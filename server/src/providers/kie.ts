import { promises as fs } from "node:fs";
import path from "node:path";
import { getModel } from "../registry.js";
import { resolveAssetPath } from "../paths.js";
import type {
  CostEstimate,
  ProviderAdapter,
  ProviderRunArgs,
  RawOutput,
  ResolvedInput,
} from "../types.js";

// KIE AI uses an async job model: createTask -> poll recordInfo -> resultJson.
// Docs: https://docs.kie.ai
const BASE = process.env.KIE_API_BASE ?? "https://api.kie.ai";
// The file-upload API lives on a separate host from the jobs API.
const UPLOAD_BASE = process.env.KIE_UPLOAD_BASE ?? "https://kieai.redpandaai.co";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 8 * 60 * 1000;

function key(): string {
  const k = process.env.KIE_API_KEY;
  if (!k) throw new Error("KIE_API_KEY is not set");
  return k;
}

async function kie<T = any>(
  method: string,
  apiPath: string,
  body?: unknown,
  base: string = BASE,
): Promise<T> {
  const res = await fetch(`${base}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${key()}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`KIE ${apiPath} non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(json.msg ?? `KIE ${apiPath} HTTP ${res.status}`);
  return json as T;
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
};

// KIE must fetch inputs from a reachable URL. Local /assets/* files are uploaded
// to KIE temp storage (base64); already-public URLs pass through.
async function toKieUrl(url: string): Promise<string> {
  if (/^https?:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url)) return url;
  const filePath = resolveAssetPath(url);
  const name = path.basename(filePath);
  const buf = await fs.readFile(filePath);
  const ext = (path.extname(name).slice(1) || "png").toLowerCase();
  const dataUrl = `data:${MIME[ext] ?? "application/octet-stream"};base64,${buf.toString("base64")}`;
  const out = await kie<any>(
    "POST",
    "/api/file-base64-upload",
    { base64Data: dataUrl, uploadPath: "canvas/inputs", fileName: name },
    UPLOAD_BASE,
  );
  const link = out?.data?.downloadUrl;
  if (!link) throw new Error(`KIE upload failed: ${JSON.stringify(out).slice(0, 200)}`);
  return link;
}

