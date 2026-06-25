import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });

// Maskable-safe: full-bleed brand green with centered ball motif.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#59C749"/>
  <circle cx="256" cy="256" r="150" fill="#FFFDF1"/>
  <path d="M178 130c70 56 70 196 0 252M334 130c-70 56-70 196 0 252"
    stroke="#16231a" stroke-width="14" stroke-linecap="round" stroke-dasharray="14 22" fill="none"/>
  <path d="M256 96v320" stroke="#2F8526" stroke-width="22" stroke-linecap="round"/>
</svg>`;

const buf = Buffer.from(svg);
await sharp(buf).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(buf).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(buf).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
console.log("icons written");
