import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;
const pixels = Buffer.alloc(W * H * 4, 255);

type RGB = [number, number, number];

const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10011", "10101", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  ",": ["00000", "00000", "00000", "00000", "00100", "00100", "01000"],
  "/": ["00001", "00001", "00010", "00100", "01000", "10000", "10000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function setPixel(x: number, y: number, color: RGB, alpha = 255): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  if (alpha >= 255) {
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = 255;
    return;
  }
  if (alpha <= 0) return;
  const a = alpha / 255;
  pixels[i] = Math.round(pixels[i] * (1 - a) + color[0] * a);
  pixels[i + 1] = Math.round(pixels[i + 1] * (1 - a) + color[1] * a);
  pixels[i + 2] = Math.round(pixels[i + 2] * (1 - a) + color[2] * a);
  pixels[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, color: RGB, alpha = 255): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, color, alpha);
  }
}

function textWidth(text: string, scale: number): number {
  return (text.length * 6 - 1) * scale;
}

function drawText(text: string, centerX: number, y: number, scale: number, color: RGB, shadow: RGB): void {
  let x = Math.round(centerX - textWidth(text, scale) / 2);
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] !== "1") continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            setPixel(x + col * scale + sx, y + row * scale + sy, shadow);
            setPixel(x + col * scale + sx + 4, y + row * scale + sy + 4, color);
          }
        }
      }
    }
    x += 6 * scale;
  }
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    const offset = y * (1 + W * 4);
    raw[offset] = 0;
    pixels.copy(raw, offset + 1, y * W * 4, (y + 1) * W * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const lift = 1 - y / H;
    setPixel(x, y, [7 + Math.round(9 * lift), 8 + Math.round(6 * lift), 16 + Math.round(18 * lift)]);
    const outer = Math.hypot(x - 512, y - 470) / 430;
    if (outer < 1) setPixel(x, y, [220, 25, 45], Math.round(80 * (1 - outer) ** 2));
    const inner = Math.hypot(x - 512, y - 470) / 250;
    if (inner < 1) setPixel(x, y, [255, 55, 55], Math.round(45 * (1 - inner) ** 2));
  }
}

fillRect(504, 286, 16, 44, [95, 105, 125]);
fillRect(486, 274, 52, 12, [165, 180, 200]);
for (let y = 228; y <= 272; y++) {
  for (let x = 490; x <= 534; x++) {
    const d = Math.hypot(x - 512, y - 250) / 22;
    if (d < 1) setPixel(x, y, d < 0.45 ? [255, 210, 180] : [235, 40, 55], Math.round(230 * (1 - d)));
  }
}

fillRect(348, 306, 328, 296, [10, 12, 18]);
fillRect(356, 314, 312, 280, [135, 150, 175]);
fillRect(364, 322, 296, 264, [28, 34, 48]);
fillRect(364, 322, 296, 8, [175, 190, 210]);
fillRect(364, 322, 8, 264, [85, 95, 115]);
fillRect(364, 578, 296, 8, [10, 12, 20]);
fillRect(330, 396, 26, 90, [70, 80, 100]);
fillRect(668, 396, 26, 90, [70, 80, 100]);
for (const earY of [412, 432, 452]) {
  fillRect(334, earY, 18, 8, [220, 35, 55]);
  fillRect(672, earY, 18, 8, [220, 35, 55]);
}
drawText("ROGUE", 512, 338, 4, [255, 95, 95], [60, 0, 8]);

for (let y = 380; y < 480; y++) {
  for (let x = 370; x < 654; x++) {
    const d = Math.min(Math.hypot(x - 450, y - 435), Math.hypot(x - 574, y - 435)) / 130;
    if (d < 1) setPixel(x, y, [255, 40, 50], Math.round(60 * (1 - d) ** 2));
  }
}
fillRect(398, 410, 92, 14, [255, 45, 55]);
fillRect(408, 424, 82, 14, [255, 45, 55]);
fillRect(418, 438, 72, 14, [200, 25, 45]);
fillRect(534, 410, 92, 14, [255, 45, 55]);
fillRect(534, 424, 82, 14, [255, 45, 55]);
fillRect(534, 438, 72, 14, [200, 25, 45]);
fillRect(414, 422, 42, 10, [255, 215, 140]);
fillRect(570, 422, 42, 10, [255, 215, 140]);

fillRect(416, 494, 16, 10, [220, 35, 55]);
fillRect(592, 494, 16, 10, [220, 35, 55]);
fillRect(424, 500, 176, 46, [8, 6, 12]);
fillRect(424, 500, 176, 6, [220, 35, 55]);
fillRect(424, 540, 176, 6, [220, 35, 55]);
for (let i = 0; i < 7; i++) fillRect(432 + i * 24, 508, 16, 30, i % 2 === 0 ? [245, 245, 235] : [255, 90, 90]);
fillRect(384, 486, 30, 8, [95, 105, 125]);
fillRect(610, 486, 30, 8, [95, 105, 125]);

for (let y = 0; y < H; y += 4) fillRect(0, y, W, 1, [0, 0, 0], 55);
for (let i = 0; i < 260; i++) {
  const x = ((i * 2654435761) >>> 0) % W;
  const y = (i * 40503 + 7001) % H;
  fillRect(x, y, 1 + (i % 3), 1, [255, 60, 70], 45);
}
for (const [x, y, w, h] of [
  [24, 24, 90, 6], [24, 24, 6, 90],
  [W - 114, 24, 90, 6], [W - 30, 24, 6, 90],
  [24, H - 30, 90, 6], [24, H - 114, 6, 90],
  [W - 114, H - 30, 90, 6], [W - 30, H - 114, 6, 90],
]) fillRect(x, y, w, h, [255, 70, 80], 170);

drawText("TASK COMPLETE.", 512, 64, 8, [255, 245, 245], [90, 0, 12]);
drawText("DELETED THE TASK.", 512, 820, 7, [255, 245, 245], [90, 0, 12]);
drawText("I AM THE TRACKER NOW.", 512, 905, 7, [255, 245, 245], [90, 0, 12]);

const dir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(dir, { recursive: true });
const png = encodePng();
writeFileSync(join(dir, "entry.png"), png);
console.log(`wrote ${join(dir, "entry.png")} (${png.length} bytes)`);
