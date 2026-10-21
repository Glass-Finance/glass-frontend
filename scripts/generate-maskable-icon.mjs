// scripts/generate-maskable-icon.mjs
//
// Regenerates public/maskable-icon-512.png from the brand icon so the whole
// logo sits inside the Android adaptive-icon safe zone.
//
// WHY A SCRIPT RATHER THAN A ONE-OFF:
// The first attempt shrank the logo to 80% of the canvas WIDTH. That is the
// wrong axis -- Android's maskable safe zone is a CIRCLE of 80% diameter, so a
// logo whose bounding box already spans the canvas still pokes outside that
// circle and gets clipped by the launcher. The mistake was invisible to a
// casual glance and to any check that only asked "is it 512x512 and declared
// maskable". The geometry is measured by src/__tests__/pwa/maskableIcon.test.js,
// which runs as part of npm run test:coverage; this script keeps the asset
// regenerable and consistent with that check.
//
// Usage: node scripts/generate-maskable-icon.mjs
import sharp from "sharp";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "public", "favicon-512x512.png");
const OUTPUT = join(root, "public", "maskable-icon-512.png");

// Matches `background_color` in the manifest. The artwork is drawn on a light
// backdrop, so a light fill keeps it reading correctly under any mask and
// makes the tile fully opaque (a transparent maskable icon shows through the
// launcher's mask and is rejected).
const BACKGROUND = { r: 0xf7, g: 0xf8, b: 0xfc };
const CANVAS = 512;
// Android guarantees only the inner 80% diameter of a maskable icon is visible.
// The 0.98 factor keeps the artwork just inside that limit, leaving room for
// resampling edge softening so no pixel row lands exactly on the boundary.
const SAFE_FRACTION = 0.8 * 0.98;

if (!existsSync(SOURCE)) {
  console.error(`FAIL: ${SOURCE} is missing.`);
  process.exit(1);
}

/** Bounding box of every pixel with meaningful alpha. */
async function subjectBounds(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const bounds = await subjectBounds(SOURCE);
const centre = CANVAS / 2;
const radius = (CANVAS * SAFE_FRACTION) / 2;

// Distance from the artwork's centre to its furthest corner.
const halfDiagonal = Math.hypot(bounds.w / 2, bounds.h / 2);
const scale = radius / halfDiagonal;
const resized = Math.round(CANVAS * scale);

// One uniform scale on both axes, so the logo keeps its aspect ratio.
const artwork = await sharp(SOURCE).resize(resized, resized, { kernel: "lanczos3" }).toBuffer();

await sharp({
  create: { width: CANVAS, height: CANVAS, channels: 4, background: BACKGROUND },
})
  .composite([
    {
      input: artwork,
      left: Math.round(centre - resized / 2),
      top: Math.round(centre - resized / 2),
    },
  ])
  .png()
  .toFile(OUTPUT);

const out = await sharp(OUTPUT).metadata();
console.log(`source subject    : ${bounds.w}x${bounds.h}`);
console.log(
  `safe-zone radius  : ${radius.toFixed(1)}px (diameter ${(radius * 2).toFixed(1)}px of ${CANVAS}px)`,
);
console.log(`scale applied     : ${scale.toFixed(4)}`);
console.log(`artwork drawn at  : ${resized}x${resized}px, centred on ${CANVAS}x${CANVAS}`);
console.log(`written           : ${OUTPUT}`);
console.log(`output            : ${out.width}x${out.height} ${out.format}`);
