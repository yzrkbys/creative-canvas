import type { NodeType, OutputKind, PortIn, PortOut } from "./types";

interface PortDef {
  inputs: { port: PortIn; kind: OutputKind; required: boolean }[];
  output?: { port: PortOut; kind: OutputKind };
}

export const PORTS: Record<NodeType, PortDef> = {
  image_gen: {
    inputs: [
      { port: "ref_in", kind: "image", required: false },
      { port: "text_in", kind: "text", required: false },
    ],
    output: { port: "image_out", kind: "image" },
  },
  image_edit: {
    inputs: [
      { port: "image_in", kind: "image", required: true },
      { port: "ref_in", kind: "image", required: false },
      { port: "text_in", kind: "text", required: false },
    ],
    output: { port: "image_out", kind: "image" },
  },
  video_gen: {
    inputs: [
      { port: "image_in", kind: "image", required: false },
      { port: "last_frame_in", kind: "image", required: false },
      { port: "ref_in", kind: "image", required: false },
      { port: "ref_video_in", kind: "video", required: false },
      { port: "text_in", kind: "text", required: false },
    ],
    output: { port: "video_out", kind: "video" },
  },
  image_upload: {
    inputs: [],
    output: { port: "image_out", kind: "image" },
  },
  video_upscale: {
    inputs: [{ port: "video_in", kind: "video", required: true }],
    output: { port: "video_out", kind: "video" },
  },
  video_concat: {
    inputs: [{ port: "clip_in", kind: "video", required: true }],
    output: { port: "video_out", kind: "video" },
  },
  frame_extract: {
    inputs: [{ port: "video_in", kind: "video", required: true }],
    output: { port: "image_out", kind: "image" },
  },
  note: {
    inputs: [{ port: "text_in", kind: "text", required: false }],
    output: { port: "text_out", kind: "text" },
  },
  doc: {
    inputs: [{ port: "text_in", kind: "text", required: false }],
    output: { port: "text_out", kind: "text" },
  },
  web_clip: {
    inputs: [],
    output: { port: "text_out", kind: "text" },
  },
  file_import: {
    inputs: [],
    output: { port: "text_out", kind: "text" },
  },
  frame: {
    inputs: [],
  },
};

export const MULTI_INPUT_PORTS = new Set<PortIn>([
  "ref_in",
  "ref_video_in",
  "clip_in",
  "text_in",
]);

export function outKind(t: NodeType): OutputKind | null {
  return PORTS[t].output?.kind ?? null;
}
export function inKind(t: NodeType, p: PortIn): OutputKind | null {
  return PORTS[t].inputs.find((i) => i.port === p)?.kind ?? null;
}
