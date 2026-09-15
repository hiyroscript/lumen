"use strict";

/* SEREN - what a person asks a car to do: keyboard, pointer and controller,
   translated into the same mechanics calls whoever is driving. The mappings
   are the mappings; nothing here decides what a car may do about them. */

const SWIPE_STEP = 42, SWIPE_LOCK = 0.18;
const TAP_SLOP = 14;
const LONG_PRESS = 0.35;
const DOUBLE_TAP = 0.5;                  /* hold one finger this long for the ultimate */                      /* a tap may wander this far and still count */

/* ---- what a person can ask a car to do --------------------------
   Player one is the car the engine was built around and keeps its own path;
   players two to four are cars in G.rivals with a person on the controls
   instead of the bot mind. Both sides of each pair end in the same place. */
function humanSteer(who, dir){
  if(who === "me"){ move(dir); return; }
  const R = who;
  if(G.state !== "running" || R.dead > 0 || R.shock > 0 ||
     R.ordered > 0 || R.finished !== null) return;
  const d = R.slip > 0 ? -dir : dir;         /* no grip: the steering is reversed */
  const n = clamp(R.lane + d, 0, 2);
  if(n === R.lane) return;
  const victim = carAt(n, R.y, R);           /* barge whoever is in the lane you want */
  if(victim) bumpTarget(victim, d, R);
  R.lane = n;
  R.changeT = 0;
}
function humanBoost(who, on){
  if(who === "me"){ G.padBoost = !!on; setBoost(); return; }
  who.wantBoost = !!on;
}
function humanUlt(who){
  if(who === "me"){ fireUlt(); return; }
  fireUltRival(who);
}
function humanBrake(who, down){
  if(who === "me"){
    if(down){ G.padBrake = true; brakeEngage(); }
    else { G.padBrake = false; if(!G.brakeKey && !G.brakePtr) releaseBrake(); }
    return;
  }
  const R = who;
  if(down){
    R.brakeHeld = true;                        /* the latch; the engage is below */
    R.airWhy = "player";
  } else {
    R.brakeHeld = false;
    if(!R.brakeOn) return;
    if(R.airMeter <= AIR_ARM) launchRival(R);  /* under the notch: it goes up */
    else rivalBrakeOff(R);                     /* over it: the meter just comes back */
  }
}

/* ---- one frame of one player's pad ------------------------------
   None of this is a local-play version of the controls: every branch ends in
   the same call your own finger makes, so a pad barging, launching, boosting
   or spending an ultimate is running the mechanic and not a copy of it. */
function padDrive(who, dt){
  const o = who === "me" ? G : who;
  const p = padOf(o);
  const k = o.pk || (o.pk = newPadKeys());
  if(!p) return;

  const lx = padAxis(p, 0), ly = padAxis(p, 1), ry = padAxis(p, 3);
  const dl = padBtn(p, PAD_DL), dr = padBtn(p, PAD_DR);

  let want = 0;
  if(lx <= -STICK_ON || dl) want = -1;
  else if(lx >= STICK_ON || dr) want = 1;
  if(!want && Math.abs(lx) < STICK_OFF){ k.lane = 0; k.laneT = 0; }
  if(want){
    if(k.lane !== want){ k.lane = want; k.laneT = LANE_REPEAT; humanSteer(who, want); }
    else {
      k.laneT -= dt;
      if(k.laneT <= 0){ k.laneT = LANE_REPEAT; humanSteer(who, want); }
    }
  }

  humanBoost(who, ry <= -STICK_ON || padBtn(p, PAD_DU));

  const br = ly >= STICK_ON || padBtn(p, PAD_DD);
  if(br !== k.brake){ k.brake = br; humanBrake(who, br); }

  /* Both sticks pressed in, and nothing else. It was L3 + L2 before, which put
     the ultimate under one hand next to a trigger the other thumb is already
     riding - easy to catch by accident and, worse, easy to miss when you meant
     it. Two sticks is a deliberate two-handed squeeze that no other control on
     the pad shares. Clicking a stick does not move its axes, so steering,
     braking and boosting all keep running underneath it. */
  const ult = padBtn(p, PAD_L3) && padBtn(p, PAD_R3);
  if(ult && !k.ult) humanUlt(who);
  k.ult = ult;

  const item = padBtn(p, PAD_R2) || padBtn(p, PAD_CIRCLE);
  if(item && !k.item) useItem(who);
  k.item = item;

  const start = padBtn(p, PAD_START);
  if(start && !k.start) pause(G.state === "running" || G.state === "countdown");
  k.start = start;
}

