"use strict";

/* SEREN - local play: seats, player colours and the controllers behind
   them. Pad discovery and the menu loops that run while the controller and
   car sheets are up live here; per-frame driving input lives in input.js. */

/* Which player is driving this car, or -1 for a bot. */
function seatOf(who){
  if(!G.local) return who === "me" ? 0 : -1;
  const i = G.humans.indexOf(who);
  return i;
}
function seatCol(who){
  const i = seatOf(who);
  return i < 0 ? null : PCOLS[i];
}

/* ================================================================
   THE MENU, ON A PAD
   ================================================================
   The controller screen has to keep looking for pads, and the car sheet has to
   let the player whose turn it is choose with the pad already in their hands.
   Both are one small loop that runs only while one of those two sheets is up
   and stops itself the moment neither is. */
let uiRaf = 0;
function uiStart(){ if(!uiRaf) uiRaf = requestAnimationFrame(uiTick); }
function uiTick(ts){
  const onPads = $("#pads").classList.contains("on");
  const onCars = G.local && $("#cars").classList.contains("on");
  if(!onPads && !onCars){ uiRaf = 0; carClock = 0; return; }
  uiRaf = requestAnimationFrame(uiTick);
  const now = (ts || 0)/1000;
  const dt = carClock ? Math.min(Math.max(now - carClock, 0), 0.05) : 0.016;
  carClock = now;
  if(onPads) padsRefresh();
  else carPadTick(dt);
}

/* A pad's own name, trimmed of the vendor and product ids the browser tacks on. */
function padName(p){
  let id = (p && p.id) || "Controller";
  id = id.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if(!id) id = "Controller";
  return id.length > 34 ? id.slice(0, 33) + "\u2026" : id;
}
/* One row per seat, filled in the order the pads were seen. The button unlocks
   only when there is a pad for every player - which is the whole reason this
   screen exists. */
function padsRefresh(){
  const pads = padPoll();
  const list = $("#padList");
  let html = "";
  for(let i=0;i<G.players;i++){
    const p = pads[i];
    html += '<div class="pad-row' + (p ? " on" : "") + '">' +
            '<span class="chip" style="background:' + PCOLS[i] + '"></span>' +
            '<span class="who">' + t("playerN") + " " + (i + 1) + '</span>' +
            '<span class="nm">' + (p ? padName(p) : t("padWaiting")) + '</span></div>';
  }
  if(list._html !== html){ list._html = html; list.innerHTML = html; }
  const ok = pads.length >= G.players;
  const cnt = $("#padCount");
  const line = pads.length + " / " + G.players + " " + t("padsNeed") + " \u00b7 " + t("padCtrls");
  if(cnt.textContent !== line) cnt.textContent = line;
  $("#btnPadsGo").classList.toggle("off", !ok);
}

/* The car sheet, driven by whoever's turn it is. Their pad and nobody else's:
   three players cannot all be moving one cursor. */
function seatPad(seat){
  const list = padPoll();
  const id = G.padIds && G.padIds[seat];
  if(id !== undefined && id !== null){
    for(let i=0;i<list.length;i++) if(list[i].index === id) return list[i];
    return null;
  }
  return list[seat];
}
function carPadTick(dt){
  const p = seatPad(pickTurn);
  const k = carKeys || (carKeys = newPadKeys());
  if(!p) return;
  const lx = padAxis(p, 0), ly = padAxis(p, 1);
  let dx = 0, dy = 0;
  if(lx <= -STICK_ON || padBtn(p, PAD_DL)) dx = -1;
  else if(lx >= STICK_ON || padBtn(p, PAD_DR)) dx = 1;
  if(ly <= -STICK_ON || padBtn(p, PAD_DU)) dy = -1;
  else if(ly >= STICK_ON || padBtn(p, PAD_DD)) dy = 1;
  const step = dy ? dy*3 : dx;              /* the board is three across */
  if(!step && Math.abs(lx) < STICK_OFF && Math.abs(ly) < STICK_OFF){ k.lane = 0; k.laneT = 0; }
  if(step){
    if(k.lane !== step){ k.lane = step; k.laneT = 0.32; carStep(step); }
    else { k.laneT -= dt; if(k.laneT <= 0){ k.laneT = 0.32; carStep(step); } }
  }
  const go = padBtn(p, PAD_CROSS);
  if(go && !k.item){
    const id = CAR_IDS[carCur];
    if(!carTaken(id)) pickCar(id);
  }
  k.item = go;
  /* Circle backs out one pick, the same as the arrow on the sheet. */
  const back = padBtn(p, PAD_CIRCLE);
  if(back && !k.ult) backFromCars();
  k.ult = back;
}

/* ================================================================
   CONTROLLERS  -  the whole of local play's input
   ================================================================
   Browsers report a "standard" mapping for PlayStation, Xbox and most
   third-party pads alike: the same control sits at the same index on all of
   them, so one table covers the lot and nothing here has to ask what is
   plugged in.

     left stick, left / right    change lane          (d-pad also works)
     left stick, held down       brake, then launch
     right stick, held up        boost
     both sticks clicked in      ultimate             (L3 + R3 / LS + RS)
     R2, or Circle               mystery bubble item  (Xbox: RT, or B)
     Options                     pause                (Xbox: Menu)

   Everything is edge-triggered off a per-player snapshot of the last frame,
   so a held trigger fires once and a held stick walks across the lanes at a
   readable pace instead of crossing the road in three frames. */
const PAD_CROSS = 0, PAD_CIRCLE = 1, PAD_L2 = 6, PAD_R2 = 7, PAD_START = 9,
      PAD_L3 = 10, PAD_R3 = 11, PAD_DU = 12, PAD_DD = 13, PAD_DL = 14, PAD_DR = 15;
const STICK_ON = 0.55, STICK_OFF = 0.32;   /* pushed / centred, with a gap between */
const LANE_REPEAT = 0.26;                  /* how fast a held stick keeps stepping */

let padSnap = [];
function padPoll(){
  const raw = navigator.getGamepads ? navigator.getGamepads() : null;
  padSnap = [];
  if(!raw) return padSnap;
  for(let i=0;i<raw.length;i++) if(raw[i] && raw[i].connected) padSnap.push(raw[i]);
  return padSnap;
}
function padCount(){ return padPoll().length; }
/* A seat holds on to its pad's own slot number rather than its place in the
   list, because the list closes up when a pad drops out: bind player three to
   "the third one connected" and a flat battery in player two's hands hands
   player three somebody else's controller mid-corner. */
function padOf(o){
  if(o.padId === undefined || o.padId === null) return padSnap[o.pad];
  for(let i=0;i<padSnap.length;i++) if(padSnap[i].index === o.padId) return padSnap[i];
  return null;
}
/* Triggers come through as analogue on most pads and as plain booleans on a
   few, so read both shapes. */
function padBtn(p, i){
  const b = p && p.buttons && p.buttons[i];
  if(b === undefined || b === null) return false;
  return typeof b === "object" ? (!!b.pressed || b.value > 0.4) : b > 0.4;
}
function padAxis(p, i){
  const v = p && p.axes && p.axes[i];
  return typeof v === "number" ? v : 0;
}
function newPadKeys(){
  return { lane:0, laneT:0, brake:false, ult:false, item:false, start:false };
}
