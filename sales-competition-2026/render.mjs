import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { synthesize } from "./audio/synthesize.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(fs.readFileSync(path.join(root, "content.json"), "utf8"));
const args = new Set(process.argv.slice(2));
const preview = args.has("--preview");
const stills = args.has("--stills");
const frameArg = process.argv.find((arg) => arg.startsWith("--frames="));

const chromeCandidates = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/local/bin/google-chrome",
];

function chromePath() {
  const found = chromeCandidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Chrome לא נמצא במחשב");
  return found;
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".ttf")) return "font/ttf";
  if (filePath.endsWith(".wav")) return "audio/wav";
  return "application/octet-stream";
}

function writeManifest() {
  const manifest = {};
  for (const [id, prize] of Object.entries(content.prizes)) {
    const filePath = path.join(root, "assets/products", prize.file);
    manifest[id] = fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  }
  fs.writeFileSync(path.join(root, "stage/product-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const relative = decodeURIComponent(url.pathname);
    const filePath = path.normalize(path.join(root, relative));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": contentType(filePath),
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function launchPages(browser, url, count) {
  const pages = [];
  for (let i = 0; i < count; i += 1) {
    const page = await browser.newPage();
    await page.setViewport({
      width: content.width,
      height: content.height,
      deviceScaleFactor: 1,
    });
    page.setDefaultTimeout(120000);
    await page.goto(url, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => window.__ready === true);
    const fontOK = await page.evaluate(() => window.__fontOK);
    if (!fontOK) throw new Error("הגופן Heebo לא נטען");
    pages.push(page);
  }
  return pages;
}

async function shoot(page, frame, filePath, type) {
  await page.evaluate((value) => window.renderFrame(value), frame);
  const options = {
    type,
    clip: { x: 0, y: 0, width: content.width, height: content.height },
    captureBeyondViewport: false,
  };
  if (type === "jpeg") options.quality = 93;
  const image = await page.screenshot(options);
  await fs.promises.writeFile(filePath, image);
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} יצא עם קוד ${code}`));
    });
  });
}

const stillList = [
  ["open", 4.2],
  ["dates", 9.5],
  ["ps5", 14.8],
  ["ninja", 16.5],
  ["camera", 18.2],
  ["note", 19.8],
  ["iphone", 22.6],
  ["galaxy", 24.3],
  ["pension", 28.8],
  ["pension-phones", 33.0],
  ["elementary", 38.8],
  ["elementary-phones", 42.6],
  ["terms", 48.2],
  ["close", 56.2],
];

async function main() {
  writeManifest();
  const server = await startServer();
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/stage/index.html`;
  if (preview) {
    console.log(url);
    return;
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--font-render-hinting=none",
    ],
  });

  try {
    if (stills || frameArg) {
      const page = (await launchPages(browser, url, 1))[0];
      const outDir = path.join(root, "dist/qa");
      fs.mkdirSync(outDir, { recursive: true });
      const jobs = frameArg
        ? frameArg.replace("--frames=", "").split(",").map((value, index) => [`f${index}`, Number(value) / content.fps])
        : stillList;
      for (const [name, seconds] of jobs) {
        const frame = Math.round(seconds * content.fps);
        const filePath = path.join(outDir, `${name}.png`);
        await shoot(page, frame, filePath, "png");
        console.log(`${name} frame ${frame}`);
      }
      return;
    }

    const scorePath = path.join(root, "assets/music/score.wav");
    const audioStarted = Date.now();
    synthesize(content, scorePath);
    console.log(`audio ${Date.now() - audioStarted}ms`);

    const total = content.duration * content.fps;
    const frameDir = path.join(root, ".frames");
    fs.rmSync(frameDir, { recursive: true, force: true });
    fs.mkdirSync(frameDir, { recursive: true });
    const page = (await launchPages(browser, url, 1))[0];
    const started = Date.now();
    for (let frame = 0; frame < total; frame += 1) {
      const filePath = path.join(frameDir, `f_${String(frame).padStart(5, "0")}.jpg`);
      try {
        await shoot(page, frame, filePath, "jpeg");
      } catch (error) {
        process.stderr.write(`retry ${frame} ${error.message}\n`);
        await page.reload({ waitUntil: "networkidle0" });
        await page.waitForFunction(() => window.__ready === true);
        await shoot(page, frame, filePath, "jpeg");
      }
      if (frame % 30 === 0) {
        const elapsed = (Date.now() - started) / 1000;
        process.stdout.write(`frames ${frame + 1}/${total} ${elapsed.toFixed(1)}s\n`);
      }
    }

    const output = path.join(root, "dist/sales-competition-2026.mp4");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    await run("ffmpeg", [
      "-y",
      "-framerate", String(content.fps),
      "-start_number", "0",
      "-i", path.join(frameDir, "f_%05d.jpg"),
      "-i", scorePath,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "libx264",
      "-profile:v", "high",
      "-pix_fmt", "yuv420p",
      "-crf", "18",
      "-preset", "medium",
      "-movflags", "+faststart",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "48000",
      "-t", String(content.duration),
      output,
    ]);
    console.log(output);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
