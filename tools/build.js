// Inline the sticker sheets from assets/assets.json into client.js.
// Client modules run in the browser, so the images ride along as data URIs
// instead of relying on package-relative file URLs.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// tools/ 下运行：项目根 = 本文件的上一级。
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const assets = JSON.parse(readFileSync(join(root, 'assets', 'assets.json'), 'utf8'));
const template = readFileSync(join(root, 'client.template.js'), 'utf8');

const stickers = {};
for (const [key, base64] of Object.entries(assets)) {
  stickers[key] = `data:image/webp;base64,${base64}`;
}

const marker = '__STICKERS__';
if (!template.includes(marker)) throw new Error(`client.template.js is missing ${marker}`);

const out = template.replace(marker, JSON.stringify(stickers));
if (out.includes(marker)) throw new Error('sticker placeholder was not fully replaced');

writeFileSync(join(root, 'client.js'), out);
console.log(`client.js written: ${(out.length / 1024).toFixed(1)} KB, ${Object.keys(stickers).length} stickers`);
