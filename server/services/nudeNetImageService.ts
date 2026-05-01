import fs from "fs";
import path from "path";
import { spawn } from "child_process";

export type NudeNetDetection = {
  class: string;
  score: number;
  box?: [number, number, number, number];
};

function readBool(envValue: string | undefined, fallback: boolean): boolean {
  if (envValue === undefined) return fallback;
  const normalized = envValue.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function readInt(envValue: string | undefined, fallback: number): number {
  if (envValue === undefined) return fallback;
  const n = Number.parseInt(envValue.trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function detectWithNudeNet(imagePath: string): Promise<NudeNetDetection[] | null> {
  const enabled = readBool(process.env.NUDENET_ENABLED, false);
  const python = process.env.NUDENET_PYTHON || "python";
  const modelPath = process.env.NUDENET_MODEL_PATH;
  const resolution = readInt(process.env.NUDENET_INFERENCE_RES, 320);

  if (!enabled) return null;
  if (!fs.existsSync(imagePath)) return null;
  if (modelPath && !fs.existsSync(modelPath)) return null;

  const scriptPath = path.resolve(process.cwd(), "server", "scripts", "nudenet_detect.py");
  if (!fs.existsSync(scriptPath)) return null;

  const args = [scriptPath, "--image", imagePath, "--resolution", String(resolution)];
  if (modelPath) args.push("--model", modelPath);

  return await new Promise<NudeNetDetection[] | null>((resolve) => {
    const child = spawn(python, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      console.warn("NudeNet python spawn failed:", err);
      resolve(null);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        if (stderr.trim()) console.warn("NudeNet python error:", stderr.trim());
        resolve(null);
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        const detections = parsed?.detections;
        if (!Array.isArray(detections)) return resolve(null);

        resolve(
          detections
            .filter((d) => d && typeof d === "object")
            .map((d) => ({
              class: String((d as any).class ?? ""),
              score: toNumber((d as any).score),
              box: Array.isArray((d as any).box) ? ((d as any).box as [number, number, number, number]) : undefined,
            }))
            .filter((d) => d.class && Number.isFinite(d.score))
        );
      } catch {
        resolve(null);
      }
    });
  });
}
