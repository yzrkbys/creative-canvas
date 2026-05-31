#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = process.env.CANVAS_SERVER_URL ?? "http://localhost:8787";

async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

// The agent's active project. Scoped tools operate on it; defaults to the first.
let current = "";
async function projectId(): Promise<string> {
  if (current) return current;
  const list = await api<any[]>("GET", "/api/projects");
  if (!list.length) throw new Error("no project exists — call canvas_create_project first");
  current = list[0].id;
  return current;
}
async function sc<T = any>(method: string, sub: string, body?: unknown): Promise<T> {
  return api<T>(method, `/api/projects/${await projectId()}${sub}`, body);
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return { isError: true, content: [{ type: "text" as const, text: `Error: ${msg}` }] };
}

const server = new McpServer({ name: "creative-canvas", version: "0.0.0" });

// ---- projects ----
server.tool(
  "canvas_list_projects",
  "List all projects (id, name, nodeCount, updatedAt).",
  {},
  async () => {
    try {
      return ok(await api("GET", "/api/projects"));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_open_project",
  "Set the active project that subsequent canvas_* tools operate on.",
  { id: z.string() },
  async ({ id }) => {
    try {
      const list = await api<any[]>("GET", "/api/projects");
      if (!list.find((p) => p.id === id)) throw new Error(`project not found: ${id}`);
      current = id;
      return ok({ active: id });
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_create_project",
  "Create a new project and make it active.",
  { name: z.string() },
  async ({ name }) => {
    try {
      const p = await api<any>("POST", "/api/projects", { name });
      current = p.id;
      return ok(p);
    } catch (e) {
      return fail(e);
    }
  },
);

// ---- graph (scoped to active project) ----
server.tool(
  "canvas_get_graph",
  "Get a compact view of the active project's graph (nodes + edges).",
  { graphId: z.string().optional() },
  async () => {
    try {
      return ok(await sc("GET", "/graph/compact"));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_list_models",
  "List available models with provider, kind, param schema and price hint.",
  {},
  async () => {
    try {
      return ok(await api("GET", "/api/models"));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_add_node",
  "Add a node. type=image_gen|image_edit|video_gen|image_upload|video_upscale|video_concat|frame_extract|note|doc|web_clip|frame. " +
    "note/doc = editable text (set content with canvas_set_prompt; doc is long-form). " +
    "web_clip = fetch a URL to text (set params.url, then canvas_run). " +
    "video_concat = join clips on clip_in (ordered left->right by node x). " +
    "frame_extract = grab one frame from video_in at params.time (seconds | first | last | NN%), then canvas_run -> image_out. " +
    "frame = visual group/label box (set title with canvas_set_prompt).",
  {
    type: z.enum([
      "image_gen",
      "image_edit",
      "video_gen",
      "image_upload",
      "video_upscale",
      "video_concat",
      "frame_extract",
      "note",
      "doc",
      "web_clip",
      "file_import",
      "frame",
    ]),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    prompt: z.string().optional(),
    model: z.string().optional(),
    params: z.record(z.any()).optional(),
  },
  async ({ type, position, prompt, model, params }) => {
    try {
      const data: Record<string, unknown> = {};
      if (prompt !== undefined) data.prompt = prompt;
      if (model !== undefined) data.model = model;
      if (params !== undefined) data.params = params;
      return ok(await sc("POST", "/nodes", { type, position, data }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_update_node",
  "Update a node's prompt, model, params and/or position.",
  {
    id: z.string(),
    prompt: z.string().optional(),
    model: z.string().optional(),
    params: z.record(z.any()).optional(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
  },
  async ({ id, prompt, model, params, position }) => {
    try {
      const patch: Record<string, unknown> = {};
      const data: Record<string, unknown> = {};
      if (prompt !== undefined) data.prompt = prompt;
      if (model !== undefined) data.model = model;
      if (params !== undefined) data.params = params;
      if (Object.keys(data).length) patch.data = data;
      if (position !== undefined) patch.position = position;
      return ok(await sc("PATCH", `/nodes/${id}`, patch));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_set_prompt",
  "Set a node's prompt text.",
  { id: z.string(), text: z.string() },
  async ({ id, text }) => {
    try {
      return ok(await sc("POST", `/nodes/${id}/prompt`, { text }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_set_model",
  "Set a node's model.",
  { id: z.string(), model: z.string() },
  async ({ id, model }) => {
    try {
      return ok(await sc("POST", `/nodes/${id}/model`, { model }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_connect",
  "Connect source.sourceHandle -> target.targetHandle. Validates kind compatibility. " +
    "Ports: image_in(first frame), last_frame_in, ref_in(images, multi), " +
    "video_in(upscale), ref_video_in(videos, multi).",
  {
    source: z.string(),
    sourceHandle: z.enum(["image_out", "video_out", "text_out"]),
    target: z.string(),
    targetHandle: z.enum([
      "image_in",
      "ref_in",
      "last_frame_in",
      "video_in",
      "ref_video_in",
      "clip_in",
      "text_in",
    ]),
  },
  async (args) => {
    try {
      return ok(await sc("POST", "/edges", args));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_disconnect",
  "Remove an edge by id.",
  { edgeId: z.string() },
  async ({ edgeId }) => {
    try {
      return ok(await sc("DELETE", `/edges/${edgeId}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_run",
  "Run a node. Video nodes need confirm=true; without it you get an estimate to re-call with confirm.",
  { id: z.string(), confirm: z.boolean().optional() },
  async ({ id, confirm }) => {
    try {
      return ok(await sc("POST", `/nodes/${id}/run`, { confirm: !!confirm }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_import_file",
  "Import a local document (PDF / txt / md / html / csv …) by path into the active project as a text node.",
  { path: z.string() },
  async ({ path }) => {
    try {
      return ok(await sc("POST", "/import-file", { path }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_read_text",
  "Read a node's text content: a note's content, or a web_clip/text node's latest text output. Use this to read gathered/written text for synthesis.",
  { id: z.string() },
  async ({ id }) => {
    try {
      return ok(await sc("GET", `/nodes/${id}/text`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_get_job",
  "Get job status/progress/error by jobId.",
  { jobId: z.string() },
  async ({ jobId }) => {
    try {
      return ok(await sc("GET", `/jobs/${jobId}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "canvas_upload_image",
  "Upload a local image file path; creates an image node holding it in the active project.",
  { path: z.string() },
  async ({ path }) => {
    try {
      return ok(await sc("POST", "/upload", { path }));
    } catch (e) {
      return fail(e);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[canvas-mcp] connected, talking to ${BASE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
