import { EventEmitter } from "node:events";
import path from "node:path";
import { promises as fs } from "node:fs";
import { nanoid } from "nanoid";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { concatVideos, extractFrame, probeDuration } from "./ffmpeg.js";
import { projectAssetsDir, resolveAssetPath } from "./paths.js";
import {
  connectionValid,
  requiredInputs,
  inputKindOf,
  PORTS,
  MULTI_INPUT_PORTS,
} from "./ports.js";
import { getModel, defaultModelFor, MODELS } from "./registry.js";
import { adapterFor } from "./providers/index.js";
import { downloadToAssets, saveBytesToAssets } from "./assets.js";
import { saveProjectGraph } from "./persistence.js";
import type {
  Edge,
  Graph,
  GraphNode,
  Job,
  ModelSpec,
  NodeStatus,
  NodeType,
  Output,
  PortIn,
  PortOut,
  ResolvedInput,
} from "./types.js";

export type CanvasEvent =
  | { type: "node:added"; node: GraphNode }
  | { type: "node:updated"; node: GraphNode }
  | { type: "node:deleted"; id: string }
  | { type: "edge:added"; edge: Edge }
  | { type: "edge:removed"; id: string }
  | { type: "node:status"; id: string; status: NodeStatus; error?: string }
  | { type: "node:output"; id: string; output: Output }
  | { type: "viewport"; viewport: Graph["viewport"] };

export interface AddNodeArgs {
  type: NodeType;
  position?: { x: number; y: number };
  data?: Partial<{
    prompt: string;
    model: string;
    params: Record<string, unknown>;
  }>;
}

export interface ConnectArgs {
  source: string;
  sourceHandle: PortOut;
  target: string;
  targetHandle: PortIn;
}

export type RunResult =
  | { jobId: string }
  | { needConfirm: true; estimate: { amount: number; currency: string; note?: string } };

const HIGH_COST_REQUIRES_CONFIRM = true; // policy: video=confirm, image=auto (spec §2)

const MAX_IMPORT_CHARS = 50000;

function decodeDataUrl(dataUrl: string): Buffer {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("invalid data url");
  return m[2]
    ? Buffer.from(m[3], "base64")
    : Buffer.from(decodeURIComponent(m[3]), "utf8");
}

// Extract readable text from a document buffer by file type.
async function extractText(buf: Buffer, filename: string): Promise<string> {
  const ext = (path.extname(filename).slice(1) || "").toLowerCase();
  let text: string;
  if (ext === "pdf") {
    text = (await pdfParse(buf)).text;
  } else if (ext === "html" || ext === "htm") {
    text = htmlToText(buf.toString("utf8"));
  } else {
    // txt, md, markdown, csv, json, log, and other text formats
    text = buf.toString("utf8");
  }
  return text.replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_IMPORT_CHARS);
}

