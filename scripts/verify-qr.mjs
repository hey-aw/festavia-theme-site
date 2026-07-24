#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import jsQR from "jsqr";
import { PNG } from "pngjs";

const [imagePath, expectedUrl] = process.argv.slice(2);
if (!imagePath || !expectedUrl) {
  console.error("Usage: verify-qr.mjs <png-path> <expected-url>");
  process.exit(2);
}

const image = PNG.sync.read(await readFile(imagePath));
const decoded = jsQR(
  new Uint8ClampedArray(image.data),
  image.width,
  image.height,
);

if (!decoded) {
  throw new Error(`No QR code found in ${imagePath}.`);
}
if (decoded.data !== expectedUrl) {
  throw new Error(
    `QR destination mismatch: expected ${expectedUrl}, got ${decoded.data}`,
  );
}

console.log(`Verified QR destination: ${decoded.data}`);
