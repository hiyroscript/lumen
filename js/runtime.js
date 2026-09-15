"use strict";

/* REDLINE - shared runtime state and layout.
   The canvas and its context, the road geometry, the split-screen view
   geometry, the one mutable game-state object G, the rule set readers, and
   the layout/resize machinery. It defines the state; it does not start the
   application - that is main.js. */

/* ================================================================
   RACE ENGINE
   ================================================================ */
const cv = $("#cv"), roadCtx = cv.getContext("2d");
/* Every model draws through this one handle. The select-screen icon painter
   borrows it for a moment so the icons come out of the same code as the road. */
let ctx = roadCtx;
let W=0, H=0, DPR=1;
let roadX=0, roadW=0, laneW=0, sideW=0, carW=0, carH=0, playerY=0, vign=null;
let SCENE = 1;                            /* scene scale, set by layout() from H */

/* ---- split screen ------------------------------------------------
   Local play draws the same world once per human, side by side. One world,
   several windows on to it: the master frame is player one's, and every other
   view is that frame shifted so its own car sits exactly where player one's
   sits in theirs.

   W is the width of one view, never of the canvas. Everything the world is
   built from has always measured off W, so a column is simply a narrower game
   and not one line of the road, the scenery or the cars has to know how many
   columns there are. */
let VIEWS = 1;              /* how many columns the canvas is cut into */
let FULLW = 0;              /* the whole canvas, in design px */
let CAMDY = 0;              /* this view's camera shift, in master screen px */
let CT = 0, CB = 0;         /* what this view can see, in master screen coords */
let VOWN = "me";            /* whose view is being drawn */
let VW_TOP = 0, VW_BOT = 0; /* the union of every view: what the world must cover */

/* Where a car's own view sits relative to the master frame. */
function camDy(who){ return who === "me" ? 0 : playerY - who.y; }

/* The union of every drawn view, in master screen coords. In a single-view
   game that is exactly the screen. In local play it stretches to cover the
   leading and the trailing human, so scenery is built and kept for the whole
   spread rather than for player one's window alone - otherwise a player half a
   screen up the road drives through an empty white world. */
function viewBounds(){
  if(!G.local){ VW_TOP = 0; VW_BOT = H; return; }
  let lo = 0, hi = H;
  for(let i=0;i<G.humans.length;i++){
    const dy = camDy(G.humans[i]);
    if(-dy < lo) lo = -dy;
    if(-dy + H > hi) hi = -dy + H;
  }
  VW_TOP = lo; VW_BOT = hi;
}
/* First y of a road pattern of this period that is at or above the top of the
   view being drawn. The markings are periodic in the scroll, so shifting the
   camera is the same as advancing the phase - this is what says by how much. */
function perTop(off, per){ return off + Math.floor((CT - off)/per)*per; }

const G = {
  state:"idle", lane:1, x:0, tilt:0,
  scroll:0, speed:0, dist:0, meters:0,
  charge:1, boosting:false, keyBoost:false, ptrBoost:false,
  traffic:[], build:[[],[]], props:[], walks:[],
  shake:0, timers:[], relGap:0, nextGap:420, swipeLock:0,
  biome:"city", next:null, seam:null, trackT:60, seamPts:[], seamBits:[],
  traps:[], fx:[], trapGap:0, nextTrap:600,
  tier:0, speedT:30, blind:0, blindPts:[], dead:0, immune:0, slowT:0,
  car:"redd", ult:0, ultOn:false, ultKey:false, ultArmed:true,
  /* While an ultimate runs, ultT is the seconds it has left and ultMax the
     seconds it was granted - Bolt's returning orbs push both up, so the meter
     keeps reading as a fraction of whatever the ultimate ended up being. */
  ultT:0, ultMax:ULT_TIME, powered:0, orbFireT:0,
  boostLock:false, rivals:[], stepFlash:0, parkWait:0, parkRot:0,
  cdT:0, cdStep:-1, wasCounting:false,
  mode:"endless", diff:"medium",
  orbs:0, bolts:[], shockT:0, launchT:0, bumpCD:0,
  chronoT:0, orderedT:0, orderBy:null, bloomT:0, clutterLv:0, cleanseT:0, petals:[],
  chronoWorld:0, chronoOwner:null, bloomOwner:null, effLog:[],
  brakeOn:false, brakeKey:false, brakePtr:false, brakeSpent:false, airMeter:1, airWind:0,
  airT:0, airMax:0, airPow:0, launchCD:0,
  slipT:0, item:null, swapT:0, boxes:[], slicks:[], missiles:[], boxGap:0, nextRow:6000, canT:0, lastTap:-9, tapClock:0,
  sirenOwner:null,
  raceT:0, tracksLeft:-1, finishAt:0, finished:null, results:[], raceDone:false,
  /* local play */
  local:false, players:1, picks:[], humans:[], padBoost:false, padBrake:false,
  pad:0, padId:null, padIds:[], pk:null, seat:0,
  custom:false, rules:null
};

