"use strict";

/* SEREN - boot. Everything above defines a system; this connects them and
   starts them. It loads last, so every declaration it touches already
   exists. */

/* ---------------- boot ------------------------------------------- */
if(SPLASH_IMAGE){
  const img = new Image();
  img.alt = "";
  img.src = SPLASH_IMAGE;
  const holder = $("#splashArt");
  img.onload = function(){ holder.innerHTML = ""; holder.appendChild(img); };
}

if(DESKTOP) document.body.classList.add("desk");
deskFit();
applyLang();
paintBest();
setSound(soundOn);

setTimeout(function(){
  $("#splash").classList.add("out");
  show("home");
  setTimeout(function(){ $("#splash").style.display = "none"; }, 400);
  if(!lang) $("#langWrap").classList.add("on");
  gateFocus();
}, SPLASH_MS);

/* ---------------- UI wiring -------------------------------------- */
document.querySelectorAll(".lang-opt").forEach(function(b){
  b.addEventListener("click", function(){
    lang = b.getAttribute("data-lang");
    store.set("seren.lang", lang);
    applyLang();
    $("#langWrap").classList.remove("on");
    gateFocus();
    tone(660, .09, "square", .1);
  });
});
$("#btnLang").addEventListener("click", function(){
  $("#langWrap").classList.add("on"); gateFocus();
});
$("#btnSound").addEventListener("click", function(){ setSound(!soundOn); if(soundOn) tone(760,.07,"square",.1); });
$("#btnStart").addEventListener("click", function(){ audio(); show("modes"); });
$("#btnCloseModes").addEventListener("click", function(){ show("home"); });
$("#modeEndless").addEventListener("click", function(){ soloMode("endless"); G.diff = "medium"; beginPicks(); });
$("#modeBots").addEventListener("click", function(){ soloMode("bots"); show("diffs"); });
$("#modeLocal").addEventListener("click", function(){
  if(!DESKTOP) return;
  G.mode = "local"; G.local = true; G.players = 2;
  show("players");
});
$("#btnClosePlayers").addEventListener("click", function(){ show("modes"); });
[2, 3, 4].forEach(function(n){
  $("#count" + n).addEventListener("click", function(){ G.players = n; show("pads"); });
});
$("#btnClosePads").addEventListener("click", function(){ show("players"); });
$("#btnPadsGo").addEventListener("click", function(){
  const pads = padPoll();
  if(pads.length < G.players) return;           /* the class is the gate; this is the rule */
  /* The order they were found in is the order they are handed out in, and each
     seat remembers the slot rather than the position. */
  G.padIds = pads.slice(0, G.players).map(function(p){ return p.index; });
  show("style");
});
/* ---- standard or custom ----
   Standard play is the game as it stands, so it clears the rules back to the
   defaults on the way through rather than trusting whatever a custom race left
   behind - back out of a custom setup, pick standard, and you get standard. */
$("#btnCloseStyle").addEventListener("click", function(){ show("pads"); });
$("#styleStandard").addEventListener("click", function(){
  G.custom = false; G.rules = defaultRules();
  show("diffs");
});
$("#styleCustom").addEventListener("click", function(){
  G.custom = true;
  if(!G.rules) G.rules = defaultRules();
  paintCustom();
  show("custom");
});
$("#btnCloseCustom").addEventListener("click", function(){ show("style"); });
$("#btnCustomGo").addEventListener("click", function(){ beginPicks(); });

$("#btnCloseDiffs").addEventListener("click", backFromDiffs);
["easy","medium","hard","brutal"].forEach(function(id){   /* wired before DIFFS exists */
  $("#diff" + id.charAt(0).toUpperCase() + id.slice(1))
    .addEventListener("click", function(){ G.diff = id; beginPicks(); });
});

$("#btnCloseCars").addEventListener("click", function(){ backFromCars(); });

/* One listener on the sheet rather than one per button, because the buttons
   are thrown away and rebuilt on every change. */