// Per-model input mapping (KIE field names differ by model). `inputs` are
// port-aware and already converted to KIE-reachable URLs.
function buildInput(
  modelId: string,
  prompt: string,
  params: Record<string, unknown>,
  inputs: ResolvedInput[],
): Record<string, unknown> {
  const urls = inputs.map((i) => i.url);
  const byPort = (p: string) => inputs.filter((i) => i.port === p).map((i) => i.url);
  const bool = (v: unknown) => v === true || v === "true";

  if (modelId === "kie/nano-banana-2") {
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: params.aspect_ratio ?? "auto",
      resolution: params.resolution ?? "2K",
      output_format: params.output_format ?? "png",
    };
    if (urls.length > 0) input.image_input = urls.slice(0, 14);
    return input;
  }

  if (modelId === "kie/nano-banana-pro") {
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: params.aspect_ratio ?? "auto",
      resolution: params.resolution ?? "2K",
      output_format: params.output_format ?? "png",
    };
    if (urls.length > 0) input.image_input = urls.slice(0, 8);
    return input;
  }

  if (modelId === "kie/seedream-v4") {
    return {
      prompt,
      image_size: params.image_size ?? "square_hd",
      image_resolution: params.image_resolution ?? "2K",
      max_images: Number(params.max_images ?? 1),
    };
  }

  if (modelId === "kie/flux-2-pro") {
    return {
      prompt,
      aspect_ratio: params.aspect_ratio ?? "1:1",
      resolution: params.resolution ?? "1K",
    };
  }

  if (modelId === "kie/gpt-image-2") {
    return {
      prompt,
      aspect_ratio: params.aspect_ratio ?? "auto",
      resolution: params.resolution ?? "1K",
    };
  }

  if (modelId === "kie/gpt-image-2-edit") {
    if (urls.length === 0)
      throw new Error("gpt-image-2 (i2i) needs at least one input image (connect to image_in)");
    return {
      prompt,
      input_urls: urls.slice(0, 16),
      aspect_ratio: params.aspect_ratio ?? "auto",
      resolution: params.resolution ?? "1K",
    };
  }

  if (modelId === "kie/nano-banana-edit") {
    if (urls.length === 0)
      throw new Error("nano-banana-edit needs at least one input image (connect to image_in)");
    return {
      prompt,
      image_urls: urls.slice(0, 10),
      image_size: params.image_size ?? "auto",
      output_format: params.output_format ?? "png",
    };
  }

  if (modelId === "kie/qwen-image-edit") {
    const img = byPort("image_in")[0] ?? urls[0];
    if (!img) throw new Error("qwen/image-edit needs an input image on image_in");
    return {
      prompt,
      image_url: img,
      image_size: params.image_size ?? "square_hd",
      num_images: String(params.num_images ?? 1),
      output_format: params.output_format ?? "png",
    };
  }

  if (modelId === "kie/kling-3.0") {
    const input: Record<string, unknown> = {
      prompt,
      duration: String(params.duration ?? 5),
      mode: params.mode ?? "std",
      aspect_ratio: params.aspect_ratio ?? "16:9",
      sound: bool(params.sound),
      multi_shots: false,
    };
    const img = byPort("image_in")[0] ?? urls[0];
    if (img) input.image_urls = [img];
    return input;
  }

  if (modelId === "kie/kling-2.6") {
    return {
      prompt,
      duration: String(params.duration ?? 5),
      aspect_ratio: params.aspect_ratio ?? "16:9",
      sound: bool(params.sound),
    };
  }

  if (modelId === "kie/wan-2.6") {
    const img = byPort("image_in")[0] ?? urls[0];
    if (!img) throw new Error("wan-2.6 (i2v) needs an input image on image_in");
    return {
      prompt,
      image_urls: [img],
      duration: String(params.duration ?? 5),
      resolution: params.resolution ?? "1080p",
    };
  }

  if (modelId === "kie/hailuo-2.3") {
    const img = byPort("image_in")[0] ?? urls[0];
    if (!img) throw new Error("hailuo-2.3 (i2v) needs an input image on image_in");
    return {
      prompt,
      image_url: img,
      duration: String(params.duration ?? 6),
      resolution: params.resolution ?? "768P",
    };
  }

  if (
    modelId === "kie/seedance-2.0" ||
    modelId === "kie/seedance-2.0-fast" ||
    modelId === "kie/seedance-2.0-mini"
  ) {
    const mode = String(params.mode ?? "i2v");
    const input: Record<string, unknown> = {
      prompt,
      duration: Number(params.duration ?? 5),
      resolution: params.resolution ?? "720p",
      aspect_ratio: params.aspect_ratio ?? "16:9",
      generate_audio: bool(params.generate_audio),
    };
    const first = byPort("image_in")[0];
    const last = byPort("last_frame_in")[0];
    const refImgs = byPort("ref_in");
    const refVids = byPort("ref_video_in");
    if (mode === "i2v") {
      if (!first) throw new Error("i2v mode needs a first-frame image on image_in");
      input.first_frame_url = first;
    } else if (mode === "flf") {
      if (!first || !last)
        throw new Error("flf mode needs both image_in (first) and last_frame_in (last)");
      input.first_frame_url = first;
      input.last_frame_url = last;
    } else if (mode === "r2v") {
      if (refImgs.length === 0 && refVids.length === 0)
        throw new Error("r2v mode needs at least one reference (ref_in image or ref_video_in)");
      if (refImgs.length) input.reference_image_urls = refImgs.slice(0, 9);
      if (refVids.length) input.reference_video_urls = refVids.slice(0, 3);
    }
    // t2v: prompt only
    return input;
  }

  if (modelId === "kie/happyhorse-1.1") {
    // Alibaba HappyHorse 1.1: T2V / I2V (first frame) / R2V (1–9 reference images).
    // Field names inferred from public HappyHorse API docs — see registry note.
    const mode = String(params.mode ?? "i2v");
    const input: Record<string, unknown> = {
      prompt,
      duration: Number(params.duration ?? 5),
      resolution: params.resolution ?? "720p",
      aspect_ratio: params.aspect_ratio ?? "16:9",
    };
    const seed = params.seed;
    if (seed !== undefined && seed !== null && seed !== "") input.seed = Number(seed);
    const first = byPort("image_in")[0];
    const refs = byPort("ref_in");
    if (mode === "i2v") {
      if (!first) throw new Error("i2v mode needs a first-frame image on image_in");
      input.image_urls = [first];
    } else if (mode === "r2v") {
      if (refs.length === 0)
        throw new Error("r2v mode needs at least one reference image on ref_in");
      input.reference_image_urls = refs.slice(0, 9);
    }
    // t2v: prompt only
    return input;
  }

  if (modelId === "kie/gemini-omni-video") {
    // Gemini Omni "reference anything" video on KIE's unified jobs API.
    // input quota: images + videos*2 + characters <= 7.
    const input: Record<string, unknown> = {
      prompt,
      duration: Number(params.duration ?? 8),
      aspect_ratio: params.aspect_ratio ?? "16:9",
      resolution: params.resolution ?? "720p",
    };
    const seed = params.seed;
    if (seed !== undefined && seed !== null && seed !== "") input.seed = Number(seed);
    // image references: first-frame and reference-image ports (max 7 image units)
    const imgs = [...byPort("image_in"), ...byPort("ref_in")];
    const vids = byPort("ref_video_in");
    if (imgs.length) input.image_urls = imgs.slice(0, 7);
    // each video counts as 2 quota units; start/ends trim the source segment (seconds)
    if (vids.length) input.video_list = vids.slice(0, 3).map((u) => ({ url: u, start: 0, ends: 10 }));
    return input;
  }

  if (modelId === "kie/topaz-video-upscale") {
    const vid = byPort("video_in")[0] ?? inputs.find((i) => i.kind === "video")?.url;
    if (!vid)
      throw new Error("video_upscale needs a connected video on video_in");
    return { video_url: vid, upscale_factor: String(params.upscale_factor ?? "2") };
  }

  // generic fallback
  const input: Record<string, unknown> = { prompt, ...params };
  if (urls.length > 0) input.image_urls = urls;
  return input;
}

