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

/* Setup screens share the moving road, with only the active screen reachable. */
const SETUP_IDS = ["modes", "players", "pads", "style", "custom", "diffs", "cars"];
let menuScreen = "home", menuFocus = {}, modalFocus = null;
function menuButtons(root){
  return Array.from(root.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')).filter(function(el){
    return !el.closest("[inert]") && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
  });
}
/* Every dialog that can sit over a menu, topmost first: the first-run language
   picker outranks Settings, which outranks the two race panels. One list, so
   the focus gate, the Tab trap and Escape always agree on what is in front -
   and the next dialog is one entry here rather than three chains of ors. */
const MODAL_IDS = ["langWrap", "settingsWrap", "pausePanel", "overPanel"];
function activeModal(){
  for(let i=0;i<MODAL_IDS.length;i++){
    const el = document.getElementById(MODAL_IDS[i]);
    if(el && el.classList.contains("on")) return el;
  }
  return null;
}
function gateFocus(){
  const modal = activeModal();
  /* A dialog that lives outside the screens covers every one of them. The race
     panels sit inside #race and gate the instruments instead. */
  const over = !!modal && !modal.closest(".screen");
  document.querySelectorAll(".screen").forEach(function(el){
    el.inert = over || el.id !== menuScreen;
  });
  const hud = $(".hud");
  if(hud) hud.inert = !!modal;
  if(modal && !modal.contains(document.activeElement)){
    modalFocus = document.activeElement;
    const first = menuButtons(modal)[0];
    if(first) first.focus({preventScroll:true});
  } else if(!modal && modalFocus){
    if(modalFocus.isConnected && !modalFocus.closest("[inert]")) modalFocus.focus({preventScroll:true});
    modalFocus = null;
  }
}
function setupSummary(){
  let label = t("raceSetup");
  if(menuScreen !== "modes"){
    label = t(G.local ? "local" : G.mode === "bots" ? "bots" : "endless");
    if(G.local && menuScreen !== "players") label += " · " + G.players + " " + t("playersShort");
    if(["custom", "diffs", "cars"].indexOf(menuScreen) >= 0 && G.local) label += " · " + t(G.custom ? "customPlay" : "standardPlay");
    if(menuScreen === "cars" && G.mode !== "endless"){
      label += " · " + botsWanted() + " " + t("botCount");
      if(botsWanted()) label += " · " + t(DIFFS[G.diff].key);
    }
  }
  document.querySelectorAll(".session-context").forEach(function(el){ el.textContent = label; });
  const next = menuScreen === "pads" ? "nextStyle" : menuScreen === "custom" ? "nextCars" : G.local && menuScreen === "cars" && pickTurn < G.players - 1 ? "nextPlayer" : "nextRace";
  document.querySelectorAll(".next-context").forEach(function(el){ el.textContent = t(next); });
}
function show(id){
  const active = document.activeElement;
  if(active && active.id && active.closest(".screen")) menuFocus[menuScreen] = active.id;
  menuScreen = id;
  const setup = SETUP_IDS.indexOf(id) >= 0;
  document.body.classList.toggle("menu", id !== "race");
  document.querySelectorAll(".screen").forEach(function(el){
    el.classList.toggle("on", el.id === id || (el.id === "home" && setup));
  });
  $("#home").classList.toggle("in-setup", setup);
  setupSummary();
  gateFocus();
  const root = document.getElementById(id);
  const remembered = document.getElementById(menuFocus[id]);
  const first = remembered && !remembered.disabled ? remembered : menuButtons(root)[0];
  if(id === "race"){
    root.tabIndex = -1; root.focus({preventScroll:true});
  } else if(first && !root.inert) first.focus({preventScroll:true});
  if(id === "cars") paintPicks();
  if(id === "garage" || id === "cars") requestAnimationFrame(paintCarIcons);
  if(id === "pads") padsRefresh();
  if(id === "pads" || (id === "cars" && G.local)) uiStart();
}

/* Tab stays in the active dialog or screen. Escape follows the same Back
   actions as pointer controls; Enter/Space keep native button activation. */
