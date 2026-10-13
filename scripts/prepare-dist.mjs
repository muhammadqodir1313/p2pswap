import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const outputDir = path.resolve(".output");
const outputPublicDir = path.resolve(".output/public");

// Clean and recreate dist directory to avoid stale assets from previous builds
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy everything from .output/public into dist/
if (fs.existsSync(outputPublicDir)) {
  fs.cpSync(outputPublicDir, distDir, { recursive: true });
}

// Copy .output server bundle into dist/server
const outputServerDir = path.resolve(".output/server");
if (fs.existsSync(outputServerDir)) {
  fs.cpSync(outputServerDir, path.join(distDir, "server"), { recursive: true });

  // Generate server.js shim expected by TanStack Start preview plugin and SSR runners
  const serverShimContent = `import server from "./index.mjs";

const env = {};
const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} };

export default {
  fetch(request) {
    try {
      Object.defineProperty(request, "ip", { value: undefined, writable: true, configurable: true });
    } catch {
      // ignore
    }
    return server.fetch(request, env, ctx);
  },
};
`;
  fs.writeFileSync(path.join(distDir, "server", "server.js"), serverShimContent, "utf-8");
}

// Copy full .output directory into dist/.output so both static and SSR runners find files
if (fs.existsSync(outputDir)) {
  fs.cpSync(outputDir, path.join(distDir, ".output"), { recursive: true });
}

// Find CSS and JS assets in dist/assets
let cssFile = "";
let jsFile = "";
const assetsDir = path.join(distDir, "assets");
if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  cssFile = files.find((f) => f.startsWith("styles-") && f.endsWith(".css")) || "";
  jsFile = files.find((f) => f.startsWith("index-") && f.endsWith(".js")) || "";
}

// Create dist/index.html
const indexHtmlContent = `<!DOCTYPE html>
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

fs.writeFileSync(path.join(distDir, "index.html"), indexHtmlContent, "utf-8");

// Also create 200.html and 404.html for SPA routers
fs.writeFileSync(path.join(distDir, "200.html"), indexHtmlContent, "utf-8");
fs.writeFileSync(path.join(distDir, "404.html"), indexHtmlContent, "utf-8");

console.log("Successfully prepared dist/ build artifacts:");
console.log(fs.readdirSync(distDir));
