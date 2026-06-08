#!/usr/bin/env node
/**
 * scripts/generate-pwa-icons.mjs
 *
 * Generates four static PNG icons for the PWA manifest.
 * Pure Node.js — zero external dependencies (uses only zlib + fs built-ins).
 *
 * Output → public/
 *   icon-192.png           192×192  purpose: any
 *   icon-512.png           512×512  purpose: any
 *   icon-maskable-192.png  192×192  purpose: maskable  (safe-zone design)
 *   icon-maskable-512.png  512×512  purpose: maskable  (safe-zone design)
 *
 * Design: dark background (#0A0E1A) + green circle (#10B981) + white "F"
 */

import { deflateSync }        from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath }      from 'url';
import path                   from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC    = path.resolve(__dirname, '..', 'public');

// ── CRC32 (required for PNG chunks) ───────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG chunk helper ───────────────────────────────────────────────────────────
function makeChunk(type, data) {
  const len  = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const tp   = Buffer.from(type, 'ascii');
  const crcv = Buffer.allocUnsafe(4); crcv.writeUInt32BE(crc32(Buffer.concat([tp, data])));
  return Buffer.concat([len, tp, data, crcv]);
}

// ── PNG writer — accepts RGB Uint8Array ────────────────────────────────────────
function writePng(pixels, width, height, filePath) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic bytes

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8; // bit depth: 8
  ihdr[9]  = 2; // color type: RGB truecolor
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace: none

  // Scanlines: 1 filter byte (0 = None) + RGB pixels per row
  const stride = 1 + width * 3;
  const raw    = Buffer.allocUnsafe(height * stride);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 3;
      const dst = y * stride + 1 + x * 3;
      raw[dst]     = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
    }
  }

  const png = Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);

  writeFileSync(filePath, png);
  console.log(`  ✓ ${path.basename(filePath)}  (${width}×${height}, ${(png.length / 1024).toFixed(1)} KB)`);
}

// ── Icon renderer ──────────────────────────────────────────────────────────────
// Palette
const BG    = [10,  14,  26 ]; // #0A0E1A — dark navy background
const GREEN = [16,  185, 129]; // #10B981 — brand green
const WHITE = [255, 255, 255]; // #FFFFFF — letter fill

/**
 * @param {number}  size     Canvas size (192 or 512)
 * @param {boolean} maskable If true, keep visual content within the 80% safe zone
 */
function drawIcon(size, maskable = false) {
  const px = new Uint8Array(size * size * 3);
  const cx = size / 2;
  const cy = size / 2;

  // Maskable safe zone: visual content must stay within central 80%
  // → effective radius = 40% of size.  Non-maskable can use more (36%).
  const circleR = maskable ? size * 0.29 : size * 0.36;

  // ── Step 1: fill background ────────────────────────────────────────────────
  for (let i = 0; i < size * size; i++) {
    px[i * 3]     = BG[0];
    px[i * 3 + 1] = BG[1];
    px[i * 3 + 2] = BG[2];
  }

  // ── Step 2: draw green circle ──────────────────────────────────────────────
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= circleR) {
        const i    = (y * size + x) * 3;
        px[i]     = GREEN[0];
        px[i + 1] = GREEN[1];
        px[i + 2] = GREEN[2];
      }
    }
  }

  // ── Step 3: draw "F" letterform (3 rectangles) ────────────────────────────
  function fillRect(x0, y0, x1, y1) {
    for (let y = Math.round(y0); y < Math.round(y1); y++) {
      for (let x = Math.round(x0); x < Math.round(x1); x++) {
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const i    = (y * size + x) * 3;
        px[i]     = WHITE[0];
        px[i + 1] = WHITE[1];
        px[i + 2] = WHITE[2];
      }
    }
  }

  const r   = circleR;
  const sw  = r * 0.18;  // stroke width  (width of vertical bar)
  const sh  = r * 0.145; // stroke height (height of horizontal bars)
  // Position the F slightly left of center so it reads as centered visually
  const fL  = cx - r * 0.26;               // left edge of vertical bar
  const fT  = cy - r * 0.60;               // top of F
  const fB  = cy + r * 0.60;               // bottom of F

  fillRect(fL,       fT,            fL + sw,       fB);          // vertical bar
  fillRect(fL,       fT,            fL + r * 0.68, fT + sh);     // top horizontal
  fillRect(fL,       cy - sh * 0.7, fL + r * 0.55, cy + sh * 0.7); // middle horizontal

  return px;
}

// ── Generate all four icons ────────────────────────────────────────────────────
console.log('Generating PWA icons…');
mkdirSync(PUBLIC, { recursive: true });

writePng(drawIcon(192, false), 192, 192, path.join(PUBLIC, 'icon-192.png'));
writePng(drawIcon(512, false), 512, 512, path.join(PUBLIC, 'icon-512.png'));
writePng(drawIcon(192, true),  192, 192, path.join(PUBLIC, 'icon-maskable-192.png'));
writePng(drawIcon(512, true),  512, 512, path.join(PUBLIC, 'icon-maskable-512.png'));

console.log('Done ✓');
