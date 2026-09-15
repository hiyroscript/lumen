"use strict";

/* SEREN - the screens in front of the race: switching between them, the
   garage, the custom setup sheet, the car board and the select-screen art.
   Gameplay logic lives elsewhere. */

/* the reference pages behind Cars & more */
let garageTab = "cars";
/* One card shape for every reference entry: an optional kind chip and odds
   pill on the head row, a name, a paragraph, and an optional meta row. Every
   tab builds the same card, so the four pages read as one index rather than
   four layouts. */
function infoCard(o){
  let head = "";
  if(o.chip || o.odds || o.dot){
    head += '<div class="info-head">';
    if(o.dot) head += '<span class="eff-dot" style="background:' + o.dot + '"></span>';
    head += '<h3>' + o.name + '</h3>';
    if(o.chip) head += o.chip;
    if(o.odds) head += '<span class="odds">' + o.odds + '</span>';
    head += '</div>';
  } else {
    head += '<div class="info-head"><h3>' + o.name + '</h3></div>';
  }
  return '<div class="info' + (o.cls ? " " + o.cls : "") + '">' +
         (o.art || "") +
         (o.art ? '<div class="info-body">' : "") +
         head +
         '<p>' + o.body + '</p>' +
         (o.meta || "") +
         (o.art ? '</div>' : "") +
         '</div>';
}
function buildGarage(){
  const body = $("#garageBody");
  let html = "";
  if(garageTab === "cars"){
    /* The art is the same drawCar the road uses, painted after the page is
       written - so the reference shows the car you will actually be driving. */
    CAR_IDS.forEach(function(id){
      const c = CARS[id];
      html += infoCard({
        cls:"car",
        art:'<span class="car-art"><canvas class="car-cv" data-car="' + id + '" aria-hidden="true"></canvas></span>',
        name:t(c.key),
        body:t(id + "Ult"),
        meta:'<div class="tagrow">' +
             ULT_EFFECTS[c.power].map(function(e){ return t(EFFECTS[e].key); }).join(" &middot; ") +
             '</div>'
      });
    });
  } else if(garageTab === "tracks"){
    TRACK_IDS.forEach(function(id){
      html += infoCard({
        chip:'<span class="kind track">' + t("kindTrack") + '</span>',
        name:t(TRACKS[id].key), body:t(id + "Info")
      });
    });
    ["puddle","meteor","weed"].forEach(function(id){
      html += infoCard({
        chip:'<span class="kind trap">' + t("kindTrap") + '</span>',
        name:t(id + "Name"), body:t(id + "Info")
      });
    });
    html += infoCard({
      chip:'<span class="kind pickup">' + t("kindBubble") + '</span>',
      name:t("bubbleName"), body:t("bubbleInfo")
    });
  } else if(garageTab === "items"){
    html += '<h2 class="sect">' + t("itemsHead") + '</h2>' +
            '<p class="lede">' + t("itemsLede") + '</p>';
    /* Odds are computed from the same table the game rolls against, so what is
       printed here can never drift from what actually drops. */
    let total = 0;
    ITEM_IDS.forEach(function(id){ total += RARITY[ITEMS[id].rarity].weight; });
    ITEM_IDS.slice().sort(function(a, b){
      return RARITY[ITEMS[b].rarity].weight - RARITY[ITEMS[a].rarity].weight;
    }).forEach(function(id){
      const r = RARITY[ITEMS[id].rarity];
      const pct = (r.weight/total*100).toFixed(1).replace(/\.0$/, "");
      html += infoCard({
        chip:'<span class="kind item" style="background:' + r.col + ';color:#0B0B0C">' +
             t("rarity" + cap(ITEMS[id].rarity)) + '</span>',
        odds:pct + "%",
        name:t(ITEMS[id].key), body:t(ITEMS[id].key + "Info")
      });
    });
    html += '<p class="soon">' + t("oddsNote") + '</p>';
  } else {
    /* An effect is named as well as swatched: the colour is a reminder of what
       you saw on the road, never the only way to tell two of them apart. */
    for(const id in EFFECTS){
      html += infoCard({ dot:EFFECTS[id].col, name:t(EFFECTS[id].key), body:t(id + "Info") });
    }
  }
  body.innerHTML = html;
  if(garageTab === "cars") paintCarIcons();
}

/* The seven setup steps. All of them are sheets over the home screen, which is
   why home stays on underneath them. */
const SHEET_IDS = ["modes", "players", "pads", "style", "custom", "diffs", "cars"];

