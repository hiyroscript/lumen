#!/usr/bin/env node
/* SEREN - a dependency-free check over the things that break silently.
 *
 *   node tools/check.mjs
 *
 * The game has no build step, so nothing catches a typo'd selector, a
 * translation key that does not exist, or a second `const` with a name another
 * file already used. Those are exactly the failures that either kill the page
 * on load or, worse, do nothing visible until somebody plays the screen that
 * uses them. This walks the source and reports them.
 *
 * It is plain Node with no dependencies and it touches nothing - the site never
 * loads this file, and there is no package.json to install. Exits non-zero if
 * anything fails, so it works in a hook or an action if you ever want one.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let failures = 0, warnings = 0;
const pass = (m) => console.log("  ok    " + m);
const fail = (m) => { failures++; console.log("  FAIL  " + m); };
const warn = (m) => { warnings++; console.log("  warn  " + m); };
const head = (m) => console.log("\n" + m);

/* The documented load order. core first because everything uses its helpers,
   data before runtime because the G literal reads ULT_TIME, main last because
   it is the only file that starts anything. */
const ORDER = ["core", "i18n", "data", "audio", "runtime", "ui", "local",
               "ai", "mechanics", "race", "render", "hud", "input", "main"];

/* Window properties a top-level declaration would shadow or overwrite. Not the
   whole of `window` - Node cannot see that - but the names that are plausible
   as game identifiers and would actually collide. */
const RISKY_GLOBALS = new Set([
  "name", "status", "length", "top", "self", "parent", "origin", "event",
  "screen", "history", "location", "closed", "frames", "external", "opener",
  "find", "focus", "blur", "open", "close", "print", "stop", "alert", "confirm",
  "prompt", "scroll", "scrollX", "scrollY", "innerWidth", "innerHeight", "onload",
  "navigator", "document", "localStorage", "sessionStorage", "performance",
  "crypto", "caches", "fetch", "origin", "isSecureContext", "menubar", "toolbar"
]);

/* ---------------------------------------------------------------- helpers */

/* Strip comments and string bodies so a scan cannot trip over a `const` inside
   a comment or a `#id` inside a regex. Keeps line structure intact. */
function strip(src) {
  let out = "", i = 0, line = true;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2);
      const chunk = src.slice(i, end < 0 ? src.length : end + 2);
      out += chunk.replace(/[^\n]/g, " ");
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    if (c === "/" && d === "/") {
      const end = src.indexOf("\n", i);
      out += " ".repeat((end < 0 ? src.length : end) - i);
      i = end < 0 ? src.length : end;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === q) { j++; break; }
        j++;
      }
      out += src.slice(i, j).replace(/[^\n]/g, " ");
      i = j;
      continue;
    }
    out += c; i++;
  }
  return out;
}

/* Top-level declarations: column-zero const/let/var/function, comments gone. */
function topLevelNames(src) {
  const names = [];
  for (const raw of strip(src).split("\n")) {
    if (!raw || /^\s/.test(raw)) continue;
    let m = /^(?:const|let|var)\s+(.*)$/.exec(raw);
    if (m) {
      for (const n of m[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*=/g)) names.push(n[1]);
      continue;
    }
    m = /^function\s+([A-Za-z_$][\w$]*)/.exec(raw);
    if (m) names.push(m[1]);
  }
  return names;
}

