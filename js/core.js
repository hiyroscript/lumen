"use strict";

/* SEREN - low-level utilities shared by every other file.
   Storage with a memory fallback, the tiny maths/DOM helpers, and the two
   capability flags the rest of the game reads. Nothing here owns a game
   system. */

/* ================================================================
   YOUR SPLASH IMAGE  —  put your own artwork here.
   Option A (true single file):  paste a data URI
       const SPLASH_IMAGE = "data:image/png;base64,iVBORw0KGgo...";
   Option B (image next to index.html in the repo):
       const SPLASH_IMAGE = "logo.png";
   Leave it empty ("") to keep the built-in mark.
   ================================================================ */
const SPLASH_IMAGE = "";

const SPLASH_MS = 2600;   // how long the splash stays up

/* Other cars are switched off for now. Flip this to true to bring
   them back - nothing else needs to change. */
const TRAFFIC_ENABLED = false;

/* ---------------- storage (falls back to memory if blocked) ------ */
const mem = {};
const store = {
  get(k){ try{ const v = localStorage.getItem(k); return v === null ? (k in mem ? mem[k] : null) : v; }catch(e){ return k in mem ? mem[k] : null; } },
  set(k,v){ mem[k] = String(v); try{ localStorage.setItem(k, String(v)); }catch(e){} }
};

/* Copy previous-version saves before any system reads them. Existing Seren
   values win, including "0". Keep the old keys as a backup; all new writes use
   seren.*. store.set also preserves the value in memory if writes are blocked. */
["lang", "sound", "best"].forEach(function(key){
  const currentKey = "seren." + key;
  if(store.get(currentKey) !== null) return;
  const previous = store.get("redline." + key);
  if(previous !== null) store.set(currentKey, previous);
});

/* ---------------- tiny helpers ----------------------------------- */
const $ = function(s){ return document.querySelector(s); };
const clamp = function(v,a,b){ return v<a?a:(v>b?b:v); };
const lerp  = function(a,b,t){ return a+(b-a)*t; };
const rand  = function(a,b){ return a+Math.random()*(b-a); };
const randi = function(a,b){ return Math.floor(rand(a,b+1)); };

/* rarity colours are plain hex; the glow needs them with an alpha */
function withA(hex, a){
  const n = parseInt(hex.slice(1), 16);
  return "rgba(" + ((n>>16)&255) + "," + ((n>>8)&255) + "," + (n&255) + "," + a + ")";
}

const DESKTOP = !!(window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches);
/* Anything drawn frame by frame from JS sits outside the reduced-motion rule in
   the stylesheet, so it has to ask for itself. */
const NO_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches);
const LANDSCAPE = false;   /* the road always runs up the screen */
