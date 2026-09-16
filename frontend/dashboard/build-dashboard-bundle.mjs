import { build } from "esbuild";

await build({
  entryPoints: ["assets/dashboard.entry.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2019"],
  minify: true,
  sourcemap: false,
  outfile: "assets/dashboard.bundle.js",
  loader: {
    ".js": "jsx",
    ".jsx": "jsx",
  },
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
});

await build({
  entryPoints: ["assets/app.css"],
  bundle: true,
  minify: true,
  external: ["/static/*", "https://*"],
  outfile: "assets/app.bundle.css",
});

console.log("Built assets/dashboard.bundle.js and assets/app.bundle.css");
