// The World in One Day — 26 November 2026
// make.fun bounty: news-image-20261126
//
// A deterministic Node 22 program (standard library only) that draws a
// 1024x1024 newspaper front page summing up Thursday 26 November 2026:
// one lead story (Champions League night) plus five story cards, a
// masthead and a footer. No network, no fonts, no timestamps, no
// randomness: the same code always produces byte-identical PNG bytes.
//
// Run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Output: out/entry.png (1024x1024 PNG)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [245, 239, 227]; // warm newsprint
const INK = [20, 20, 20];
const RED = [168, 30, 30];
const MUTED = [96, 91, 80];
const CARD = [255, 253, 246];

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 3);

function fill(c) {
  for (let i = 0; i < px.length; i += 3) {
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
  }
}

function setPixel(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function rect(x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
  }
}

function hline(x, y, w, c, t) {
  rect(x, y, w, t === undefined ? 1 : t, c);
}

function vline(x, y, h, c, t) {
  rect(x, y, t === undefined ? 1 : t, h, c);
}

// Outline circle by distance test (cheap at these radii).
function circleOutline(cx, cy, r, c, t) {
  const th = t === undefined ? 2 : t;
  for (let y = cy - r - 2; y <= cy + r + 2; y++) {
    for (let x = cx - r - 2; x <= cx + r + 2; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - r) <= th / 2) setPixel(x, y, c);
    }
  }
}

// Tiny globe: circle plus vertical and horizontal meridians.
function globe(cx, cy, r, c) {
  circleOutline(cx, cy, r, c, 2);
  vline(cx - 1, cy - r, 2 * r + 1, c, 2);
  hline(cx - r, cy - 1, 2 * r + 1, c, 2);
}

// ---------------------------------------------------------------- bitmap font
// 5x7 pixel font. Each glyph is 7 rows; each row is a 5-bit number, bit 4
// is the leftmost pixel. Only capitals are stored: the renderer uppercases.
const GLYPHS = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31],
  "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "!": [4, 4, 4, 4, 4, 0, 4],
  '"': [10, 10, 10, 0, 0, 0, 0],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  ",": [0, 0, 0, 0, 4, 4, 8],
  "-": [0, 0, 0, 14, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0, 4],
  "/": [1, 2, 2, 4, 8, 8, 16],
  ":": [0, 4, 0, 0, 0, 4, 0],
  ";": [0, 4, 0, 0, 4, 4, 8],
  "?": [14, 17, 1, 6, 4, 0, 4],
  "%": [25, 26, 2, 4, 8, 11, 19],
  $: [4, 15, 20, 14, 5, 30, 4],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "=": [0, 0, 31, 0, 31, 0, 0],
  "—": [0, 0, 0, 31, 0, 0, 0],
  "•": [0, 0, 14, 14, 14, 0, 0],
  "×": [0, 17, 10, 4, 10, 17, 0],
  "°": [14, 17, 17, 14, 0, 0, 0],
  "…": [0, 0, 0, 0, 0, 0, 21],
};

const NORM = {
  "’": "'",
  "‘": "'",
  "“": '"',
  "”": '"',
  "–": "—",
};

function glyphFor(ch) {
  const up = ch.toUpperCase();
  const norm = NORM[up] || up;
  return GLYPHS[norm] || GLYPHS["?"] || [14, 17, 1, 6, 4, 0, 4];
}

// One character is 5*scale wide plus a 1*scale gap; no gap after the last.
function textWidth(text, scale) {
  const s = String(text).toUpperCase();
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}

