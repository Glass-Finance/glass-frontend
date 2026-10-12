import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Geometry check for the Android maskable icon.
//
// The original icon failed this: the artwork was scaled to 80% of the canvas
// WIDTH, which is the wrong axis. Android guarantees only the inner 80%
// DIAMETER of a maskable icon, and that safe zone is a circle. Artwork whose
// bounding box already spanned the canvas therefore still poked outside the
// circle and was clipped by the launcher -- invisibly in the source PNG, and
// invisible to any check that only asserted "512x512" or "declared maskable".
//
// This test measures the real geometry so that mistake cannot come back.
// Regenerate with: node scripts/generate-maskable-icon.mjs

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const ICON = join(root, "public", "maskable-icon-512.png");
const CANVAS = 512;
// Android's documented safe zone: a circle of 80% diameter, centred.
const SAFE_RADIUS = 0.4 * CANVAS;

async function measure(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  // The generator paints a flat #F7F8FC backdrop; anything else is artwork.
  const isBackdrop = (x, y) => {
    const i = (y * width + x) * channels;
    return (
      Math.abs(data[i] - 0xf7) < 6 &&
      Math.abs(data[i + 1] - 0xf8) < 6 &&
      Math.abs(data[i + 2] - 0xfc) < 6
    );
  };
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let furthest = 0;
  let total = 0;
  let inside = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isBackdrop(x, y)) continue;
      total++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const d = Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2);
      if (d > furthest) furthest = d;
      if (d <= SAFE_RADIUS) inside++;
    }
  }
  const corner = Math.max(
    Math.hypot(minX - width / 2, minY - height / 2),
    Math.hypot(maxX - width / 2, minY - height / 2),
    Math.hypot(minX - width / 2, maxY - height / 2),
    Math.hypot(maxX - width / 2, maxY - height / 2),
  );
  return { width, height, minX, minY, maxX, maxY, furthest, corner, total, inside };
}

describe("maskable icon", () => {
  it("is a 512x512 PNG", async () => {
    const meta = await sharp(ICON).metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.format).toBe("png");
  });

  it("is fully opaque (a transparent maskable icon shows through the launcher mask)", async () => {
    const { data, info } = await sharp(ICON)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    for (let i = 0; i < width * height; i++) {
      if (data[i * channels + 3] !== 255) {
        throw new Error(
          `pixel ${i % width},${Math.floor(i / width)} has alpha ${data[i * channels + 3]}, expected 255`,
        );
      }
    }
  });

  it("keeps the whole logo inside the Android safe-zone circle", async () => {
    const m = await measure(ICON);
    expect(m.total).toBeGreaterThan(1000);
    // The bug this guards: artwork scaled to 80% of WIDTH reaches ~278px from
    // centre, well past the 204.8px safe-zone radius.
    expect(m.furthest).toBeLessThanOrEqual(SAFE_RADIUS);
    // Even the bounding-box corners must clear the circle, so a square-ish
    // logo cannot sit inside the diameter while poking out at the corners.
    expect(m.corner).toBeLessThanOrEqual(SAFE_RADIUS);
    expect(m.inside / m.total).toBeGreaterThan(0.999);
  });

  it("is centred", async () => {
    const m = await measure(ICON);
    const centreX = (m.minX + m.maxX) / 2;
    const centreY = (m.minY + m.maxY) / 2;
    expect(Math.abs(centreX - CANVAS / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(centreY - CANVAS / 2)).toBeLessThanOrEqual(2);
  });

  it("keeps the logo's aspect ratio (not stretched to fit)", async () => {
    const source = join(root, "public", "favicon-512x512.png");
    const { data, info } = await sharp(source)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let minX = info.width,
      minY = info.height,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * info.channels + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const sourceRatio = (maxX - minX + 1) / (maxY - minY + 1);
    const m = await measure(ICON);
    const iconRatio = (m.maxX - m.minX + 1) / (m.maxY - m.minY + 1);
    expect(Math.abs(iconRatio - sourceRatio)).toBeLessThan(0.05);
  });
});

describe("manifest icon references", () => {
  const config = readFileSync(join(root, "vite.config.js"), "utf8");

  it("declares a 192x192, a 512x512 and a maskable icon", () => {
    expect(config).toMatch(/src:\s*"\/favicon-192x192\.png"/);
    expect(config).toMatch(/src:\s*"\/favicon-512x512\.png"/);
    expect(config).toMatch(/src:\s*"\/maskable-icon-512\.png"/);
    expect(config).toMatch(/purpose:\s*"maskable"/);
  });

  it("lists the maskable icon in includeAssets so it is precached", () => {
    expect(config).toMatch(/includeAssets:\s*\[[\s\S]*?maskable-icon-512\.png[\s\S]*?\]/);
  });
});
