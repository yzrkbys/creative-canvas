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

// xAI Grok Imagine video — async job model:
//   POST /v1/videos/generations -> { request_id }
//   poll GET /v1/videos/{request_id} -> { status, video: { url } }
// Docs: https://docs.x.ai/developers/model-capabilities/video/generation
// Verified working with model "grok-imagine-video-1.5-preview" (i2v/t2v).
const BASE = process.env.XAI_API_BASE ?? "https://api.x.ai/v1";
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 8 * 60 * 1000;

function key(): string {
  const k = process.env.XAI_API_KEY;
  if (!k) throw new Error("XAI_API_KEY is not set");
  return k;
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// xAI accepts a public https URL or a base64 data URI for image inputs.
// Local /assets/* files (and localhost urls) are inlined as data URIs.
async function toXaiUrl(url: string): Promise<string> {
  if (/^https?:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url)) return url;
  const filePath = resolveAssetPath(url);
  const buf = await fs.readFile(filePath);
  const ext = (path.extname(filePath).slice(1) || "png").toLowerCase();
  return `data:${MIME[ext] ?? "image/png"};base64,${buf.toString("base64")}`;
}

async function xai<T = any>(
  method: string,
  apiPath: string,
  body?: unknown,
): Promise<{ status: number; json: T }> {
  const res = await fetch(`${BASE}${apiPath}`, {
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
    throw new Error(`xAI ${apiPath} non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  return { status: res.status, json: json as T };
}

// Map canvas node (prompt + params + port-aware inputs) to the xAI request body.
async function buildBody(
  modelId: string,
  prompt: string,
  params: Record<string, unknown>,
  inputs: ResolvedInput[],
): Promise<Record<string, unknown>> {
  const spec = getModel(modelId);
  const mode = String(params.mode ?? "i2v");
  const byPort = (p: string) => inputs.filter((i) => i.port === p).map((i) => i.url);

  const body: Record<string, unknown> = {
    model: spec?.path ?? "grok-imagine-video-1.5-preview",
    prompt,
    duration: Number(params.duration ?? 8),
    resolution: params.resolution ?? "720p",
    aspect_ratio: params.aspect_ratio ?? "16:9",
  };

  if (mode === "i2v") {
    const first = byPort("image_in")[0];
    if (!first) throw new Error("i2v mode needs a first-frame image on image_in");
    body.image = { url: await toXaiUrl(first) };
  }
  // t2v: prompt only.
  // (Grok Imagine 1.5-preview does not support reference_images / r2v.)
  return body;
}

function estimate(_model: string, params: Record<string, unknown>): CostEstimate {
  const dur = Number(params.duration ?? 8);
  const amount = Number((0.08 * dur).toFixed(2));
  return {
    amount,
    currency: "USD",
    note: `grok-imagine-video 1.5 ${dur}s ${params.resolution ?? "720p"} (概算)`,
  };
}

async function poll(requestId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { json } = await xai<any>("GET", `/videos/${encodeURIComponent(requestId)}`);
    const status = json?.status;
    if (status === "done") {
      const url = json?.video?.url;
      if (!url) throw new Error(`xAI video ${requestId} reported done but no video.url`);
      return url;
    }
    if (status === "failed" || status === "expired") {
      throw new Error(`xAI video ${status}: ${json?.error?.message ?? json?.error ?? "unknown"}`);
    }
    await new Promise((rs) => setTimeout(rs, POLL_INTERVAL_MS));
  }
  throw new Error(`xAI video ${requestId} timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

export const xaiAdapter: ProviderAdapter = {
  id: "xai",
  supports(model) {
    return model.startsWith("xai/");
  },
  estimateCost(model, params) {
    return estimate(model, params);
  },
  async run(model, args: ProviderRunArgs) {
    const body = await buildBody(model, args.prompt, args.params, args.inputs);
    const { status, json } = await xai<any>("POST", "/videos/generations", body);
    if (status !== 200 && status !== 201) {
      const msg = json?.error ?? json?.message ?? JSON.stringify(json).slice(0, 200);
      throw new Error(`xAI /videos/generations HTTP ${status}: ${msg}`);
    }
    let url: string | undefined = json?.video?.url;
    if (!url) {
      const requestId = json?.request_id ?? json?.id;
      if (!requestId) throw new Error(`xAI /videos/generations returned no request_id or video`);
      url = await poll(requestId);
    }
    const outputs: RawOutput[] = [{ kind: "video", url }];
    return { outputs, cost: estimate(model, args.params).amount };
  },
};
