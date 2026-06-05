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
// fal's hosted safety filter intermittently returns a 422 content_policy_violation
// on plainly benign prompts; the identical prompt then succeeds on retry (verified
// 2026-06-04 against ideogram/v4: 1 spurious block, then 5/5 OK). Same flaky behaviour
// was seen with mai-image-2.5. Retry ONLY this specific transient block — genuine
// param/validation 422s are left to fail fast and surface their real error.
function isTransientSafetyBlock(err: unknown): boolean {
  const e = err as { message?: string; body?: unknown };
  const hay = `${e?.message ?? ""} ${JSON.stringify(e?.body ?? "")}`.toLowerCase();
  return hay.includes("content_policy_violation") || hay.includes("safety filter");
}

async function subscribeWithRetry(
  path: string,
  input: Record<string, unknown>,
): Promise<Awaited<ReturnType<typeof fal.subscribe>>> {
  const maxAttempts = 4; // 1 try + 3 retries; ~3 consecutive blocks ⇒ treat as genuine
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fal.subscribe(path, { input, logs: false });
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isTransientSafetyBlock(err)) {
        // A fixed seed makes the filter verdict deterministic: retries regenerate the
        // identical image and it gets re-flagged, so plain retry can't escape (verified
        // 2026-06-04 — seed 12345 + a benign poster prompt blocked 3/3). Perturb the seed
        // so each retry attempts a genuinely different image. Only fires after a block,
        // when the user's exact-seed output is unavailable anyway.
        if (typeof input.seed === "number") input.seed = input.seed + attempt;
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function toFalUrl(url: string): Promise<string> {
  if (/^https?:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url))
    return url;
  const filePath = resolveAssetPath(url);
  const data = await fs.readFile(filePath);
  const file = new File([data], filePath.split("/").pop() || "input");
  return await fal.storage.upload(file);
}

function mimeFromPath(p: string): string {
  const ext = p.toLowerCase().split("?")[0].split(".").pop();
  return ext === "jpg" || ext === "jpeg"
    ? "image/jpeg"
    : ext === "webp"
      ? "image/webp"
      : ext === "gif"
        ? "image/gif"
        : "image/png";
}