/* Batteries die mid-race. A car whose controller has gone would otherwise keep
   whatever was last held - stick down, boost on - and drive itself into the
   scenery while its owner hunts for a cable. So the whole race stops, the car
   lets go of everything, and the panel says whose pad it is. */
function padsLost(seats){
  let lost = -1;
  for(let i=0;i<seats.length;i++){
    if(!padOf(seats[i] === "me" ? G : seats[i])){ lost = i; break; }
  }
  if(lost < 0) return false;
  for(let i=0;i<seats.length;i++){
    const who = seats[i];
    humanBoost(who, false);
    humanBrake(who, false);
    const o = who === "me" ? G : who;
    o.pk = newPadKeys();                     /* nothing is held any more */
  }
  const lead = $("#pauseLead");
  if(lead) lead.textContent = t("padGone").replace("{n}", String(lost + 1));
  /* The same panel, but this is not a pause anybody asked for. The class is
     what says so; resuming and starting a race both clear it. */
  $("#pausePanel").classList.add("alert");
  pause(true);
  return true;
}

/* Paused, or looking at the result: the same two buttons that run the race
   run the panel in front of it. A pad that can stop the race has to be able to
   start it again, or the only way out of a pause is the mouse. */
function padMenuTick(who){
  if(G.state !== "paused" && G.state !== "over") return;
  const o = who === "me" ? G : who;
  const p = padOf(o);
  const k = o.pk || (o.pk = newPadKeys());
  if(!p) return;
  const go = padBtn(p, PAD_START) || padBtn(p, PAD_CROSS);
  const back = padBtn(p, PAD_CIRCLE);
  const wasGo = k.start, wasBack = k.item;
  k.start = go; k.item = back;
  if(go && !wasGo){
    if(G.state === "paused") pause(false);
    else startRace();
    return;
  }
  if(back && !wasBack) leave();
}

document.addEventListener("keydown", function(e){
  if(!e.key) return;
  const k = e.key.toLowerCase();
  const racing = $("#race").classList.contains("on");
  if(k === " " || k === "enter"){
    if(G.state === "over"){ e.preventDefault(); startRace(); return; }
    if($("#home").classList.contains("on") && !$("#langWrap").classList.contains("on")){ e.preventDefault(); show("modes"); return; }
    if($("#modes").classList.contains("on")){ e.preventDefault(); show("cars"); return; }
    if($("#diffs").classList.contains("on")){ e.preventDefault(); G.diff = "medium"; show("cars"); return; }
    if($("#cars").classList.contains("on")){ e.preventDefault(); pickCar(CAR_IDS[randi(0, CAR_IDS.length-1)]); return; }
  }
  if(!racing) return;
  if(k === "arrowleft" || k === "a"){ e.preventDefault(); move(-1); }
  else if(k === "arrowright" || k === "d"){ e.preventDefault(); move(1); }
  else if(k === "arrowup" || k === "w"){ e.preventDefault(); G.keyBoost = true; setBoost(); }
  else if(k === "arrowdown" || k === "s"){
    /* Held, not tapped: the key going down starts the brake and the key coming
       up is what fires. Autorepeat sends keydown over and over, so only the
       first one counts. */
    e.preventDefault();
    G.brakeKey = true; brakeEngage();
  }
  else if(k === "p" || k === "escape"){
    e.preventDefault();
    pause(G.state === "running" || G.state === "countdown");
  }
  else if(k === "shift" || k === " "){ e.preventDefault(); G.ultKey = true; }
  else if(k === "e"){ e.preventDefault(); useItem("me"); }
});
document.addEventListener("keyup", function(e){
  if(!e.key) return;
  const k = e.key.toLowerCase();
  if(k === "arrowup" || k === "w"){ G.keyBoost = false; setBoost(); }
  if(k === "arrowdown" || k === "s"){
    if(G.brakeKey){ G.brakeKey = false; if(!G.brakePtr) releaseBrake(); }
    setBoost();
  }
  if(k === "shift" || k === " ") G.ultKey = false;
});

