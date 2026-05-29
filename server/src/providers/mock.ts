import { getModel } from "../registry.js";
import { falAdapter } from "./fal.js";
import type {
  OutputKind,
  ProviderAdapter,
  ProviderRunArgs,
  ProviderRunResult,
  RawOutput,
} from "../types.js";

function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
  );
}

function placeholderSvg(
  kind: OutputKind,
  prompt: string,
  i: number,
): string {
  const bg = kind === "video" ? "#1d2b3a" : "#2a1d3a";
  const label = kind === "video" ? "MOCK VIDEO" : "MOCK IMAGE";
  const text = esc(prompt.slice(0, 60)) || "(no prompt)";
  const anim =
    kind === "video"
      ? `<animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite"/>`
      : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" fill="${bg}"/>
  <circle cx="256" cy="200" r="60" fill="#5b8def">${anim}</circle>
  <text x="256" y="300" fill="#fff" font-family="sans-serif" font-size="28" text-anchor="middle">${label}</text>
  <text x="256" y="340" fill="#9fb3c8" font-family="sans-serif" font-size="16" text-anchor="middle">#${i + 1}</text>
  <text x="256" y="380" fill="#cdd9e5" font-family="sans-serif" font-size="14" text-anchor="middle">${text}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Reuses fal's cost model so the run-guard (video=confirm) behaves identically.
export const mockAdapter: ProviderAdapter = {
  id: "mock",
  supports() {
    return true;
  },
  estimateCost(model, params, inputs) {
    return falAdapter.estimateCost(model, params, inputs);
  },
  async run(model, args: ProviderRunArgs): Promise<ProviderRunResult> {
    const spec = getModel(model);
    const kind = spec?.kind ?? "image";
    const n = kind === "image" ? Number(args.params.n ?? 1) : 1;
    await new Promise((r) => setTimeout(r, 600)); // simulate latency
    const outputs: RawOutput[] = [];
    for (let i = 0; i < n; i++) {
      outputs.push({
        kind,
        url: placeholderSvg(kind, args.prompt, i),
        width: 512,
        height: 512,
        durationSec:
          kind === "video" ? Number(args.params.duration ?? 5) : undefined,
        seed: Math.floor(Math.random() * 1e6),
      });
    }
    return {
      outputs,
      cost: this.estimateCost(model, args.params, args.inputs).amount,
    };
  },
};
