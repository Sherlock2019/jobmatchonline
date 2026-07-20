import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const marketingRoot = resolve(scriptDir, "..");
const appRoot = resolve(marketingRoot, "..");
const marketingPublic = join(marketingRoot, "public");
const appPublic = join(appRoot, "public");
const expoImages = join(appRoot, "mobile-expo", "assets", "images");
const iconSvg = join(marketingPublic, "icon.svg");
const heartSvg = join(appPublic, "brand-heart.svg");
const foregroundSvg = join(appPublic, "brand-heart-foreground.svg");

async function renderPng(source, destination, width, height = width, flatten = false) {
  let image = sharp(source, { density: 384 }).resize(width, height, { fit: "contain" });
  if (flatten) image = image.flatten({ background: "#fff8fb" }).removeAlpha();
  await image.png({ compressionLevel: 9 }).toFile(destination);
}

await renderPng(iconSvg, join(marketingPublic, "logo.png"), 512);
await renderPng(iconSvg, join(appPublic, "logo.png"), 512);
await renderPng(iconSvg, join(expoImages, "icon.png"), 1024, 1024, true);
await renderPng(iconSvg, join(expoImages, "favicon.png"), 96, 96, true);
await renderPng(iconSvg, join(expoImages, "splash-icon.png"), 512);
await renderPng(iconSvg, join(expoImages, "android-icon-background.png"), 432, 432, true);
await renderPng(foregroundSvg, join(expoImages, "android-icon-foreground.png"), 432);
await renderPng(foregroundSvg, join(expoImages, "android-icon-monochrome.png"), 432);
await renderPng(join(marketingPublic, "og-source.svg"), join(marketingPublic, "og.png"), 1200, 630);
await renderPng(join(marketingPublic, "og-source.svg"), join(appPublic, "og.png"), 1200, 630);

const androidDensities = {
  mdpi: { icon: 48, foreground: 108 },
  hdpi: { icon: 72, foreground: 162 },
  xhdpi: { icon: 96, foreground: 216 },
  xxhdpi: { icon: 144, foreground: 324 },
  xxxhdpi: { icon: 192, foreground: 432 },
};

for (const [density, sizes] of Object.entries(androidDensities)) {
  const directory = join(appRoot, "android", "app", "src", "main", "res", `mipmap-${density}`);
  await renderPng(iconSvg, join(directory, "ic_launcher.png"), sizes.icon);
  await renderPng(iconSvg, join(directory, "ic_launcher_round.png"), sizes.icon);
  await renderPng(foregroundSvg, join(directory, "ic_launcher_foreground.png"), sizes.foreground);
}

await renderPng(iconSvg, join(appRoot, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png"), 1024, 1024, true);

function textOverlay(width, height) {
  const titleSize = Math.max(19, Math.round(Math.min(width, height) * 0.055));
  const copySize = Math.max(9, Math.round(titleSize * 0.34));
  const titleY = Math.round(height * 0.72);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <text x="50%" y="${titleY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="800"><tspan fill="#0b102b">Jobs</tspan><tspan fill="#1762e8">Match</tspan><tspan fill="#ed103c">Now</tspan></text>
    <text x="50%" y="${titleY + Math.round(titleSize * 1.25)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${copySize}" font-weight="700" fill="#fd267a">Match nearby. Meet for coffee.</text>
  </svg>`);
}

async function renderSplash(destination, width, height) {
  const logoSize = Math.round(Math.min(width, height) * 0.47);
  const logo = await sharp(heartSvg, { density: 384 }).resize(logoSize, logoSize, { fit: "contain" }).png().toBuffer();
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="pink"><stop stop-color="#ffd9e8" stop-opacity=".7"/><stop offset="1" stop-color="#fff8fb" stop-opacity="0"/></radialGradient><radialGradient id="blue"><stop stop-color="#d9edff" stop-opacity=".75"/><stop offset="1" stop-color="#fff8fb" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="#fff8fb"/><circle cx="82%" cy="14%" r="38%" fill="url(#pink)"/><circle cx="14%" cy="88%" r="34%" fill="url(#blue)"/></svg>`);
  await sharp(background)
    .composite([
      { input: logo, left: Math.round((width - logoSize) / 2), top: Math.round(height * 0.18) },
      { input: textOverlay(width, height), left: 0, top: 0 },
    ])
    .flatten({ background: "#fff8fb" })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(destination);
}

const androidSplashes = [
  ["drawable/splash.png", 480, 320],
  ["drawable-port-mdpi/splash.png", 320, 480],
  ["drawable-port-hdpi/splash.png", 480, 800],
  ["drawable-port-xhdpi/splash.png", 720, 1280],
  ["drawable-port-xxhdpi/splash.png", 960, 1600],
  ["drawable-port-xxxhdpi/splash.png", 1280, 1920],
  ["drawable-land-mdpi/splash.png", 480, 320],
  ["drawable-land-hdpi/splash.png", 800, 480],
  ["drawable-land-xhdpi/splash.png", 1280, 720],
  ["drawable-land-xxhdpi/splash.png", 1600, 960],
  ["drawable-land-xxxhdpi/splash.png", 1920, 1280],
];

for (const [relativePath, width, height] of androidSplashes) {
  await renderSplash(join(appRoot, "android", "app", "src", "main", "res", relativePath), width, height);
}

for (const filename of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await renderSplash(join(appRoot, "ios", "App", "App", "Assets.xcassets", "Splash.imageset", filename), 2732, 2732);
}