/* What the keyboard and the pointer may reach.

   A sheet is modal, so the home screen it is drawn over has to stop taking
   focus and clicks while staying visible - it is the backdrop. The language
   dialog is modal over everything, and a pause or a result is modal over the
   instruments. `inert` is exactly that: still painted, no longer reachable.
   Called from show() and from every place a panel opens or closes. */
function gateFocus(){
  const langUp = $("#langWrap").classList.contains("on");
  const sheetUp = SHEET_IDS.some(function(id){ return $("#" + id).classList.contains("on"); });
  const panelUp = $("#pausePanel").classList.contains("on") ||
                  $("#overPanel").classList.contains("on");
  document.querySelectorAll(".screen").forEach(function(el){
    el.inert = langUp || (sheetUp && el.id === "home");
  });
  const hud = $(".hud");
  if(hud) hud.inert = langUp || panelUp;
}

function show(id){
  const sheet = SHEET_IDS.indexOf(id) >= 0;
  $("#home").classList.toggle("on", id === "home" || sheet);
  $("#modes").classList.toggle("on", id === "modes");
  $("#players").classList.toggle("on", id === "players");
  $("#pads").classList.toggle("on", id === "pads");
  $("#style").classList.toggle("on", id === "style");
  $("#custom").classList.toggle("on", id === "custom");
  $("#diffs").classList.toggle("on", id === "diffs");
  $("#garage").classList.toggle("on", id === "garage");
  $("#cars").classList.toggle("on", id === "cars");
  $("#race").classList.toggle("on", id === "race");
  gateFocus();
  if(id === "pads" || (id === "cars" && G.local)) uiStart();
}

/* ---------------- best score ------------------------------------- */
let best = parseInt(store.get("seren.best") || "0", 10) || 0;
function paintBest(){ $("#homeBest").textContent = best; $("#hudBest").textContent = best; }

/* Backing out of the difficulty sheet goes back to whichever sheet sent you
   there, which in local play is now the style sheet and not the pad list. */
function backFromDiffs(){ show(G.local ? "style" : "modes"); }

/* Endless and Race against bots are the standard game: they never go past the
   style sheet, so they clear the rules here. */
function soloMode(m){
  G.mode = m; G.local = false; G.players = 1; VIEWS = 1;
  G.custom = false; G.rules = defaultRules();
}

/* Backing out of the car sheet in local play undoes one pick at a time, so a
   player who chose the wrong car costs everyone one press rather than the
   whole run-up. Only an empty board leaves the sheet. */
function backFromCars(){
  if(G.local && pickTurn > 0){
    G.picks.pop(); pickTurn--; paintPicks();
    return;
  }
  if(G.local && G.custom) show("custom");
  else show(toFlag() ? "diffs" : "modes");
}

/* ---- the custom setup sheet -------------------------------------
   Painted from G.rules and written straight back into it, so the sheet is
   never a second copy of the settings that could drift out of step with the
   race. Rebuilt whole on every change: it is a handful of buttons, and doing
   it this way means the bot-difficulty row appearing and disappearing with the
   bot count costs nothing to keep honest. */
const RULE_TOGGLES = [
  { k:"traps",   name:"optTraps",   desc:"optTrapsDesc" },
  { k:"bubbles", name:"optBubbles", desc:"optBubblesDesc" },
  { k:"boost",   name:"optBoost",   desc:"optBoostDesc" },
  { k:"ults",    name:"optUlts",    desc:"optUltsDesc" }
];
function paintCustom(){
  const r = G.rules || (G.rules = defaultRules());
  const fill = FIELD_SIZE - G.players;
  if(r.bots > fill) r.bots = -1;            /* a seat was added since it was set */
  const n = botsWanted();

  /* how many bots - nought up to whatever the people leave free */
  let steps = "";
  for(let i=0;i<=fill;i++){
    const on = (r.bots < 0 ? i === fill : i === r.bots);
    steps += '<button class="step' + (on ? " on" : "") + '" data-bots="' + i + '">' +
             (i === fill && fill > 0 ? t("botCountFill") : String(i)) + '</button>';
  }
  $("#botSteps").innerHTML = steps;
  $("#botCountVal").textContent = String(n);
  $("#botCountDesc").textContent = n === 0 ? t("botCountNone") : t("botCountDesc");

  /* how hard they push - nothing to set when there are none */
  let ds = "";
  DIFF_IDS.forEach(function(id){
    ds += '<button class="step' + (G.diff === id ? " on" : "") + '" data-diff="' + id + '">' +
          t(DIFFS[id].key) + '</button>';
  });
  $("#diffSteps").innerHTML = ds;
  $("#botDiffOpt").classList.toggle("off", n === 0);

  let tg = "";
  RULE_TOGGLES.forEach(function(o){
    tg += '<button class="tog' + (r[o.k] ? " on" : "") + '" data-rule="' + o.k + '">' +
          '<span class="sw"><i></i></span>' +
          '<span class="tx"><b>' + t(o.name) + '</b><span>' + t(o.desc) + '</span></span>' +
          '</button>';
  });
  $("#toggles").innerHTML = tg;
}