async function createTask(model: string, input: Record<string, unknown>): Promise<string> {
  const out = await kie<any>("POST", "/api/v1/jobs/createTask", { model, input });
  const taskId = out?.data?.taskId;
  if (!taskId) throw new Error(`KIE createTask returned no taskId: ${JSON.stringify(out).slice(0, 200)}`);
  return taskId;
}

interface PollResult {
  urls: string[];
  credits?: number;
}

interface RecordInfo {
  state?: string;
  urls: string[];
  failMsg?: string;
  credits?: number;
}

// KIE occasionally returns a malformed `param` echo (broken quote escaping) that
// breaks strict JSON.parse. We try strict first, then fall back to regex so a
// finished task's state/result/error are still recoverable.
async function fetchRecord(taskId: string): Promise<RecordInfo> {
  const res = await fetch(
    `${BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${key()}` } },
  );
  const text = await res.text();
  try {
    const d = (JSON.parse(text)?.data ?? {}) as Record<string, any>;
    const rj = d.resultJson ? JSON.parse(d.resultJson) : {};
    return { state: d.state, urls: rj.resultUrls ?? [], failMsg: d.failMsg, credits: d.creditsConsumed };
  } catch {
    const state = text.match(/"state":"([^"]+)"/)?.[1];
    const failMsg = text.match(/"failMsg":"([^"]*)"/)?.[1];
    let urls: string[] = [];
    const rj = text.match(/"resultJson":"((?:[^"\\]|\\.)*)"/)?.[1];
    if (rj) {
      try {
        const unescaped = rj.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        urls = JSON.parse(unescaped).resultUrls ?? [];
      } catch {
        /* ignore */
      }
    }
    return { state, urls, failMsg };
  }
}