// Lightweight HTML -> readable text for web_clip (no heavy deps).
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class Canvas extends EventEmitter {
  readonly projectId: string;
  private graph: Graph;
  private jobs = new Map<string, Job>();
  private cancelled = new Set<string>();

  constructor(projectId: string, graph?: Graph) {
    super();
    this.projectId = projectId;
    this.graph =
      graph ?? {
        id: projectId,
        name: "Untitled Space",
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        updatedAt: new Date().toISOString(),
      };
  }

  // ---- helpers ----

  private touch() {
    this.graph.updatedAt = new Date().toISOString();
    void saveProjectGraph(this.projectId, this.graph);
  }

  private emitEvent(ev: CanvasEvent) {
    this.emit("event", ev);
  }

  private node(id: string): GraphNode {
    const n = this.graph.nodes.find((x) => x.id === id);
    if (!n) throw new Error(`node not found: ${id}`);
    return n;
  }

  // ---- reads ----

  getGraph(): Graph {
    return this.graph;
  }

  // Compact representation for agents (spec §5): small payload, enough to plan.
  getGraphCompact() {
    return {
      id: this.graph.id,
      name: this.graph.name,
      nodes: this.graph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        prompt: n.data.prompt,
        model: n.data.model,
        status: n.status,
        hasOutput: n.data.outputs.length > 0,
        outputKinds: n.data.outputs.map((o) => o.kind),
        error: n.error,
      })),
      edges: this.graph.edges.map((e) => ({
        id: e.id,
        from: `${e.source}.${e.sourceHandle}`,
        to: `${e.target}.${e.targetHandle}`,
      })),
    };
  }

  listModels(): ModelSpec[] {
    return MODELS;
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  // ---- structure ops (spec §2) ----

  addNode(args: AddNodeArgs): GraphNode {
    const type = args.type;
    if (!PORTS[type]) throw new Error(`invalid node type: ${type}`);
    const model = args.data?.model ?? defaultModelFor(type);
    const spec = model ? getModel(model) : undefined;
    const node: GraphNode = {
      id: nanoid(),
      type,
      position: args.position ?? { x: 80, y: 80 },
      data: {
        prompt: args.data?.prompt ?? "",
        model,
        params: { ...(spec?.defaults ?? {}), ...(args.data?.params ?? {}) },
        outputs: [],
      },
      status: "idle",
    };
    this.graph.nodes.push(node);
    this.touch();
    this.emitEvent({ type: "node:added", node });
    return node;
  }

  updateNode(
    id: string,
    patch: {
      position?: { x: number; y: number };
      data?: Partial<{
        prompt: string;
        model: string;
        params: Record<string, unknown>;
      }>;
    },
  ): GraphNode {
    const n = this.node(id);
    if (patch.position) n.position = patch.position;
    if (patch.data) {
      if (patch.data.prompt !== undefined) n.data.prompt = patch.data.prompt;
      if (patch.data.model !== undefined) {
        n.data.model = patch.data.model;
        // merge defaults for newly selected model (keep explicit params)
        const spec = getModel(patch.data.model);
        if (spec) n.data.params = { ...spec.defaults, ...n.data.params };
      }
      if (patch.data.params !== undefined)
        n.data.params = { ...n.data.params, ...patch.data.params };
    }
    this.touch();
    this.emitEvent({ type: "node:updated", node: n });
    return n;
  }

  deleteNode(id: string): void {
    const idx = this.graph.nodes.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error(`node not found: ${id}`);
    // remove attached edges first
    const attached = this.graph.edges.filter(
      (e) => e.source === id || e.target === id,
    );
    for (const e of attached) this.disconnect(e.id);
    this.graph.nodes.splice(idx, 1);
    this.touch();
    this.emitEvent({ type: "node:deleted", id });
  }

  connect(args: ConnectArgs): Edge {
    const src = this.node(args.source);
    const dst = this.node(args.target);
    const check = connectionValid(
      src,
      args.sourceHandle,
      dst,
      args.targetHandle,
    );
    if (!check.ok) throw new Error(`invalid connection: ${check.reason}`);
    // Most input ports take a single source; reference ports accept many.
    if (!MULTI_INPUT_PORTS.has(args.targetHandle)) {
      const existing = this.graph.edges.find(
        (e) => e.target === args.target && e.targetHandle === args.targetHandle,
      );
      if (existing) this.disconnect(existing.id);
    }

    const edge: Edge = {
      id: nanoid(),
      source: args.source,
      sourceHandle: args.sourceHandle,
      target: args.target,
      targetHandle: args.targetHandle,
    };
    this.graph.edges.push(edge);
    this.touch();
    this.emitEvent({ type: "edge:added", edge });
    return edge;
  }

  disconnect(edgeId: string): void {
    const idx = this.graph.edges.findIndex((e) => e.id === edgeId);
    if (idx === -1) throw new Error(`edge not found: ${edgeId}`);
    this.graph.edges.splice(idx, 1);
    this.touch();
    this.emitEvent({ type: "edge:removed", id: edgeId });
  }

  // ---- sugar ----

  setPrompt(id: string, text: string): GraphNode {
    return this.updateNode(id, { data: { prompt: text } });
  }
  setModel(id: string, model: string): GraphNode {
    return this.updateNode(id, { data: { model } });
  }
  setParams(id: string, patch: Record<string, unknown>): GraphNode {
    return this.updateNode(id, { data: { params: patch } });
  }

  setName(name: string): void {
    this.graph.name = name;
    this.touch();
  }

  setViewport(viewport: Graph["viewport"]): void {
    this.graph.viewport = viewport;
    this.touch();
    this.emitEvent({ type: "viewport", viewport });
  }

  // ---- inputs resolution (spec §1) ----

  // Text content of a node: a note's own content, else its latest text output.
  private textOf(src: GraphNode): string | undefined {
    if (src.type === "note" || src.type === "doc") return src.data.prompt;
    for (let i = src.data.outputs.length - 1; i >= 0; i--)
      if (src.data.outputs[i].kind === "text") return src.data.outputs[i].text;
    return undefined;
  }

  getText(id: string): { text: string } {
    return { text: this.textOf(this.node(id)) ?? "" };
  }

  private resolveInputs(node: GraphNode): ResolvedInput[] {
    const incoming = this.graph.edges.filter((e) => e.target === node.id);
    const resolved: ResolvedInput[] = [];
    for (const e of incoming) {
      const src = this.graph.nodes.find((n) => n.id === e.source);
      if (!src) continue;
      const targetKind = inputKindOf(node.type, e.targetHandle);
      if (targetKind === "text") {
        const text = this.textOf(src);
        if (text != null && text !== "")
          resolved.push({ port: e.targetHandle, kind: "text", url: "", text });
      } else {
        const out = src.data.outputs[src.data.outputs.length - 1];
        if (out) resolved.push({ port: e.targetHandle, kind: out.kind, url: out.url });
      }
    }
    // required input check
    const have = new Set(resolved.map((r) => r.port));
    for (const req of requiredInputs(node.type)) {
      if (!have.has(req))
        throw new Error(
          `required input "${req}" of node ${node.id} is unconnected or upstream has no output`,
        );
    }
    return resolved;
  }

  // ---- run (spec §2 run-guard) ----

  run(id: string, opts?: { confirm?: boolean }): RunResult {
    const node = this.node(id);
    if (node.type === "note" || node.type === "doc" || node.type === "frame")
      throw new Error(`${node.type} nodes don't run`);
    if (node.type === "web_clip") return this.runWebClip(node);
    if (node.type === "video_concat") return this.runVideoConcat(node);
    if (node.type === "frame_extract") return this.runFrameExtract(node);

    const spec = getModel(node.data.model);
    if (!spec) throw new Error(`node ${id} has no valid model`);
    const adapter = adapterFor(node.data.model);

    const resolved = this.resolveInputs(node); // throws on missing required input
    // A connected text input drives the prompt; only media goes to the adapter.
    const textIn = resolved.find((r) => r.kind === "text" && r.text && r.text.trim());
    const mediaInputs = resolved.filter((r) => r.kind !== "text");
    const effPrompt = textIn?.text ?? node.data.prompt;
    const estimate = adapter.estimateCost(node.data.model, node.data.params, mediaInputs);

    const needsConfirm = HIGH_COST_REQUIRES_CONFIRM && spec.kind === "video";
    if (needsConfirm && !opts?.confirm) {
      return {
        needConfirm: true,
        estimate: {
          amount: estimate.amount,
          currency: estimate.currency,
          note: estimate.note,
        },
      };
    }

    const job: Job = {
      id: nanoid(),
      nodeId: id,
      status: "queued",
      progress: 0,
      estimate,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    this.setStatus(node, "queued");

    // dispatch async
    void this.execute(job, node, mediaInputs, effPrompt);
    return { jobId: job.id };
  }

  cancel(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`job not found: ${jobId}`);
    if (job.status === "succeeded" || job.status === "failed") return;
    this.cancelled.add(jobId);
    job.status = "failed";
    job.error = "cancelled";
    const node = this.graph.nodes.find((n) => n.id === job.nodeId);
    if (node) this.setStatus(node, "failed", "cancelled");
  }

  // ---- web_clip (builtin: fetch a URL -> readable text) ----
  private runWebClip(node: GraphNode): RunResult {
    const job: Job = {
      id: nanoid(),
      nodeId: node.id,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    this.setStatus(node, "queued");
    void this.executeWebClip(job, node);
    return { jobId: job.id };
  }

  private async executeWebClip(job: Job, node: GraphNode): Promise<void> {
    try {
      job.status = "running";
      this.setStatus(node, "running");
      const url = String(node.data.params.url ?? "").trim();
      if (!/^https?:\/\//.test(url)) throw new Error("有効な http(s) URL を入力してください");
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (CreativeCanvas web_clip)" },
      });
      if (!res.ok) throw new Error(`fetch failed ${res.status}`);
      const html = await res.text();
      const max = Number(node.data.params.maxChars ?? 12000);
      const text = htmlToText(html).slice(0, max);
      const output: Output = {
        id: nanoid(),
        kind: "text",
        url: "",
        text,
        meta: { provider: "web", model: "web_clip" },
        createdAt: new Date().toISOString(),
      };
      node.data.outputs.push(output);
      this.touch();
      this.emitEvent({ type: "node:output", id: node.id, output });
      job.status = "succeeded";
      job.progress = 1;
      this.setStatus(node, "succeeded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      job.status = "failed";
      job.error = msg;
      this.setStatus(node, "failed", msg);
    }
  }

  // ---- video_concat (builtin: join clips A->B->… with ffmpeg) ----
  private runVideoConcat(node: GraphNode): RunResult {
    const job: Job = {
      id: nanoid(),
      nodeId: node.id,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    this.setStatus(node, "queued");
    void this.executeConcat(job, node);
    return { jobId: job.id };
  }

  private async executeConcat(job: Job, node: GraphNode): Promise<void> {
    try {
      job.status = "running";
      this.setStatus(node, "running");
      // Gather connected clips, ordered left-to-right by source node position.
      const clips = this.graph.edges
        .filter((e) => e.target === node.id && e.targetHandle === "clip_in")
        .map((e) => {
          const src = this.graph.nodes.find((n) => n.id === e.source);
          const out = [...(src?.data.outputs ?? [])]
            .reverse()
            .find((o) => o.kind === "video");
          return src && out ? { x: src.position.x, y: src.position.y, url: out.url } : null;
        })
        .filter((c): c is { x: number; y: number; url: string } => !!c)
        .sort((a, b) => a.x - b.x || a.y - b.y);

      if (clips.length < 2)
        throw new Error("clip_in に2本以上の動画を接続してください（左→右の順で連結）");

      const inputs = clips.map((c) => resolveAssetPath(c.url));
      const name = `${nanoid()}.mp4`;
      await fs.mkdir(projectAssetsDir(this.projectId), { recursive: true });
      const outPath = path.join(projectAssetsDir(this.projectId), name);
      await concatVideos(inputs, outPath);

      const output: Output = {
        id: nanoid(),
        kind: "video",
        url: `/assets/${this.projectId}/${name}`,
        meta: { provider: "ffmpeg", model: "video_concat" },
        createdAt: new Date().toISOString(),
      };
      node.data.outputs.push(output);
      this.touch();
      this.emitEvent({ type: "node:output", id: node.id, output });
      job.status = "succeeded";
      job.progress = 1;
      this.setStatus(node, "succeeded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      job.status = "failed";
      job.error = msg;
      this.setStatus(node, "failed", msg);
    }
  }

  // ---- frame_extract (builtin: grab one frame from a video at a chosen time) ----
  private runFrameExtract(node: GraphNode): RunResult {
    const job: Job = {
      id: nanoid(),
      nodeId: node.id,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    this.setStatus(node, "queued");
    void this.executeFrameExtract(job, node);
    return { jobId: job.id };
  }

  // Resolve a time spec (number seconds | "first" | "last" | "NN%") to seconds.
  private frameTimeSec(raw: unknown, duration: number): number {
    if (typeof raw === "number") return Math.max(0, raw);
    const s = String(raw ?? "").trim().toLowerCase();
    if (s === "" || s === "first") return 0;
    if (s === "last" || s === "end") return Math.max(0, duration - 0.05);
    if (s.endsWith("%")) {
      const pct = Number(s.slice(0, -1));
      if (Number.isFinite(pct))
        return Math.max(0, Math.min(duration, (pct / 100) * duration));
    }
    const n = Number(s);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  private async executeFrameExtract(job: Job, node: GraphNode): Promise<void> {
    try {
      job.status = "running";
      this.setStatus(node, "running");
      // single connected video on video_in -> its latest video output
      const edge = this.graph.edges.find(
        (e) => e.target === node.id && e.targetHandle === "video_in",
      );
      const src = edge && this.graph.nodes.find((n) => n.id === edge.source);
      const vid =
        src && [...(src.data.outputs ?? [])].reverse().find((o) => o.kind === "video");
      if (!vid) throw new Error("video_in に動画出力を持つノードを接続してください");

      const inputPath = resolveAssetPath(vid.url);
      const duration = await probeDuration(inputPath);
      const t = this.frameTimeSec(node.data.params.time, duration);

      const name = `${nanoid()}.png`;
      await fs.mkdir(projectAssetsDir(this.projectId), { recursive: true });
      const outPath = path.join(projectAssetsDir(this.projectId), name);
      await extractFrame(inputPath, t, outPath);

      const output: Output = {
        id: nanoid(),
        kind: "image",
        url: `/assets/${this.projectId}/${name}`,
        meta: { provider: "ffmpeg", model: "frame_extract" },
        createdAt: new Date().toISOString(),
      };
      node.data.outputs.push(output);
      this.touch();
      this.emitEvent({ type: "node:output", id: node.id, output });
      job.status = "succeeded";
      job.progress = 1;
      this.setStatus(node, "succeeded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      job.status = "failed";
      job.error = msg;
      this.setStatus(node, "failed", msg);
    }
  }

  private setStatus(node: GraphNode, status: NodeStatus, error?: string) {
    node.status = status;
    node.error = error;
    this.touch();
    this.emitEvent({ type: "node:status", id: node.id, status, error });
  }

  private async execute(
    job: Job,
    node: GraphNode,
    inputs: ResolvedInput[],
    prompt: string,
  ): Promise<void> {
    const adapter = adapterFor(node.data.model);
    const spec = getModel(node.data.model)!;
    try {
      job.status = "running";
      this.setStatus(node, "running");

      const result = await adapter.run(node.data.model, {
        prompt,
        params: node.data.params,
        inputs,
      });

      if (this.cancelled.has(job.id)) {
        this.cancelled.delete(job.id);
        return;
      }

      for (const raw of result.outputs) {
        const { localUrl } = await downloadToAssets(raw.url, raw.kind, this.projectId);
        const output: Output = {
          id: nanoid(),
          kind: raw.kind,
          url: localUrl,
          meta: {
            width: raw.width,
            height: raw.height,
            durationSec: raw.durationSec,
            provider: adapter.id,
            model: node.data.model,
            cost: result.cost,
            seed: raw.seed,
          },
          createdAt: new Date().toISOString(),
        };
        node.data.outputs.push(output);
        this.touch();
        this.emitEvent({ type: "node:output", id: node.id, output });
      }

      job.status = "succeeded";
      job.progress = 1;
      this.setStatus(node, "succeeded");
      void spec;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      job.status = "failed";
      job.error = msg;
      this.setStatus(node, "failed", msg);
    }
  }

  // ---- assets (spec §2 uploadImage) ----

  async uploadImage(filePath: string): Promise<{ node: GraphNode; output: Output }> {
    const abs = path.resolve(filePath);
    const bytes = await fs.readFile(abs);
    const ext = (path.extname(abs).slice(1) || "png").toLowerCase();
    const localUrl = await saveBytesToAssets(bytes, ext, this.projectId);
    const node = this.addNode({
      type: "image_gen",
      data: { prompt: `(uploaded: ${path.basename(abs)})` },
    });
    const output: Output = {
      id: nanoid(),
      kind: "image",
      url: localUrl,
      meta: { provider: "upload", model: "upload" },
      createdAt: new Date().toISOString(),
    };
    node.data.outputs.push(output);
    this.setStatus(node, "succeeded");
    this.emitEvent({ type: "node:output", id: node.id, output });
    return { node, output };
  }

  // Attach a browser-uploaded image (data: URL) to an existing node.
  async uploadToNode(id: string, dataUrl: string): Promise<Output> {
    const node = this.node(id);
    const { localUrl } = await downloadToAssets(dataUrl, "image", this.projectId);
    const output: Output = {
      id: nanoid(),
      kind: "image",
      url: localUrl,
      meta: { provider: "upload", model: "upload" },
      createdAt: new Date().toISOString(),
    };
    node.data.outputs.push(output);
    this.touch();
    this.emitEvent({ type: "node:output", id: node.id, output });
    this.setStatus(node, "succeeded");
    return output;
  }

  // Attach a browser-uploaded video (data: URL) to an existing node.
  async uploadVideoToNode(id: string, dataUrl: string): Promise<Output> {
    const node = this.node(id);
    const { localUrl } = await downloadToAssets(dataUrl, "video", this.projectId);
    const output: Output = {
      id: nanoid(),
      kind: "video",
      url: localUrl,
      meta: { provider: "upload", model: "upload" },
      createdAt: new Date().toISOString(),
    };
    node.data.outputs.push(output);
    this.touch();
    this.emitEvent({ type: "node:output", id: node.id, output });
    this.setStatus(node, "succeeded");
    return output;
  }

  // Import a browser-uploaded document (data: URL) into a node as text.
  async importFileToNode(id: string, dataUrl: string, filename: string): Promise<Output> {
    const node = this.node(id);
    this.setStatus(node, "running");
    try {
      const text = await extractText(decodeDataUrl(dataUrl), filename || "file");
      const output: Output = {
        id: nanoid(),
        kind: "text",
        url: "",
        text,
        meta: { provider: "file", model: filename || "file_import" },
        createdAt: new Date().toISOString(),
      };
      node.data.outputs.push(output);
      this.touch();
      this.emitEvent({ type: "node:output", id: node.id, output });
      this.setStatus(node, "succeeded");
      return output;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus(node, "failed", msg);
      throw err;
    }
  }

  // Import a local file by path (used by the MCP agent): creates a file_import node.
  async importFileFromPath(
    filePath: string,
  ): Promise<{ node: GraphNode; output: Output }> {
    const abs = path.resolve(filePath);
    const buf = await fs.readFile(abs);
    const base = path.basename(abs);
    const node = this.addNode({ type: "file_import", data: { prompt: base } });
    const text = await extractText(buf, base);
    const output: Output = {
      id: nanoid(),
      kind: "text",
      url: "",
      text,
      meta: { provider: "file", model: base },
      createdAt: new Date().toISOString(),
    };
    node.data.outputs.push(output);
    this.touch();
    this.emitEvent({ type: "node:output", id: node.id, output });
    this.setStatus(node, "succeeded");
    return { node, output };
  }
}