// mai-image-2.5/edit cannot process images handed to it as a URL: a fal.storage
// (or otherwise) image URL yields a *misleading* 422 {loc:["body","prompt"],
// "Could not process the request. Please try again with a different prompt."} —
// it reads as a content block but is purely about image delivery. Verified
// 2026-06-04: the IDENTICAL image+prompt succeeds inlined as a data URI and fails
// as a fal.media URL, across BOTH fal.run and the queue API (4-cell isolation).
// So for this endpoint we inline the bytes instead of uploading to fal.storage.
async function toDataUri(url: string): Promise<string> {
  if (/^data:/.test(url)) return url;
  let buf: Buffer;
  let mime: string;
  if (/^https?:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url)) {
    const res = await fetch(url);
    buf = Buffer.from(await res.arrayBuffer());
    mime = res.headers.get("content-type") || mimeFromPath(url);
  } else {
    const filePath = resolveAssetPath(url);
    buf = await fs.readFile(filePath);
    mime = mimeFromPath(filePath);
  }
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function buildInput(
  modelId: string,
  args: ProviderRunArgs,
): Record<string, unknown> {
  const { prompt, params, inputs } = args;
  const imageUrls = inputs.map((i) => i.url);
  // Forward ONLY params declared in this model's own schema — never blind-spread.
  // Two sources of junk would otherwise reach fal: switching a node's model keeps
  // the previous model's params (updateNode in canvas.ts merges defaults under the
  // existing params rather than pruning), and the web UI persists an internal
  // `aspect` float in params (the aspect-lock value). fal currently ignores unknown
  // fields so this never broke, but a stricter validator would 422 on them — and it
  // brings fal in line with the kie adapter, which builds inputs by named field.
  const allowed = new Set((getModel(modelId)?.paramSchema ?? []).map((p) => p.key));
  const input: Record<string, unknown> = { prompt };
  for (const [k, v] of Object.entries(params)) if (allowed.has(k)) input[k] = v;

  if (modelId === "fal/gpt-image-2") {
    if (params.n != null) input.num_images = params.n;
    delete input.n;
    if (params.size) {
      input.image_size = params.size;
    }
    // image_edit passes the target image (+ optional refs) as reference images
    if (imageUrls.length > 0) input.image_urls = imageUrls;
  } else if (modelId === "fal/mai-image-2.5-edit") {
    // i2i edit takes image_urls but accepts AT MOST ONE image (2 -> 422). Cap to 1.
    if (imageUrls.length > 0) input.image_urls = imageUrls.slice(0, 1);
  } else if (modelId === "fal/seedance-2.0") {
    // i2v: first input image seeds the video
    if (imageUrls.length > 0) input.image_url = imageUrls[0];
  } else if (modelId === "fal/ideogram-v4") {
    // ParamField has no boolean type; the select yields "true"/"false" strings.
    // fal expects a real boolean — coerce it (the string "false" is truthy).
    if (typeof input.enable_prompt_expansion === "string")
      input.enable_prompt_expansion = input.enable_prompt_expansion === "true";
  } else if (modelId === "fal/krea-v2") {
    // style_strength is a per-reference field, NOT a top-level fal param — pull it out
    // of the spread input so it never reaches the API as an unknown key.
    const strength =
      typeof input.style_strength === "number" ? input.style_strength : undefined;
    delete input.style_strength;
    // Any connected image becomes a style reference (the endpoint has no "edit target",
    // only image_style_references: list of {image_url, strength?}). Cap at the API's 10.
    if (imageUrls.length > 0)
      input.image_style_references = imageUrls.slice(0, 10).map((url) =>
        strength === undefined ? { image_url: url } : { image_url: url, strength },
      );
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
    // mai-image-2.5 (T2I) and its i2i edit variant: flat per-image, count via num_images
    if (model === "fal/mai-image-2.5" || model === "fal/mai-image-2.5-edit") {
      const cnt = Number(params.num_images ?? 1);
      return {
        amount: Number((0.03 * cnt).toFixed(2)),
        currency: "USD",
        note: `${cnt} image(s)`,
      };
    }
    // ideogram/v4: per-MP tiered by rendering_speed (+flat $0.03 if expansion).
    // fal's image_size enums are all ≈1MP, so approximate 1MP/image.
    if (model === "fal/ideogram-v4") {
      const cnt = Number(params.num_images ?? 1);
      const speed = String(params.rendering_speed ?? "BALANCED");
      const perMp = speed === "TURBO" ? 0.03 : speed === "QUALITY" ? 0.1 : 0.06;
      const expand =
        String(params.enable_prompt_expansion ?? "false") === "true" ? 0.03 : 0;
      return {
        amount: Number(((perMp + expand) * cnt).toFixed(2)),
        currency: "USD",
        note: `${cnt} img @ ${speed}${expand ? " +expand" : ""}`,
      };
    }
    // krea/v2 large: flat per-image; style references bump it to $0.065.
    if (model === "fal/krea-v2") {
      const withRefs = inputs.length > 0;
      return {
        amount: withRefs ? 0.065 : 0.06,
        currency: "USD",
        note: withRefs ? "1 image +style-ref" : "1 image",
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
    // mai edit needs its input image inlined (URL delivery 422s — see toDataUri).
    const inlineImages = model === "fal/mai-image-2.5-edit";
    const falInputs = await Promise.all(
      args.inputs.map(async (i) => ({
        ...i,
        url: inlineImages ? await toDataUri(i.url) : await toFalUrl(i.url),
      })),
    );
    const input = buildInput(model, { ...args, inputs: falInputs });
    // fal/gpt-image-2 uses split subpaths: T2I (spec.path) vs edit-image (needs an
    // input image). Route to the edit endpoint whenever an image is connected.
    const endpointPath =
      model === "fal/gpt-image-2" && falInputs.length > 0
        ? "fal-ai/gpt-image-1/edit-image"
        : spec.path;
    const result = await subscribeWithRetry(endpointPath, input);
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