async function poll(taskId: string): Promise<PollResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const r = await fetchRecord(taskId);
    if (r.state === "success") {
      if (!r.urls.length)
        throw new Error(`KIE task ${taskId} succeeded but returned no resultUrls`);
      return { urls: r.urls, credits: r.credits };
    }
    if (r.state === "fail") {
      throw new Error(`KIE task failed: ${r.failMsg || "unknown"}`);
    }
    await new Promise((rs) => setTimeout(rs, POLL_INTERVAL_MS));
  }
  throw new Error(`KIE task ${taskId} timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

function estimate(model: string, params: Record<string, unknown>): CostEstimate {
  if (model === "kie/nano-banana-2") {
    const res = params.resolution ?? "2K";
    const amount = res === "4K" ? 0.08 : res === "1K" ? 0.04 : 0.06;
    return { amount, currency: "USD", note: `nano-banana-2 ${res} (概算)` };
  }
  if (model === "kie/nano-banana-pro") {
    const res = params.resolution ?? "2K";
    const amount = res === "4K" ? 0.12 : res === "1K" ? 0.05 : 0.08;
    return { amount, currency: "USD", note: `nano-banana-pro ${res} (概算)` };
  }
  if (model === "kie/seedream-v4") {
    const n = Number(params.max_images ?? 1);
    return { amount: Number((0.03 * n).toFixed(2)), currency: "USD", note: `seedream-v4 ×${n} (概算)` };
  }
  if (model === "kie/flux-2-pro") {
    const res = params.resolution ?? "1K";
    const amount = res === "2K" ? 0.08 : 0.05;
    return { amount, currency: "USD", note: `flux-2-pro ${res} (概算)` };
  }
  if (model === "kie/gpt-image-2" || model === "kie/gpt-image-2-edit") {
    const res = params.resolution ?? "1K";
    const amount = res === "4K" ? 0.12 : res === "2K" ? 0.08 : 0.04;
    const edit = model.endsWith("-edit");
    return { amount, currency: "USD", note: `${edit ? "gpt-image-2-edit" : "gpt-image-2"} ${res} (概算)` };
  }
  if (model === "kie/nano-banana-edit") {
    return { amount: 0.04, currency: "USD", note: `nano-banana-edit (概算)` };
  }
  if (model === "kie/qwen-image-edit") {
    const n = Number(params.num_images ?? 1);
    return { amount: Number((0.02 * n).toFixed(2)), currency: "USD", note: `qwen-image-edit ×${n} (概算)` };
  }
  if (model === "kie/kling-3.0") {
    const dur = Number(params.duration ?? 5);
    const modeMul = params.mode === "4K" ? 3 : params.mode === "pro" ? 1.6 : 1;
    const amount = Number((0.1 * dur * modeMul).toFixed(2));
    return { amount, currency: "USD", note: `kling-3.0 ${dur}s ${params.mode ?? "std"} (概算)` };
  }
  if (model === "kie/kling-2.6") {
    const dur = Number(params.duration ?? 5);
    const amount = Number((0.07 * dur).toFixed(2));
    return { amount, currency: "USD", note: `kling-2.6 ${dur}s (概算)` };
  }
  if (model === "kie/wan-2.6") {
    const dur = Number(params.duration ?? 5);
    const resMul = params.resolution === "1080p" ? 1.3 : 1;
    const amount = Number((0.08 * dur * resMul).toFixed(2));
    return { amount, currency: "USD", note: `wan-2.6 ${dur}s ${params.resolution ?? "1080p"} (概算)` };
  }
  if (model === "kie/hailuo-2.3") {
    const dur = Number(params.duration ?? 6);
    const resMul = params.resolution === "1080P" ? 1.4 : 1;
    const amount = Number((0.08 * dur * resMul).toFixed(2));
    return { amount, currency: "USD", note: `hailuo-2.3 ${dur}s ${params.resolution ?? "768P"} (概算)` };
  }
  if (
    model === "kie/seedance-2.0" ||
    model === "kie/seedance-2.0-fast" ||
    model === "kie/seedance-2.0-mini"
  ) {
    const dur = Number(params.duration ?? 5);
    const res = params.resolution ?? "720p";
    const resMul = res === "1080p" ? 1.8 : res === "480p" ? 0.6 : 1;
    // mini is the cheapest tier, fast next, standard the priciest.
    const perSec = model.endsWith("-mini") ? 0.015 : model.endsWith("-fast") ? 0.022 : 0.12;
    const amount = Number((perSec * dur * resMul).toFixed(3));
    return {
      amount,
      currency: "USD",
      note: `${model.replace("kie/", "")} ${dur}s ${res} ${params.mode ?? ""} (概算)`,
    };
  }
  if (model === "kie/happyhorse-1.1") {
    // Advisory only; actual cost returns as creditsConsumed after the run.
    const dur = Number(params.duration ?? 5);
    const res = params.resolution ?? "720p";
    const resMul = res === "1080p" ? 1.6 : 1;
    const amount = Number((0.1 * dur * resMul).toFixed(2));
    return { amount, currency: "USD", note: `happyhorse-1.1 ${dur}s ${res} ${params.mode ?? ""} (概算)` };
  }
  if (model === "kie/gemini-omni-video") {
    // NOTE: exact KIE pricing not published here; actual cost is reported as
    // creditsConsumed after the run. This is a rough advisory estimate only.
    const dur = Number(params.duration ?? 8);
    const res = params.resolution ?? "720p";
    const resMul = res === "4k" ? 4 : res === "1080p" ? 2 : 1;
    const amount = Number((0.15 * dur * resMul).toFixed(2));
    return { amount, currency: "USD", note: `gemini-omni-video ${dur}s ${res} (概算・要確認)` };
  }
  if (model === "kie/topaz-video-upscale") {
    const f = String(params.upscale_factor ?? "2");
    const amount = f === "4" ? 0.8 : f === "1" ? 0.2 : 0.4;
    return { amount, currency: "USD", note: `topaz upscale x${f} (概算)` };
  }
  return { amount: 0, currency: "USD", note: "unknown KIE model (概算)" };
}

export const kieAdapter: ProviderAdapter = {
  id: "kie",
  supports(model) {
    return model.startsWith("kie/");
  },
  estimateCost(model, params) {
    return estimate(model, params);
  },
  async run(model, args: ProviderRunArgs) {
    const spec = getModel(model);
    if (!spec) throw new Error(`unknown model ${model}`);
    // Upload local inputs to KIE-reachable URLs, preserving their port identity.
    const resolved: ResolvedInput[] = await Promise.all(
      args.inputs.map(async (i) => ({ ...i, url: await toKieUrl(i.url) })),
    );
    const input = buildInput(model, args.prompt, args.params, resolved);
    const taskId = await createTask(spec.path, input);
    const result = await poll(taskId);
    const outputs: RawOutput[] = result.urls.map((url) => ({ kind: spec.kind, url }));
    return { outputs, cost: estimate(model, args.params).amount };
  },
};