/* ---------------- what is on the table ---------------------------
   Every mode runs on a rule set. Standard play and both single-player modes
   run on this one, which is the game as it has always been - so the rules
   object is never a special case bolted onto local play, it is the thing the
   race has always been reading and simply could not be changed before.

   bots is -1 for "fill the grid", which is what six-cars-whatever-happens has
   always meant; a custom race can name a number instead, down to nobody. */
function defaultRules(){
  return { bots:-1, traps:true, bubbles:true, boost:true, ults:true };
}
/* How many bots this race actually wants. -1 fills whatever the people leave. */
function botsWanted(){
  const fill = FIELD_SIZE - (G.local ? G.players : 1);
  const r = G.rules || defaultRules();
  return r.bots < 0 ? fill : clamp(r.bots, 0, fill);
}
/* One reader per switch, so nothing downstream has to know a rules object
   exists or cope with it being missing. */
function ruleOn(k){
  const r = G.rules || defaultRules();
  return r[k] !== false;
}

function diff(){ return DIFFS[G.diff] || DIFFS.medium; }

function layout(){
  /* Everything the world is built from scales off the height, against a
     portrait phone as the reference. That is what keeps the two orientations
     the same game: a short landscape viewport draws a smaller road and smaller
     cars, so the stretch of road in front of you - measured in car lengths -
     comes out identical. Width still caps the road on a narrow screen, which
     is what portrait has always done. */
  SCENE  = clamp(H/860, 0.34, 2.2);
  roadW  = Math.min(W*0.72, 400*SCENE);
  roadX  = (W-roadW)/2;
  laneW  = roadW/3;
  sideW  = clamp(roadX*0.4, 10*SCENE, 32*SCENE);
  carW   = Math.min(laneW*0.64, 62*SCENE);
  carH   = carW*1.86;
  playerY= H - carH*0.62 - H*0.15;
  G.x    = laneCX(G.lane);
  if(G.seam !== null) buildSeamShape();
  vign = ctx.createRadialGradient(W/2, H*0.55, H*0.28, W/2, H*0.55, H*0.9);
  vign.addColorStop(0, "rgba(0,0,0,0)");
  vign.addColorStop(1, "rgba(0,0,0,0.55)");
  seedWorld();
}
function laneCX(i){ return roadX + laneW*(i+0.5); }

/* How much bigger the desktop shell can be drawn than it is laid out. Measured
   from the shell's own layout box, which a transform does not affect, so there
   is no feedback loop. Floored at 1 - this only ever makes things larger. */
function deskFit(){
  const root = document.documentElement;
  if(!document.body.classList.contains("desk")){
    root.style.setProperty("--desk-k", "1");
    return 1;
  }
  const sh = $("#shell");
  const w = sh.clientWidth, h = sh.clientHeight;
  if(w < 2 || h < 2) return 1;
  const k = clamp(Math.min(window.innerWidth/w, window.innerHeight/h), 1, 3);
  root.style.setProperty("--desk-k", k.toFixed(4));
  return k;
}

function resize(){
  const k = deskFit();
  /* The rect includes the desktop scale, so divide it back out: the game keeps
     thinking in the same design coordinates it always has, and every cap in
     layout() still means exactly what it meant. The backing store is then sized
     from the on-screen rect, so blowing the shell up stays crisp - cw*DPR comes
     out at r.width*devicePixelRatio either way. */
  const r = cv.getBoundingClientRect();
  const cw = Math.max(1, r.width/k), ch = Math.max(1, r.height/k);
  DPR = Math.min(Math.min(window.devicePixelRatio || 1, 2)*k, 3);
  cv.width = Math.round(cw*DPR); cv.height = Math.round(ch*DPR);
  {
    FULLW = cw; H = ch;
    W = cw/VIEWS;                              /* one column is one game */
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  CT = 0; CB = H; CAMDY = 0; VW_TOP = 0; VW_BOT = H;
  layout();
}
