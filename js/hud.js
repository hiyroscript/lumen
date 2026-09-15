"use strict";

/* SEREN - the instruments. The DOM HUD painted over the canvas, the effect
   labels beside it, and the canvas HUD each local-play column gets - all
   reading the same numbers so a column and a phone show the same race. */

/* ================================================================
   EFFECT TEXT  -  a fixed set of lines, reused, never accumulated
   ================================================================
   The list used to be built by appending a fresh element per application and
   removing it on a timer keyed by id. Two things went wrong with that. A
   re-application during the four-tenths of a second an old line spent fading
   created a second element with the same id, and the next removal looked the
   id up and took the wrong one - so the survivor was never removed again. And
   nothing cleared the list between races, so every run inherited the last
   one's leftovers.

   So: one element per effect for the life of the page, held in a map, revived
   rather than recreated, and hard-capped. There is no path here that can
   produce an unbounded number of nodes. */
const EFF_MAX = 6;                         /* most lines on screen at once */
const effEls = {};                         /* id -> { el, out, timer } */
function effHost(){ return $("#effList"); }
function logEffect(id){
  const def = EFFECTS[id];
  if(!def) return;
  if(id === "immune") return;              /* immune has its own treatment */
  if(id === "cleansed"){                   /* and so does the cleanse flash */
    const c = $("#cleanseTag");
    c.textContent = t(def.key);
    c.classList.remove("on"); void c.offsetWidth; c.classList.add("on");
    return;
  }
  const have = effEls[id];
  if(have){
    if(have.out){                          /* caught on the way out: bring it back */
      if(have.timer) clearTimeout(have.timer);
      have.timer = null; have.out = false;
      have.el.classList.remove("out");
      if(!have.el.parentNode) effHost().appendChild(have.el);
      if(G.effLog.indexOf(id) < 0) G.effLog.push(id);
    }
    return;
  }
  if(G.effLog.length >= EFF_MAX) killEffect(G.effLog[0]);   /* oldest makes room, at once */
  sweepFaded();
  const el = document.createElement("span");
  el.id = "eff-" + id;
  el.textContent = t(def.key);
  /* The label is set in the interface's own white on a dark pill and the
     effect's colour is carried by the swatch beside it. That is why Slippery,
     whose colour is very nearly black, needs no special case any more: nothing
     here is ever read off the colour alone. */
  el.style.setProperty("--eff", def.col);
  effEls[id] = { el:el, out:false, timer:null };
  G.effLog.push(id);
  effHost().appendChild(el);
}
/* Straight out, no fade. Used when something has to give. */
function killEffect(id){
  const i = G.effLog.indexOf(id);
  if(i >= 0) G.effLog.splice(i, 1);
  const have = effEls[id];
  if(!have) return;
  if(have.timer) clearTimeout(have.timer);
  if(have.el.parentNode) have.el.parentNode.removeChild(have.el);
  delete effEls[id];
}
/* A fading line still occupies a node for four-tenths of a second. That is
   fine, and bounded, but it must never let the list run past its cap: if it
   would, the oldest fading ones go immediately instead. */
function sweepFaded(){
  const host = effHost();
  if(!host || !host.children || host.children.length < EFF_MAX) return;
  for(const id in effEls){
    if(host.children.length < EFF_MAX) break;
    if(effEls[id].out) killEffect(id);
  }
}
function dropEffect(id){
  const i = G.effLog.indexOf(id);
  if(i >= 0) G.effLog.splice(i, 1);
  const have = effEls[id];
  if(!have || have.out) return;
  have.out = true;
  have.el.classList.add("out");
  have.timer = setTimeout(function(){
    if(have.el.parentNode) have.el.parentNode.removeChild(have.el);
    have.timer = null;
    delete effEls[id];                     /* the next application builds a fresh one */
  }, 420);
}
/* Between races: everything goes, DOM and bookkeeping together. */
function clearEffects(){
  for(const id in effEls){
    const have = effEls[id];
    if(have.timer) clearTimeout(have.timer);
    if(have.el.parentNode) have.el.parentNode.removeChild(have.el);
    delete effEls[id];
  }
  G.effLog = [];
  const host = effHost();
  while(host && host.children && host.children.length) host.removeChild(host.children[0]);
  $("#cleanseTag").classList.remove("on");
  $("#immuneTag").classList.remove("on");
  $("#shell").classList.remove("immune");
}
/* Read the player's state each frame and keep the list honest. Every line on
   screen is derived here and nowhere else, so a state that has quietly lapsed
   cannot leave its label behind. */
function syncEffects(){
  const p = CARS[G.car].power;
  const won = finishedMe();
  const faster = G.boosting || G.launchT > 0 || G.canT > 0 || airborne() ||
                 (G.ultOn && ULT_EFFECTS[p].indexOf("boosted") >= 0);
  const slower = G.slowT > 0 || G.chronoT > 0;
  const on = {
    winner:    won,
    slowed:    !won && slower,
    cluttered: !won && (G.blind > 0 || G.bloomT > 0),
    boosted:   !won && faster,
    shocked:   !won && G.shockT > 0,
    chrono:    !won && G.chronoT > 0,
    onfire:    !won && G.ultOn && p === "burn",
    phasing:   !won && G.ultOn && p === "phase",
    powered:   !won && G.ultOn && p === "storm" && G.powered > 0,
    ordered:   !won && G.orderedT > 0,
    slippery:  !won && G.slipT > 0,
    launched:  !won && airborne()
  };
  for(const id in on){
    if(on[id]) logEffect(id);
    else dropEffect(id);
  }
  if(G.cleanseT <= 0 && effEls.cleansed) dropEffect("cleansed");
  const imm = G.immune > 0 && !won;
  const tag = $("#immuneTag");
  const lbl = tag.firstElementChild;
  if(lbl) lbl.textContent = t(EFFECTS.immune.key);
  tag.classList.toggle("on", imm);
  $("#shell").classList.toggle("immune", imm);
}

/* ---- who is driving this one ------------------------------------
   A ring on the road under every human car and, on the cars that are not
   yours, a small numbered flag. Two players in identical positions on two
   columns still have to be told apart, and the car alone will not do it. */
function drawSeatMark(who, cx, cy){
  const i = seatOf(who);
  if(i < 0) return;
  const col = PCOLS[i];
  const own = VOWN === who;
  ctx.save();
  ctx.globalAlpha = own ? 0.5 : 0.95;
  ctx.beginPath();
  if(ctx.ellipse) ctx.ellipse(cx, cy + carH*0.5, carW*0.64, carW*0.22, 0, 0, 6.2832);
  else ctx.arc(cx, cy + carH*0.5, carW*0.5, 0, 6.2832);
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.6, 2.6*SCENE); ctx.stroke();
  ctx.globalAlpha = 1;
  if(!own){
    const w = 24*SCENE, h = 16*SCENE, ty = cy - carH*0.62 - h;
    fillRR(cx - w/2, ty, w, h, 4*SCENE, col);
    ctx.fillStyle = "#0B0B0C";
    ctx.font = "700 " + Math.max(8, 10*SCENE).toFixed(1) + "px " + HUD_MONO;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("P" + (i + 1), cx, ty + h/2 + 0.5);
  }
  ctx.restore();
}

