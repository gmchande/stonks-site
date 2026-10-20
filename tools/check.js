// Checks what search engines, answer engines, and link cards read from the
// page against what a person reads on it: node tools/check.js
// - the FAQPage JSON-LD says exactly what the FAQ on the page says;
// - the app's JSON-LD description is the page's "What is Stonks?" answer;
// - the site's address is the same in every file that names it;
// - one h1, and alt text on every picture.
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const html = read("index.html");
const failures = [];
const fail = (msg) => failures.push(msg);

const text = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const app = ld.find((d) => d["@type"] === "SoftwareApplication");
const faq = ld.find((d) => d["@type"] === "FAQPage");
if (!app) fail("no SoftwareApplication JSON-LD");
if (!faq) fail("no FAQPage JSON-LD");

const shown = [...html.matchAll(/<section class="qa"><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><\/section>/g)]
  .map((m) => ({ q: text(m[1]), a: text(m[2]) }));
const told = faq ? faq.mainEntity.map((e) => ({ q: e.name, a: e.acceptedAnswer.text })) : [];
if (shown.length !== told.length) fail(`the page asks ${shown.length} questions, the JSON-LD ${told.length}`);
shown.forEach((s, i) => {
  const t = told[i] || {};
  if (s.q !== t.q) fail(`question ${i + 1}: page "${s.q}", JSON-LD "${t.q}"`);
  if (s.a !== t.a) fail(`answer ${i + 1}: page "${s.a}", JSON-LD "${t.a}"`);
});
const what = shown.find((s) => s.q === "What is Stonks?");
if (app && what && app.description !== what.a) fail("the SoftwareApplication description isn't the page's answer to What is Stonks?");

const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
if (!canonical) fail("no canonical link");
const addressed = { "index.html": html, "robots.txt": read("robots.txt"), "sitemap.xml": read("sitemap.xml"), "llms.txt": read("llms.txt") };
for (const [file, body] of Object.entries(addressed)) {
  if (!body.includes(canonical)) fail(`${file} doesn't name ${canonical}`);
  for (const url of body.match(/https:\/\/[a-z0-9.-]+\.github\.io\/[^\s"<)]*/g) || []) {
    if (!url.startsWith(canonical)) fail(`${file} names ${url}, outside ${canonical}`);
  }
}

const h1s = html.match(/<h1[\s>]/g) || [];
if (h1s.length !== 1) fail(`${h1s.length} h1 elements`);
for (const img of html.match(/<img\b[^>]*>/g) || []) {
  if (!/\balt="/.test(img)) fail(`an img without alt: ${img}`);
}

if (failures.length) {
  console.error(failures.map((f) => `FAIL ${f}`).join("\n"));
  process.exit(1);
}
console.log(`ok: ${shown.length} questions match their JSON-LD; one address, ${canonical}`);