/* ---- choosing cars, in turns ------------------------------------
   One car can only be driven once, so a car already spoken for is dead on the
   sheet for everybody after. The board is the same board single player uses;
   all that is added is whose turn it is and what is left. */
let pickTurn = 0, carCur = 0, carKeys = null, carClock = 0;
function beginPicks(){
  G.picks = []; pickTurn = 0; carCur = 0; carKeys = newPadKeys(); carClock = 0;
  paintPicks();
  show("cars");
}
function carEl(id){ return $("#car" + cap(id)); }
function carTaken(id){ return G.local && G.picks.indexOf(id) >= 0; }
function paintPicks(){
  const on = G.local;
  const row = $("#carTurn");
  if(row) row.classList.toggle("on", on);
  for(let i=0;i<CAR_IDS.length;i++){
    const el = carEl(CAR_IDS[i]);
    if(!el) continue;
    el.classList.toggle("taken", carTaken(CAR_IDS[i]));
    el.classList.toggle("cursor", on && i === carCur);
  }
  if(!on || !row) return;
  const seat = clamp(pickTurn, 0, LOCAL_MAX - 1);
  row.querySelector("i").style.background = PCOLS[seat];
  row.querySelector("span").textContent =
    t("playerN") + " " + (seat + 1) + " \u00b7 " + t(PCOL_KEYS[seat]) + " \u00b7 " + t("picksCar");
}
function pickCar(id){
  if(G.local){
    if(carTaken(id)) return;
    G.picks.push(id);
    pickTurn++;
    tone(760, .07, "square", .1);
    if(pickTurn < G.players){
      carCur = firstFree();
      carKeys = newPadKeys();          /* the next player starts from nothing held */
      paintPicks();
      return;
    }
    G.car = G.picks[0];
    show("race"); startRace();
    return;
  }
  G.car = id; show("race"); startRace();
}
function firstFree(){
  for(let i=0;i<CAR_IDS.length;i++) if(!carTaken(CAR_IDS[i])) return i;
  return 0;
}
function carStep(step){
  let n = carCur;
  for(let g=0; g<CAR_IDS.length*2; g++){
    n = n + step;
    if(n < 0) n += CAR_IDS.length;
    if(n >= CAR_IDS.length) n -= CAR_IDS.length;
    if(!carTaken(CAR_IDS[n])){ carCur = n; paintPicks(); tone(520, .04, "square", .05); return; }
  }
}

function setTab(){
  ["cars","tracks","items","effects"].forEach(function(k){
    $("#tab" + k.charAt(0).toUpperCase() + k.slice(1)).classList.toggle("on", garageTab === k);
  });
  buildGarage();
}

/* ---------------- select-screen car art --------------------------
   Painted with drawCar, the same call the race loop makes, so the icon and
   the car on the road are the same drawing at two sizes. Nothing here is
   hand-copied, so an icon cannot fall out of step with its model. */
function paintCarIcon(el, id){
  const p = CARS[id];
  if(!p || !el.getContext) return;
  const box = el.getBoundingClientRect();
  const cw = Math.round(box.width), ch = Math.round(box.height);
  if(cw < 4 || ch < 4) return;                  /* not laid out yet */
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  el.width = Math.round(cw*dpr); el.height = Math.round(ch*dpr);
  const c2 = el.getContext("2d");
  if(!c2) return;
  const prev = ctx;
  ctx = c2;
  try{
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    /* the models hang bull bars, wings and wheels outside their own box, so
       size to the widest overhang rather than to the body */
    const w = Math.min(cw*0.78, ch*0.43);
    drawCar(cw/2, ch/2, w, w*1.86, p, 0, true, false);
  } finally {
    ctx = prev;
  }
}
function paintCarIcons(){
  const list = document.querySelectorAll("canvas.car-cv");
  for(let i=0;i<list.length;i++) paintCarIcon(list[i], list[i].getAttribute("data-car"));
}