let ptr = {on:false, x:0, y:0, sx:0, sy:0, moved:false};
let ptrCount = 0;
const ptrDown = {};
cv.addEventListener("pointerdown", function(e){
  if(!ptrDown[e.pointerId]){ ptrDown[e.pointerId] = true; ptrCount++; }
  ptr.on = true; ptr.x = ptr.sx = e.clientX; ptr.y = ptr.sy = e.clientY; ptr.moved = false;
  ptr.hold = 0;
  if(cv.setPointerCapture) try{ cv.setPointerCapture(e.pointerId); }catch(err){}
});
cv.addEventListener("pointermove", function(e){
  if(!ptr.on) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
  /* Both vertical gestures latch until the finger comes off, so once one has
     taken hold its travel has been spent and the origin moves up to where the
     finger is now. Without that the swipe you already made keeps counting:
     dy stays at whatever you dragged, and a lane change has to out-travel it
     before it will register. Braking is the case that made it obvious - you
     hold the brake precisely because you want to pick a line - but boosting
     had the same stiffness and gets the same fix. */
  if(Math.abs(dx) > SWIPE_STEP && Math.abs(dx) > Math.abs(dy)){
    /* Each step of travel is one lane, but a flick covers several steps in
       one instant - the lock keeps that to a single lane, while a drag held
       and continued keeps stepping across. */
    if(G.swipeLock <= 0){
      move(dx > 0 ? 1 : -1);
      G.swipeLock = SWIPE_LOCK;
    }
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = true;
  } else if(dy < -34 && Math.abs(dy) > Math.abs(dx) && !G.brakePtr){
    G.ptrBoost = true; setBoost(); ptr.moved = true;
    ptr.x = e.clientX; ptr.y = e.clientY;
  } else if(dy > 34 && Math.abs(dy) > Math.abs(dx) && !G.ptrBoost){
    /* Down and hold. Whichever way this finger went first owns it until it
       comes off, so a wobble back the other way cannot flip you from braking
       into boosting halfway through a launch. */
    G.brakePtr = true; brakeEngage();
    ptr.moved = true;
    ptr.x = e.clientX; ptr.y = e.clientY;
  } else if(Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP){
    ptr.moved = true;                      /* a drag, not a tap */
  }
});
function endPtr(e){
  const tapped = ptr.on && !ptr.moved && (ptr.hold || 0) < LONG_PRESS;
  if(tapped){
    const now2 = G.tapClock;                     /* real seconds, even when stopped */
    if(now2 - G.lastTap < DOUBLE_TAP){ useItem("me"); G.lastTap = -9; }
    else G.lastTap = now2;
  }
  if(e && ptrDown[e.pointerId]){ delete ptrDown[e.pointerId]; ptrCount = Math.max(0, ptrCount - 1); }
  else { ptrCount = 0; for(const k in ptrDown) delete ptrDown[k]; }
  if(ptrCount === 0){
    ptr.on = false; G.ptrBoost = false;
    /* The finger coming off is the release. A cancelled pointer counts too:
       losing the touch has to put the car down one way or the other, or the
       brake would stay latched with nothing left to let go of. */
    if(G.brakePtr){ G.brakePtr = false; if(!G.brakeKey) releaseBrake(); }
    setBoost();
    G.ultArmed = true;             /* the ultimate needs a long press, not a tap */
  }
}
cv.addEventListener("pointerup", endPtr);
cv.addEventListener("pointercancel", endPtr);
cv.addEventListener("contextmenu", function(e){ e.preventDefault(); });