function menuKeydown(e){
  const modal = activeModal();
  const root = modal || document.getElementById(menuScreen);
  if(!root) return;
  if(e.key === "Tab"){
    const all = menuButtons(root);
    if(!all.length) return;
    const first = all[0], last = all[all.length - 1];
    if(e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))){e.preventDefault();first.focus();}
  }
  if(e.key === "Escape" && menuScreen !== "race"){
    e.preventDefault();
    if(modal){
      /* One keypress, one action: the dialog closes and nothing behind it moves.
         The first-run picker has nothing to fall back to until a language has
         been chosen, so it stays. */
      if(modal.id === "settingsWrap") closeSettings();
      else if(modal.id === "langWrap" && lang){ $("#langWrap").classList.remove("on"); gateFocus(); }
      return;
    }
    const back = root.querySelector('[data-i18n-aria="navBack"], [data-i18n-aria="navClose"]');
    if(back) back.click();
  }
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
    G.picks.pop(); pickTurn--; carCur = firstFree(); paintPicks();
    carEl(CAR_IDS[carCur]).focus({preventScroll:true});
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
  const focused = document.activeElement;
  const attr = focused && ["data-bots", "data-diff", "data-rule"].find(function(k){ return focused.hasAttribute(k); });
  const value = attr ? focused.getAttribute(attr) : null;
  const r = G.rules || (G.rules = defaultRules());
  const fill = FIELD_SIZE - G.players;
  if(r.bots > fill) r.bots = -1;            /* a seat was added since it was set */
  const n = botsWanted();

  /* how many bots - nought up to whatever the people leave free */
  let steps = "";
  for(let i=0;i<=fill;i++){
    const on = (r.bots < 0 ? i === fill : i === r.bots);
    steps += '<button class="step' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-bots="' + i + '">' +
             (i === fill && fill > 0 ? t("botCountFill") : String(i)) + '</button>';
  }
  $("#botSteps").innerHTML = steps;
  $("#botCountVal").textContent = String(n);
  $("#botCountDesc").textContent = n === 0 ? t("botCountNone") : t("botCountDesc");

  /* how hard they push - nothing to set when there are none */
  let ds = "";
  DIFF_IDS.forEach(function(id){
    ds += '<button class="step' + (G.diff === id ? " on" : "") + '" aria-pressed="' + (G.diff === id) + '"' + (n === 0 ? ' disabled' : '') + ' data-diff="' + id + '">' +
          t(DIFFS[id].key) + '</button>';
  });
  $("#diffSteps").innerHTML = ds;
  $("#botDiffOpt").classList.toggle("off", n === 0);

  let tg = "";
  RULE_TOGGLES.forEach(function(o){
    tg += '<button class="tog' + (r[o.k] ? " on" : "") + '" role="switch" aria-checked="' + r[o.k] + '" data-rule="' + o.k + '">' +
          '<span class="sw"><i></i></span>' +
          '<span class="tx"><b>' + t(o.name) + '</b><span>' + t(o.desc) + '</span></span>' +
          '</button>';
  });
  $("#toggles").innerHTML = tg;
  if(attr){
    const replacement = $("#customBody").querySelector("[" + attr + "='" + value + "']");
    if(replacement && !replacement.disabled) replacement.focus({preventScroll:true});
  }
  setupSummary();
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
    el.disabled = carTaken(CAR_IDS[i]);
    el.classList.toggle("cursor", on && i === carCur);
  }
  $("#pickRoster").textContent = on ? G.picks.map(function(id, i){ return t("playerN") + " " + (i + 1) + " / " + t(CARS[id].key); }).join(" · ") : "";
  previewCar(CAR_IDS[carCur]);
  $("#carPadState").textContent = "";
  $("#carRules").textContent = on && G.custom ? RULE_TOGGLES.map(function(rule){ return t(rule.name) + ": " + t(ruleOn(rule.k) ? "ruleEnabled" : "ruleDisabled"); }).join(" · ") : "";
  setupSummary();
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
      carEl(CAR_IDS[carCur]).focus({preventScroll:true});
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
    if(!carTaken(CAR_IDS[n])){ carCur = n; paintPicks(); carEl(CAR_IDS[n]).focus(); tone(520, .04, "square", .05); return; }
  }
}

function previewCar(id){
  if(!CARS[id]) return;
  const hero = $("#carHero");
  hero.setAttribute("data-car", id);
  $("#carHeroName").textContent = t(CARS[id].key);
  $("#carHeroPower").textContent = t(id + "Ult");
  CAR_IDS.forEach(function(k){carEl(k).classList.toggle("preview", k === id && !carTaken(k));});
  paintCarIcon(hero, id);
}

function setTab(){
  ["cars","tracks","items","effects"].forEach(function(k){
    const tab = $("#tab" + cap(k));
    tab.classList.toggle("on", garageTab === k);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(garageTab === k));
    tab.setAttribute("aria-controls", "garageBody");
    tab.tabIndex = garageTab === k ? 0 : -1;
  });
  $("#garageBody").setAttribute("aria-labelledby", "tab" + cap(garageTab));
  buildGarage();
  $("#garageBody").scrollTop = 0;
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
