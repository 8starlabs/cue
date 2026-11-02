import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { complete } from "../packages/cue/dist/complete.js";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDirectory = path.join(root, "assets", "brand");
const outputDirectory = path.join(root, "assets", "social");
const commandIconPath = path.join(
  root,
  "packages",
  "cue",
  "node_modules",
  "@withfig",
  "autocomplete",
  "icons",
  "command.png",
);
const discoLogoPath = path.join(brandDirectory, "8starlabs-disco.png");

const completions = (await complete("git c", root)).slice(0, 7);
if (completions.length < 2) throw new Error("Could not load Cue's Git command suggestions.");

const commandIcon = `data:image/png;base64,${(await readFile(commandIconPath)).toString("base64")}`;
const discoLogo = `data:image/png;base64,${(await readFile(discoLogoPath)).toString("base64")}`;
const xml = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function cueMark(x, y, size) {
  return `<g transform="translate(${x} ${y}) scale(${size / 32})">
    <path d="M16 2v28M2 16h28M6.1 6.1l19.8 19.8m0-19.8L6.1 25.9" fill="none" stroke="#3B6ED3" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function starField(width, height, seed) {
  const random = seededRandom(seed);
  return Array.from({ length: 260 }, () => {
    const x = Math.round(random() * width);
    const y = Math.round(random() * height);
    const radius = (0.45 + random() * 1.25).toFixed(2);
    const opacity = (0.24 + random() * 0.68).toFixed(2);
    const fill = random() > 0.72 ? "#8ccaff" : "#f1f5ff";
    const star = `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" opacity="${opacity}"/>`;
    if (random() > 0.988) {
      const flare = Number(radius) * 3.5;
      return `${star}<path d="M ${x - flare} ${y}H${x + flare}M ${x} ${y - flare}V${y + flare}" stroke="#d9efff" stroke-opacity=".58" stroke-width=".7"/>`;
    }
    return star;
  }).join("");
}

function definitions() {
  return `
    <defs>
      <linearGradient id="night" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#07101c"/><stop offset=".48" stop-color="#071321"/><stop offset="1" stop-color="#05070d"/>
      </linearGradient>
      <radialGradient id="nebulaBlue">
        <stop stop-color="#2b83c7" stop-opacity=".48"/><stop offset="1" stop-color="#2b83c7" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="nebulaRed">
        <stop stop-color="#f15d4d" stop-opacity=".25"/><stop offset="1" stop-color="#f15d4d" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="orbitBlue" x1="0" y1="0" x2="1" y2=".2">
        <stop stop-color="#16346e" stop-opacity="0"/><stop offset=".22" stop-color="#397fd5"/><stop offset=".48" stop-color="#e5f7ff"/><stop offset=".7" stop-color="#53a8ef"/><stop offset="1" stop-color="#173a7b" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="orbitFire" x1="0" y1="0" x2="1" y2=".1">
        <stop stop-color="#123d8e" stop-opacity="0"/><stop offset=".2" stop-color="#e94e45"/><stop offset=".43" stop-color="#ffbd87"/><stop offset=".62" stop-color="#f14e4e"/><stop offset=".84" stop-color="#497fd0"/><stop offset="1" stop-color="#3879c5" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="orbitCore" x1="0" y1="0" x2="1" y2="0">
        <stop stop-color="#5da7f4" stop-opacity="0"/><stop offset=".42" stop-color="#d8f4ff"/><stop offset=".56" stop-color="#fff4dd"/><stop offset=".75" stop-color="#ff7158"/><stop offset="1" stop-color="#ff7158" stop-opacity="0"/>
      </linearGradient>
      <filter id="orbitBloom" x="-20%" y="-120%" width="140%" height="340%">
        <feGaussianBlur stdDeviation="28"/>
      </filter>
      <filter id="orbitSoft" x="-20%" y="-100%" width="140%" height="300%">
        <feGaussianBlur stdDeviation="10"/>
      </filter>
      <filter id="windowShadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#00030a" flood-opacity=".62"/>
      </filter>
      <filter id="popupShadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity=".55"/>
      </filter>
      <filter id="brandShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000000" flood-opacity=".55"/>
      </filter>
      <style>.mono{font-family:Menlo,Monaco,monospace;letter-spacing:.16px}.system{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}.italic{font-style:italic}</style>
    </defs>`;
}

