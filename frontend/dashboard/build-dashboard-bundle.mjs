import { build } from "esbuild";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsOut = path.resolve(__dirname, "assets/dashboard.bundle.js");
const cssOut = path.resolve(__dirname, "assets/app.bundle.css");
const staticfilesDir = path.resolve(__dirname, "../../staticfiles/assets");

await build({
  entryPoints: [path.resolve(__dirname, "assets/dashboard.entry.js")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2019"],
  minify: true,
  sourcemap: false,
  outfile: jsOut,
  loader: {
    ".js": "jsx",
    ".jsx": "jsx",
  },
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
});

await build({
  entryPoints: [path.resolve(__dirname, "assets/app.css")],
  bundle: true,
  minify: true,
  external: ["/static/*", "https://*"],
  outfile: cssOut,
});

console.log("Built assets/dashboard.bundle.js and assets/app.bundle.css");

// Ensure staticfiles/assets directory exists
if (!fs.existsSync(staticfilesDir)) {
  fs.mkdirSync(staticfilesDir, { recursive: true });
}

// Compress and sync bundles
for (const [filePath, fileName] of [
  [jsOut, "dashboard.bundle.js"],
  [cssOut, "app.bundle.css"],
]) {
  const content = fs.readFileSync(filePath);
  const gzipped = zlib.gzipSync(content, { level: 9 });

  // Save local .gz
  fs.writeFileSync(`${filePath}.gz`, gzipped);

  // Copy to staticfiles/assets
  const targetFile = path.join(staticfilesDir, fileName);
  fs.writeFileSync(targetFile, content);
  fs.writeFileSync(`${targetFile}.gz`, gzipped);

  console.log(`Synced and compressed ${fileName} to staticfiles/assets (${content.length} bytes, gz: ${gzipped.length} bytes)`);
}

// Bump version in index.html to bust browser cache
const indexHtmlPath = path.resolve(__dirname, "index.html");
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, "utf8");
  const newVer = Date.now().toString().slice(-6); // e.g. 6 digits
  html = html.replace(/app\.bundle\.css\?v=[^"']+/g, `app.bundle.css?v=${newVer}`);
  html = html.replace(/dashboard\.bundle\.js\?v=[^"']+/g, `dashboard.bundle.js?v=${newVer}`);
  fs.writeFileSync(indexHtmlPath, html, "utf8");
  console.log(`Updated cache-busting version in index.html to v=${newVer}`);

  // Also sync to staticfiles/index.html if exists
  const staticIndex = path.resolve(__dirname, "../../staticfiles/index.html");
  if (fs.existsSync(staticIndex)) {
    fs.writeFileSync(staticIndex, html, "utf8");
    fs.writeFileSync(`${staticIndex}.gz`, zlib.gzipSync(Buffer.from(html), { level: 9 }));
  }
}