function drawText(text, x, y, scale, color, bold) {
  const s = String(text).toUpperCase();
  let cx = x;
  for (const ch of s) {
    const g = glyphFor(ch);
    for (let row = 0; row < 7; row++) {
      const bits = g[row];
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          const px0 = cx + col * scale;
          const py0 = y + row * scale;
          rect(px0, py0, scale, scale, color);
          if (bold) rect(px0 + 1, py0, scale, scale, color);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(text, cx, y, scale, color, bold) {
  const w = textWidth(text, scale);
  drawText(text, cx - Math.floor(w / 2), y, scale, color, bold);
}

function drawTextRight(text, rightX, y, scale, color, bold) {
  drawText(text, rightX - textWidth(text, scale), y, scale, color, bold);
}

// Greedy word wrap to a pixel width; returns the lines.
function wrapText(text, scale, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? cur + " " + word : word;
    if (textWidth(test, scale) <= maxWidth) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draw a wrapped paragraph; returns the number of lines drawn.
function drawParagraph(text, x, y, scale, maxWidth, color, lineGap) {
  const gap = lineGap === undefined ? 4 : lineGap;
  const lines = wrapText(text, scale, maxWidth);
  const lh = 7 * scale + gap;
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, scale, color, false));
  return lines.length;
}

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG() {
  // Filter 0 (none) on every scanline; zlib level 9 is deterministic.
  const stride = W * 3 + 1;
  const raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    raw[y * stride] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * stride + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- the stories
// All six were verified against sources dated 26 November 2026 (or first
// reported that day); the AI-bubble item is a Wall Street Journal analysis
// carried in the morning's news, so its card says "reports say" / "warns".
const LEAD = {
  kicker: "CHAMPIONS LEAGUE • MATCHDAY 5",
  headline: "LILLE STUN BAYERN",
  subhead: "INJURY-HIT CHAMPIONS FALL 2-1 IN FRANCE",
  body: "LIVERPOOL CRUISE 3-0 AT BRUGGE AND BARCA WIN 4-1, BUT PSG'S PERFECT RUN ENDS IN A 2-2 DRAW WITH ROMA.",
  scores: [
    ["LILLE 2-1 BAYERN", "LIVERPOOL 3-0 BRUGGE", "BARCA 4-1 SABAH"],
    ["PSG 2-2 ROMA", "INTER 2-0 STUTTGART", "SPORTING 2-2 MAN UTD"],
    ["ATLETICO 2-0 VIKING", "SHAKHTAR 0-1 FENERBAHCE", "SLAVIA 0-1 VILLARREAL"],
  ],
};

const CARDS_TOP = [
  {
    kicker: "TRADE • TAIPEI",
    headline: "TAIWAN ANSWERS U.S. TARIFF PLAN",
    body: "TAIPEI SAYS IT EXPECTS THE LOWEST TIER UNDER WASHINGTON'S NEW SECTION 301 PLAN — A 15% CAP, NO STACKING. HEARINGS DUE IN JANUARY.",
  },
  {
    kicker: "ENERGY • GULF",
    headline: "OIL NEAR $95 AS GULF STRIKES WIDEN",
    body: "BRENT HOLDS NEAR $95 AFTER REPORTS OF HOUTHI STRIKES ON SAUDI RED SEA PORTS. RIYADH SAYS DRONES WERE DOWNED OVER JIZAN AND JEDDAH.",
  },
];

const CARDS_BOTTOM = [
  {
    kicker: "AMERICA • HOLIDAY",
    headline: "THANKSGIVING IN AMERICA",
    body: "THE U.S. MARKS THANKSGIVING DAY. MARKETS CLOSE FOR THE HOLIDAY, AND THE PRESIDENT PARDONS THE TURKEYS.",
  },
  {
    kicker: "NEW YORK • CENTENARY",
    headline: "MACY'S 100TH PARADE FACES STORM WINDS",
    body: "A RECORD 100 INFLATABLES ARE READY FOR THE 100TH PARADE, BUT A HIGH-WIND WARNING MAY GROUND THE BALLOONS.",
  },
  {
    kicker: "MARKETS • TECHNOLOGY",
    headline: "AI BUBBLE FEARS SPREAD",
    body: "WALL STREET WARNS OF TOO MANY CHIPS AND TOO FEW USERS AS SHARES SLIDE. REPORTS SAY COSTS ARE OUTRUNNING RETURNS.",
  },
];

// ---------------------------------------------------------------- layout
const MX = 36; // side margin
const RX = 988; // right content edge

function doubleRule(y) {
  hline(MX, y, RX - MX, INK, 3);
  hline(MX, y + 5, RX - MX, INK, 1);
}

function drawMasthead() {
  doubleRule(26);
  drawTextCentered("THE WORLD IN ONE DAY", 512, 46, 7, INK, true);
  globe(52, 118, 11, INK);
  globe(972, 118, 11, INK);
  drawTextCentered("THURSDAY, 26 NOVEMBER 2026", 512, 108, 3, INK, false);
  doubleRule(136);
}

function drawLead() {
  // Lead panel: y 152..476
  drawTextCentered(LEAD.kicker, 512, 166, 2, RED, false);
  drawTextCentered(LEAD.headline, 512, 192, 7, INK, true);
  drawTextCentered(LEAD.subhead, 512, 252, 3, INK, false);
  drawParagraph(LEAD.body, 92, 290, 2, 840, INK, 4);
  hline(52, 344, 920, INK, 1);
  const colX = [52, 372, 692];
  LEAD.scores.forEach((row, ri) => {
    row.forEach((score, ci) => {
      drawText(score, colX[ci], 360 + ri * 32, 2, INK, false);
    });
  });
  doubleRule(466);
}

function drawCard(card, x, y, w) {
  const tx = x + 16;
  const tw = w - 32;
  drawText(card.kicker, tx, y + 12, 2, RED, false);
  const headLines = wrapText(card.headline, 3, tw);
  headLines.forEach((ln, i) => drawText(ln, tx, y + 36 + i * 25, 3, INK, false));
  const bodyY = y + 36 + headLines.length * 25 + 10;
  drawParagraph(card.body, tx, bodyY, 2, tw, INK, 4);
}

function drawCards() {
  // Top row: two wide cards, y 486..672
  drawCard(CARDS_TOP[0], MX, 486, 464);
  drawCard(CARDS_TOP[1], 524, 486, 464);
  vline(512, 486, 186, MUTED, 1);
  hline(MX, 684, RX - MX, INK, 1);
  // Bottom row: three cards, y 696..920
  const bw = 301;
  const bx = [MX, 361, 686];
  CARDS_BOTTOM.forEach((card, i) => drawCard(card, bx[i], 696, bw));
  vline(349, 696, 224, MUTED, 1);
  vline(674, 696, 224, MUTED, 1);
}

function drawFooter() {
  doubleRule(934);
  drawTextCentered("SIX STORIES — ONE DAY — 26 NOVEMBER 2026", 512, 952, 3, INK, false);
  drawTextCentered(
    "SOURCES: UEFA • AP • REUTERS • EXECUTIVE YUAN • NPR • WALL STREET JOURNAL",
    512,
    986,
    2,
    MUTED,
    false,
  );
}

// ---------------------------------------------------------------- main
function main() {
  fill(PAPER);
  drawMasthead();
  drawLead();
  drawCards();
  drawFooter();

  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);

  // Guard: read the file back and verify it is a real, non-trivial PNG
  // before reporting success (wrong magic or a tiny file means the
  // encoder broke and the entry would be judged as a blank/corrupt image).
  const back = readFileSync(outPath);
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!back.subarray(0, 8).equals(magic)) {
    throw new Error("entry.png failed the PNG-magic check");
  }
  if (back.length < 10000) {
    throw new Error("entry.png suspiciously small: " + back.length + " bytes");
  }
  console.log("wrote " + outPath + " (" + png.length + " bytes, " + W + "x" + H + ")");
}

main();