function background(width, height, seed) {
  const highSweep = `M ${-width * 0.13} ${height * 0.12} C ${width * 0.22} ${height * 0.21} ${width * 0.56} ${height * 0.53} ${width * 1.13} ${height * 0.36}`;
  const mainSweep = `M ${-width * 0.13} ${height * 0.3} C ${width * 0.2} ${height * 0.37} ${width * 0.47} ${height * 0.83} ${width * 1.13} ${height * 0.53}`;
  const lowSweep = `M ${-width * 0.13} ${height * 0.51} C ${width * 0.27} ${height * 0.54} ${width * 0.56} ${height * 0.96} ${width * 1.13} ${height * 0.73}`;
  return `
    <rect width="${width}" height="${height}" fill="url(#night)"/>
    <ellipse cx="${width * 0.25}" cy="${height * 0.25}" rx="${width * 0.46}" ry="${height * 0.54}" fill="url(#nebulaBlue)"/>
    <ellipse cx="${width * 0.84}" cy="${height * 0.79}" rx="${width * 0.41}" ry="${height * 0.42}" fill="url(#nebulaRed)"/>
    <path d="${highSweep}" fill="none" stroke="url(#orbitBlue)" stroke-width="${height * 0.105}" opacity=".38"/>
    <path d="${highSweep}" fill="none" stroke="url(#orbitBlue)" stroke-width="${height * 0.038}" opacity=".62"/>
    <path d="${highSweep}" fill="none" stroke="url(#orbitCore)" stroke-width="${Math.max(2.5, height * 0.005)}" opacity=".92"/>
    <path d="${mainSweep}" fill="none" stroke="url(#orbitFire)" stroke-width="${height * 0.11}" opacity=".42"/>
    <path d="${mainSweep}" fill="none" stroke="url(#orbitBlue)" stroke-width="${height * 0.046}" opacity=".68"/>
    <path d="${mainSweep}" fill="none" stroke="url(#orbitCore)" stroke-width="${Math.max(3.5, height * 0.007)}" opacity=".95"/>
    <path d="${lowSweep}" fill="none" stroke="url(#orbitFire)" stroke-width="${height * 0.058}" opacity=".66"/>
    <path d="${lowSweep}" fill="none" stroke="url(#orbitCore)" stroke-width="${Math.max(1.6, height * 0.003)}" opacity=".91"/>
    <g>${starField(width, height, seed)}</g>
    <rect width="${width}" height="${height}" fill="#020711" opacity=".16"/>`;
}

function popup({ x, y, width, rowHeight, fontSize, iconSize, scale }) {
  const inset = Math.round(6 * scale);
  const horizontalPadding = Math.round(9 * scale);
  const footerHeight = Math.round(25 * scale);
  const verticalPadding = Math.round(5 * scale);
  const height = verticalPadding * 2 + completions.length * rowHeight + footerHeight + 1;
  const labelX = x + horizontalPadding + iconSize + Math.round(7 * scale);
  const charWidth = fontSize * 0.61;
  const maxChars = Math.floor((width - (labelX - x) - horizontalPadding - 12 * scale) / charWidth);
  const rows = completions
    .map((completion, index) => {
      const rowY = y + verticalPadding + index * rowHeight;
      const baseline = rowY + rowHeight * 0.68;
      const selected = index === 0;
      const hint = completion.argumentHint ?? "";
      const availableForHint = maxChars - completion.name.length - (hint ? 2 : 0);
      const shownHint =
        hint && availableForHint > 3
          ? hint.length > availableForHint
            ? `${hint.slice(0, availableForHint - 1)}…`
            : hint
          : "";
      const shownName =
        completion.name.length > maxChars
          ? `${completion.name.slice(0, maxChars - 1)}…`
          : completion.name;
      const prefix = shownName.toLowerCase().startsWith(completion.typedPrefix.toLowerCase())
        ? completion.typedPrefix
        : "";
      const prefixWidth = prefix.length * charWidth;
      const iconY = rowY + (rowHeight - iconSize) / 2;
      const commandLabel = selected ? "#ffffff" : "#c5c9d2";
      return `
      ${selected ? `<rect x="${x + inset}" y="${rowY + 1}" width="${width - inset * 2}" height="${rowHeight - 2}" rx="${Math.round(5 * scale)}" fill="#2e5fbf"/>` : ""}
      <image href="${commandIcon}" x="${x + horizontalPadding}" y="${iconY}" width="${iconSize}" height="${iconSize}"/>
      ${prefix ? `<rect x="${labelX - 1}" y="${baseline - fontSize * 0.8}" width="${prefixWidth + 2}" height="${fontSize * 1.02}" rx="1" fill="#cfac4c" fill-opacity=".48"/>` : ""}
      <text x="${labelX}" y="${baseline}" class="mono" font-size="${fontSize}" font-weight="${selected ? 650 : 400}" fill="${commandLabel}">${xml(prefix)}</text>
      <text x="${labelX + prefixWidth}" y="${baseline}" class="mono" font-size="${fontSize}" font-weight="${selected ? 650 : 400}" fill="${commandLabel}">${xml(shownName.slice(prefix.length))}</text>
      ${shownHint ? `<text x="${labelX + shownName.length * charWidth + fontSize * 0.62}" y="${baseline}" class="mono" font-size="${fontSize}" fill="#9ea4ae">${xml(shownHint)}</text>` : ""}`;
    })
    .join("");
  const footerY = y + verticalPadding + completions.length * rowHeight;
  const description = completions[0].description ?? "";
  return {
    height,
    markup: `
      <g filter="url(#popupShadow)">
        <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.round(8 * scale)}" fill="#292a2e" stroke="#505157" stroke-width="1"/>
        ${rows}
        <line x1="${x + inset}" y1="${footerY}" x2="${x + width - inset}" y2="${footerY}" stroke="#ffffff" stroke-opacity=".16"/>
        <text x="${x + horizontalPadding}" y="${footerY + footerHeight * 0.7}" class="system italic" font-size="${fontSize * 0.91}" fill="#c5c8ce">${xml(description)}</text>
        <text x="${x + width - horizontalPadding}" y="${footerY + footerHeight * 0.68}" class="mono" text-anchor="end" font-size="${fontSize * 0.64}" fill="#898d95">(⌘I)</text>
      </g>`,
  };
}

