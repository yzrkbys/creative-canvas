import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { projectAssetsDir } from "./paths.js";
import type { OutputKind } from "./types.js";

const EXT: Record<OutputKind, string> = { image: "png", video: "mp4", text: "txt" };

function extFromContentType(ct: string | null, kind: OutputKind): string {
  if (!ct) return EXT[kind];
  if (ct.includes("svg")) return "svg";
  if (ct.includes("jpeg")) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("mp4")) return "mp4";
  if (ct.includes("webm")) return "webm";
  return EXT[kind];
}

// Download a (provider-side, often temporary) URL into the project's assets dir
// and return the local URL the server serves it from. Supports data: URLs too.
export async function downloadToAssets(
  url: string,
  kind: OutputKind,
  projectId: string,
): Promise<{ localUrl: string; bytes: number }> {
  const dir = projectAssetsDir(projectId);
  await fs.mkdir(dir, { recursive: true });

  let buf: Buffer;
  let ext = EXT[kind];

  if (url.startsWith("data:")) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
    if (!m) throw new Error("invalid data url");
    const ct = m[1] ?? null;
    const isB64 = !!m[2];
    buf = isB64
      ? Buffer.from(m[3], "base64")
      : Buffer.from(decodeURIComponent(m[3]), "utf8");
    ext = extFromContentType(ct, kind);
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed ${res.status} for ${url}`);
    ext = extFromContentType(res.headers.get("content-type"), kind);
    buf = Buffer.from(await res.arrayBuffer());
  }

  const name = `${nanoid()}.${ext}`;
  await fs.writeFile(path.join(dir, name), buf);
  return { localUrl: `/assets/${projectId}/${name}`, bytes: buf.length };
}

export async function saveBytesToAssets(
  bytes: Buffer,
  ext: string,
  projectId: string,
): Promise<string> {
  const dir = projectAssetsDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const name = `${nanoid()}.${ext.replace(/^\./, "")}`;
  await fs.writeFile(path.join(dir, name), bytes);
  return `/assets/${projectId}/${name}`;
}
