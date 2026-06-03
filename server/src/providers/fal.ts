import { promises as fs } from "node:fs";
import { fal } from "@fal-ai/client";
import { getModel } from "../registry.js";
import { resolveAssetPath } from "../paths.js";
import type {
  CostEstimate,
  OutputKind,
  ProviderAdapter,
  ProviderRunArgs,
  ProviderRunResult,
  RawOutput,
  ResolvedInput,
} from "../types.js";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  fal.config({ credentials: key });
  configured = true;
}

function resolutionFactor(res: unknown): number {
  switch (res) {
    case "480p":
      return 0.6;
    case "1080p":
      return 2.0;
    default:
      return 1.0; // 720p baseline
  }
}

// Best-effort extraction of output urls from fal's varied response shapes.
function extractOutputs(data: unknown, kind: OutputKind): RawOutput[] {
  const out: RawOutput[] = [];
  const d = data as Record<string, any>;
  if (!d) return out;

  const pushImg = (o: any) => {
    if (o?.url) out.push({ kind: "image", url: o.url, width: o.width, height: o.height });
  };
  const pushVid = (o: any) => {
    if (o?.url) out.push({ kind: "video", url: o.url, durationSec: o.duration });
  };

  if (kind === "image") {
    if (Array.isArray(d.images)) d.images.forEach(pushImg);
    else if (d.image) pushImg(d.image);
    else if (typeof d.url === "string") out.push({ kind: "image", url: d.url });
  } else {
    if (d.video) pushVid(d.video);
    else if (Array.isArray(d.videos)) d.videos.forEach(pushVid);
    else if (typeof d.url === "string") out.push({ kind: "video", url: d.url });
  }
  return out;
}

// fal must fetch input images from a reachable URL. Local /assets/* files are
// uploaded to fal storage; already-public URLs pass through.
async function toFalUrl(url: string): Promise<string> {
  if (/^https?:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url))
    return url;
  const filePath = resolveAssetPath(url);
  const data = await fs.readFile(filePath);
  const file = new File([data], filePath.split("/").pop() || "input");
  return await fal.storage.upload(file);
}

function buildInput(
  modelId: string,
  args: ProviderRunArgs,
): Record<string, unknown> {
  const { prompt, params, inputs } = args;
  const imageUrls = inputs.map((i) => i.url);
  const input: Record<string, unknown> = { prompt, ...params };

  if (modelId === "fal/gpt-image-2") {
    if (params.n != null) input.num_images = params.n;
    delete input.n;
    if (params.size) {
      input.image_size = params.size;
    }
    // image_edit passes the target image (+ optional refs) as reference images
    if (imageUrls.length > 0) input.image_urls = imageUrls;
  } else if (modelId === "fal/seedance-2.0") {
    // i2v: first input image seeds the video
    if (imageUrls.length > 0) input.image_url = imageUrls[0];
  }
  return input;
}

export const falAdapter: ProviderAdapter = {
  id: "fal",
  supports(model) {
    return model.startsWith("fal/");
  },
  estimateCost(model, params, inputs): CostEstimate {
    const spec = getModel(model);
    if (spec?.kind === "video") {
      const dur = Number(params.duration ?? spec.defaults.duration ?? 5);
      const amount =
        0.3 * dur * resolutionFactor(params.resolution ?? spec.defaults.resolution);
      return {
        amount: Number(amount.toFixed(2)),
        currency: "USD",
        note: `${dur}s @ ${params.resolution ?? spec.defaults.resolution}`,
      };
    }
    // mai-image-2.5: flat per-image rate, count via num_images
    if (model === "fal/mai-image-2.5") {
      const cnt = Number(params.num_images ?? 1);
      return {
        amount: Number((0.03 * cnt).toFixed(2)),
        currency: "USD",
        note: `${cnt} image(s)`,
      };
    }
    const n = Number(params.n ?? 1);
    const per = params.quality === "high" ? 0.17 : params.quality === "low" ? 0.02 : 0.07;
    void inputs;
    return {
      amount: Number((per * n).toFixed(2)),
      currency: "USD",
      note: `${n} image(s)`,
    };
  },
  async run(model, args): Promise<ProviderRunResult> {
    ensureConfigured();
    const spec = getModel(model);
    if (!spec) throw new Error(`unknown model ${model}`);
    const falInputs = await Promise.all(
      args.inputs.map(async (i) => ({ ...i, url: await toFalUrl(i.url) })),
    );
    const input = buildInput(model, { ...args, inputs: falInputs });
    const result = await fal.subscribe(spec.path, { input, logs: false });
    const outputs = extractOutputs(result.data, spec.kind);
    if (outputs.length === 0)
      throw new Error(
        `fal returned no ${spec.kind} outputs (endpoint ${spec.path})`,
      );
    const cost = this.estimateCost(model, args.params, args.inputs).amount;
    return { outputs, cost };
  },
};

export type { ResolvedInput };
