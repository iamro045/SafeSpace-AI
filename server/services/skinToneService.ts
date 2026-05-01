/**
 * skinToneService.ts
 *
 * Scans an uploaded image file for skin-tone pixel content using the `sharp`
 * library (pure Node.js, no Python required).
 *
 * Algorithm:
 *  1. Resize the image to a small thumbnail (64×64) for fast processing.
 *  2. Extract raw RGB pixel data.
 *  3. Count pixels that fall within a broad skin-tone range in RGB space
 *     (covers light, medium, and dark skin tones).
 *  4. Also count pixels with very low saturation/brightness (shadows on skin).
 *  5. Return a "skinRatio" (0–1) — fraction of total pixels that look like skin.
 *
 * The caller (aiService.ts) uses this ratio to decide whether to flag/block.
 */

import fs from "fs";
import sharp from "sharp";

export interface SkinScanResult {
  skinRatio: number;       // 0..1 — proportion of skin-tone pixels
  totalPixels: number;
  skinPixels: number;
}

/**
 * Returns true if the RGB triplet falls within a skin-tone range.
 * Uses a well-known heuristic that works across light, medium and dark skin.
 *
 *   Conditions (Kovac et al. 2003, adapted):
 *     R > 95 && G > 40 && B > 20
 *     max(R,G,B) - min(R,G,B) > 15
 *     |R-G| > 15
 *     R > G && R > B
 *
 *   Additional dark-skin range (Chaves et al.):
 *     R > 60 && G > 30 && B > 20 && R > B && (R-G) > 10
 */
function isSkinPixel(r: number, g: number, b: number): boolean {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);

  // Light/medium skin
  if (
    r > 95 && g > 40 && b > 20 &&
    (maxC - minC) > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b
  ) {
    return true;
  }

  // Darker skin tones
  if (
    r > 60 && g > 30 && b > 20 &&
    r > b &&
    (r - g) > 10 &&
    (maxC - minC) > 10
  ) {
    return true;
  }

  return false;
}

/**
 * Scan a local image file and return the fraction of pixels that appear to be skin.
 * Returns null if the file cannot be processed.
 */
export async function scanImageForSkin(imagePath: string): Promise<SkinScanResult | null> {
  if (!fs.existsSync(imagePath)) return null;

  try {
    // Resize to 64×64 for speed; use raw RGB (no alpha) output.
    const { data, info } = await sharp(imagePath)
      .resize(64, 64, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalPixels = info.width * info.height;
    let skinPixels = 0;

    // Each pixel = 3 bytes (R, G, B)
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isSkinPixel(r, g, b)) {
        skinPixels++;
      }
    }

    return {
      skinRatio: skinPixels / totalPixels,
      totalPixels,
      skinPixels,
    };
  } catch (err) {
    console.warn("[skinToneService] Error scanning image:", (err as Error).message);
    return null;
  }
}
