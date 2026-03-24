/**
 * Local preview for the landing page without Django.
 * Serves /static/* the same way as runserver + STATICFILES_DIRS.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const port = Number(process.env.PORT) || 3333;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const raw = (req.url || "/").split("?")[0];

  if (raw === "/" || raw === "/index.html") {
    const htmlPath = path.join(root, "index.html");
    fs.readFile(htmlPath, "utf8", (err, html) => {
      if (err) {
        res.writeHead(500);
        res.end(String(err));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    return;
  }

  if (raw === "/static/output.css") {
    sendFile(res, path.join(root, "output.css"));
    return;
  }
  if (raw === "/static/script.js") {
    sendFile(res, path.join(root, "script.js"));
    return;
  }

  if (raw.startsWith("/static/assets/")) {
    const base = path.basename(raw);
    let filePath = path.join(root, "assets", base);
    if (base === "logoreal.svg" && !fs.existsSync(filePath)) {
      filePath = path.join(root, "assets", "logodark.svg");
    }
    sendFile(res, filePath);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Landing preview: http://127.0.0.1:${port}/`);
  console.log("(Install Python and use `python manage.py runserver` for full Django + /app/)");
});
