// Reads Stonks' listing on the Omarchy plugin marketplace and writes the two
// shields.io endpoint files its README badges read:
//   marketplace.json  the version the marketplace lists, and whether that
//                     exact version is verified, waits for review, or neither;
//   verified.json     the last version the marketplace verified.
// Usage: node .github/marketplace-status.mjs <out-dir>
// The catalog is about 15 MB, too big for a badge service to read itself.
// The run writes no time, so the files change only when the status does.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PLUGIN = "grvc.stonks";
const CATALOG = "https://plugins.omarchy.org/catalog.json";
const MARKETPLACE = "omacom/omarchy-plugin-marketplace";
const out = process.argv[2];
if (!out) throw new Error("usage: node .github/marketplace-status.mjs <out-dir>");

async function get(url, json = true) {
  const headers = { "User-Agent": "stonks-site marketplace status" };
  if (url.startsWith("https://api.github.com/")) {
    headers.Accept = "application/vnd.github+json";
    if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return json ? res.json() : res.text();
}

// The catalog's entry (the marketplace's scripts/build-catalog.mjs): `version`
// is the manifest's at `upstreamValidatedCommit`, the newest commit of the
// plugin's main branch that passed the marketplace's checks.
// `listingValidatedCommit` is the commit the last listing or update request
// validated, which lags behind `version` while an update waits.
// `verificationCommit` is the last commit the marketplace verified. The
// listed version is verified only when that is the version's own commit.
const catalog = await get(CATALOG);
const entry = (catalog.plugins || []).find((p) => p.id === PLUGIN);
if (!entry) throw new Error(`${PLUGIN} is not in the catalog`);
const listed = entry.version;
const listedCommit = String(entry.upstreamValidatedCommit || "").toLowerCase();
const verifiedCommit = entry.verificationSnapshotStatus === "verified"
  ? String(entry.verificationCommit || "").toLowerCase() : "";
if (!listed || !/^[0-9a-f]{40}$/.test(listedCommit)) throw new Error(`${PLUGIN}'s entry has no listed version or commit`);
const verified = verifiedCommit === listedCommit;

// The last verified version: the listed one, or the manifest's at the
// verified commit, read from the plugin's own repository.
let lastVerified = null;
if (verified) lastVerified = listed;
else if (/^[0-9a-f]{40}$/.test(verifiedCommit)) {
  const repo = new URL(entry.repo).pathname.replace(/^\/|\.git$|\/$/g, "");
  const manifest = await get(`https://raw.githubusercontent.com/${repo}/${verifiedCommit}/${entry.manifestPath || "manifest.json"}`);
  lastVerified = manifest.version || null;
}

// An unverified listing waits for review while an open verify request names
// the plugin in its Plugin ID field (the marketplace's own form).
let pending = false;
if (!verified) {
  const q = encodeURIComponent(`repo:${MARKETPLACE} is:issue is:open "${PLUGIN}" in:body`);
  const found = await get(`https://api.github.com/search/issues?q=${q}&per_page=50`);
  pending = found.items.some((issue) => {
    const id = /^###\s+Plugin ID\s*$\s*^(\S+)\s*$/m.exec(issue.body || "");
    return /^\[Verify\]/.test(issue.title) && id && id[1] === PLUGIN;
  });
}

const state = verified ? "verified" : pending ? "pending review" : "unverified";
const badge = (label, message, color) => JSON.stringify({ schemaVersion: 1, label, message, color, cacheSeconds: 3600 }) + "\n";
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "marketplace.json"),
  badge("marketplace", `${listed} ${state}`, verified ? "brightgreen" : pending ? "yellow" : "lightgrey"));
writeFileSync(join(out, "verified.json"),
  badge("last verified", lastVerified || "none", lastVerified ? "brightgreen" : "lightgrey"));
console.log(JSON.stringify({ listed, listedCommit, verifiedCommit: verifiedCommit || null, verified, pending, lastVerified }));
