import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { complete } from "../packages/cue/dist/complete.js";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "assets", "social");
const iconPath = path.join(
  root,
  "packages",
  "cue",
  "node_modules",
  "@withfig",
  "autocomplete",
  "icons",
  "command.png",
);

const completions = (await complete("git c", root)).slice(0, 7);
if (completions.length < 2) throw new Error("Could not load Cue's Git command suggestions.");

const commandIcon = `data:image/png;base64,${(await readFile(iconPath)).toString("base64")}`;
const xml = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function popup({ x, y, width, rowHeight, fontSize, iconSize, footerSize }) {
  const padding = Math.max(6, Math.round(rowHeight * 0.19));
  const footerHeight = Math.round(rowHeight * 1.3);
  const height = padding * 2 + completions.length * rowHeight + 1 + footerHeight;
  const labelX = x + padding + iconSize + Math.round(rowHeight * 0.28);
  const maxChars = Math.floor((width - (labelX - x) - padding - 12) / (fontSize * 0.61));
  const rows = completions
    .map((completion, index) => {
      const rowY = y + padding + index * rowHeight;
      const baseline = rowY + rowHeight * 0.69;
      const selected = index === 0;
      const hint = completion.argumentHint ?? "";
      const availableForHint = maxChars - completion.name.length - (hint ? 2 : 0);
      let shownHint = hint;
      if (hint && availableForHint < hint.length) {
        shownHint = availableForHint > 3 ? `${hint.slice(0, availableForHint - 1)}…` : "";
      }
      const titleFits = completion.name.length <= maxChars;
      const shownName = titleFits ? completion.name : `${completion.name.slice(0, maxChars - 1)}…`;
      const prefix =
        selected && shownName.toLowerCase().startsWith(completion.typedPrefix.toLowerCase())
          ? completion.typedPrefix
          : "";
      const prefixWidth = prefix.length * fontSize * 0.61;
      const iconY = rowY + (rowHeight - iconSize) / 2;
      return `
        ${selected ? `<rect x="${x + 5}" y="${rowY + 1}" width="${width - 10}" height="${rowHeight - 2}" rx="${Math.round(rowHeight * 0.2)}" fill="#2e5fbf"/>` : ""}
        <image href="${commandIcon}" x="${x + padding}" y="${iconY}" width="${iconSize}" height="${iconSize}"/>
        ${prefix ? `<rect x="${labelX - 1}" y="${baseline - fontSize * 0.78}" width="${prefixWidth + 2}" height="${fontSize * 1.02}" rx="1.5" fill="#d1ab3d" fill-opacity=".50"/>` : ""}
        <text x="${labelX}" y="${baseline}" class="mono" font-size="${fontSize}" font-weight="${selected ? 700 : 400}" fill="${selected ? "#ffffff" : "#c0c0c3"}">${xml(prefix)}</text>
        <text x="${labelX + prefixWidth}" y="${baseline}" class="mono" font-size="${fontSize}" font-weight="${selected ? 700 : 400}" fill="${selected ? "#ffffff" : "#c0c0c3"}">${xml(shownName.slice(prefix.length))}</text>
        ${shownHint ? `<text x="${labelX + shownName.length * fontSize * 0.61 + fontSize * 0.75}" y="${baseline}" class="mono" font-size="${fontSize}" fill="#a9abb2">${xml(shownHint)}</text>` : ""}`;
    })
    .join("");
  const footerY = y + padding + completions.length * rowHeight;
  const description = completions[0].description ?? "Live command suggestions";
  return {
    height,
    markup: `
      <g filter="url(#popupShadow)">
        <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="9" fill="#2e2e30" stroke="#454548" stroke-width="1.5"/>
        ${rows}
        <line x1="${x + 6}" y1="${footerY}" x2="${x + width - 6}" y2="${footerY}" stroke="#ffffff" stroke-opacity=".13"/>
        <text x="${x + padding + 1}" y="${footerY + footerHeight * 0.67}" class="system italic" font-size="${footerSize}" fill="#c5c5c8">${xml(description)}</text>
        <text x="${x + width - padding}" y="${footerY + footerHeight * 0.67}" class="mono" text-anchor="end" font-size="${Math.max(11, footerSize * 0.67)}" fill="#88898e">(⌘I)</text>
      </g>`,
  };
}