function terminalWindow({ x, y, width, scale }) {
  const titleBarHeight = 34 * scale;
  const promptFont = 20 * scale;
  const prompt = "~ % git c";
  const promptX = x + 26 * scale;
  const promptBaseline = y + titleBarHeight + 46 * scale;
  const caretX = promptX + prompt.length * promptFont * 0.61;
  const popupX = caretX + 3 * scale;
  const popupY = promptBaseline + 9 * scale;
  const panel = popup({
    x: popupX,
    y: popupY,
    width: 504 * scale,
    rowHeight: 25 * scale,
    fontSize: 16 * scale,
    iconSize: 18 * scale,
    scale,
  });
  const caretHeight = promptFont * 1.18;
  const height = popupY + panel.height + 12 * scale - y;
  return `
    <g filter="url(#windowShadow)">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${9 * scale}" fill="#080a0f" stroke="#727681" stroke-opacity=".78" stroke-width="1"/>
      <path d="M ${x + 9 * scale} ${y} H ${x + width - 9 * scale} Q ${x + width} ${y} ${x + width} ${y + 9 * scale} V ${y + titleBarHeight} H ${x} V ${y + 9 * scale} Q ${x} ${y} ${x + 9 * scale} ${y} Z" fill="#34363b"/>
      <line x1="${x}" y1="${y + titleBarHeight}" x2="${x + width}" y2="${y + titleBarHeight}" stroke="#555861" stroke-opacity=".85"/>
      <circle cx="${x + 20 * scale}" cy="${y + titleBarHeight / 2}" r="${5.5 * scale}" fill="#f36a60"/>
      <circle cx="${x + 38 * scale}" cy="${y + titleBarHeight / 2}" r="${5.5 * scale}" fill="#f4bd4d"/>
      <circle cx="${x + 56 * scale}" cy="${y + titleBarHeight / 2}" r="${5.5 * scale}" fill="#57c96a"/>
      ${cueMark(x + width / 2 - 18 * scale, y + (titleBarHeight - 16 * scale) / 2, 16 * scale)}
      <text x="${x + width / 2 + 5 * scale}" y="${y + titleBarHeight * 0.68}" class="system" font-size="${13 * scale}" font-weight="600" fill="#e3e5e9">Cue</text>
      <text x="${promptX}" y="${promptBaseline}" class="mono" font-size="${promptFont}" fill="#e8ebf1">${xml(prompt)}</text>
      <rect x="${caretX}" y="${promptBaseline - promptFont * 0.94}" width="${promptFont * 0.55}" height="${caretHeight}" rx="1" fill="#d7e9f2"/>
    </g>
    ${panel.markup}`;
}

function composition(width, height, seed) {
  const scale = width / 1280;
  const terminalX = 86 * scale;
  const terminalY = 130 * scale;
  const terminalWidth = 660 * scale;
  const cueMarkSize = 43 * scale;
  const cueX = 56 * scale;
  const cueY = 35 * scale;
  const discoSize = 102 * scale;
  const discoX = width - 142 * scale;
  const discoY = 17 * scale;
  const terminal = terminalWindow({ x: terminalX, y: terminalY, width: terminalWidth, scale });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${definitions()}
  ${background(width, height, seed)}
  <g filter="url(#brandShadow)">
    ${cueMark(cueX, cueY, cueMarkSize)}
    <text x="${cueX + cueMarkSize + 12 * scale}" y="${cueY + cueMarkSize * 0.7}" class="system" font-size="${29 * scale}" font-weight="680" letter-spacing="-1.2" fill="#f4f7ff">Cue</text>
    <image href="${discoLogo}" x="${discoX}" y="${discoY}" width="${discoSize}" height="${discoSize}" preserveAspectRatio="xMidYMid meet"/>
  </g>
  ${terminal}
</svg>`;
}

await mkdir(brandDirectory, { recursive: true });
await mkdir(outputDirectory, { recursive: true });

for (const [name, width, height, seed] of [["cue-x-post", 1600, 900, 867]]) {
  const svgPath = path.join(outputDirectory, `${name}.svg`);
  const pngPath = path.join(outputDirectory, `${name}.png`);
  await writeFile(svgPath, composition(width, height, seed).replace(/[ \t]+$/gm, ""));
  await execFileAsync("/usr/bin/sips", ["-s", "format", "png", svgPath, "--out", pngPath]);
  console.log(`Created ${path.relative(root, pngPath)}`);
}
