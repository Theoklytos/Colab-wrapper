// generate-icons.js — Generate PWA icons from source SVG
//
// Usage:
//   npm install sharp   (only needed once, as a devDependency)
//   node scripts/generate-icons.js
//
// Generates:
//   pwa/icons/icon-{72,96,128,144,152,192,384,512}.png  — standard (any)
//   pwa/icons/icon-192-maskable.png                      — maskable (safe zone)
//   pwa/icons/icon-512-maskable.png                      — maskable (safe zone)
//
// Maskable icons:
//   Android adaptive icons use a "safe zone" = center 80% of the canvas.
//   Content outside the safe zone may be cropped by the launcher shape.
//   For maskable icons we add 10% padding on each side (80% safe zone).
//   Background: solid Colab orange (#f9ab00) to look great on all shapes.

import sharp from 'sharp';
import { mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const SVG_PATH  = join(ROOT, 'pwa/icons/source/icon.svg');
const OUT_DIR   = join(ROOT, 'pwa/icons');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];

// Maskable safe zone: 80% of canvas. Padding = 10% per side.
const MASKABLE_PADDING = 0.10;
// Colab orange — used as maskable icon background
const MASKABLE_BG = { r: 249, g: 171, b: 0, alpha: 255 };

async function main() {
  // Verify source SVG exists
  try {
    await access(SVG_PATH);
  } catch {
    console.error(`Source SVG not found: ${SVG_PATH}`);
    console.error('Expected at: pwa/icons/source/icon.svg');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Generating icons from: ${SVG_PATH}\n`);

  // Standard icons
  for (const size of SIZES) {
    const outPath = join(OUT_DIR, `icon-${size}.png`);
    await sharp(SVG_PATH)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 10, alpha: 255 }, // dark bg matches theme_color
      })
      .png({ compressionLevel: 9, palette: false })
      .toFile(outPath);
    console.log(`  ✓ icon-${size}.png`);
  }

  // Maskable icons (192 and 512 only — spec requires at least one of each)
  for (const size of MASKABLE_SIZES) {
    const padding    = Math.round(size * MASKABLE_PADDING);
    const innerSize  = size - (padding * 2);
    const outPath    = join(OUT_DIR, `icon-${size}-maskable.png`);

    // Render the SVG logo into the inner (safe zone) size
    const logoBuffer = await sharp(SVG_PATH)
      .resize(innerSize, innerSize, {
        fit: 'contain',
        background: { r: 249, g: 171, b: 0, alpha: 0 }, // transparent — composite onto bg
      })
      .png()
      .toBuffer();

    // Create solid background canvas, composite the logo centered
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: MASKABLE_BG,
      }
    })
      .composite([{ input: logoBuffer, left: padding, top: padding }])
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    console.log(`  ✓ icon-${size}-maskable.png (${innerSize}px logo, ${padding}px padding)`);
  }

  console.log(`\nAll icons generated in: ${OUT_DIR}`);
  console.log('\nNote: Generate a screenshot at 1080×2340px and save as:');
  console.log('  pwa/screenshots/launcher-1080x2340.png');
  console.log('This is used by Chrome\'s enhanced install bottom sheet on Android 119+.\n');
}

main().catch(err => {
  console.error('Icon generation failed:', err.message);
  process.exit(1);
});