/* ---- one column's instruments -----------------------------------
   Painted on the canvas rather than in the page, because four of everything in
   the DOM would be four stylesheets to keep in step with a road already drawn
   here. What it must not be is a second design: every number, colour and
   position below is read off the page's own HUD, so a player in a column is
   looking at the same instruments as a player on a phone - same distance
   readout top right, same ladder under it, same two meters across the foot,
   same ultimate and item squares bottom right. */
const HUD_MONO = "'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace";
const HUD_DISPLAY = "Archivo, 'Arial Narrow', Helvetica, sans-serif";

/* ---- the page's HUD, in numbers ---------------------------------
   Everything below is laid out from these, and the stylesheet lays the page's
   own HUD out from the same figures. They are the contract between the two:
   change one here and the matching value in css/app.css, or a column and a
   phone stop showing the same race. */
const HUD_EDGE = 14;                       /* left and right inset */
const HUD_TOP = 12;                        /* top inset */
const HUD_READ_W = 140;                    /* the distance panel, at full size */
const HUD_ACT = 56;                        /* the ultimate and item squares */
const HUD_ACT_GAP = 8;
const HUD_ACT_BOT = 46;                    /* how far they stand off the foot */
const HUD_RAIL_BOT = 12;                   /* and the meter tray under them */
const HUD_RAIL_MAX = 680;                  /* how wide the instrument band gets */
const HUD_RAIL_PAD = 6;
const HUD_BAR = 5;                         /* one meter track */
const HUD_RAIL_H = HUD_RAIL_PAD*2 + HUD_BAR*2 + 5;
const HUD_PILL_H = 20;                     /* one effect pill */
const HUD_PILL_GAP = 4;

/* the interface ramp, the same values the stylesheet's tokens carry */
const HUD_INK = "#F4F5F6";
const HUD_DIM = "#71767E";
const HUD_MID = "#A7ACB3";
const HUD_LINE = "rgba(255,255,255,0.10)";
const HUD_LINE2 = "rgba(255,255,255,0.16)";
const HUD_RED = "#E5262D";
const HUD_RED_HI = "#FF4A50";

/* How far the bottom row - the squares, the pills, the immune tag - stands off
   the foot. A short viewport pulls it in, exactly as the stylesheet's
   @media (max-height:480px) block does. */
function hudFoot(){ return H < 480 ? 40 : HUD_ACT_BOT; }
/* The instrument band's inset. On a narrow view it is the plain edge margin;
   on a wide one it closes in so the meters, the pills and the two squares stay
   beside the road rather than in the far corners. The stylesheet's --side on
   .hud is this same expression. */
function hudSide(){ return Math.max(HUD_EDGE, (W - HUD_RAIL_MAX)/2); }
/* The standings panel, narrowed where a view is narrow. Four columns on a
   small screen leave under three hundred points each, and a panel that took
   half of one would be a panel covering the road it is reporting on. */
function readWidth(){ return Math.round(Math.min(HUD_READ_W, Math.max(112, W*0.42))); }

/* The page's glass, as close as a canvas gets. There is no blur to be had
   here - the road underneath is this view's own drawing, already flat - so the
   dark fill carries the contrast the blur would have carried, and the hairline
   and the top highlight carry the shape. */
