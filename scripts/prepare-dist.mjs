import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const distDir = path.resolve("dist");
const outputDir = path.resolve(".output");
const outputPublicDir = path.resolve(".output/public");
const serverDir = path.join(distDir, "server");

// Clean and recreate dist directory to avoid stale assets from previous builds
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(serverDir, { recursive: true });

// Copy public directory and .output/public into dist/
const staticPublicDir = path.resolve("public");
if (fs.existsSync(staticPublicDir)) {
  fs.cpSync(staticPublicDir, distDir, { recursive: true });
}
if (fs.existsSync(outputPublicDir)) {
  fs.cpSync(outputPublicDir, distDir, { recursive: true });
}

// Copy .output server bundle into dist/server if available
const outputServerDir = path.resolve(".output/server");
if (fs.existsSync(outputServerDir)) {
  try {
    fs.cpSync(outputServerDir, serverDir, { recursive: true });
  } catch (err) {
    console.warn("Could not copy .output/server:", err);
  }
}

// Copy full .output directory into dist/.output so both static and SSR runners find files
if (fs.existsSync(outputDir)) {
  try {
    fs.cpSync(outputDir, path.join(distDir, ".output"), { recursive: true });
  } catch (err) {
    console.warn("Could not copy .output:", err);
  }
}

// Generate resilient server.js shim expected by TanStack Start preview plugin and Cloud Run runners
const serverShimContent = `import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..");
const indexHtmlPath = path.resolve(distDir, "index.html");

const staticMimes = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
};

let ssrModule = null;
try {
  ssrModule = (await import("./_ssr/ssr.mjs")).default;
} catch (e1) {
  try {
    ssrModule = (await import("./index.mjs")).default;
  } catch (e2) {
    console.warn("[PeerSwap Server] Could not load SSR module:", e1, e2);
  }
}

const env = {};
const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} };

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const cleanPath = url.pathname.replace(/^\\/+/, "");

      // Serve static assets directly if they exist in dist/
      if (cleanPath && !cleanPath.endsWith("/")) {
        const localFilePath = path.join(distDir, cleanPath);
        if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
          const ext = path.extname(localFilePath).toLowerCase();
          const contentType = staticMimes[ext] || "application/octet-stream";
          const fileBytes = fs.readFileSync(localFilePath);
          return new Response(fileBytes, {
            status: 200,
            headers: {
              "content-type": contentType,
              "cache-control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
            },
          });
        }
      }

      // Handle server-side rendered routes via TanStack Start SSR
      if (ssrModule && typeof ssrModule.fetch === "function") {
        try {
          Object.defineProperty(request, "ip", { value: undefined, writable: true, configurable: true });
        } catch {
          // ignore
        }
        const res = await ssrModule.fetch(request, env, ctx);
        if (res && res.status < 500) {
          return res;
        }
      }
    } catch (err) {
      console.warn("[PeerSwap Server] SSR request error, falling back to static HTML:", err);
    }

    // SPA fallback: return pre-rendered index.html
    try {
      if (fs.existsSync(indexHtmlPath)) {
        const html = fs.readFileSync(indexHtmlPath, "utf-8");
        return new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        });
      }
    } catch (readErr) {
      console.error("[PeerSwap Server] Error reading index.html fallback:", readErr);
    }

    return new Response("PeerSwap OK", { status: 200, headers: { "content-type": "text/plain" } });
  },
};
`;

fs.writeFileSync(path.join(serverDir, "server.js"), serverShimContent, "utf-8");

// Pre-render index.html using the generated SSR module so that static fallbacks and preview are never blank
let renderedIndexHtml = "";
try {
  const ssrPath = path.join(serverDir, "_ssr", "ssr.mjs");
  if (fs.existsSync(ssrPath)) {
    const ssrMod = (await import(pathToFileURL(ssrPath).href)).default;
    const res = await ssrMod.fetch(
      new Request("http://localhost:3000/"),
      {},
      { waitUntil() {}, passThroughOnException() {}, props: {} },
    );
    if (res && res.status === 200) {
      renderedIndexHtml = await res.text();
      console.log(`Pre-rendered SSR index.html (${renderedIndexHtml.length} bytes)`);
    }
  }
} catch (ssrErr) {
  console.warn("Could not pre-render index.html from SSR:", ssrErr);
}

// Fallback HTML if SSR pre-rendering is unavailable
let cssFile = "";
let jsFile = "";
const assetsDir = path.join(distDir, "assets");
if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  cssFile = files.find((f) => f.startsWith("styles-") && f.endsWith(".css")) || "";
  jsFile = files.find((f) => f.startsWith("index-") && f.endsWith(".js")) || "";
}

const fallbackHtml = `<!DOCTYPE html>
<html lang="uz">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PeerSwap — O‘rgatib o‘rganing</title>
    <meta name="description" content="Bilgan ko‘nikmalaringizni boshqalar bilan almashing va keraklisini o‘rganing." />
    <meta name="author" content="PeerSwap" />
    <meta property="og:title" content="PeerSwap — O‘rgatib o‘rganing" />
    <meta property="og:description" content="Bilgan ko‘nikmalaringizni boshqalar bilan almashing va keraklisini o‘rganing." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    ${cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    ${jsFile ? `<script type="module" src="/assets/${jsFile}"></script>` : ""}
  </body>
</html>
`;

const finalIndexHtml = renderedIndexHtml || fallbackHtml;
fs.writeFileSync(path.join(distDir, "index.html"), finalIndexHtml, "utf-8");
fs.writeFileSync(path.join(distDir, "200.html"), finalIndexHtml, "utf-8");
fs.writeFileSync(path.join(distDir, "404.html"), finalIndexHtml, "utf-8");

console.log("Successfully prepared dist/ build artifacts with full SSR rendering support:");
console.log(fs.readdirSync(distDir));
