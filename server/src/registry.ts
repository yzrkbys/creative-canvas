import type { ModelSpec, NodeType } from "./types.js";

// Model registry (spec §3).
// `path` is the provider endpoint id: for KIE it is the exact `model` slug sent
// to POST /api/v1/jobs/createTask; for fal it is the fal endpoint id.
//
// Ordering note: KIE models are listed first within each kind so that new nodes
// default to a model that runs with the currently-configured key (KIE_API_KEY).
// The fal entries are kept for when a FAL_KEY is configured.
export const MODELS: ModelSpec[] = [
  // ---------------- IMAGE ----------------
  {
    id: "kie/nano-banana-2",
    provider: "kie",
    path: "nano-banana-2",
    kind: "image",
    nodeTypes: ["image_gen", "image_edit"],
    priceHint: "≈$0.04–0.09 / image",
    paramSchema: [
      {
        key: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"],
      },
      { key: "resolution", label: "Resolution", type: "select", options: ["1K", "2K", "4K"] },
      { key: "output_format", label: "Format", type: "select", options: ["png", "jpg"] },
    ],
    defaults: { aspect_ratio: "auto", resolution: "2K", output_format: "png" },
  },
  {
    id: "kie/nano-banana-pro",
    provider: "kie",
    path: "nano-banana-pro",
    kind: "image",
    nodeTypes: ["image_gen", "image_edit"],
    priceHint: "≈$0.05–0.12 / image",
    paramSchema: [
      {
        key: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
      },
      { key: "resolution", label: "Resolution", type: "select", options: ["1K", "2K", "4K"] },
      { key: "output_format", label: "Format", type: "select", options: ["png", "jpg"] },
    ],
    defaults: { aspect_ratio: "auto", resolution: "2K", output_format: "png" },
  },
  {
    id: "kie/seedream-v4",
    provider: "kie",
    path: "bytedance/seedream-v4-text-to-image",
    kind: "image",
    nodeTypes: ["image_gen"],
    priceHint: "≈$0.03 / image",
    paramSchema: [
      {
        key: "image_size",
        label: "Size",
        type: "select",
        options: [
          "square",
          "square_hd",
          "portrait_4_3",
          "portrait_3_2",
          "portrait_16_9",
          "landscape_4_3",
          "landscape_3_2",
          "landscape_16_9",
          "landscape_21_9",
        ],
      },
      { key: "image_resolution", label: "Resolution", type: "select", options: ["1K", "2K", "4K"] },
      { key: "max_images", label: "Count", type: "number", min: 1, max: 6, step: 1 },
    ],
    defaults: { image_size: "square_hd", image_resolution: "2K", max_images: 1 },
  },
  {
    id: "kie/flux-2-pro",
    provider: "kie",
    path: "flux-2/pro-text-to-image",
    kind: "image",
    nodeTypes: ["image_gen"],
    priceHint: "≈$0.05 / image",
    paramSchema: [
      {
        key: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"],
      },
      { key: "resolution", label: "Resolution", type: "select", options: ["1K", "2K"] },
    ],
    defaults: { aspect_ratio: "1:1", resolution: "1K" },
  },
  {
    id: "kie/gpt-image-2",
    provider: "kie",
    path: "gpt-image-2-text-to-image",
    kind: "image",
    nodeTypes: ["image_gen"],
    priceHint: "≈$0.04–0.12 / image",
    paramSchema: [
      {
        key: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      },
      { key: "resolution", label: "Resolution", type: "select", options: ["1K", "2K", "4K"] },
    ],
    defaults: { aspect_ratio: "auto", resolution: "1K" },
  },
  {
    id: "kie/gpt-image-2-edit",
    provider: "kie",
    path: "gpt-image-2-image-to-image",
    kind: "image",
    nodeTypes: ["image_edit"],
    priceHint: "≈$0.04–0.12 / image",
    paramSchema: [
      {
        key: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: ["auto", "1:1", "9:16", "16:9", "4:3", "3:4"],
      },
      { key: "resolution", label: "Resolution", type: "select", options: ["1K", "2K", "4K"] },
    ],
    defaults: { aspect_ratio: "auto", resolution: "1K" },
  },
  {
    id: "kie/nano-banana-edit",
    provider: "kie",
    path: "google/nano-banana-edit",
    kind: "image",
    nodeTypes: ["image_edit"],
    priceHint: "≈$0.04 / image",
    paramSchema: [
      {
        key: "image_size",
        label: "Aspect",
        type: "select",
        options: ["auto", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9"],
      },
      { key: "output_format", label: "Format", type: "select", options: ["png", "jpeg"] },
    ],
    defaults: { image_size: "auto", output_format: "png" },
  },
  {
    id: "kie/qwen-image-edit",
    provider: "kie",
    path: "qwen/image-edit",
    kind: "image",
    nodeTypes: ["image_edit"],
    priceHint: "≈$0.02 / image",
    paramSchema: [
      {
        key: "image_size",
        label: "Size",
        type: "select",
        options: [
          "square",
          "square_hd",
          "portrait_4_3",
          "portrait_16_9",
          "landscape_4_3",
          "landscape_16_9",
        ],
      },
      { key: "num_images", label: "Count", type: "number", min: 1, max: 4, step: 1 },
      { key: "output_format", label: "Format", type: "select", options: ["png", "jpeg"] },
    ],
    defaults: { image_size: "square_hd", num_images: 1, output_format: "png" },
  },
  {
    id: "fal/gpt-image-2",
    provider: "fal",
    path: "fal-ai/gpt-image-1",
    kind: "image",
    nodeTypes: ["image_gen", "image_edit"],
    priceHint: "$0.01–0.41 / image (needs FAL_KEY)",
    paramSchema: [
      { key: "size", label: "Size", type: "select", options: ["1024x1024", "1536x1024", "1024x1536"] },
      { key: "quality", label: "Quality", type: "select", options: ["low", "medium", "high"] },
      { key: "n", label: "Count", type: "number", min: 1, max: 4, step: 1 },
    ],
    defaults: { size: "1024x1024", quality: "medium", n: 1 },
  },

  // ---------------- VIDEO ----------------
  {
    id: "kie/seedance-2.0",
    provider: "kie",
    path: "bytedance/seedance-2",
    kind: "video",
    nodeTypes: ["video_gen"],
    priceHint: "≈$0.12/s× res (概算)",
    paramSchema: [
      {
        key: "mode",
        label: "Mode",
        type: "select",
        // t2v=text only / i2v=first frame / flf=first+last / r2v=references
        options: ["t2v", "i2v", "flf", "r2v"],
      },
      { key: "duration", label: "Duration (s)", type: "number", min: 4, max: 15, step: 1 },
      { key: "resolution", label: "Resolution", type: "select", options: ["480p", "720p", "1080p"] },
      {
        key: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
      },
      { key: "generate_audio", label: "Audio", type: "select", options: ["false", "true"] },
    ],
    defaults: {
      mode: "i2v",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "16:9",
      generate_audio: "false",
    },
  },
  {
    id: "kie/seedance-2.0-fast",
    provider: "kie",
    path: "bytedance/seedance-2-fast",
    kind: "video",
    nodeTypes: ["video_gen"],
    priceHint: "≈$0.022/s× res (概算・低コスト版)",
    paramSchema: [
      { key: "mode", label: "Mode", type: "select", options: ["t2v", "i2v", "flf", "r2v"] },
      { key: "duration", label: "Duration (s)", type: "number", min: 4, max: 15, step: 1 },
      // fast tier does not offer 1080p
      { key: "resolution", label: "Resolution", type: "select", options: ["480p", "720p"] },
      {
        key: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
      },
      { key: "generate_audio", label: "Audio", type: "select", options: ["false", "true"] },
    ],
    defaults: {
      mode: "i2v",
      duration: 5,
      resolution: "720p",
      aspect_ratio: "16:9",
      generate_audio: "false",
    },
  },
  {
    id: "kie/gemini-omni-video",
    provider: "kie",
    path: "gemini-omni-video",
    kind: "video",
    nodeTypes: ["video_gen"],
    priceHint: "従量・要確認（4k/長尺ほど高額。概算 ~$0.15/s×res）",
    paramSchema: [
      // duration is REQUIRED by the API (seconds): 4 | 6 | 8 | 10
      { key: "duration", label: "Duration (s)", type: "select", options: ["4", "6", "8", "10"] },
      { key: "aspect_ratio", label: "Aspect", type: "select", options: ["16:9", "9:16"] },
      { key: "resolution", label: "Resolution", type: "select", options: ["720p", "1080p", "4k"] },
      // optional deterministic seed [0, 2147483647]
      { key: "seed", label: "Seed", type: "number", min: 0, max: 2147483647, step: 1 },
    ],
    defaults: { duration: "8", aspect_ratio: "16:9", resolution: "720p" },
  },
  {
    id: "kie/kling-3.0",
    provider: "kie",
    path: "kling-3.0/video",
    kind: "video",
    nodeTypes: ["video_gen"],
    priceHint: "≈$0.10/s× mode (概算)",
    paramSchema: [
      { key: "duration", label: "Duration (s)", type: "number", min: 3, max: 15, step: 1 },
      { key: "mode", label: "Mode", type: "select", options: ["std", "pro", "4K"] },
      { key: "aspect_ratio", label: "Aspect", type: "select", options: ["16:9", "9:16", "1:1"] },
      { key: "sound", label: "Sound", type: "select", options: ["false", "true"] },
    ],
    defaults: { duration: 5, mode: "std", aspect_ratio: "16:9", sound: "false" },
  },
  {
    id: "kie/kling-2.6",
    provider: "kie",
    path: "kling-2.6/text-to-video",
    kind: "video",
    nodeTypes: ["video_gen"],
    priceHint: "≈$0.07/s (概算)",
    paramSchema: [
      { key: "duration", label: "Duration (s)", type: "select", options: ["5", "10"] },
      { key: "aspect_ratio", label: "Aspect", type: "select", options: ["16:9", "9:16", "1:1"] },
      { key: "sound", label: "Sound", type: "select", options: ["false", "true"] },
    ],
    defaults: { duration: "5", aspect_ratio: "16:9", sound: "false" },
  },
  {
    id: "kie/wan-2.6",
    provider: "kie",
    path: "wan/2-6-image-to-video",
    kind: "video",
    nodeTypes: ["video_gen"],
    priceHint: "≈$0.08/s (概算・I2V)",
    paramSchema: [
      { key: "duration", label: "Duration (s)", type: "select", options: ["5", "10", "15"] },
      { key: "resolution", label: "Resolution", type: "select", options: ["720p", "1080p"] },
    ],
    defaults: { duration: "5", resolution: "1080p" },
  },
  {
    id: "kie/hailuo-2.3",
    provider: "kie",
    path: "hailuo/2-3-image-to-video-pro",
    kind: "video",
    nodeTypes: ["video_gen"],
    priceHint: "≈$0.08/s (概算・I2V)",
    paramSchema: [
      { key: "duration", label: "Duration (s)", type: "select", options: ["6", "10"] },
      { key: "resolution", label: "Resolution", type: "select", options: ["768P", "1080P"] },
    ],
    defaults: { duration: "6", resolution: "768P" },
  },
  {
    id: "fal/seedance-2.0",
    provider: "fal",
    path: "fal-ai/bytedance/seedance/v1/pro",
    kind: "video",
    nodeTypes: ["video_gen"],
    priceHint: "$0.30 / sec (720p, needs FAL_KEY)",
    paramSchema: [
      { key: "duration", label: "Duration (s)", type: "number", min: 1, max: 12, step: 1 },
      { key: "resolution", label: "Resolution", type: "select", options: ["480p", "720p", "1080p"] },
      { key: "mode", label: "Mode", type: "select", options: ["t2v", "i2v"] },
    ],
    defaults: { duration: 5, resolution: "720p", mode: "i2v" },
  },
  {
    id: "xai/grok-imagine-video-1.5",
    provider: "xai",
    path: "grok-imagine-video-1.5-preview",
    kind: "video",
    nodeTypes: ["video_gen"],
    priceHint: "≈$0.08/s (xAI direct・720p上限・i2v/t2v)",
    paramSchema: [
      // i2v=first frame (image_in) / t2v=text only. (1.5-preview は r2v 非対応)
      { key: "mode", label: "Mode", type: "select", options: ["i2v", "t2v"] },
      { key: "duration", label: "Duration (s)", type: "number", min: 1, max: 15, step: 1 },
      { key: "resolution", label: "Resolution", type: "select", options: ["480p", "720p"] },
      {
        key: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"],
      },
    ],
    defaults: { mode: "i2v", duration: 8, resolution: "720p", aspect_ratio: "16:9" },
  },
  {
    id: "kie/topaz-video-upscale",
    provider: "kie",
    path: "topaz/video-upscale",
    kind: "video",
    nodeTypes: ["video_upscale"],
    priceHint: "≈$0.4–0.8 (概算)",
    paramSchema: [
      { key: "upscale_factor", label: "Factor", type: "select", options: ["1", "2", "4"] },
    ],
    defaults: { upscale_factor: "2" },
  },

  // ---------------- TEXT ----------------
  {
    id: "builtin/web-clip",
    provider: "builtin",
    path: "web-clip",
    kind: "text",
    nodeTypes: ["web_clip"],
    priceHint: "free (fetch)",
    paramSchema: [
      { key: "url", label: "URL", type: "string" },
      { key: "maxChars", label: "Max chars", type: "number", min: 500, max: 50000, step: 500 },
    ],
    defaults: { url: "", maxChars: 12000 },
  },
];

export function getModel(id: string): ModelSpec | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelsForType(type: NodeType): ModelSpec[] {
  return MODELS.filter((m) => m.nodeTypes.includes(type));
}

export function defaultModelFor(type: NodeType): string {
  const m = modelsForType(type)[0];
  return m ? m.id : "";
}
