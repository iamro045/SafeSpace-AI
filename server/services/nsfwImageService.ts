import fs from "fs";
import path from "path";
import { spawn } from "child_process";

export type NsfwScores = {
  drawings: number;
  hentai: number;
  neutral: number;
  porn: number;
  sexy: number;
};

function readBool(envValue: string | undefined, fallback: boolean): boolean {
  if (envValue === undefined) return fallback;
  const normalized = envValue.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function classifyWithNsfwModel(imagePath: string): Promise<NsfwScores | null> {
  const enabled = readBool(process.env.NSFW_ENABLED, false);
  const modelPath = process.env.NSFW_MODEL_PATH;
  const python = process.env.NSFW_PYTHON || "python";

  if (!enabled) return null;
  if (!modelPath) return null;
  if (!fs.existsSync(imagePath)) return null;
  if (!fs.existsSync(modelPath)) return null;

  const scriptPath = path.resolve(process.cwd(), "server", "scripts", "nsfw_predict.py");
  if (!fs.existsSync(scriptPath)) return null;

  const args = [scriptPath, "--model", modelPath, "--image", imagePath];

  return await new Promise<NsfwScores | null>((resolve) => {
    const child = spawn(python, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      console.warn("NSFW python spawn failed:", err);
      resolve(null);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        if (stderr.trim()) console.warn("NSFW python error:", stderr.trim());
        resolve(null);
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        const scores = parsed?.scores ?? parsed;
        if (!scores || typeof scores !== "object") return resolve(null);

        resolve({
          drawings: toNumber((scores as any).drawings),
          hentai: toNumber((scores as any).hentai),
          neutral: toNumber((scores as any).neutral),
          porn: toNumber((scores as any).porn),
          sexy: toNumber((scores as any).sexy),
        });
      } catch {
        resolve(null);
      }
    });
  });
}
