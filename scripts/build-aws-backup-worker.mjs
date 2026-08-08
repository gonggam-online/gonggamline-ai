import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir("dist/aws-backup-worker", { recursive: true });
await build({
  entryPoints: ["tools/aws-backup-worker/handler.ts"],
  outfile: "dist/aws-backup-worker/handler.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: false,
  minify: false,
  legalComments: "none",
  logLevel: "info",
});