function hudGlass(x, y, w, h, r, alpha){
  fillRR(x, y, w, h, r, "rgba(9,10,12," + (alpha === undefined ? 0.78 : alpha) + ")");
  rr(x, y, w, h, r);
  ctx.strokeStyle = HUD_LINE; ctx.lineWidth = 1; ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, 1.6); ctx.clip();
  rr(x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

let LETTER_SP = null;
/* Canvas gained letter-spacing late; where it is missing the tracking is
   stepped out by hand, because these labels are unreadable set solid. */
function trackText(str, x, y, ls, align){
  if(LETTER_SP === null){
    try{ ctx.letterSpacing = "0px"; LETTER_SP = typeof ctx.letterSpacing === "string"; }
    catch(e){ LETTER_SP = false; }
  }
  if(!ls){ ctx.textAlign = align || "left"; ctx.fillText(str, x, y); return; }
  if(LETTER_SP){
    ctx.letterSpacing = ls + "px";
    ctx.textAlign = align || "left";
    ctx.fillText(str, x, y);
    ctx.letterSpacing = "0px";
    return;
  }
  let w = -ls;
  for(let i=0;i<str.length;i++) w += ctx.measureText(str[i]).width + ls;
  let cx = align === "right" ? x - w : (align === "center" ? x - w/2 : x);
  ctx.textAlign = "left";
  for(let i=0;i<str.length;i++){ ctx.fillText(str[i], cx, y); cx += ctx.measureText(str[i]).width + ls; }
}
/* How wide a tracked run comes out, so a pill can be cut to fit its label. */
function trackWidth(str, ls){
  const w = ctx.measureText(str).width;
  return ls ? w + ls*Math.max(0, str.length - 1) : w;
}
function placeOf(who){
  const done = who === "me" ? G.finished : who.finished;
  if(done !== null && done !== undefined) return done;
  const m = who === "me" ? G.meters : metersOf(who);
  let n = 1;
  if(who !== "me" && G.meters > m) n++;
  for(let i=0;i<G.rivals.length;i++){
    const R = G.rivals[i];
    if(R !== who && metersOf(R) > m) n++;
  }
  return n;
}

/* ---- the two meters across the foot ----
   One tray, two tracks: launch on top, boost below. The page puts them in the
   same tray for the same reason - the two things you fill by holding are one
   question, so they get one place to look. */
function hudMeters(o){
  if(!ruleOn("boost")) return;             /* no launch, no boost, no tray */
  const x = hudSide(), w = Math.max(48, W - x*2);
  const ry = H - HUD_RAIL_BOT - HUD_RAIL_H;
  const air = !!(o.airT > 0), armed = o.airMeter <= AIR_ARM && o.airWind <= 0;
  const wound = o.airWind >= 1, winding = o.airWind > 0 && o.airWind < 1;
  const cooling = o.launchCD > 0 && !air;

  ctx.save();
  hudGlass(x, ry, w, HUD_RAIL_H, 8);
  const bx = x + 8, bw = w - 16;
  const ay = ry + HUD_RAIL_PAD;                                   /* #airWrap */
  const by = ay + HUD_BAR + 5;                                    /* #boostWrap */

  /* the launch */
  ctx.save();
  if(armed){ ctx.shadowColor = "rgba(47,191,99,0.85)"; ctx.shadowBlur = 9; }
  else if(wound){ ctx.shadowColor = "rgba(255,233,168,0.9)"; ctx.shadowBlur = 14; }
  else if(winding){ ctx.shadowColor = "rgba(255,255,255,0.7)"; ctx.shadowBlur = 10; }
  fillRR(bx, ay, bw, HUD_BAR, 3, "rgba(255,255,255,0.14)");
  ctx.restore();
  fillRR(bx, ay, bw*AIR_ARM, HUD_BAR, 3, "rgba(47,191,99,0.26)");  /* #airZone */
  const fillCol = air ? "#FFFFFF"
                : cooling ? "rgba(47,191,99,0.30)"
                : (armed ? "#7CF7A6" : "#2FBF63");
  if(o.airMeter > 0.001) fillRR(bx, ay, Math.max(4, bw*clamp(o.airMeter,0,1)), HUD_BAR, 3, fillCol);
  if(o.airWind > 0.001){                                           /* #airWind */
    ctx.save();
    ctx.shadowColor = wound ? "rgba(255,210,74,0.9)" : "rgba(255,255,255,0.8)";
    ctx.shadowBlur = wound ? 12 : 8;
    fillRR(bx, ay, Math.max(4, bw*clamp(o.airWind,0,1)), HUD_BAR, 3, wound ? "#FFE9A8" : "#FFFFFF");
    ctx.restore();
  }
  ctx.save();                                                      /* #airMark */
  ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 4;
  ctx.fillStyle = armed ? "#7CF7A6" : (cooling ? "rgba(255,255,255,0.35)" : "#FFFFFF");
  ctx.fillRect(bx + bw*AIR_ARM - 1, ay - 3, 2, HUD_BAR + 6);
  ctx.restore();

  /* the boost */
  fillRR(bx, by, bw, HUD_BAR, 3, "rgba(255,255,255,0.14)");
  if(o.charge > 0.001)
    fillRR(bx, by, Math.max(4, bw*clamp(o.charge,0,1)), HUD_BAR, 3,
           o.boostLock ? "rgba(255,255,255,0.30)" : (o.charge > 0.98 ? HUD_RED_HI : HUD_RED));
  ctx.restore();
}

/* ---- the ultimate square and the item square ----
   The charge is the square filling from the bottom, with the number over it:
   a shape to read at a glance and a figure to read when you want the exact
   answer. Exactly what the page's own button does. */
function hudActions(o){
  const bw = HUD_ACT;
  const iy = H - hudFoot() - bw;
  const ix = W - hudSide() - bw;                 /* the item, outermost */
  const ux = ix - HUD_ACT_GAP - bw;              /* the ultimate, inboard of it */

  /* A switch that is off takes its meter off the screen with it. A dark square
     that can never fill reads as something broken rather than as something
     that was not invited, and the item square is the same: no bubbles, no
     items, nothing to show. */
  if(ruleOn("ults")){
    const ready = o.ult >= 1 && !o.ultOn;
    const k = clamp(o.ult, 0, 1);
    ctx.save();
    hudGlass(ux, iy, bw, bw, 12);
    if(k > 0.001){                                /* #ultFill, rising from the foot */
      ctx.save();
      rr(ux + 1, iy + 1, bw - 2, bw - 2, 11); ctx.clip();
      const fh = Math.max(2, (bw - 2)*k);
      const fy = iy + bw - 1 - fh;
      const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
      if(ready && !NO_MOTION){
        const pulse = 0.86 + 0.14*(0.5 + 0.5*Math.sin(G.raceT*4.2));
        ctx.globalAlpha = pulse;
      }
      g.addColorStop(0, ready ? HUD_RED_HI : "rgba(229,38,45,0.85)");
      g.addColorStop(1, ready ? HUD_RED : "rgba(229,38,45,0.50)");
      ctx.fillStyle = g;
      ctx.fillRect(ux + 1, fy, bw - 2, fh);
      ctx.fillStyle = "rgba(255,122,127,0.9)";
      ctx.fillRect(ux + 1, fy, bw - 2, 1);
      ctx.restore();
    }
    if(ready){                                    /* #ultPct.ready */
      ctx.save();
      ctx.shadowColor = "rgba(229,38,45,0.75)"; ctx.shadowBlur = 16;
      rr(ux + 0.5, iy + 0.5, bw - 1, bw - 1, 12);
      ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    } else {
      rr(ux + 0.5, iy + 0.5, bw - 1, bw - 1, 12);
      ctx.strokeStyle = HUD_LINE2; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.fillStyle = ready ? "#FFFFFF" : HUD_MID;
    ctx.font = "600 14px " + HUD_MONO;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
    ctx.fillText(Math.round(o.ult*100) + "%", ux + bw/2, iy + bw/2 + 1);
    ctx.restore();
    ctx.restore();
  }

  if(!ruleOn("bubbles")) return;
  const col = o.item ? RARITY[ITEMS[o.item].rarity].col : null;
  const k = clamp((o.swapT || 0)/ITEM_SWAP, 0, 1);
  const pulse = Math.sin(k*Math.PI);              /* the trade flash, out and back */
  ctx.save();
  ctx.translate(ix + bw/2, iy + bw/2);
  if(!NO_MOTION && k > 0) ctx.scale(1 + pulse*0.18, 1 + pulse*0.18);
  ctx.translate(-(ix + bw/2), -(iy + bw/2));
  if(col){ ctx.shadowColor = withA(col, 0.5); ctx.shadowBlur = 18; }
  hudGlass(ix, iy, bw, bw, 12, o.item ? 0.88 : 0.78);
  ctx.shadowBlur = 0;
  if(col){                                        /* the rarity, on the rim */
    rr(ix + 0.5, iy + 0.5, bw - 1, bw - 1, 12);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
  } else {
    rr(ix + 0.5, iy + 0.5, bw - 1, bw - 1, 12);
    ctx.strokeStyle = HUD_LINE2; ctx.lineWidth = 1; ctx.stroke();
  }
  if(o.item){
    const paths = itemPaths(o.item);
    ctx.save();
    ctx.translate(ix + bw/2 - 14, iy + bw/2 - 14);   /* the icon is 28px on a 24 grid */
    ctx.scale(28/24, 28/24);
    ctx.strokeStyle = ITEM_INK; ctx.lineWidth = 2;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if(paths) for(let i=0;i<paths.length;i++) ctx.stroke(paths[i]);
    ctx.restore();
  }
  ctx.restore();
}

/* The readout's own proportions. A phone on its side has barely four hundred
   points of height to spend, so below 480 the panel tightens - and the
   stylesheet's @media (max-height:480px) block carries the same numbers, so
   the page's HUD and a column's tighten together. */
function readMetrics(){
  const tight = H < 480;
  return { padX:tight ? 10 : 11, padY:tight ? 7 : 9,
           big:tight ? 24 : 32, row:tight ? 12 : 14,
           rule:tight ? 6 : 8, best:5 };
}
/* The panel's height for a field of this size - the one place that arithmetic
   lives, because the edge badges and the ladder both have to know where it
   ends. */
function readHeight(rows){
  const m = readMetrics();
  return m.padY + 12 + 3 + m.big + m.rule + 1 + m.rule + rows*m.row + m.best + 13 + m.padY;
}

/* ---- the distance readout and the running order under it ----
   One panel, so white numerals hold over a white desert and a black road
   alike. In a column it also carries the seat, because four people reading
   four identical panels have to be able to find their own. */
function hudReadout(who, o){
  const board = [{ me:true, m:G.meters, car:G.car, who:"me" }].concat(
    G.rivals.map(function(R){ return { me:false, m:metersOf(R), car:R.car, who:R }; }));
  board.sort(function(a, b){ return b.m - a.m; });

  const m = readMetrics();
  const padX = m.padX, padY = m.padY;
  const w = readWidth();
  const x = W - HUD_EDGE - w, y = HUD_TOP;
  const h = readHeight(board.length);
  const rx = x + w - padX, lx = x + padX;

  ctx.save();
  hudGlass(x, y, w, h, 12);
  ctx.textBaseline = "top";

  let ry = y + padY;
  ctx.fillStyle = HUD_DIM;
  ctx.font = "9px " + HUD_MONO;
  trackText(t("distance").toUpperCase(), rx, ry, 1.8, "right");
  const seat = G.local ? seatOf(who) : -1;
  if(seat >= 0){
    fillRR(lx, ry - 1, 4, 11, 2, PCOLS[seat]);
    ctx.fillStyle = HUD_MID;
    trackText("P" + (seat + 1), lx + 8, ry, 1.2, "left");
  }
  ry += 12 + 3;

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 " + m.big + "px " + HUD_MONO;
  ctx.textAlign = "right";
  ctx.fillText(String(Math.floor(who === "me" ? G.meters : metersOf(who))), rx, ry);
  ry += m.big + m.rule;

  ctx.fillStyle = HUD_LINE;                         /* .ladder's top rule */
  ctx.fillRect(lx, ry, w - padX*2, 1);
  ry += 1 + m.rule;

  for(let i=0;i<board.length;i++){
    const row = board[i], mine = row.who === who;
    ctx.save();
    ctx.globalAlpha = mine ? 1 : 0.6;
    ctx.fillStyle = PLACE_COLS[i] || PLACE_COLS[3];
    ctx.font = (mine ? "600 " + (m.row - 1) + "px " : "600 " + (m.row - 2) + "px ") + HUD_MONO;
    ctx.textAlign = "right";
    ctx.fillText(String(Math.floor(row.m)), rx, ry + (mine ? -0.5 : 0));
    ctx.globalAlpha = mine ? 0.9 : 0.5;
    ctx.font = "9px " + HUD_MONO;
    trackText(t("place" + (i+1)).toUpperCase(), rx - (w - padX*2 - 68), ry + 2, 1.3, "right");
    ctx.restore();
    /* .pos.mine: your row is ticked in red as well as lit, so which one is
       yours never rests on brightness alone. */
    if(mine) fillRR(x + 4, ry + 1, 3, m.row - 3, 1.5, HUD_RED);
    ry += m.row;
  }

  ry += m.best;
  ctx.fillStyle = HUD_DIM;
  ctx.font = "10px " + HUD_MONO;
  trackText(t("bestShort").toUpperCase() + " " + best, rx, ry, 1, "right");
  ctx.restore();
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
/* ---- what is currently being done to this car ----
   The page keeps one pill per state for the player. A rival carries the same
   states under its own field names, so the reading is the same reading. */
function hudEffects(who, o){
  const p = CARS[who === "me" ? G.car : who.car].power;
  const won = (who === "me" ? G.finished : who.finished) !== null;
  const boostT = who === "me" ? (G.launchT > 0 || G.canT > 0) : (o.launch > 0 || o.canT > 0);
  const blindT = who === "me" ? (G.blind > 0 || G.bloomT > 0) : (o.blind > 0 || o.clutter > 0);
  const slowT  = who === "me" ? (G.slowT > 0 || G.chronoT > 0) : (o.slow > 0 || o.chrono > 0);
  const chronoT= who === "me" ? G.chronoT > 0 : o.chrono > 0;
  const shockT = who === "me" ? G.shockT > 0 : o.shock > 0;
  const ordT   = who === "me" ? G.orderedT > 0 : o.ordered > 0;
  const slipT  = who === "me" ? G.slipT > 0 : o.slip > 0;
  const air    = o.airT > 0;
  const faster = o.boosting || boostT || air ||
                 (o.ultOn && ULT_EFFECTS[p].indexOf("boosted") >= 0);
  const on = [];
  if(won) on.push("winner");
  else {
    if(slowT) on.push("slowed");
    if(blindT) on.push("cluttered");
    if(faster) on.push("boosted");
    if(shockT) on.push("shocked");
    if(chronoT) on.push("chrono");
    if(o.ultOn && p === "burn") on.push("onfire");
    if(o.ultOn && p === "phase") on.push("phasing");
    if(o.ultOn && p === "storm" && (who === "me" ? G.powered > 0 : o.powered > 0)) on.push("powered");
    if(ordT) on.push("ordered");
    if(slipT) on.push("slippery");
    if(air) on.push("launched");
  }
  ctx.save();
  ctx.textBaseline = "middle";
  const sx = hudSide();
  let y = H - hudFoot() - HUD_PILL_H;
  for(let i=0;i<on.length && i<EFF_MAX;i++){
    ctx.font = "500 9px " + HUD_MONO;
    const label = t(EFFECTS[on[i]].key).toUpperCase();
    const tw = trackWidth(label, 1.3);
    const pw = Math.min(W - sx*2, 7 + 7 + 6 + tw + 9);
    hudGlass(sx, y, pw, HUD_PILL_H, HUD_PILL_H/2);
    fillRR(sx + 7, y + HUD_PILL_H/2 - 3.5, 7, 7, 2, EFFECTS[on[i]].col);
    rr(sx + 7.5, y + HUD_PILL_H/2 - 3, 6, 6, 2);
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = HUD_INK;
    trackText(label, sx + 20, y + HUD_PILL_H/2 + 0.5, 1.3, "left");
    y -= HUD_PILL_H + HUD_PILL_GAP;
  }
  ctx.restore();

  /* Immunity: the gold pill across the foot and the gold edge around the
     view - on the page that edge is a border on the shell, so in a column it
     is a border on the column. */
  const imm = !won && o.immune > 0;
  if(imm){
    ctx.save();
    ctx.font = "600 9px " + HUD_MONO;
    ctx.textBaseline = "middle";
    const label = t(EFFECTS.immune.key).toUpperCase();
    const pw = trackWidth(label, 2) + 22;
    const px = W/2 - pw/2, py = H - hudFoot() - HUD_PILL_H;
    fillRR(px, py, pw, HUD_PILL_H, HUD_PILL_H/2, "rgba(10,11,13,0.66)");
    rr(px, py, pw, HUD_PILL_H, HUD_PILL_H/2);
    ctx.strokeStyle = "rgba(255,216,107,0.55)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#FFD86B";
    trackText(label, W/2, py + HUD_PILL_H/2 + 0.5, 2, "center");
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = (Math.floor(G.raceT*1.82) % 2) ? "#FFFFFF" : "#FFD86B";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
    ctx.restore();
  }
  /* the cleanse flash, in the middle of your own column */
  const cl = who === "me" ? G.cleanseT : o.cleanse;
  if(cl > 0){
    const k = clamp(1 - cl/CLEANSE_TIME, 0, 1);           /* runs once, then goes */
    const a = k < 0.25 ? k/0.25 : (k > 0.75 ? Math.max(0, (1-k)/0.25) : 1);
    if(a > 0.01){
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(W/2, H*0.40);
      if(!NO_MOTION) ctx.scale(0.88 + Math.min(1, k/0.25)*0.12, 0.88 + Math.min(1, k/0.25)*0.12);
      ctx.fillStyle = "#B96BFF";
      ctx.font = "760 26px " + HUD_DISPLAY;
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowOffsetY = 2; ctx.shadowBlur = 20;
      trackText(t(EFFECTS.cleansed.key).toUpperCase(), 0, 0, 2.1, "center");
      ctx.restore();
    }
  }
}

function drawSeatHud(who, seat){
  const o = who === "me" ? G : who;
  ctx.save();
  hudReadout(who, o);
  hudMeters(o);
  hudActions(o);
  hudEffects(who, o);
  ctx.restore();
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}

/* A hairline between columns and a band of the owner's colour above each one,
   so four games on one screen never read as one game. */
function drawSplitEdges(){
  const n = G.humans.length;
  ctx.save();
  for(let i=0;i<n;i++){
    ctx.fillStyle = PCOLS[i];
    ctx.fillRect(i*W, 0, W, 3);
  }
  /* the gap between two games: solid black with a hairline either side, so a
     column reads as a window rather than as more road */
  for(let i=1;i<n;i++){
    ctx.fillStyle = "#050506";
    ctx.fillRect(i*W - 2, 0, 4, H);
    ctx.fillStyle = HUD_LINE;
    ctx.fillRect(i*W - 2.5, 0, 1, H);
    ctx.fillRect(i*W + 1.5, 0, 1, H);
  }
  ctx.restore();
}

/* When the other car is off the top or bottom of the screen, a marker at the
   edge shows which lane it is in and how far up or down the road it is. */
function pipColour(id){ return CARS[id].pip || CARS[id].accent; }

/* A ladder down the right-hand side: one dot per racer, height showing how far
   ahead or behind they are. Off-screen cars also get their distance badge here. */
function ladderGeom(){
  /* Sits in the gap the panels leave: under the standings, over the ultimate
     and item squares. Both ends are measured rather than assumed, so a field
     of two and a field of six each get the longest line that still clears
     everything. */
  const z = hudZones();
  const top = z.readBottom + 18;
  /* Never shorter than this, and never reaching back up into the panel: on a
     phone held sideways the gap between the two is small, and a line that
     solved that by growing would be a line drawn through the standings. */
  const bottom = Math.max(top + 44, z.actsTop - 18);
  return { x:W - 26, cy:(top + bottom)/2, half:Math.min((bottom - top)/2, 150) };
}
/* How much road the whole race covers - the standing start at one end, the
   finish line at the other. The flag is only planted on the last of the three
   closing tracks, so until then the far end is a projection: the driving still
   to come, at the pace this race has actually been run at, plus the run-in to
   the line. It creeps rather than jumps, and it snaps to the true number the
   moment the flag exists. Endless has no line to run to, so it gets no span. */
function raceSpan(){
  if(!toFlag()) return null;
  if(G.finishAt) return { from:0, to:G.finishAt };
  const cruise = BASE_SPEED*0.075;                 /* metres a second at 1.00x */
  const pace = G.raceT > 4 ? clamp(G.meters/G.raceT, cruise*0.5, cruise*3) : cruise;
  let secs;
  if(G.tracksLeft < 0){
    /* Still on the clock. Run the track timer forward to the five minute mark
       so the count picks up exactly where this branch leaves off - otherwise
       the scale lurches the moment the closing tracks start counting. */
    const mark = Math.max(0, RACE_MINUTES*60 - G.raceT);
    const skip = Math.max(0, Math.ceil((mark - G.trackT)/TRACK_SECONDS));  /* switches before the mark */
    const t2 = G.trackT + skip*TRACK_SECONDS - mark;   /* what the track timer reads at the mark */
    secs = mark + t2 + (FINAL_TRACKS - 1)*TRACK_SECONDS;
  } else {
    secs = G.trackT + Math.max(0, G.tracksLeft - 1)*TRACK_SECONDS;
  }
  return { from:0, to:G.meters + secs*pace + FINISH_STRETCH };
}

/* Where a racer sits on the line. The line is the whole race, so a dot is placed
   by how far down the race that racer is: the foot of it is the standing start,
   the head of it is the finish, and a dot halfway up is halfway home. The dots
   and the fill behind them are the one scale, read off the same numbers. Endless
   has no finish to measure against, so it falls back to the old rolling window,
   you in the middle and the field measured against you. */
function ladderY(m, g, span){
  if(!span) return g.cy - clamp((m - G.meters)/PIP_FAR, -1, 1)*g.half;
  const p = clamp((m - span.from)/Math.max(1, span.to - span.from), 0, 1);
  return (g.cy + g.half) - p*g.half*2;             /* start at the foot, flag at the head */
}

function drawLadder(){
  if(G.state === "idle") return;
  const g = ladderGeom();

  ctx.save();
  ctx.lineWidth = 2; ctx.lineCap = "round";
  /* The line is the whole race: its foot is the standing start, its head is the
     finish. It is drawn between exactly the same two points it always was - what
     changed is that the stretch you have already covered is lit and the road
     still to come is left dim, so how far up the lit part reaches is how far
     through the race you are. Endless has no finish to measure against, so it
     keeps the plain even line. */
  const span = raceSpan();
  const foot = g.cy + g.half, head = g.cy - g.half;
  ctx.strokeStyle = span ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.5)";
  ctx.beginPath(); ctx.moveTo(g.x, head); ctx.lineTo(g.x, foot); ctx.stroke();
  if(span){
    const p = clamp((G.meters - span.from)/Math.max(1, span.to - span.from), 0, 1);
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath(); ctx.moveTo(g.x, foot); ctx.lineTo(g.x, foot - p*g.half*2); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  [-1, 1].forEach(function(s2){
    ctx.beginPath();
    ctx.moveTo(g.x - 5, g.cy + s2*g.half); ctx.lineTo(g.x + 5, g.cy + s2*g.half);
    ctx.stroke();
  });
  ctx.strokeStyle = "rgba(255,255,255,0.3)";      /* half distance (level with you in endless) */
  ctx.beginPath(); ctx.moveTo(g.x - 3, g.cy); ctx.lineTo(g.x + 3, g.cy); ctx.stroke();
  ctx.restore();

  /* every rival, plus you - placed by how far down the race they are, not by
     how far off you they are, so you climb the line as you close on the flag */
  /* Gaps are measured from whoever is looking at this ladder, and the dot with
     the ring on it is theirs. On one screen that is always the player, which is
     what it always was; in local play each column answers for its own seat. */
  const mine = VOWN === "me" ? G.meters : metersOf(VOWN);
  const marks = [];
  for(let i=0;i<G.rivals.length;i++){
    const R = G.rivals[i];
    const rm = metersOf(R);
    const own = VOWN === R;
    marks.push({
      col: pipColour(R.car), pcol: seatCol(R), gap: rm - mine, y: ladderY(rm, g, span),
      off: !own && (R.y < CT - 18 || R.y > CB + 18), above: R.y < CT - 18, me: own,
      ex: clamp(R.x, roadX + 30, roadX + roadW - 30)     /* the lane it is in */
    });
  }
  const own1 = VOWN === "me";
  marks.push({ col: pipColour(G.car), pcol: seatCol("me"), gap: G.meters - mine,
               y: ladderY(G.meters, g, span),
               off: !own1 && (playerY < CT - 18 || playerY > CB + 18),
               above: playerY < CT - 18, me: own1,
               ex: clamp(G.x, roadX + 30, roadX + roadW - 30) });

  /* Every off-screen racer gets a marker now, not just the nearest one each
     way. Which marker it gets is the only question. */
  const near = [], far = [];
  for(let i=0;i<marks.length;i++){
    const m = marks[i];
    if(!m.off) continue;
    /* gate on the number the badge would print, so a badge reading 499m is a
       badge that is shown and one reading 500m never appears */
    if(Math.round(Math.abs(m.gap)) < PIP_FAR) near.push(m); else far.push(m);
  }

  /* the close ones, at the edge they went off */
  edgeRows(near.filter(function(m){ return m.above; }), true);
  edgeRows(near.filter(function(m){ return !m.above; }), false);
  for(let i=0;i<near.length;i++) drawEdgeMark(near[i]);

  /* the far ones, stacked down the ladder beside their own dots */
  far.sort(function(a, b){ return a.y - b.y; });
  let last = -1e9;
  for(let i=0;i<far.length;i++){
    far[i].by = Math.max(far[i].y, last + 28);
    last = far[i].by;
  }
  const overflow = far.length ? Math.max(0, far[far.length-1].by - (H - 40)) : 0;
  for(let i=0;i<far.length;i++) far[i].by -= overflow;
  for(let i=0;i<far.length;i++) drawFarMark(far[i], g);

  for(let i=0;i<marks.length;i++){
    const m = marks[i];
    ctx.beginPath(); ctx.arc(g.x, m.y, m.me ? 5.5 : 4.2, 0, 6.2832);
    ctx.fillStyle = m.col; ctx.fill();
    if(m.me){
      ctx.strokeStyle = "rgba(11,11,12,0.8)"; ctx.lineWidth = 1.6; ctx.stroke();
    }
    /* A dot with a person behind it wears that person's colour, so four
       columns can all read the same ladder and each find themselves on it. */
    if(m.pcol){
      ctx.beginPath(); ctx.arc(g.x, m.y, (m.me ? 5.5 : 4.2) + 2.6, 0, 6.2832);
      ctx.strokeStyle = m.pcol; ctx.lineWidth = 2; ctx.stroke();
    }
  }
}

/* The HUD is DOM painted over the canvas, so whatever it covers is space a
   badge cannot use, and where a badge can go is a question about the page
   rather than about this file. Carrying a copy of the stylesheet's numbers here
   would be wrong the moment a notch inset shifted the block down, the mode
   dropped the race clock or the six place rows, or the mono font rendered a
   line taller than assumed - and being wrong means a badge printed under the
   standings, which is a badge nobody can read.

   So the three blocks that matter are measured off the page: the track name and
   clock at the top left, the standings at the top right, the ultimate and item
   buttons at the bottom right. Rects come back in screen pixels while the canvas
   thinks in design pixels, so the desktop scale is divided back out the way
   resize() does it. Reading rects forces layout, so it happens twice a second
   rather than sixty times - none of them move except when a race starts or the
   window changes - and a box that comes back implausible is dropped rather than
   believed, which leaves the arithmetic below as the fallback. */
let hudZoneCache = null, hudZoneTick = 0;
function hudZones(){
  if(--hudZoneTick > 0 && hudZoneCache) return hudZoneCache;
  hudZoneTick = 120;
  /* The fallback - and, in local play, the whole answer - is the stylesheet's
     own arithmetic, run here. A square that is switched off takes its space
     back with it, so an edge badge can use the corner a missing meter left. */
  const acts = (ruleOn("ults") || ruleOn("bubbles")) ? HUD_ACT : 0;
  const rail = ruleOn("boost") ? HUD_RAIL_H + HUD_RAIL_BOT : 10;
  const z = {
    gaugeBottom: HUD_TOP + 42 + 8 + 26,
    readBottom:  HUD_TOP + readHeight(G.rivals.length + 1),
    readLeft:    W - HUD_EDGE - readWidth(),
    actsTop:     acts ? H - hudFoot() - HUD_ACT : H - rail,
    actsLeft:    acts ? W - hudSide() - HUD_ACT*2 - HUD_ACT_GAP : W - hudSide()
  };
  if(G.local){
    /* The columns paint the page's HUD themselves, at the page's own
       coordinates, so the defaults above already describe them exactly.
       Nothing is measured because there is nothing in the page to measure. */
    hudZoneCache = z;
    return z;
  }
  const c = $("#cv");
  const cr = c && c.getBoundingClientRect ? c.getBoundingClientRect() : null;
  if(cr && cr.width > 0){
    const k = Math.max(0.01, deskFit());
    const rel = function(sel){
      const el = $(sel);
      if(!el || !el.getBoundingClientRect) return null;
      const b = el.getBoundingClientRect();
      if(!(b.width > 0) || !(b.height > 0)) return null;
      if(b.width > W*0.7*k || b.height > H*0.7*k) return null;   /* a stub, or a bad read */
      return { left:(b.left - cr.left)/k, top:(b.top - cr.top)/k, bottom:(b.bottom - cr.top)/k };
    };
    const gauge = rel("#gauges"), read = rel(".readout"), acts = rel("#hudActions");
    if(gauge) z.gaugeBottom = gauge.bottom;
    if(read){ z.readBottom = read.bottom; z.readLeft = read.left; }
    if(acts){ z.actsTop = acts.top; z.actsLeft = acts.left; }
  }
  hudZoneCache = z;
  return z;
}

/* How much clear width a row of edge badges has at a given height. Which parts
   of the HUD are in the way depends on how high the row sits, so it is asked per
   row rather than guessed once: the standings only block the top of the screen,
   the two buttons only block the bottom, and the ladder column blocks both. A
   row placed clear of a thing gets that width back, which is what keeps a badge
   under the car it belongs to instead of shunted a lane inboard. */
function edgeBounds(y){
  const z = hudZones();
  const lo = 12 + EDGE_W/2;
  let hi = Math.min(W - 12, ladderGeom().x - 13 - FAR_W - 4) - EDGE_W/2;
  if(y - 13 < z.readBottom) hi = Math.min(hi, z.readLeft - 4 - EDGE_W/2);
  if(y + 13 > z.actsTop)    hi = Math.min(hi, z.actsLeft - 4 - EDGE_W/2);
  return { lo:lo, hi:Math.max(lo, hi) };
}

/* Place a set of edge badges. Each one wants to sit under its own car so the
   lane it is in can be read off at a glance, so they are laid out from those
   positions and only pushed apart where they would otherwise sit on each other.
   Five cars off the same edge is ordinary on hard, and five badges do not fit
   across a phone, so a row that cannot hold them all spills onto a second one
   set further in - squeezing them into one line instead would put the digits
   under each other, and the digits are the whole point. Closest first, so the
   car about to arrive is the one on the outside row.

   The rows sit as far out as the HUD allows rather than hard against the glass:
   at the top the standings run a fifth of the way down the screen, and at the
   bottom the ultimate and item buttons stand off the corner, and a badge behind
   either is a badge you cannot read. */
function edgeRows(list, above){
  if(!list.length) return;
  const z = hudZones();
  const anchor = above ? z.gaugeBottom + 18 : z.actsTop - 21;
  list.sort(function(a, b){ return Math.abs(a.gap) - Math.abs(b.gap); });
  let start = 0, line = 0;
  while(start < list.length){
    const y = anchor + (above ? 1 : -1)*line*EDGE_ROW;
    const b = edgeBounds(y);
    const perRow = Math.max(1, Math.floor((b.hi - b.lo)/(EDGE_W + 4)) + 1);
    const row = list.slice(start, start + perRow);
    for(let i=0;i<row.length;i++) row[i].ey = y;
    spreadRow(row, b.lo, b.hi);
    start += perRow; line++;
  }
}

/* One row: sort by where the cars actually are, walk left to right pushing each
   badge clear of the one before, then slide the whole run back if it has run off
   the end. The spacing is never squeezed below the badge width, so nothing can
   end up printed on top of anything else. */
function spreadRow(row, lo, hi){
  row.sort(function(a, b){ return a.ex - b.ex; });
  const step = EDGE_W + 4;
  let x = lo;
  for(let i=0;i<row.length;i++){
    row[i].ex = Math.max(row[i].ex, x);
    x = row[i].ex + step;
  }
  const over = row[row.length-1].ex - hi;
  if(over > 0){
    x = hi;
    for(let i=row.length-1;i>=0;i--){
      row[i].ex = Math.min(row[i].ex, x);
      x = row[i].ex - step;
    }
  }
}

/* The close marker: which lane, which way, and how far. */
function drawEdgeMark(m){
  const x = m.ex, y = m.ey, c = m.col, w = EDGE_W;
  ctx.save();
  fillRR(x - w/2, y - 13, w, 26, 13, "rgba(11,11,12,0.78)");
  rr(x - w/2, y - 13, w, 26, 13);
  ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();

  const cx = x - w/2 + 14;
  ctx.strokeStyle = c; ctx.lineWidth = 2.4; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath();
  if(m.above){ ctx.moveTo(cx - 4.5, y + 3.5); ctx.lineTo(cx, y - 3.5); ctx.lineTo(cx + 4.5, y + 3.5); }
  else       { ctx.moveTo(cx - 4.5, y - 3.5); ctx.lineTo(cx, y + 3.5); ctx.lineTo(cx + 4.5, y - 3.5); }
  ctx.stroke();

  ctx.fillStyle = c;
  ctx.font = "600 11px ui-monospace, Menlo, Consolas, monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(Math.abs(Math.round(m.gap)) + "m", cx + 20, y + 0.5);
  ctx.restore();
}

/* The far marker: no number, because the number would only tell you the car is
   out of reach, which the pair of chevrons already says. */
function drawFarMark(m, g){
  const w = FAR_W;
  const x = g.x - 13 - w/2;
  const y = m.by, c = m.col;
  ctx.save();
  fillRR(x - w/2, y - 12, w, 24, 12, "rgba(11,11,12,0.74)");
  rr(x - w/2, y - 12, w, 24, 12);
  ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.lineJoin = "round"; ctx.lineCap = "round";
  const chevron = function(cy){
    ctx.beginPath();
    if(m.above){ ctx.moveTo(x - 4.5, cy + 3); ctx.lineTo(x, cy - 3); ctx.lineTo(x + 4.5, cy + 3); }
    else       { ctx.moveTo(x - 4.5, cy - 3); ctx.lineTo(x, cy + 3); ctx.lineTo(x + 4.5, cy - 3); }
    ctx.stroke();
  };
  chevron(y + (m.above ? 3.5 : -3.5));               /* two, stacked the way it went */
  chevron(y + (m.above ? -3.5 : 3.5));
  ctx.restore();
}

/* rows of three floating bubbles with a ? inside */
/* All three drawn the same way: racing red, stroked, no fills. The rarity is
   carried by the outline of the box, so the icon itself only has to say which
   item it is. The oil drop is back to a plain outline - it only ever wore a
   pale disc because a black droplet disappeared against a black panel. */
const ITEM_INK = "#E21B22";
const ITEM_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="' + ITEM_INK +
                 '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
/* The artwork, written once. The page builds its <svg> from this and the canvas
   HUD builds its Path2D from the same strings, so the icon in a split-screen
   item box is the icon in the phone's item box and cannot drift from it. */
const ITEM_PATHS = {
  can: ["M6 8h9v12H6z", "M15 11h3l2 3v6h-5", "M8 5h5v3H8z", "M9 12l-1 4h3l-1 4"],
  oil: ["M12 3.4c3.5 4.5 5.5 7.6 5.5 10a5.5 5.5 0 0 1-11 0c0-2.4 2-5.5 5.5-10Z",
        "M9.1 13.9a3 3 0 0 0 1.7 2.8"],
  seeker: ["M12 2c2.2 2.6 3.2 5.4 3.2 8.4V16H8.8v-5.6C8.8 7.4 9.8 4.6 12 2Z",
           "M8.8 12 5 16l3.8-.6M15.2 12 19 16l-3.8-.6",
           "M10.4 19h3.2l-1.6 3z"]
};
const ITEM_ICON = {};
for(const _id in ITEM_PATHS){
  ITEM_ICON[_id] = ITEM_SVG +
    ITEM_PATHS[_id].map(function(d){ return '<path d="' + d + '"/>'; }).join("") + '</svg>';
}
/* Path2D is built lazily and kept, because the same three icons are redrawn
   sixty times a second in up to four boxes at once. */
const ITEM_P2D = {};
function itemPaths(id){
  if(ITEM_P2D[id]) return ITEM_P2D[id];
  if(typeof Path2D === "undefined") return (ITEM_P2D[id] = null);
  try{ ITEM_P2D[id] = ITEM_PATHS[id].map(function(d){ return new Path2D(d); }); }
  catch(e){ ITEM_P2D[id] = null; }
  return ITEM_P2D[id];
}

function paintItemBox(){
  const box = $("#itemBox"), icon = $("#itemIcon");
  if(!box) return;
  const id = G.item;
  box.classList.toggle("full", !!id);
  /* The outline is the rarity. A border alone was not enough to read it -
     common is very nearly white, so holding one looked the same as holding
     nothing. It now carries a ring and a glow in the same colour, which
     separates common from empty and makes legendary unmistakable. */
  const col = id ? RARITY[ITEMS[id].rarity].col : null;
  box.style.borderColor = col || "";
  box.style.boxShadow = col
    ? "inset 0 1px 0 rgba(255,255,255,.10), 0 0 0 1px " + withA(col, 0.45) +
      ", 0 0 16px -1px " + withA(col, 0.55)
    : "";
  const want = id || "";
  if(box._shown !== want){ box._shown = want; icon.innerHTML = id ? ITEM_ICON[id] : ""; }

  /* The trade flash. Driven off the game clock rather than a CSS keyframe so it
     cannot fire while the race is paused, and so the reduced-motion sweep that
     flattens every animation on the page does not quietly delete the one piece
     of feedback that says a swap happened. Under reduced motion it is the
     brightness alone, with the box held still. */
  const k = clamp(G.swapT/ITEM_SWAP, 0, 1);
  box.classList.toggle("swapping", k > 0);
  if(box._swapK !== k){
    box._swapK = k;
    const pulse = Math.sin(k*Math.PI);                  /* out and back within the flash */
    box.style.filter = k > 0 ? "brightness(" + (1 + pulse*0.85).toFixed(3) + ")" : "";
    box.style.transform = k > 0 && !NO_MOTION ? "scale(" + (1 + pulse*0.18).toFixed(3) + ")" : "";
  }
}

/* ---------------- HUD -------------------------------------------- */
let lastM = -1;
function paintHUD(force){
  const m = Math.floor(G.meters);
  if(force || m !== lastM){ lastM = m; $("#hudDist").textContent = m; }
  const f = $("#boostFill");
  f.style.width = (G.charge*100).toFixed(1) + "%";
  $("#boostWrap").classList.toggle("full", G.charge > 0.98);
  $("#boostWrap").classList.toggle("locked", G.boostLock);
  /* The notch and the tinted zone are placed from AIR_ARM itself, so the line
     you are aiming under is always the line the launch actually tests. */
  const aw = $("#airWrap");
  const arm = (AIR_ARM*100).toFixed(1) + "%";
  $("#airMark").style.left = arm;
  $("#airZone").style.width = arm;
  $("#airFill").style.width = (G.airMeter*100).toFixed(1) + "%";
  $("#airWind").style.width = (G.airWind*100).toFixed(1) + "%";
  aw.classList.toggle("armed", airArmed() && G.airWind <= 0);
  aw.classList.toggle("winding", G.airWind > 0 && G.airWind < 1);
  aw.classList.toggle("wound", G.airWind >= 1);
  aw.classList.toggle("air", airborne());
  aw.classList.toggle("cooling", G.launchCD > 0 && !airborne());
  syncEffects();
  paintItemBox();
  const board = [{ me:true, m:G.meters, car:G.car }].concat(G.rivals.map(function(R){
    return { me:false, m:metersOf(R), car:R.car };
  }));
  board.sort(function(a, b){ return b.m - a.m; });
  for(let i=0;i<6;i++){
    const row = $("#posRow" + (i+1));
    if(!row) continue;
    if(!board[i]){ row.style.display = "none"; continue; }
    row.style.display = "";
    $("#pos" + (i+1)).textContent = t("place" + (i+1));
    $("#pos" + (i+1) + "n").textContent = Math.floor(board[i].m);
    row.style.color = PLACE_COLS[i] || PLACE_COLS[3];
    row.classList.toggle("mine", board[i].me);        /* which one is you */
  }
  const clock = $("#raceClock");
  clock.classList.toggle("on", toFlag());
  if(toFlag()){
    if(G.tracksLeft < 0){
      const left = Math.max(0, RACE_MINUTES*60 - G.raceT);
      clock.textContent = Math.floor(left/60) + ":" + String(Math.floor(left % 60)).padStart(2, "0");
      clock.classList.remove("final");
    } else {
      clock.textContent = G.finishAt
        ? Math.max(0, Math.round(G.finishAt - G.meters)) + "m"
        : "T-" + G.tracksLeft;
      clock.classList.add("final");
    }
  }
  /* The charge is read twice over: the square fills from the foot, which is
     what you catch out of the corner of your eye, and the figure on top is
     there when you want to know exactly. */
  const up = $("#ultPct");
  $("#ultNum").textContent = Math.round(G.ult*100) + "%";
  $("#ultFill").style.height = (clamp(G.ult, 0, 1)*100).toFixed(1) + "%";
  up.classList.toggle("ready", G.ult >= 1 && !G.ultOn);
  /* Anything a custom race switched off comes off the HUD with it. A meter
     that can never fill is worse than no meter: it reads as broken rather
     than as absent. */
  up.style.display = ruleOn("ults") ? "" : "none";
  $("#itemBox").style.display = ruleOn("bubbles") ? "" : "none";
  $("#meterRail").style.display = ruleOn("boost") ? "" : "none";
}
