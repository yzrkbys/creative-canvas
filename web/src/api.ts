import type {
  Edge,
  Graph,
  GraphNode,
  ModelSpec,
  NodeType,
  PortIn,
  PortOut,
  ProjectMeta,
  RunResult,
} from "./types";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

// The active project all scoped calls operate on (set when a project is opened).
let pid = "";
export function setProject(id: string) {
  pid = id;
}
const P = () => `/api/projects/${pid}`;

export const api = {
  // global
  getModels: () => req<ModelSpec[]>("GET", "/api/models"),

  // projects
  listProjects: () => req<ProjectMeta[]>("GET", "/api/projects"),
  createProject: (name: string) => req<ProjectMeta>("POST", "/api/projects", { name }),
  renameProject: (id: string, name: string) =>
    req<ProjectMeta>("PATCH", `/api/projects/${id}`, { name }),
  deleteProject: (id: string) => req("DELETE", `/api/projects/${id}`),
  duplicateProject: (id: string, name?: string) =>
    req<ProjectMeta>("POST", `/api/projects/${id}/duplicate`, { name }),

  // scoped to the active project
  getGraph: () => req<Graph>("GET", `${P()}/graph`),
  addNode: (args: {
    type: NodeType;
    position?: { x: number; y: number };
    data?: Partial<{ prompt: string; model: string; params: Record<string, unknown> }>;
  }) => req<GraphNode>("POST", `${P()}/nodes`, args),
  updateNode: (
    id: string,
    patch: {
      position?: { x: number; y: number };
      data?: Partial<{ prompt: string; model: string; params: Record<string, unknown> }>;
    },
  ) => req<GraphNode>("PATCH", `${P()}/nodes/${id}`, patch),
  deleteNode: (id: string) => req("DELETE", `${P()}/nodes/${id}`),
  connect: (args: {
    source: string;
    sourceHandle: PortOut;
    target: string;
    targetHandle: PortIn;
  }) => req<Edge>("POST", `${P()}/edges`, args),
  disconnect: (id: string) => req("DELETE", `${P()}/edges/${id}`),
  run: (id: string, confirm?: boolean) =>
    req<RunResult>("POST", `${P()}/nodes/${id}/run`, { confirm: !!confirm }),
  uploadFile: (id: string, dataUrl: string) =>
    req("POST", `${P()}/nodes/${id}/upload-file`, { dataUrl }),
  uploadVideoFile: (id: string, dataUrl: string) =>
    req("POST", `${P()}/nodes/${id}/upload-video`, { dataUrl }),
  importFile: (id: string, dataUrl: string, filename: string) =>
    req("POST", `${P()}/nodes/${id}/import-file`, { dataUrl, filename }),
};