$("#customBody").addEventListener("click", function(e){
  const el = e.target && e.target.closest ? e.target.closest("[data-bots],[data-diff],[data-rule]") : null;
  if(!el) return;
  const r = G.rules || (G.rules = defaultRules());
  const bots = el.getAttribute("data-bots");
  const dif = el.getAttribute("data-diff");
  const rule = el.getAttribute("data-rule");
  if(bots !== null){
    const v = parseInt(bots, 10);
    r.bots = (v === FIELD_SIZE - G.players) ? -1 : v;   /* the top step means "fill" */
  } else if(dif !== null){
    G.diff = dif;
  } else if(rule !== null){
    r[rule] = !r[rule];
  }
  tone(660, .05, "square", .07);
  paintCustom();
});

$("#carRedd").addEventListener("click", function(){ pickCar("redd"); });
$("#carPhantom").addEventListener("click", function(){ pickCar("phantom"); });
$("#carBolt").addEventListener("click", function(){ pickCar("bolt"); });
$("#carTimestamp").addEventListener("click", function(){ pickCar("timestamp"); });
$("#carRose").addEventListener("click", function(){ pickCar("rose"); });
$("#carSiren").addEventListener("click", function(){ pickCar("siren"); });
$("#btnGarage").addEventListener("click", function(){ garageTab = "cars"; setTab(); show("garage"); });
$("#btnCloseGarage").addEventListener("click", function(){ show("home"); });

$("#tabCars").addEventListener("click", function(){ garageTab = "cars"; setTab(); });
$("#tabTracks").addEventListener("click", function(){ garageTab = "tracks"; setTab(); });
$("#tabItems").addEventListener("click", function(){ garageTab = "items"; setTab(); });
$("#tabEffects").addEventListener("click", function(){ garageTab = "effects"; setTab(); });
$("#carRandom").addEventListener("click", function(){
  const left = CAR_IDS.filter(function(id){ return !carTaken(id); });
  pickCar(left[randi(0, left.length-1)]);
});

$("#itemBox").addEventListener("click", function(e){ if(e && e.stopPropagation) e.stopPropagation(); useItem("me"); });
/* Tap the charge square to spend it. fireUlt does all the gating - not running,
   wrecked, pinned, already finished, not charged yet - so a tap that cannot fire
   simply does nothing, and the press animation is what says the tap landed.
   Blurred straight after, or the square keeps keyboard focus and a later Enter
   would set the ultimate off from across the road. */
$("#ultPct").addEventListener("click", function(e){
  if(e && e.stopPropagation) e.stopPropagation();
  if(this.blur) this.blur();
  fireUlt();
});
$("#btnPause").addEventListener("click", function(){ pause(true); });
$("#btnResume").addEventListener("click", function(){ pause(false); });
$("#btnQuit").addEventListener("click", function(){ leave(); });
$("#btnAgain").addEventListener("click", function(){ startRace(); });
$("#btnHome").addEventListener("click", function(){ leave(); });

window.addEventListener("resize", function(){
  deskFit();                                   /* every screen, not just the race */
  if($("#race").classList.contains("on")) resize();
  paintCarIcons();
});
window.addEventListener("orientationchange", function(){ setTimeout(resize, 250); });

document.addEventListener("visibilitychange", function(){
  if(document.hidden && G.state === "running") pause(true);
});

/* Last thing at boot: every constant and model is defined by now, so the
   select-screen art can safely be painted from CARS and drawCar, and the shell
   can be measured for the desktop scale. Both are repeated once layout has
   settled, in case the first read landed before the stylesheet applied. */
function settle(){ deskFit(); paintCarIcons(); }
settle();
requestAnimationFrame(settle);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(settle);

/* Menu input stays in the DOM; race input is handled by input.js. */
document.addEventListener("keydown", menuKeydown);
CAR_IDS.forEach(function(id){
  const button = carEl(id);
  button.addEventListener("mouseenter", function(){if(!button.disabled) previewCar(id);});
  button.addEventListener("focus", function(){if(!button.disabled) previewCar(id);});
});
$(".tabs").addEventListener("keydown", function(e){
  const ids = ["cars", "tracks", "items", "effects"];
  let next = ids.indexOf(garageTab);
  if(e.key === "ArrowRight" || e.key === "ArrowDown") next = (next + 1) % ids.length;
  else if(e.key === "ArrowLeft" || e.key === "ArrowUp") next = (next + ids.length - 1) % ids.length;
  else if(e.key === "Home") next = 0;
  else if(e.key === "End") next = ids.length - 1;
  else return;
  e.preventDefault(); garageTab = ids[next]; setTab(); $("#tab" + cap(garageTab)).focus();
});
