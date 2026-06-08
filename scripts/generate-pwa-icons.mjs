#!/usr/bin/env node
/**
 * scripts/generate-pwa-icons.mjs
 *
 * Generates four static PNG icons for the FinTrack PWA:
 *   • Solid emerald background  (#10B981) — matches manifest background_color so Android
 *     shows a "filled" icon instead of a dark square on the home screen
 *   • White TrendingUp arrow  (Lucide icon, stroke-width 2.5, stroke-linecap round)
 *
 * Output → public/
 *   icon-192.png           192×192  purpose: any
 *   icon-512.png           512×512  purpose: any
 *   icon-maskable-192.png  192×192  purpose: maskable  (content within 80% safe zone)
 *   icon-maskable-512.png  512×512  purpose: maskable  (content within 80% safe zone)
 *
 * Pure Node.js — zero external dependencies (only zlib + fs built-ins).
 */

import { deflateSync }              from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath }            from 'url';
import path                         from 'path';

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

// ── PNG writer (RGB, no alpha) ────────────────────────────────────────────────
function writePng(pixels, size, filePath) {
  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = 1 + size * 3;
  const raw    = Buffer.allocUnsafe(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 3;
      const d = y * stride + 1 + x * 3;
      raw[d] = pixels[s]; raw[d+1] = pixels[s+1]; raw[d+2] = pixels[s+2];
    }
  }

  const png = Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(filePath, png);
  console.log(`  ✓  ${path.basename(filePath)}  (${size}×${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

// ── Drawing helpers ────────────────────────────────────────────────────────────

/** Set an RGB pixel; silently ignores out-of-bounds coords. */
function setPx(buf, size, x, y, r, g, b) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 3;
  buf[i] = r; buf[i+1] = g; buf[i+2] = b;
}

/**
 * Returns true if the pixel center (px+0.5, py+0.5) is inside
 * a filled rounded rectangle centered at (cx, cy) with given side and radius.
 */
function inRRect(px, py, cx, cy, side, r) {
  const l = cx - side/2, ri = cx + side/2;
  const t = cy - side/2, b  = cy + side/2;
  const x = px + 0.5,    y  = py + 0.5;
  if (x < l || x > ri || y < t || y > b) return false;
  const nearL = x < l + r,  nearR = x > ri - r;
  const nearT = y < t + r,  nearB = y > b  - r;
  if (nearL && nearT) return (x-(l+r))**2  + (y-(t+r))**2  <= r*r;
  if (nearR && nearT) return (x-(ri-r))**2 + (y-(t+r))**2  <= r*r;
  if (nearL && nearB) return (x-(l+r))**2  + (y-(b-r))**2  <= r*r;
  if (nearR && nearB) return (x-(ri-r))**2 + (y-(b-r))**2  <= r*r;
  return true;
}

/** Perpendicular distance from point (px,py) to segment (x1,y1)→(x2,y2), with round caps. */
function dSeg(px, py, x1, y1, x2, y2) {
  const dx = x2-x1, dy = y2-y1;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return Math.hypot(px-x1, py-y1);
  const t = Math.max(0, Math.min(1, ((px-x1)*dx + (py-y1)*dy) / lenSq));
  return Math.hypot(px-(x1+t*dx), py-(y1+t*dy));
}

/** Draw a thick stroke-linecap:round line. */
function drawLine(buf, size, x1, y1, x2, y2, sw, r, g, b) {
  const half = sw / 2;
  const x0 = Math.max(0,      Math.floor(Math.min(x1,x2) - half - 1));
  const xE = Math.min(size-1, Math.ceil( Math.max(x1,x2) + half + 1));
  const y0 = Math.max(0,      Math.floor(Math.min(y1,y2) - half - 1));
  const yE = Math.min(size-1, Math.ceil( Math.max(y1,y2) + half + 1));
  for (let y = y0; y <= yE; y++)
    for (let x = x0; x <= xE; x++)
      if (dSeg(x+.5, y+.5, x1, y1, x2, y2) <= half)
        setPx(buf, size, x, y, r, g, b);
}

// ── Icon renderer ──────────────────────────────────────────────────────────────
/**
 * Renders the FinTrack icon to an RGB pixel buffer.
 *
 * Design: solid emerald (#10B981) background + white TrendingUp arrow.
 * The background matches manifest.json background_color so Android shows a
 * "filled" icon instead of a dark square.
 *
 * @param {number}  size      Canvas size (192 or 512).
 * @param {boolean} maskable  If true, keep visual content inside the 80% safe zone.
 */
function drawIcon(size, maskable = false) {
  const buf = new Uint8Array(size * size * 3);
  const cx  = size / 2;
  const cy  = size / 2;

  // ── 1. Background fill (#10B981 — emerald-500) ──────────────────────────────
  for (let i = 0; i < size * size; i++) {
    buf[i*3] = 16; buf[i*3+1] = 185; buf[i*3+2] = 129;
  }

  // ── 2. White TrendingUp arrow (Lucide, 24×24 viewbox) ───────────────────────
  // The icon spans (2,7)→(22,17) — visual center (12,12) = viewbox center ✓
  //
  // Path 1 — arrow indicator: (16,7)→(22,7)→(22,13)
  //   M16 7h6v6
  // Path 2 — trend line:      (22,7)→(13.5,15.5)→(8.5,10.5)→(2,17)
  //   m22 7  -8.5 8.5  -5 -5  L2 17
  //
  const arrowSz = Math.round(size * (maskable ? 0.37 : 0.47));
  const sc      = arrowSz / 24;                       // viewbox → pixel scale
  const sw      = Math.max(2, Math.round(sc * 2.8));  // stroke width (2.5 in viewbox)
  const ox      = cx - arrowSz / 2;                   // arrow area origin X
  const oy      = cy - arrowSz / 2;                   // arrow area origin Y

  // Map a 24×24 viewbox point to pixel coordinates
  const p = (vx, vy) => [ox + vx * sc, oy + vy * sc];

  const drawPath = (pts) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = p(...pts[i]);
      const [x2, y2] = p(...pts[i+1]);
      drawLine(buf, size, x1, y1, x2, y2, sw, 255, 255, 255);
    }
  };

  // Arrow indicator (top-right corner: horizontal then vertical)
  drawPath([[16,7],[22,7],[22,13]]);

  // Trend line (bottom-left to top-right, zigzag)
  drawPath([[22,7],[13.5,15.5],[8.5,10.5],[2,17]]);

  return buf;
}

// ── Generate all four icons ────────────────────────────────────────────────────
console.log('Generating PWA icons…');
mkdirSync(PUBLIC, { recursive: true });

writePng(drawIcon(192, false), 192, path.join(PUBLIC, 'icon-192.png'));
writePng(drawIcon(512, false), 512, path.join(PUBLIC, 'icon-512.png'));
writePng(drawIcon(192, true),  192, path.join(PUBLIC, 'icon-maskable-192.png'));
writePng(drawIcon(512, true),  512, path.join(PUBLIC, 'icon-maskable-512.png'));

console.log('Done ✓');
