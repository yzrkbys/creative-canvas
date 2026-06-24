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
        // KIE GPT-image-2 supports the full documented aspect set (T2I & I2I share
        // the same enum). Verified against docs.kie.ai/market/gpt/* (2026-06-25).
        options: [
          "auto",
          "1:1",
          "3:2",
          "2:3",
          "4:3",
          "3:4",
          "5:4",
          "4:5",
          "16:9",
          "9:16",
          "2:1",
          "1:2",
          "3:1",
          "1:3",
          "21:9",
          "9:21",
        ],
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
        // KIE GPT-image-2 supports the full documented aspect set (T2I & I2I share
        // the same enum). Verified against docs.kie.ai/market/gpt/* (2026-06-25).
        options: [
          "auto",
          "1:1",
          "3:2",
          "2:3",
          "4:3",
          "3:4",
          "5:4",
          "4:5",
          "16:9",
          "9:16",
          "2:1",
          "1:2",
          "3:1",
          "1:3",
          "21:9",
          "9:21",
        ],
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
    // fal split gpt-image-1 into subpaths (~2026-06): the base `fal-ai/gpt-image-1`
    // now 404s. T2I lives at `/text-to-image`, edit at `/edit-image`. This default is
    // the T2I path; fal.ts run() swaps to `/edit-image` when an input image is present.
    path: "fal-ai/gpt-image-1/text-to-image",
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
  {
    id: "fal/mai-image-2.5",
    provider: "fal",
    path: "microsoft/mai-image-2.5",
    kind: "image",
    // fal endpoint exposes text-to-image only (no image input in the schema).
    nodeTypes: ["image_gen"],
    priceHint: "≈$0.03 / image (needs FAL_KEY)",
    paramSchema: [
      {
        key: "aspect_ratio",
        label: "Aspect",
        type: "select",
        // Docs list auto/21:9/16:9/3:2/4:3/5:4/1:1/4:5/3:4/2:3/9:16, but empirical
        // testing (2026-06-03) showed the fal endpoint silently falls back to 1:1
        // (1024x1024) for 4:5, 5:4 and 21:9. Only the verified-honored set is offered.
        options: ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "16:9", "9:16"],
      },
      { key: "output_format", label: "Format", type: "select", options: ["png", "jpeg", "webp"] },
      { key: "num_images", label: "Count", type: "number", min: 1, max: 4, step: 1 },
    ],
    defaults: { aspect_ratio: "auto", output_format: "png", num_images: 1 },
  },
  {
    id: "fal/mai-image-2.5-edit",
    provider: "fal",
    path: "microsoft/mai-image-2.5/edit",
    kind: "image",
    // i2i edit endpoint (added by fal ~2026-06-04; the T2I-only era ended).
    // image_urls is typed as an array but the endpoint accepts AT MOST ONE image
    // (2 images -> 422 "List should have at most 1 item"). Single-source edit only;
    // no multi-image compositing. Verified 2026-06-04: keeps MAI's own retro-cel
    // style while repairing Japanese sign text / doing targeted attribute edits.
    //
    // NO aspect_ratio param: the edit endpoint IGNORES aspect_ratio and ALWAYS
    // preserves the input image's aspect ratio (verified 2026-06-04 direct against
    // fal: a portrait 2:3 input returns 2:3 for aspect_ratio 16:9 / 1:1 / 9:16 alike,
    // despite the param appearing in fal's OpenAPI). Offering it would mislead — to
    // change the output aspect, pre-pad/crop/outpaint the INPUT to the target ratio.
    nodeTypes: ["image_edit"],
    priceHint: "≈$0.03 / image (needs FAL_KEY)",
    paramSchema: [
      { key: "output_format", label: "Format", type: "select", options: ["png", "jpeg", "webp"] },
      { key: "num_images", label: "Count", type: "number", min: 1, max: 4, step: 1 },
    ],
    defaults: { output_format: "png", num_images: 1 },
  },
  {
    id: "fal/ideogram-v4",
    provider: "fal",
    path: "ideogram/v4",
    kind: "image",
    // fal endpoint is text-to-image only (no image input in the schema).
    nodeTypes: ["image_gen"],
    priceHint: "≈$0.03–0.13 / image (TURBO→QUALITY, +$0.03 expand; needs FAL_KEY)",
    paramSchema: [
      {
        key: "image_size",
        label: "Size",
        type: "select",
        // fal enum set (all ≈1MP). Custom {width,height} not exposed here.
        options: [
          "square_hd",
          "square",
          "portrait_4_3",
          "portrait_16_9",
          "landscape_4_3",
          "landscape_16_9",
        ],
      },
      {
        key: "rendering_speed",
        label: "Speed",
        type: "select",
        options: ["TURBO", "BALANCED", "QUALITY"],
      },
      // ParamField has no boolean type, so this select yields "true"/"false"
      // strings that fal.ts buildInput coerces to a real boolean. Default OFF:
      // expansion rewrites the prompt with an LLM and adds a flat $0.03/image —
      // unwanted for hand-authored prompts.
      {
        key: "enable_prompt_expansion",
        label: "Expand prompt",
        type: "select",
        options: ["false", "true"],
      },
      { key: "num_images", label: "Count", type: "number", min: 1, max: 4, step: 1 },
      { key: "output_format", label: "Format", type: "select", options: ["png", "jpeg"] },
    ],
    defaults: {
      image_size: "square_hd",
      rendering_speed: "BALANCED",
      enable_prompt_expansion: "false",
      num_images: 1,
      output_format: "png",
    },
  },
  {
    id: "fal/krea-v2",
    provider: "fal",
    path: "krea/v2/large/text-to-image",
    kind: "image",
    // image_gen = pure T2I. image_edit = T2I + style references: any image fed to the
    // node (ref_in/image_in) is passed as image_style_references (Krea's --sref analog).
    nodeTypes: ["image_gen", "image_edit"],
    priceHint: "≈$0.06 / image ($0.065 with style refs, needs FAL_KEY)",
    paramSchema: [
      {
        key: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: ["1:1", "4:3", "3:2", "16:9", "2.35:1", "4:5", "2:3", "9:16"],
      },
      {
        // Krea-specific: how freely the model reinterprets the prompt (raw = literal,
        // high = most stylised/artistic). The "MJ-like" knob, akin to --stylize.
        key: "creativity",
        label: "Creativity",
        type: "select",
        options: ["raw", "low", "medium", "high"],
      },
      { key: "seed", label: "Seed", type: "number", min: 0, max: 2147483647, step: 1 },
      // Applies to style references (image_edit nodes). 1 = full transfer (can override
      // the subject), ~0.5–0.7 = style-only on your own subject, negative = push away.
      // Ignored for pure T2I. Not in defaults so T2I nodes never carry it.
      { key: "style_strength", label: "Style strength", type: "number", min: -1, max: 2, step: 0.1 },
    ],
    defaults: { aspect_ratio: "1:1", creativity: "medium" },
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
    id: "kie/seedance-2.0-mini",
    provider: "kie",
    path: "bytedance/seedance-2-mini",
    kind: "video",
    nodeTypes: ["video_gen"],
    priceHint: "≈$0.015/s× res (概算・最安ミニ版)",
    paramSchema: [
      { key: "mode", label: "Mode", type: "select", options: ["t2v", "i2v", "flf", "r2v"] },
      { key: "duration", label: "Duration (s)", type: "number", min: 4, max: 15, step: 1 },
      // mini tier (like fast) tops out at 720p — no 1080p
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
    id: "kie/happyhorse-1.1",
    provider: "kie",
    // Alibaba HappyHorse 1.1 via KIE's unified jobs API — T2V / I2V / R2V.
    // ⚠ slug + field names are INFERRED from public docs (KIE's own model page
    // blocks automated fetch). If a real run 404s (bad slug) or 422s (bad field),
    // confirm against kie.ai/happyhorse-1-1 → "API" panel and adjust this `path`
    // + the kie/happyhorse-1.1 branch in providers/kie.ts buildInput. Modeled on
    // KIE's Seedance (its direct competitor) which uses one unified slug for all
    // modes. (HappyHorse 1.1 has no first-last-frame mode — first frame only.)
    path: "happyhorse/1-1",
    kind: "video",
    nodeTypes: ["video_gen"],
    priceHint: "≈$0.10/s× res (概算・T2V/I2V/R2V)",
    paramSchema: [
      // t2v=text only / i2v=first frame (image_in) / r2v=reference images (ref_in, 1–9)
      { key: "mode", label: "Mode", type: "select", options: ["t2v", "i2v", "r2v"] },
      { key: "duration", label: "Duration (s)", type: "number", min: 3, max: 15, step: 1 },
      { key: "resolution", label: "Resolution", type: "select", options: ["720p", "1080p"] },
      {
        key: "aspect_ratio",
        label: "Aspect",
        type: "select",
        options: ["16:9", "9:16", "1:1", "4:3", "3:4"],
      },
      { key: "seed", label: "Seed", type: "number", min: 0, max: 2147483647, step: 1 },
    ],
    defaults: { mode: "i2v", duration: 5, resolution: "720p", aspect_ratio: "16:9" },
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
