#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const targetUrl =
  process.argv[2] ?? "https://pink.awzone.com";
const outputDirectory = new URL("../public/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });

const options = {
  errorCorrectionLevel: "H",
  margin: 4,
  color: {
    dark: "#171316",
    light: "#FFFFFF",
  },
};

await Promise.all([
  QRCode.toFile(
    fileURLToPath(new URL("pink-door-qr.png", outputDirectory)),
    targetUrl,
    { ...options, width: 1600, type: "png" },
  ),
  QRCode.toFile(
    fileURLToPath(new URL("pink-door-qr.svg", outputDirectory)),
    targetUrl,
    { ...options, type: "svg" },
  ),
]);

console.log("Generated QR assets for the configured public URL.");