function terminalWindow({
  x,
  y,
  width,
  height,
  promptFont,
  rowHeight,
  popupWidth,
  popupFont,
  iconSize,
  footerSize,
}) {
  const titleBarHeight = 55;
  const prompt = "dev@mac ~ % git c";
  const promptX = x + 36;
  const promptBaseline = y + titleBarHeight + 85;
  const caretX = promptX + prompt.length * promptFont * 0.6;
  const popupX = caretX + 7;
  const popupY = promptBaseline + 22;
  const panel = popup({
    x: popupX,
    y: popupY,
    width: popupWidth,
    rowHeight,
    fontSize: popupFont,
    iconSize,
    footerSize,
  });
  const caretHeight = promptFont * 1.27;
  return `
    <g filter="url(#terminalShadow)">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="15" fill="#090a0d" stroke="#77757a" stroke-opacity=".64" stroke-width="1.5"/>
      <path d="M ${x + 15} ${y} H ${x + width - 15} Q ${x + width} ${y} ${x + width} ${y + 15} V ${y + titleBarHeight} H ${x} V ${y + 15} Q ${x} ${y} ${x + 15} ${y} Z" fill="#3a393d"/>
      <line x1="${x}" y1="${y + titleBarHeight}" x2="${x + width}" y2="${y + titleBarHeight}" stroke="#5c5b60" stroke-opacity=".7"/>
      <circle cx="${x + 28}" cy="${y + 28}" r="11" fill="#f2645c"/>
      <circle cx="${x + 61}" cy="${y + 28}" r="11" fill="#f2bd4c"/>
      <circle cx="${x + 94}" cy="${y + 28}" r="11" fill="#55c65c"/>
      <text x="${x + width / 2}" y="${y + 35}" text-anchor="middle" class="system" font-size="16" font-weight="600" fill="#d0cfd3">dev@mac — zsh — 80×24</text>
      <text x="${promptX}" y="${promptBaseline}" class="mono" font-size="${promptFont}" fill="#eeeeef">${xml(prompt)}</text>
      <rect x="${caretX}" y="${promptBaseline - promptFont * 0.98}" width="${promptFont * 0.58}" height="${caretHeight}" fill="#dfded9"/>
    </g>
    ${panel.markup}`;
}

function definitions() {
  return `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#101a35"/><stop offset=".48" stop-color="#18253a"/><stop offset="1" stop-color="#0d111a"/>
      </linearGradient>
      <linearGradient id="blueRibbon" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#3a8ed1"/><stop offset=".53" stop-color="#3154bf"/><stop offset="1" stop-color="#6239a8"/>
      </linearGradient>
      <linearGradient id="warmRibbon" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#ec4e63"/><stop offset=".55" stop-color="#f07a62"/><stop offset="1" stop-color="#eaa14f"/>
      </linearGradient>
      <radialGradient id="blueGlow"><stop stop-color="#4398d5" stop-opacity=".55"/><stop offset="1" stop-color="#4398d5" stop-opacity="0"/></radialGradient>
      <radialGradient id="coralGlow"><stop stop-color="#f16a62" stop-opacity=".48"/><stop offset="1" stop-color="#f16a62" stop-opacity="0"/></radialGradient>
      <filter id="terminalShadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#03060b" flood-opacity=".48"/></filter>
      <filter id="popupShadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity=".5"/></filter>
      <style>.mono{font-family:Menlo,Monaco,monospace;letter-spacing:.25px}.system{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}.italic{font-style:italic}</style>
    </defs>`;
}

