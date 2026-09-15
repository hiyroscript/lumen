"use strict";

/* SEREN - player preferences and the dialog that edits them.

   One authoritative value per preference, held here and written straight to
   storage. Nothing reads a preference back off the DOM: applySettings() pushes
   each value into the system that owns the behaviour - audio.js for sound and
   volume, core.js and the stylesheet for motion and contrast - and
   paintSettings() writes the same values on to the controls. The dialog is a
   view; this is the state.

   Language is the one preference that is not held here: i18n.js owns `lang`
   and chooseLang(), and the Settings row calls it. */

const SETTINGS_KEYS = {
  sound:    "seren.sound",
  volume:   "seren.volume",
  motion:   "seren.motion",
  contrast: "seren.contrast",
  hints:    "seren.controlHints"
};
/* Volume 90 is the master gain the game shipped with, so an installation that
   has never opened Settings sounds exactly as it always did. */
const SETTINGS_DEFAULTS = {
  sound:"1", volume:"90", motion:"system", contrast:"system", hints:"1"
};
/* What each choice may be. A stored value that is not on its list - an older
   build, a hand-edited key - falls back to the default rather than travelling
   any further into the game. */
const SETTINGS_ALLOWED = {
  sound:["1","0"], motion:["system","reduced","full"], contrast:["system","on","off"], hints:["1","0"]
};

function settingValue(key, raw){
  if(raw === null || raw === undefined) return SETTINGS_DEFAULTS[key];
  const value = String(raw);
  if(key === "volume"){
    const n = parseInt(value, 10);
    return isNaN(n) ? SETTINGS_DEFAULTS.volume : String(clamp(n, 0, 100));
  }
  return SETTINGS_ALLOWED[key].indexOf(value) >= 0 ? value : SETTINGS_DEFAULTS[key];
}
const settings = (function(){
  const out = {};
  for(const key in SETTINGS_DEFAULTS) out[key] = settingValue(key, store.get(SETTINGS_KEYS[key]));
  return out;
})();

function getSetting(key){ return settings[key]; }
/* The only way a preference changes: validate, save, apply, repaint. */
function setSetting(key, value){
  const next = settingValue(key, value);
  if(settings[key] === next) return false;
  settings[key] = next;
  store.set(SETTINGS_KEYS[key], next);
  resetNote = "desc";                  /* a half-pressed restore is off the table */
  applySettings();
  paintSettings();
  return true;
}
function volumeSetting(){ return parseInt(settings.volume, 10) || 0; }

/* Hand every preference to whatever actually carries it out. Called at boot and
   after any change, so the game can never be running on a value the player no
   longer has. */
function applySettings(){
  setSound(settings.sound === "1");
  setVolume(volumeSetting()/100);
  motionPref = settings.motion;
  document.documentElement.setAttribute("data-motion", settings.motion);
  document.documentElement.setAttribute("data-contrast", settings.contrast);
  document.body.classList.toggle("no-hints", settings.hints !== "1");
}

/* ---------------- the dialog ------------------------------------- */
/* The restore row says one of three things, and which one is state rather than
   something left behind in the DOM: its description, the confirmation it is
   waiting on, or the fact that it has just run. */
let resetNote = "desc";

function paintSettings(){
  const on = t("setOn"), off = t("setOff");
  /* Segmented rows: language reads i18n's own value, the rest read this file. */
  $("#settingsBody").querySelectorAll("[data-set][data-val]").forEach(function(el){
    const key = el.getAttribute("data-set");
    const current = key === "lang" ? (lang || "en") : settings[key];
    const picked = el.getAttribute("data-val") === current;
    el.classList.toggle("on", picked);
    el.setAttribute("aria-pressed", String(picked));
  });
  /* Switches say their state in words as well as in the pill, so it never
     rests on colour alone. */
  [["sound", "#setSoundSw", "#setSoundState"], ["hints", "#setHintsSw", "#setHintsState"]].forEach(function(row){
    const up = settings[row[0]] === "1";
    const sw = $(row[1]);
    sw.classList.toggle("on", up);
    sw.setAttribute("aria-checked", String(up));
    $(row[2]).textContent = up ? on : off;
  });

  const vol = volumeSetting();
  const range = $("#setVolRange");
  range.value = String(vol);
  range.style.setProperty("--fill", vol + "%");
  /* French keeps its space before the sign. */
  $("#setVolVal").textContent = lang === "fr" ? vol + "\u00a0%" : vol + "%";

  $("#setResetNote").textContent =
    t(resetNote === "ask" ? "setRestoreAsk" : resetNote === "done" ? "setRestoreDone" : "setRestoreDesc");
  $("#btnSetReset").classList.toggle("armed", resetNote === "ask");
}

function settingsUp(){ return $("#settingsWrap").classList.contains("on"); }
function openSettings(){
  if(settingsUp()) return;
  resetNote = "desc";
  paintSettings();
  $("#settingsWrap").classList.add("on");
  gateFocus();                       /* inerts the menus and moves focus inside */
}
function closeSettings(){
  if(!settingsUp()) return;
  resetNote = "desc";
  $("#settingsWrap").classList.remove("on");
  gateFocus();                       /* hands focus back to whatever opened it */
}

/* Language is the one preference held elsewhere, so it changes through i18n's
   chooseLang - the same call the first-run picker makes - and the panel then
   repaints itself in the new language rather than closing. */
function setLanguage(code){
  if(!chooseLang(code)) return false;
  resetNote = "desc";
  paintSettings();
  return true;
}

/* Two presses and no second dialog: the first arms the row and says so in
   words, the second restores. Touching any other preference disarms it. */
function restorePressed(){
  if(resetNote !== "ask"){ resetNote = "ask"; paintSettings(); return false; }
  restoreSettings();
  return true;
}
/* Preferences only, and only the keys this file owns. A personal best is not a
   preference, and neither is the language being read right now - losing either
   to a button called "restore settings" would be a surprise, not a reset. */
function restoreSettings(){
  for(const key in SETTINGS_DEFAULTS){
    settings[key] = SETTINGS_DEFAULTS[key];
    store.set(SETTINGS_KEYS[key], SETTINGS_DEFAULTS[key]);
  }
  applySettings();
  resetNote = "done";
  paintSettings();
}
