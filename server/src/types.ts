// Canonical data model — the single source of truth for the canvas.
// (spec §1)

export type NodeType =
  | "image_gen"
  | "image_edit"
  | "video_gen"
  | "image_upload"
  | "video_upscale"
  | "video_concat"
  | "note"
  | "doc"
  | "web_clip"
  | "file_import"
  | "frame";

export type NodeStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export type PortOut = "image_out" | "video_out" | "text_out";
export type PortIn =
  | "image_in"
  | "ref_in"
  | "last_frame_in"
  | "video_in"
  | "ref_video_in"
  | "clip_in"
  | "text_in";

export type OutputKind = "image" | "video" | "text";

export interface OutputMeta {
  width?: number;
  height?: number;
  durationSec?: number;
  provider: string;
  model: string;
  cost?: number;
  seed?: number;
}

export interface Output {
  id: string;
  kind: OutputKind;
  url: string; // served by the local server (empty for text outputs)
  text?: string; // inline content for text outputs
  thumbUrl?: string;
  meta: OutputMeta;
  createdAt: string;
}

export interface NodeData {
  prompt: string;
  model: string;
  params: Record<string, unknown>;
  outputs: Output[];
}

export interface GraphNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  status: NodeStatus;
  error?: string;
}

export interface Edge {
  id: string;
  source: string;
  sourceHandle: PortOut;
  target: string;
  targetHandle: PortIn;
}

export interface Graph {
  id: string;
  name: string;
  nodes: GraphNode[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  updatedAt: string;
}

// --- Provider layer ---

export interface ResolvedInput {
  port: PortIn;
  kind: OutputKind;
  url: string; // for image/video inputs ("" for text)
  text?: string; // for text inputs
}

export interface RawOutput {
  kind: OutputKind;
  url: string; // provider-side url (often temporary) — core downloads it
  width?: number;
  height?: number;
  durationSec?: number;
  seed?: number;
}

export interface CostEstimate {
  amount: number;
  currency: "USD";
  note?: string;
}

export interface ProviderRunArgs {
  prompt: string;
  params: Record<string, unknown>;
  inputs: ResolvedInput[];
}

export interface ProviderRunResult {
  outputs: RawOutput[];
  cost: number;
}

export interface ProviderAdapter {
  id: "fal" | "kie" | "mock";
  supports(model: string): boolean;
  estimateCost(
    model: string,
    params: Record<string, unknown>,
    inputs: ResolvedInput[],
  ): CostEstimate;
  run(model: string, args: ProviderRunArgs): Promise<ProviderRunResult>;
}

// --- Model registry ---

export interface ModelSpec {
  id: string; // e.g. "fal/gpt-image-2"
  provider: "fal" | "kie" | "mock" | "builtin";
  path: string; // provider endpoint id, e.g. "fal-ai/gpt-image-1"
  kind: OutputKind; // primary output kind
  nodeTypes: NodeType[]; // which node types may use this model
  paramSchema: ParamField[];
  defaults: Record<string, unknown>;
  priceHint: string;
}

export interface ParamField {
  key: string;
  label: string;
  type: "string" | "number" | "select";
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

// --- Jobs ---

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job {
  id: string;
  nodeId: string;
  status: JobStatus;
  progress: number; // 0..1
  error?: string;
  estimate?: CostEstimate;
  createdAt: string;
}
