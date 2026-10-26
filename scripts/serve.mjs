import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve("out");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    let path = resolve(root, `.${pathname}`);
    if (path !== root && !path.startsWith(root + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (pathname.endsWith("/")) path = resolve(path, "index.html");
    let body;
    try {
      body = await readFile(path);
    } catch {
      if (!extname(path)) {
        path = resolve(path, "index.html");
        body = await readFile(path);
      } else throw new Error("Missing file");
    }
    response.writeHead(200, {
      "Content-Type": mime[extname(path)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  }
}).listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () =>
  console.log(
    `PrintPantry production export: http://localhost:${process.env.PORT ?? 3000}`,
  ),
);