/* Pull one brace-balanced object literal out of a source file by its name. */
function objectLiteral(src, declName) {
  const clean = strip(src);
  const at = clean.indexOf("const " + declName + " = {");
  if (at < 0) return null;
  const open = clean.indexOf("{", at);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    const c = clean[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  try { return vm.runInNewContext("(" + src.slice(open, end + 1) + ")"); }
  catch { return null; }
}

/* ------------------------------------------------------------ the checks */

const html = read("index.html");

head("index.html wiring");

const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
  .map((m) => m[1]).filter((h) => !/^https?:/.test(h));
for (const s of styles) {
  existsSync(join(ROOT, s)) ? pass(`stylesheet ${s} exists`) : fail(`stylesheet ${s} is missing`);
}
if (!styles.length) fail("no local stylesheet is linked");

const scripts = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
const inline = /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/.test(html);
inline ? fail("index.html still contains an inline <script> block") : pass("no inline <script> blocks");
/<style[\s>]/.test(html) ? fail("index.html still contains a <style> block") : pass("no inline <style> blocks");

for (const s of scripts) {
  if (!existsSync(join(ROOT, s))) fail(`script ${s} is missing`);
}
const got = scripts.map((s) => s.replace(/^js\//, "").replace(/\.js$/, ""));
if (got.join() === ORDER.join()) pass(`all ${ORDER.length} scripts present, in dependency order`);
else fail(`script order is\n          ${got.join(" -> ")}\n        expected\n          ${ORDER.join(" -> ")}`);

const undeferred = scripts.filter(
  (s) => !new RegExp(`<script[^>]*\\bdefer\\b[^>]*src="${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(html));
undeferred.length
  ? undeferred.forEach((s) => fail(`${s} is not loaded with defer`))
  : pass("every script is deferred");

head("JavaScript syntax");
const sources = {};
for (const n of ORDER) {
  const p = `js/${n}.js`;
  if (!existsSync(join(ROOT, p))) { fail(`${p} is missing`); continue; }
  sources[n] = read(p);
  try { new vm.Script(sources[n], { filename: p }); }
  catch (e) { fail(`${p}: ${e.message}`); }
}
if (Object.keys(sources).length === ORDER.length) pass(`${ORDER.length} files parse`);

head("Saved-data migration");
for (const scenario of [
  { name: "fresh install", seed: {}, expected: [null, null, null] },
  { name: "previous saves", seed: { "redline.lang": "fr", "redline.sound": "0", "redline.best": "4820" }, expected: ["fr", "0", "4820"] },
  { name: "existing Seren saves win", seed: { "redline.lang": "fr", "redline.sound": "1", "redline.best": "4820", "seren.lang": "en", "seren.sound": "0", "seren.best": "0" }, expected: ["en", "0", "0"] },
  { name: "blocked writes retain migrated values in memory", seed: { "redline.lang": "fr", "redline.sound": "0", "redline.best": "4820" }, blockWrite: true, expected: ["fr", "0", "4820"] },
  { name: "blocked storage still supports session saves", seed: {}, blockRead: true, blockWrite: true, expected: [null, null, null] }
]) {
  try {
    const saved = new Map(Object.entries(scenario.seed));
    const context = vm.createContext({
      window: {},
      localStorage: {
        getItem(k) { if (scenario.blockRead) throw new Error("blocked"); return saved.get(k) ?? null; },
        setItem(k, v) { if (scenario.blockWrite) throw new Error("blocked"); saved.set(k, v); }
      }
    });
    vm.runInContext(sources.core, context);
    const actual = vm.runInContext('["lang", "sound", "best"].map(k => store.get("seren." + k))', context);
    assert.deepEqual(Array.from(actual), scenario.expected);
    for (const [key, value] of Object.entries(scenario.seed)) assert.equal(saved.get(key), value);
    if (!scenario.blockWrite) {
      scenario.expected.forEach((value, i) => assert.equal(saved.get("seren." + ["lang", "sound", "best"][i]) ?? null, value));
    }
    vm.runInContext('store.set("seren.best", "5000")', context);
    assert.equal(vm.runInContext('store.get("seren.best")', context), "5000");
    pass(scenario.name);
  } catch (e) { fail(`${scenario.name}: ${e.message}`); }
}

head("Global scope");
const owner = new Map();
const dupes = [];
for (const n of ORDER) {
  if (!sources[n]) continue;
  for (const name of topLevelNames(sources[n])) {
    if (owner.has(name)) dupes.push(`${name} declared in both ${owner.get(name)}.js and ${n}.js`);
    else owner.set(name, n);
  }
}
dupes.length
  ? dupes.forEach((d) => fail("duplicate top-level declaration: " + d))
  : pass(`${owner.size} top-level names, all unique`);

const clashes = [...owner.keys()].filter((n) => RISKY_GLOBALS.has(n));
clashes.length
  ? clashes.forEach((c) => fail(`${c} (${owner.get(c)}.js) shadows a browser global`))
  : pass("no declaration shadows a known browser global");

for (const n of ORDER) {
  if (sources[n] && !/^"use strict";/.test(sources[n])) fail(`js/${n}.js does not start with "use strict"`);
}

head("DOM contract");
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
let literal = 0, dynamic = 0;
const missing = new Set();
for (const n of ORDER) {
  if (!sources[n]) continue;
  const src = sources[n];
  for (const m of src.matchAll(/(?:\$|querySelector(?:All)?)\(\s*"#([A-Za-z][\w-]*)"\s*\)/g)) {
    literal++;
    if (!ids.has(m[1])) missing.add(`#${m[1]} (js/${n}.js) is not in index.html`);
  }
  for (const _ of src.matchAll(/(?:\$|querySelector)\(\s*"#[^"]*"\s*\+/g)) dynamic++;
}
missing.size
  ? [...missing].forEach((m) => fail("selector " + m))
  : pass(`${literal} literal #id selectors all resolve (${dynamic} built at runtime, not checked)`);

head("Translations");
const STR = objectLiteral(sources.i18n || "", "STR");
if (!STR) fail("could not read STR out of js/i18n.js");
else {
  const keys = new Set(Object.keys(STR));
  pass(`${keys.size} strings defined`);

  const langs = new Set();
  for (const v of Object.values(STR)) Object.keys(v).forEach((l) => langs.add(l));
  const incomplete = Object.entries(STR)
    .filter(([, v]) => [...langs].some((l) => typeof v[l] !== "string"))
    .map(([k]) => k);
  incomplete.length
    ? incomplete.forEach((k) => fail(`STR.${k} is missing a translation`))
    : pass(`every string has all ${langs.size} languages (${[...langs].join(", ")})`);

  const used = new Set();
  for (const m of html.matchAll(/\bdata-i18n="([^"]+)"/g)) {
    used.add(m[1]);
    if (!keys.has(m[1])) fail(`data-i18n="${m[1]}" in index.html has no string`);
  }
  for (const n of ORDER) {
    if (!sources[n]) continue;
    for (const m of sources[n].matchAll(/\bt\(\s*"([A-Za-z][\w]*)"\s*\)/g)) {
      used.add(m[1]);
      if (!keys.has(m[1])) fail(`t("${m[1]}") in js/${n}.js has no string`);
    }
  }
  pass(`${used.size} keys referenced literally and all resolve`);

  /* Many keys are reached by concatenation - t(id + "Ult"), t("place" + n) -
     so an unreferenced key is a hint, not a fault. */
  const orphans = [...keys].filter((k) => !used.has(k));
  if (orphans.length) warn(`${orphans.length} strings are never referenced literally (most are built at runtime)`);
}

head("Data tables");
const CARS = objectLiteral(sources.data || "", "CARS");
if (!CARS) warn("could not read CARS out of js/data.js");
else {
  const carIds = Object.keys(CARS);
  const drawn = new Set([...(sources.render || "").matchAll(/p\.style === "(\w+)"/g)].map((m) => m[1]));
  drawn.add("gt");                                   /* the else branch in drawCar */
  for (const id of carIds) {
    const c = CARS[id];
    if (!drawn.has(c.style)) fail(`car ${id} uses style "${c.style}" with no branch in drawCar`);
    if (STR && !STR[id]) fail(`car ${id} has no name string`);
    if (STR && !STR[id + "Ult"]) fail(`car ${id} has no ultimate description`);
    if (!ids.has("car" + id[0].toUpperCase() + id.slice(1))) fail(`car ${id} has no button in index.html`);
    if (!new RegExp(`data-car="${id}"`).test(html)) fail(`car ${id} has no select-screen canvas`);
  }
  const ultEffects = objectLiteral(sources.data || "", "ULT_EFFECTS");
  if (ultEffects) for (const id of carIds) {
    if (!ultEffects[CARS[id].power]) fail(`car ${id} power "${CARS[id].power}" has no ULT_EFFECTS entry`);
  }
  pass(`${carIds.length} cars: models, strings, buttons and ultimates all wired`);
}

const EFFECTS = objectLiteral(sources.data || "", "EFFECTS");
if (EFFECTS && STR) {
  for (const [id, e] of Object.entries(EFFECTS)) {
    if (!STR[e.key]) fail(`effect ${id} has no label string`);
    if (!STR[id + "Info"]) warn(`effect ${id} has no garage description (${id}Info)`);
  }
  pass(`${Object.keys(EFFECTS).length} effects have labels`);
}

const ITEMS = objectLiteral(sources.data || "", "ITEMS");
const RARITY = objectLiteral(sources.data || "", "RARITY");
if (ITEMS && RARITY) {
  const paths = objectLiteral(sources.hud || "", "ITEM_PATHS");
  for (const [id, it] of Object.entries(ITEMS)) {
    if (!RARITY[it.rarity]) fail(`item ${id} has unknown rarity "${it.rarity}"`);
    if (paths && !paths[id]) fail(`item ${id} has no icon artwork in ITEM_PATHS`);
    if (STR && !STR[it.key]) fail(`item ${id} has no name string`);
  }
  const total = Object.values(ITEMS).reduce((s, it) => s + RARITY[it.rarity].weight, 0);
  const odds = Object.entries(ITEMS)
    .map(([id, it]) => `${id} ${(RARITY[it.rarity].weight / total * 100).toFixed(1)}%`).join(", ");
  pass(`${Object.keys(ITEMS).length} items wired - drop odds: ${odds}`);
}

head(failures ? `${failures} failure${failures === 1 ? "" : "s"}` +
                (warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : "")
              : warnings ? `all checks passed, ${warnings} warning${warnings === 1 ? "" : "s"}`
              : "all checks passed");
process.exit(failures ? 1 : 0);
