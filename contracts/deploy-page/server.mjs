#!/usr/bin/env node
/**
 * Owner-only deploy page for the Terminus Veil contracts, served on localhost.
 * The page in this folder asks the browser wallet (MetaMask, Rabby) to sign
 * the deployment; no key ever reaches this server or the terminal.
 *
 *   cd contracts && npm run deploy:page      # then open http://localhost:8787
 *
 * Endpoints:
 *   GET /                      the page
 *   GET /data?contract=NAME&args=JSON   creation bytecode + ABI-encoded constructor args
 *   GET /abi?contract=NAME     the contract's ABI (for reads after deploy)
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Interface } = require("ethers");

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const PORT = Number(process.env.PORT ?? 8787);
const NAMES = ["TerminusWire", "VeilPass"];

function artifact(name) {
  if (!NAMES.includes(name)) throw new Error(`unknown contract ${name}`);
  const p = join(root, "artifacts", "contracts", `${name}.sol`, `${name}.json`);
  if (!existsSync(p)) throw new Error(`artifact missing; run: npx hardhat compile`);
  return JSON.parse(readFileSync(p, "utf8"));
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(readFileSync(join(here, "index.html"), "utf8"));
      return;
    }
    if (url.pathname === "/abi") {
      json(res, 200, { abi: artifact(url.searchParams.get("contract") ?? "").abi });
      return;
    }
    if (url.pathname === "/data") {
      const name = url.searchParams.get("contract") ?? "";
      const art = artifact(name);
      const args = JSON.parse(url.searchParams.get("args") ?? "[]");
      const iface = new Interface(art.abi);
      const encoded = iface.encodeDeploy(args);
      json(res, 200, { name, data: art.bytecode + encoded.slice(2), args });
      return;
    }
    json(res, 404, { error: "not found" });
  } catch (err) {
    json(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`deploy page: http://localhost:${PORT}  (contracts: ${NAMES.join(", ")})`);
});