function readmeSvg() {
  const terminal = terminalWindow({
    x: 72,
    y: 97,
    width: 1136,
    height: 560,
    promptFont: 25,
    popupWidth: 700,
    rowHeight: 32,
    popupFont: 19,
    iconSize: 25,
    footerSize: 17,
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    ${definitions()}
    <rect width="1280" height="720" fill="url(#sky)"/>
    <circle cx="140" cy="180" r="440" fill="url(#blueGlow)"/>
    <circle cx="1150" cy="600" r="420" fill="url(#coralGlow)"/>
    <path d="M0 520 C150 435 255 490 382 720 H0Z" fill="url(#blueRibbon)" opacity=".78"/>
    <path d="M730 0 H1280 V385 C1127 323 1064 244 1008 160 C938 55 855 40 730 0Z" fill="url(#warmRibbon)" opacity=".9"/>
    <path d="M1088 720 C1077 610 1140 501 1280 438 V720Z" fill="url(#warmRibbon)" opacity=".75"/>
    <text x="79" y="54" class="system" font-size="18" font-weight="800" letter-spacing="3.5" fill="#ffffff">CUE</text>
    <text x="148" y="54" class="system" font-size="11" font-weight="600" letter-spacing="1.45" fill="#e2e8f1">LIVE AUTOCOMPLETE FOR APPLE TERMINAL</text>
    <text x="1200" y="54" class="system" font-size="11" text-anchor="end" letter-spacing="1.5" fill="#e2e8f1">MACOS · ZSH</text>
    ${terminal}
  </svg>`;
}

function xPostSvg() {
  const terminal = terminalWindow({
    x: 610,
    y: 164,
    width: 920,
    height: 588,
    promptFont: 20,
    popupWidth: 625,
    rowHeight: 27,
    popupFont: 16,
    iconSize: 21,
    footerSize: 14,
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
    ${definitions()}
    <rect width="1600" height="900" fill="url(#sky)"/>
    <circle cx="260" cy="210" r="560" fill="url(#blueGlow)"/>
    <circle cx="1510" cy="730" r="500" fill="url(#coralGlow)"/>
    <path d="M0 735 C130 636 236 636 387 900 H0Z" fill="url(#blueRibbon)" opacity=".72"/>
    <path d="M975 0 H1600 V326 C1434 280 1340 187 1280 103 C1199 -8 1083 11 975 0Z" fill="url(#warmRibbon)" opacity=".8"/>
    <text x="104" y="244" class="system" font-size="20" font-weight="800" letter-spacing="4" fill="#ffffff">CUE</text>
    <text x="104" y="342" class="system" font-size="49" font-weight="720" fill="#ffffff">Fig-style</text>
    <text x="104" y="401" class="system" font-size="49" font-weight="720" fill="#ffffff">autocomplete.</text>
    <text x="104" y="460" class="system" font-size="49" font-weight="720" fill="#ffffff">Back in Terminal.</text>
    <text x="106" y="527" class="system" font-size="19" fill="#cbd2dd">Live command and path suggestions</text>
    <text x="106" y="555" class="system" font-size="19" fill="#cbd2dd">for the terminal you already use.</text>
    <text x="106" y="624" class="system" font-size="14" letter-spacing=".3" fill="#9eabbc">Powered by Fig’s open spec catalog.</text>
    ${terminal}
  </svg>`;
}

await mkdir(outputDirectory, { recursive: true });
for (const [name, content] of [
  ["cue-readme", readmeSvg()],
  ["cue-x-post", xPostSvg()],
]) {
  const svgPath = path.join(outputDirectory, `${name}.svg`);
  const pngPath = path.join(outputDirectory, `${name}.png`);
  await writeFile(svgPath, content);
  await execFileAsync("/usr/bin/sips", ["-s", "format", "png", svgPath, "--out", pngPath]);
  console.log(`Created ${path.relative(root, pngPath)}`);
}
