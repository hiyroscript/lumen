"use strict";

/* REDLINE - the rules of the road, shared by every car on it.
   Contact and collisions, lane changes, boost, the brake and the launch,
   wrecking and respawning, effects, ultimates, items, hazards and particles.
   Player and bot run the same functions here; nothing is duplicated for one
   or the other. */

/* Which ultimate, if any, this car is currently driving. One place to ask,
   so every contact rule reads the same answer. */
function ultPower(who){
  if(who === "me") return G.ultOn ? CARS[G.car].power : null;
  return who && who.ultOn ? CARS[who.car].power : null;
}
function ghosting(who){ return ultPower(who) === "phase"; }
function burning(who){ return ultPower(who) === "burn"; }
/* Bolt, Timestamp, Rose and Siren all clear the road the same way: whatever
   they touch is shouldered aside rather than driven through or written off. */
function bumping(who){
  const p = ultPower(who);
  return p === "storm" || p === "freeze" || p === "bloom" || p === "siren";
}

/* Winner: granted the instant a car crosses the line and never taken away.
   A winner is out of play outright - no targeting system may pick it, nothing
   can reach it, and it takes no further part in the race it has finished. */
function finishedCar(R){ return !!R && R.finished !== null; }
function finishedMe(){ return G.finished !== null; }

/* Immune means immune to everything, ultimates included, and it also phases:
   an immune car passes through anything that would otherwise meet it. */
function immuneCar(R){ return !!R && (finishedCar(R) || R.dead > 0 || R.immune > 0); }
function immuneMe(){ return finishedMe() || G.dead > 0 || G.immune > 0; }
function immuneWho(who){ return who === "me" ? immuneMe() : immuneCar(who); }

/* Nothing on the road can make contact with this car: it has finished, it is
   wrecked, it is immune, it is phasing, or it is over everyone's heads. */
function noContact(who){
  return immuneWho(who) || ghosting(who) || overhead(who);
}
/* Safe from being barged or wrecked by another car. Immunity, phasing and the
   flag are absolute; a burning or bumping ultimate wins the exchange instead
   of losing it, which the contact rules handle, so it counts here too. */
function safeCar(R){ return !R || noContact(R) || burning(R) || bumping(R); }
function playerUntouchable(){ return noContact("me") || burning("me") || bumping("me"); }

/* ---- negative effects: who may be given one, and clearing the ones that
   somehow landed anyway ----
   Cleansed and Immune both refuse them. Immune goes further and re-clears
   every frame, so anything applied in the same frame it arrived is gone
   before it can do anything. Beneficial states are never touched by either. */
function warded(who){
  if(who === "me") return immuneMe() || G.cleanseT > 0;
  return !who || immuneCar(who) || who.cleanse > 0;
}
function scrubBad(who){
  if(who === "me"){
    G.slowT = 0; G.shockT = 0; G.blind = 0; G.chronoT = 0; G.slipT = 0;
    G.orderedT = 0; G.orderBy = null;
    if(G.bloomT > 0){ G.bloomT = 0; G.petals = []; G.clutterLv = 0; }
  } else if(who){
    who.slow = 0; who.shock = 0; who.blind = 0; who.chrono = 0; who.slip = 0;
    who.clutter = 0; who.clutterLv = 0; who.petals = []; who.ordered = 0; who.orderBy = null;
  }
}
function immuneScrub(){
  if(G.immune > 0 || finishedMe()) scrubBad("me");
  for(let i=0;i<G.rivals.length;i++){
    const R = G.rivals[i];
    if(R.immune > 0 || finishedCar(R)) scrubBad(R);
  }
}

/* every car on the road, described the same way */
function racers(){
  const list = [{ me:true, obj:null, lane:G.lane, y:playerY, car:G.car,
                  out:G.dead > 0 || finishedMe() }];
  for(let i=0;i<G.rivals.length;i++){
    const R = G.rivals[i];
    list.push({ me:false, obj:R, lane:R.lane, y:R.y, car:R.car,
                out:R.dead > 0 || finishedCar(R) });
  }
  return list;
}
function carAt(lane, y, skip){
  if(noContact(skip)) return null;             /* phasing, immune or in the air: meets nobody */
  const all = racers();
  for(let i=0;i<all.length;i++){
    const a = all[i];
    if(a.out || a.obj === skip || (skip === "me" && a.me)) continue;
    if(noContact(a.me ? "me" : a.obj)) continue;                /* and nobody meets it */
    if(a.lane === lane && Math.abs(a.y - y) < carH*0.95) return a;
  }
  return null;
}

/* Which way a car should be shoved so it always has somewhere to go: away from
   whichever barrier it is already against, and either way from the middle. */
function shoveDir(lane){
  return lane === 0 ? 1 : (lane === 2 ? -1 : (Math.random() < 0.5 ? -1 : 1));
}
/* An ultimate clearing the road. The victim is put in the next lane along
   rather than written off - a bump, not a kill - and the driver of the
   ultimate loses nothing for it. */
function ultShove(by, victim){
  const obj = victim.me ? null : victim.obj;
  if(victim.me ? noContact("me") : noContact(obj)) return;
  bumpTarget(victim, shoveDir(victim.lane), by, true);
}

/* Two cars in the same piece of road. One place decides what happens, so
   barging into a lane and running into a back bumper always agree.

   The order is the whole ruleset: phasing and immunity are absolute and meet
   nothing at all; a bumping ultimate clears the road and beats a burning one,
   which is why Redd cannot destroy Timestamp, Rose or Siren while they are
   running theirs; and burning destroys whatever is left. Returns true if the
   contact was resolved by one of those, so the caller can stop. */
function ultContact(aWho, bVictim){
  if(noContact(aWho) || (bVictim.me ? noContact("me") : noContact(bVictim.obj))) return true;
  if(bumping(aWho)){ ultShove(aWho, bVictim); return true; }
  const bWho = bVictim.me ? "me" : bVictim.obj;
  if(bumping(bWho)){                                  /* the one being hit clears the road */
    ultShove(bWho, { me:aWho === "me", obj:aWho === "me" ? null : aWho,
                     lane:aWho === "me" ? G.lane : aWho.lane });
    return true;
  }
  if(burning(aWho)){
    if(bVictim.me) destroyCar(aWho); else wreckRival(bVictim.obj, aWho);
    return true;
  }
  if(burning(bWho)){                                  /* drove into the fire */
    if(aWho === "me") destroyCar(bWho); else wreckRival(aWho, bWho);
    return true;
  }
  return false;
}

/* Running into the back of the car in front: they get shunted forward,
   you lose time. What either ultimate is doing changes the outcome. */
function rearEnd(who, victim){
  const meB = who === "me";
  if(meB ? finishedMe() : finishedCar(who)) return;      /* out of play: no contact */
  if(victim.me ? finishedMe() : finishedCar(victim.obj)) return;
  if((meB ? G.bumpCD : who.bumpCD) > 0) return;

  const vy = victim.y;
  if(meB) G.bumpCD = 0.5; else { who.bumpCD = 0.5; who.y = vy + carH*0.98; }

  if(ultContact(who, victim)) return;
  clutterOnContact(who, victim.me ? "me" : victim.obj);

  if(meB) G.slowT = Math.max(G.slowT, BUMP_SLOW*0.7);
  else who.slow = Math.max(who.slow, BUMP_SLOW*0.7);
  if(victim.me) G.launchT = LAUNCH_TIME;               /* they get shoved along */
  else victim.obj.launch = LAUNCH_TIME;
  for(let i=0;i<12;i++){
    const a = rand(-2.4, -0.7), sp = rand(60, 200);
    addFx((meB ? G.x : who.x), vy + carH*0.5, Math.cos(a)*sp, Math.sin(a)*sp,
          rand(.25,.5), rand(2,4), i % 2 ? "#FFE8C0" : "#B9BEC6");
  }
  G.shake = Math.max(G.shake, 7);
  noise(.14, .22);
}

/* Phantom coming back solid on top of someone takes both of them out. */
function rematerialise(){
  const all = racers();
  for(let i=0;i<all.length;i++){
    const a = all[i];
    if(a.me || a.out) continue;
    if(a.lane === G.lane && Math.abs(a.y - playerY) < carH*0.95){
      wreckRival(a.obj);
      destroyCar();
      return;
    }
  }
}

/* One car shouldering another out of a lane. `raw` is the shove itself, with
   no ultimate rules applied - ultShove calls in on this door so an ultimate
   clearing the road cannot bounce back off its own victim's rules. */
function bumpTarget(victim, dir, by, raw){
  if(!raw && ultContact(by, victim)) return;
  clutterOnContact(by, victim.me ? "me" : victim.obj);
  const to = victim.lane + dir;
  if(victim.me){
    if(noContact("me")) return;
    if(to < 0 || to > 2) destroyCar(by);
    else { G.lane = to; G.slowT = Math.max(G.slowT, BUMP_SLOW); }
  } else {
    if(noContact(victim.obj)) return;
    if(to < 0 || to > 2) wreckRival(victim.obj, by);
    else {
      victim.obj.lane = to;
      victim.obj.x = lerp(victim.obj.x, laneCX(to), 0.35);
      victim.obj.slow = Math.max(victim.obj.slow, BUMP_SLOW);
      victim.obj.changeT = 0.7;
      botBlame(victim.obj, by);
    }
  }
  sideSwipe(victim.obj || { x:G.x, y:playerY, car:G.car });
}

function move(dir){
  if(G.state !== "running" || G.dead > 0 || G.shockT > 0 ||
     G.orderedT > 0 || G.finished !== null) return;
  if(G.slipT > 0) dir = -dir;                    /* no grip: the steering is reversed */
  const n = clamp(G.lane + dir, 0, 2);
  if(n === G.lane) return;

  /* Barge into the lane you want. If the other car has room it is shoved
     across and left labouring; if it is already against a barrier the hit
     wrecks it instead. Either way the lane is yours. */
  const victim = carAt(n, playerY, "me");
  if(victim) bumpTarget(victim, dir, "me");
  G.lane = n;
}

/* what the bot meant to do, after its steering is reversed */
function rivalSteer(R, lane){
  if(R.slip > 0) lane = clamp(R.lane - (lane - R.lane), 0, 2);
  rivalLaneTo(R, lane);
}

function rivalLaneTo(R, lane){
  const dir = lane > R.lane ? 1 : -1;
  const victim = carAt(lane, R.y, R);
  if(victim) bumpTarget(victim, dir, R);
  R.lane = lane;
  R.changeT = 0.7;
}

/* paint and sparks where the two cars trade a lane */
function sideSwipe(R){
  const cx = (G.x + R.x)/2, cy = (playerY + R.y)/2;
  for(let i=0;i<14;i++){
    const a = rand(0, 6.2832), sp = rand(60, 240);
    addFx(cx, cy, Math.cos(a)*sp, Math.sin(a)*sp, rand(.25,.55), rand(2,4),
          i % 2 ? "#FFE8C0" : CARS[R.car].accent);
  }
  G.shake = Math.max(G.shake, 8);
  noise(.16, .25);
}
/* Trading paint counts as contact for Rose's clutter, on both cars. */
function clutterOnContact(a, b){ clutterUp(a); clutterUp(b); }
/* ================================================================
   ULTIMATES  -  five seconds, double pace, and one signature each
   ================================================================
   Every ultimate is granted through startUlt and taken away through endUlt,
   whoever is driving it, so a bot and the player run exactly the same code.
   The duration is a clock in seconds rather than a fraction of the meter,
   because Bolt's returning orbs push that clock out and a fraction cannot be
   extended without lying about what it is a fraction of. */
function ultOwnerCar(who){ return who === "me" ? G.car : who.car; }
function ultPos(who){
  return who === "me" ? { x:G.x, y:playerY } : { x:who.x, y:who.y };
}
/* seconds left / seconds granted, for the meter */
function ultFrac(who){
  const o = who === "me" ? G : who;
  return o.ultMax > 0 ? clamp(o.ultT/o.ultMax, 0, 1) : 0;
}
function ultExtend(who, secs){
  const o = who === "me" ? G : who;
  if(!o.ultOn) return;
  o.ultT += secs; o.ultMax += secs; o.powered = (o.powered || 0) + 1;
  o.ult = ultFrac(who);
}

function startUlt(who){
  const o = who === "me" ? G : who;
  const p = CARS[ultOwnerCar(who)].power;
  o.ultOn = true;
  o.ultT = ULT_TIME; o.ultMax = ULT_TIME; o.powered = 0;
  o.ult = 1;
  if(p === "storm"){ o.orbs = ORB_COUNT; o.orbFireT = ORB_GAP*0.5; }
  else if(p === "freeze") startChrono(who);
  else if(p === "bloom") startBloom(who);
  else if(p === "siren"){ cleanse(who); sirenWail(); sirenSweep(who); }
  const at = ultPos(who);
  ultBurst(ultOwnerCar(who), at.x, at.y);
}
function endUlt(who){
  const o = who === "me" ? G : who;
  const p = CARS[ultOwnerCar(who)].power;
  o.ultOn = false; o.ultT = 0; o.ultMax = ULT_TIME; o.powered = 0;
  o.ult = 0; o.orbs = 0; o.orbFireT = 0;
  if(p === "freeze" && G.chronoOwner === who) endChrono();
  if(p === "bloom" && G.bloomOwner === who) G.bloomOwner = null;
  /* Phantom coming back solid on top of somebody takes both of them out. */
  if(p === "phase" && who === "me") rematerialise();
}
/* Run the clock down for whoever is holding one. */
function tickUlt(who, dt){
  const o = who === "me" ? G : who;
  if(!o.ultOn) return;
  o.ultT -= dt;
  if(o.ultT <= 0){ endUlt(who); return; }
  o.ult = ultFrac(who);
  const p = CARS[ultOwnerCar(who)].power;
  if(p === "storm") stormTick(who, dt);
  else if(p === "siren"){ sirenSweep(who); sirenNoise(who, dt); }
}

/* ---- Timestamp: chronokinesis ----------------------------------
   The driver keeps its doubled pace and everything else on the road - every
   other car, and the world's own motion - is dragged down to half. It is a
   field-wide state rather than a per-car one, because "the world" has to slow
   as well: rolling tumbleweeds, falling rock, orbs and seekers in flight. */
function startChrono(owner){
  G.chronoOwner = owner;
  G.chronoWorld = CHRONO_TIME;
  for(let i=0;i<G.rivals.length;i++){
    const R = G.rivals[i];
    if(R !== owner && !warded(R)) R.chrono = CHRONO_TIME;
  }
  if(owner !== "me" && !warded("me")) G.chronoT = CHRONO_TIME;
  tone(140, .7, "sine", .1);
  later(function(){ tone(90, .5, "sine", .07); }, 200);
}
function endChrono(){
  G.chronoWorld = 0; G.chronoOwner = null;
  for(let i=0;i<G.rivals.length;i++) G.rivals[i].chrono = 0;
  G.chronoT = 0;
}
/* How fast the world's own moving parts are allowed to run this frame. The
   driver of the chronokinesis is exempt from nothing here - the world is slow
   for everybody; what makes it an advantage is that the driver is not. */
function worldRate(){ return G.chronoWorld > 0 ? CHRONO_RATE : 1; }

/* ---- Rose: clutter, in stages ----------------------------------
   Stage one is the screenful of petals it always was. It does not deepen on
   its own - only contact does that, a trap or another car - so a driver who
   keeps it clean rides out the same five seconds on stage one, and one who
   starts hitting things while blind cannot see well enough to stop hitting
   things. Five is the whole screen. */
function bloomPetals(){
  const out = [];
  for(let i=0;i<64;i++)
    out.push({ x:rand(-0.08,1.08), y:rand(-0.08,1.08), r:rand(10,22),
               a:rand(0,6.28), sp:rand(-1.6,1.6), s:Math.random(), layer:0,
               dx:rand(-0.0006,0.0006), fall:rand(0.0012,0.0022) });
  for(let i=0;i<44;i++)
    out.push({ x:rand(-0.10,1.10), y:rand(-0.10,1.10), r:rand(24,46),
               a:rand(0,6.28), sp:rand(-2.0,2.0), s:Math.random(), layer:1,
               dx:rand(-0.0011,0.0011), fall:rand(0.0022,0.0038) });
  for(let i=0;i<18;i++)
    out.push({ x:rand(-0.15,1.15), y:rand(-0.20,1.10), r:rand(64,110),
               a:rand(0,6.28), sp:rand(-1.2,1.2), s:Math.random(), layer:2,
               dx:rand(-0.0016,0.0016), fall:rand(0.0040,0.0062) });
  return out;
}
function startBloom(owner){
  G.bloomOwner = owner;
  for(let i=0;i<G.rivals.length;i++){
    const R = G.rivals[i];
    if(R !== owner && !warded(R)){ R.clutter = BLOOM_TIME; R.clutterLv = 1; R.petals = bloomPetals(); }
  }
  if(owner !== "me" && !warded("me")){
    G.bloomT = BLOOM_TIME;
    G.clutterLv = 1;
    G.petals = bloomPetals();
  }
  tone(520, .3, "sine", .08);
}
function clearBloom(){
  G.bloomT = 0; G.petals = []; G.bloomOwner = null; G.clutterLv = 0;
  for(let i=0;i<G.rivals.length;i++){ G.rivals[i].clutter = 0; G.rivals[i].clutterLv = 0; G.rivals[i].petals = []; }
}
/* One more layer of it, for whoever just hit something. */
function clutterUp(who){
  if(who === "me"){
    if(G.bloomT <= 0 || G.clutterLv >= CLUTTER_MAX) return;
    G.clutterLv++;
    G.shake = Math.max(G.shake, 5);
    tone(320 + G.clutterLv*90, .16, "sine", .06);
  } else if(who){
    if(who.clutter <= 0 || who.clutterLv >= CLUTTER_MAX) return;
    who.clutterLv++;
  }
}
/* Nought to one across the five stages, which is what the wash, the petal
   count and the bot's blindness are all scaled off. */
function clutterK(lv){ return clamp((lv - 1)/(CLUTTER_MAX - 1), 0, 1); }

/* ---- Siren: being ordered --------------------------------------
   Only cars near and ahead of Siren are ordered, because the point of it is to
   clear the road in front. Being ordered takes the controls away outright for
   its whole five seconds; the lane change itself only happens when Siren is
   actually in your lane, and it happens again every time Siren moves back into
   it. An order given from another lane is not wasted - it is a standing one. */
function orderLaneOf(who){ return who === "me" ? G.lane : who.lane; }
function sirenSweep(owner){
  const oy = owner === "me" ? playerY : owner.y;
  const all = racers();
  for(let i=0;i<all.length;i++){
    const a = all[i];
    if(a.out || (owner === "me" ? a.me : a.obj === owner)) continue;
    const gap = oy - a.y;                        /* positive: up the road from Siren */
    if(gap < -carH*0.4 || gap > SIREN_RANGE) continue;
    const who = a.me ? "me" : a.obj;
    if(warded(who) || noContact(who)) continue;
    if(a.me){ G.orderedT = ORDER_TIME; G.orderBy = owner; }
    else { a.obj.ordered = ORDER_TIME; a.obj.orderBy = owner; }
  }
}
/* Standing orders, made good. Anyone ordered who is sitting in Siren's lane is
   moved out of it; anyone ordered who is not simply stays ordered. */
function serveOrders(){
  for(let i=0;i<G.rivals.length;i++){
    const R = G.rivals[i];
    if(R.ordered <= 0 || !R.orderBy) continue;
    if(noContact(R)) continue;
    const by = R.orderBy;
    const gone = by !== "me" && (finishedCar(by) || by.dead > 0 || !by.ultOn);
    if(by === "me" && !G.ultOn){ R.ordered = 0; R.orderBy = null; continue; }
    if(gone){ R.ordered = 0; R.orderBy = null; continue; }
    if(orderLaneOf(by) !== R.lane) continue;
    const to = clamp(R.lane + shoveDir(R.lane), 0, 2);
    if(to !== R.lane) rivalLaneTo(R, to);
  }
  if(G.orderedT > 0 && G.orderBy){
    const by = G.orderBy;
    const gone = by !== "me" && (finishedCar(by) || by.dead > 0 || !by.ultOn);
    if(gone || noContact("me")){ G.orderedT = 0; G.orderBy = null; return; }
    if(orderLaneOf(by) === G.lane) forceLane(G.lane + shoveDir(G.lane));
  }
}
function forceLane(n){
  const t2 = clamp(n, 0, 2);
  if(t2 === G.lane) return;
  const victim = carAt(t2, playerY, "me");
  if(victim) bumpTarget(victim, t2 > G.lane ? 1 : -1, "me");
  G.lane = t2;
}

/* ---- Cleansed --------------------------------------------------
   Wipes every negative state and refuses new ones for as long as it lasts.
   Beneficial states are not touched: cleansing while boosted keeps the boost. */
function cleanse(who){
  if(who === "me"){
    scrubBad("me");
    G.cleanseT = CLEANSE_TIME;
    logEffect("cleansed");
  } else {
    scrubBad(who);
    who.cleanse = CLEANSE_TIME;
  }
  tone(1100, .18, "sine", .07);
}

function ultBurst(carId, x, y){
  const car = CARS[carId];
  for(let i=0;i<26;i++){
    const a = (i/26)*6.2832;
    addFx(x + Math.cos(a)*carW*0.7, y + Math.sin(a)*carH*0.45,
          Math.cos(a)*210, Math.sin(a)*210, rand(.4,.8), rand(3,6),
          i % 2 ? car.flame[0] : car.flame[1]);
  }
  G.shake = Math.max(G.shake, 9);
  tone(car.power === "burn" ? 180 : 520, .5, car.power === "burn" ? "sawtooth" : "sine", .1);
  later(function(){ tone(car.power === "burn" ? 260 : 780, .45, "sine", .08); }, 120);
}

/* Anything that has taken the controls away has taken the ultimate with it. */
function canFireUlt(){
  return ruleOn("ults") &&
         G.state === "running" && G.dead <= 0 && G.shockT <= 0 &&
         G.orderedT <= 0 && G.finished === null;
}
function fireUlt(){
  if(!canFireUlt()) return;
  /* Bolt: pressing again while it runs looses one of the orbs early. They go
     out on their own clock regardless, so this is impatience, not a rotation. */
  if(G.ultOn){
    if(CARS[G.car].power === "storm" && G.orbs > 0){
      if(fireOrb("me")){ G.orbs--; G.orbFireT = ORB_GAP; }
      G.ultArmed = false;
    }
    return;
  }
  if(G.ult < 1) return;
  G.ultArmed = false;
  startUlt("me");
}

/* The rival side of fireUlt, gate for gate. */
function fireUltRival(R){
  if(!ruleOn("ults")) return;
  if(G.state !== "running" || R.dead > 0 || R.shock > 0 ||
     R.ordered > 0 || R.finished !== null) return;
  if(R.ultOn){
    if(CARS[R.car].power === "storm" && R.orbs > 0){
      if(fireOrb(R)){ R.orbs--; R.orbFireT = ORB_GAP; }
    }
    return;
  }
  if(R.ult < 1) return;
  startUlt(R);
}

/* the two-tone wail while Siren has the road */
function sirenWail(){
  tone(760, .35, "square", .07);
  later(function(){ tone(560, .35, "square", .07); }, 360);
}
/* kept going for as long as the lights are on, whoever is driving */
function sirenNoise(who, dt){
  const o = who === "me" ? G : who;
  o.sirenT = (o.sirenT || 0) - dt;
  if(o.sirenT <= 0){ o.sirenT = 0.72; sirenWail(); }
}

function setBoost(){
  G.boosting = ruleOn("boost")
               && (G.keyBoost || G.ptrBoost || G.padBoost) && !G.boostLock && G.charge > 0
               && !G.brakeOn
               && G.state === "running" && G.dead <= 0 && G.finished === null
               && G.shockT <= 0 && G.orderedT <= 0;
}

/* ================================================================
   BOLT  -  three orbs that keep looking until they find work
   ================================================================
   An orb goes out at the nearest car up the road. If that car is already
   pinned - or is phasing, or immune, or over the line, all of which amount to
   the same thing, there is nothing here to pin - the orb does not go to waste:
   it climbs to the next car above and tries again. Only when there is nobody
   left above it does it turn round and come home, and a returning orb is worth
   another five seconds of the ultimate. Three orbs, three possible extensions,
   and they stack. */
function orbHolder(owner){
  return owner === "me"
    ? { x:G.x, y:playerY, orbs:G.orbs }
    : { x:owner.x, y:owner.y, orbs:owner.orbs };
}
/* the nearest car up the road from this one */
function targetAhead(fromY, skip, also){
  const all = racers();
  let best = null;
  for(let i=0;i<all.length;i++){
    const a = all[i];
    if(a.out || a.obj === skip || (skip === "me" && a.me)) continue;
    if(also !== undefined && (a.obj === also || (also === "me" && a.me))) continue;
    if(a.y >= fromY - carH*0.4) continue;
    if(!best || a.y > best.y) best = a;
  }
  return best;
}
/* Is there anything for an orb to do to this car? */
function orbCatches(who){
  if(who === "me") return !(immuneMe() || ghosting("me")) && G.shockT <= 0;
  return !(immuneCar(who) || ghosting(who)) && who.shock <= 0;
}
function fireOrb(owner){
  const h = orbHolder(owner);
  const mark = targetAhead(h.y, owner);
  /* Out in front with nobody to pin, the orb is not held back and it is not
     wasted: it goes up the road, finds the road empty, and turns for home.
     Coming home is worth another five seconds, so leading is what Bolt's
     ultimate rewards when there is nothing left to shoot at. */
  G.bolts.push({
    x:h.x, y:h.y - carH*0.4, vx:0, vy:-ORB_SPEED,
    owner:owner, car:owner === "me" ? G.car : owner.car, life:6,
    mark:mark ? (mark.me ? "me" : mark.obj) : owner,
    home:!mark,
    /* a homing orb still arcs out first, so it reads as a throw and a catch */
    arc:mark ? 0 : 0.42
  });
  tone(880, .12, "square", .07);
  later(function(){ tone(1240, .1, "square", .06); }, 70);
  return true;
}
/* Send it up the road to the next one, or home if there is no next one. */
function orbSeekOn(b, fromY){
  const owner = b.owner;
  b.arc = 0;
  const next = targetAhead(fromY, owner, b.mark);
  if(next){
    b.mark = next.me ? "me" : next.obj;
    b.life = Math.max(b.life, 3);
    for(let k=0;k<8;k++)
      addFx(b.x, b.y, rand(-70,70), rand(-70,70), rand(.2,.45), rand(2,4), "#FFF6C0");
    tone(1480, .07, "square", .05);
    return;
  }
  b.home = true;                                 /* nobody left above: come back */
  b.mark = owner;
  b.life = Math.max(b.life, 4);
  const h = orbHolder(owner);
  const hx = h.x - b.x, hy = h.y - b.y;
  const hl = Math.max(1, Math.sqrt(hx*hx + hy*hy));
  b.vx = hx/hl*ORB_SPEED; b.vy = hy/hl*ORB_SPEED;   /* about turn, at once */
  for(let q=0;q<10;q++)
    addFx(b.x, b.y, rand(-90,90), rand(-90,90), rand(.2,.45), rand(2,4), "#FFFBDA");
  tone(520, .1, "sine", .06);
}
/* An orb arriving back on Bolt. Five more seconds, and it can happen again. */
function orbAbsorb(b){
  const owner = b.owner;
  const o = owner === "me" ? G : owner;
  if(!o.ultOn) return;
  ultExtend(owner, POWER_TIME);
  const h = orbHolder(owner);
  for(let i=0;i<22;i++){
    const a = (i/22)*6.2832;
    addFx(h.x + Math.cos(a)*carW*0.85, h.y + Math.sin(a)*carH*0.55,
          -Math.cos(a)*300, -Math.sin(a)*300, rand(.25,.55), rand(2,5),
          i % 2 ? "#FFE44D" : "#FFFBDA");
  }
  G.shake = Math.max(G.shake, 8);
  tone(300, .3, "sawtooth", .09);
  later(function(){ tone(880, .26, "square", .08); }, 80);
}
/* Being in the air is no defence against an orb - Launched is explicitly still
   catchable by the seeker and by these - so this asks about immunity, a
   cleanse and phasing only, and never about being overhead. */
function shockCar(who){
  if(warded(who) || ghosting(who)) return;
  if(who === "me"){
    G.shockT = SHOCK_TIME;
    G.slowT = 0; G.boosting = false; G.keyBoost = false; G.ptrBoost = false;
    killLaunch();                                /* pinned mid-flight: put it down */
  } else {
    who.shock = SHOCK_TIME;
    who.boosting = false;
    killLaunchRival(who);                        /* pinned mid-flight: put it down */
  }
  const p = who === "me" ? { x:G.x, y:playerY } : { x:who.x, y:who.y };
  for(let i=0;i<20;i++){
    const a = rand(0, 6.2832), sp = rand(60, 240);
    addFx(p.x, p.y, Math.cos(a)*sp, Math.sin(a)*sp, rand(.3,.7), rand(2,5),
          i % 2 ? "#FFE44D" : "#FFFFFF");
  }
  G.shake = Math.max(G.shake, 10);
  noise(.3, .3); tone(150, .3, "square", .1);
}
function updateBolts(dt){
  const k = worldRate();                         /* chronokinesis drags these too */
  for(let i=G.bolts.length-1;i>=0;i--){
    const b = G.bolts[i];
    b.life -= dt;
    const owner = b.owner;
    const ownerGone = owner === "me"
      ? (G.dead > 0 || !G.ultOn)
      : (owner.dead > 0 || !owner.ultOn);
    if(b.home && ownerGone){ G.bolts.splice(i,1); continue; }
    const m = b.mark === "me"
      ? { x:G.x, y:playerY, gone:G.dead > 0 || finishedMe() }
      : { x:b.mark.x, y:b.mark.y, gone:b.mark.dead > 0 || finishedCar(b.mark) };
    /* The cull used to be "off the top of the screen", which is only ever
       right for an orb the player fired. Rivals live in world space and run to
       thirty thousand pixels either side of the camera, so a bot up the road
       fired orbs that were already past that line on the frame they spawned
       and were binned before they had moved - which is why a Bolt bot never
       pinned anybody. An orb chases a live mark and has its own clock; that
       clock is the cull, and the bound below is only a backstop against a
       runaway. */
    if(b.life <= 0 || b.y < -90000 || b.y > 90000){ G.bolts.splice(i,1); continue; }
    if(m.gone){                                  /* the mark left the road */
      if(b.home){ G.bolts.splice(i,1); continue; }
      orbSeekOn(b, b.y);
      continue;
    }
    if(b.arc > 0){                               /* still climbing away */
      b.arc -= dt;
      b.x += b.vx*dt*k; b.y += b.vy*dt*k;
      addFx(b.x, b.y, rand(-30,30), rand(-30,30), .25, rand(1.5,3), "#FFE44D");
      continue;
    }
    const dx = m.x - b.x, dy = m.y - b.y;
    const d = Math.max(1, Math.sqrt(dx*dx + dy*dy));
    const turn = b.home ? 1 : (1 - Math.pow(0.0004, dt));   /* it knows the way back */
    b.vx = lerp(b.vx, dx/d*ORB_SPEED, turn);
    b.vy = lerp(b.vy, dy/d*ORB_SPEED, turn);
    const sp2 = Math.sqrt(b.vx*b.vx + b.vy*b.vy) || 1;
    b.vx = b.vx/sp2*ORB_SPEED; b.vy = b.vy/sp2*ORB_SPEED;   /* never slows down */
    b.x += b.vx*dt*k; b.y += b.vy*dt*k;
    addFx(b.x, b.y, rand(-30,30), rand(-30,30), .25, rand(1.5,3), "#FFE44D");
    const hitBox = { x:m.x, y:m.y, hw:carW*0.40, hh:carH*0.42 };
    const cp = nearestOnCar(hitBox, b.x, b.y);
    const hx = cp.x - b.x, hy = cp.y - b.y;
    if(hx*hx + hy*hy > ORB_R*ORB_R) continue;                /* not there yet */

    if(b.home){ orbAbsorb(b); G.bolts.splice(i,1); continue; }
    if(burning(b.mark)){                         /* Redd: it goes off on contact */
      for(let q=0;q<18;q++){
        const a = rand(0, 6.2832), sp = rand(60, 260);
        addFx(b.x, b.y, Math.cos(a)*sp, Math.sin(a)*sp, rand(.3,.7), rand(2,5),
              q % 2 ? "#FF7A3A" : "#FFD9A0");
      }
      G.shake = Math.max(G.shake, 8);
      noise(.25, .3);
      G.bolts.splice(i,1); continue;
    }
    if(!orbCatches(b.mark)){                     /* pinned, phasing or untouchable */
      orbSeekOn(b, m.y);
      continue;
    }
    shockCar(b.mark);
    G.bolts.splice(i,1);
  }
}
/* Orbs going out on their own clock, so the five seconds are always used.
   The player may still tap to send one early. */
function stormTick(who, dt){
  const o = who === "me" ? G : who;
  if(o.orbs <= 0) return;
  o.orbFireT -= dt;
  if(o.orbFireT > 0) return;
  o.orbFireT = ORB_GAP;
  if(fireOrb(who)) o.orbs--;
}

function puffFx(x, y){
  for(let i=0;i<12;i++){
    const a = rand(0, 6.2832), sp = rand(50, 190);
    addFx(x, y, Math.cos(a)*sp, Math.sin(a)*sp, rand(.3,.6), rand(2,5), "#B9BEC6");
  }
}

function wreckRival(R, by, force){
  if(!R || R.dead > 0) return;
  if(force ? immuneCar(R) : safeCar(R)) return;
  botBlame(R, by);
  ultDelta(R, ULT_ON_WRECK);
  if(by !== undefined) ultDelta(by, ULT_ON_KILL);
  R.dead = DEAD_TIME;
  killLaunchRival(R);                          /* and anything it had in the air */
  if(CARS[R.car].power === "bloom" && G.bloomOwner === R) clearBloom();
  if(R.ultOn) endUlt(R);                       /* a running ultimate is lost outright */
  /* The meter itself survives, exactly as the player's does: destroyCar takes
     ULT_ON_WRECK off the top and no more. Wiping it here contradicted the
     ultDelta two lines above and quietly taxed the violent difficulties
     hardest - a brutal field wrecks four times as often, so it was losing
     four times as many charged ultimates to a rule the player never met. */
  R.boosting = false; R.orbs = 0;
  scrubBad(R);
  for(let i=0;i<30;i++){
    const a = rand(0, 6.2832), sp = rand(70, 340);
    addFx(R.x, R.y, Math.cos(a)*sp, Math.sin(a)*sp, rand(.45,1.0), rand(2,7),
          i%3 === 0 ? "#FFD9A0" : (i%3 === 1 ? "#FF7A3A" : CARS[R.car].accent));
  }
  for(let i=0;i<10;i++)
    addFx(R.x, R.y, rand(-110,110), rand(-190,-40), rand(.6,1.2), rand(3,7), "#2A2C33");
  G.shake = Math.max(G.shake, 12);
  noise(.55, .45); tone(95, .4, "sawtooth", .14);
}
function destroyRival(){ wreckRival(G.rivals[0]); }

/* Nought at the notch, AIR_STOP_POW at a dead stop, one fully wound. Two
   phases, one number: everything downstream - air time, air speed, height,
   the size of the bang - reads this and nothing else. */
function airPower(){
  const drained = clamp((AIR_ARM - G.airMeter)/AIR_ARM, 0, 1);
  return clamp(drained*AIR_STOP_POW + G.airWind*(1 - AIR_STOP_POW), 0, 1);
}

function airborne(){ return G.airT > 0; }
/* Airborne cars are not on the road: nothing meets them and they meet nothing.
   This is the same door ghosting uses, which is why one test covers barging,
   rear-ending, bot lane reads and Siren's shove all at once. */
function overhead(who){ return who === "me" ? airborne() : (!!who && who.airT > 0); }

/* Anything that takes the controls away also takes the brake away. */
function canBrake(){
  return ruleOn("boost") &&
         G.state === "running" && G.dead <= 0 && G.finished === null &&
         G.shockT <= 0 && G.orderedT <= 0 &&
         G.launchCD <= 0 && !airborne();
}
/* Under the notch: far enough to go up. */
function airArmed(){ return G.brakeOn && G.airMeter <= AIR_ARM; }

/* brakeKey and brakePtr are the input being physically down; brakeOn is the
   brake actually biting. Keeping them apart is what makes a cancelled hold
   behave: a pin drops the brake, but the key is still down, and it must not
   quietly come back - key autorepeat would otherwise re-latch a fresh full
   meter every frame without the player ever lifting a finger. brakeSpent is
   that latch, and it only clears when everything is released. */
function brakeHeld(){ return G.brakeKey || G.brakePtr || G.padBrake; }
function brakeEngage(){
  if(G.brakeOn || G.brakeSpent || !brakeHeld() || !canBrake()) return;
  G.brakeOn = true; setBoost();
}
/* Let go without getting under the notch and the meter simply comes back -
   no launch, no cooldown, nothing spent. */
function brakeOff(){
  G.brakeOn = false;
  G.airWind = 0;                            /* a wind-up not spent is a wind-up lost */
  if(brakeHeld()) G.brakeSpent = true;      /* still down: dead until released */
  if(G.launchCD <= 0) G.airMeter = 1;
}

function launchCar(){
  const p = airPower();
  G.airPow = p;
  G.airMax = G.airT = lerp(AIR_MIN_T, AIR_MAX_T, p);
  G.launchCD = AIR_CD;
  G.brakeOn = false;
  G.airWind = 0;
  if(brakeHeld()) G.brakeSpent = true;
  G.airMeter = 0;                          /* refills across the cooldown */
  G.boosting = false; G.ptrBoost = false;
  logEffect("launched", G.airMax);
  /* thrust out of the back as it leaves the road, and the harder it was wound
     the wider and hotter it comes out - a full charge should look like it
     cost something */
  const n = Math.round(lerp(18, 60, p));
  for(let i=0;i<n;i++){
    const a = rand(1.1, 2.05), sp = rand(90, 300)*(0.6 + p*1.5);
    addFx(G.x + rand(-carW*0.4, carW*0.4), playerY + carH*0.42,
          Math.cos(a)*sp, Math.sin(a)*sp, rand(.3,.9), rand(2,6),
          i % 3 === 0 ? "#7CF7A6" : (i % 3 === 1 ? "#2FBF63" : "#FFFFFF"));
  }
  if(p > 0.5){                             /* a ring of it, for the big ones */
    const ring = Math.round(lerp(0, 22, (p - 0.5)*2));
    for(let i=0;i<ring;i++){
      const a = (i/Math.max(1, ring))*6.2832;
      addFx(G.x, playerY + carH*0.3, Math.cos(a)*260*p, Math.sin(a)*160*p,
            rand(.35,.7), rand(3,6), i % 2 ? "#FFFFFF" : "#7CF7A6");
    }
  }
  G.shake = Math.max(G.shake, 6 + p*14);
  tone(190, .18, "square", .08);
  later(function(){ tone(400 + p*520, .26, "sine", .10); }, 90);
  noise(.2 + p*0.2, .22);
}

/* Coming down. Whatever is under you in this lane is written off; a trap or a
   hazard is not, so the frame after touchdown puts you back in the world and
   the usual collision runs on whatever you landed in. */
function landCar(){
  const p = G.airPow;                      /* how hard it came down, before we clear it */
  G.airT = 0; G.airPow = 0; G.airMax = 0;
  dropEffect("launched");
  const under = carAt(G.lane, playerY, "me");
  if(under && !under.me && !safeCar(under.obj)){
    wreckRival(under.obj, "me");
    G.shake = Math.max(G.shake, 14 + p*14);
  } else {
    /* Even an empty landing should land. A full-charge touchdown comes down
       from nearly three car heights, so it throws a ring of dust out to the
       kerb and hits the screen accordingly; a little hop barely puffs. */
    puffFx(G.x, playerY + carH*0.42);
    const ring = Math.round(lerp(0, 20, p));
    for(let i=0;i<ring;i++){
      const a = rand(0, 6.2832), sp = rand(120, 300)*p;
      addFx(G.x, playerY + carH*0.3, Math.cos(a)*sp, Math.sin(a)*sp*0.45 - rand(0, 60),
            rand(.3, .6), rand(2, 5), i % 2 ? "#D9DEE6" : "#B9BEC6");
    }
    G.shake = Math.max(G.shake, 6 + p*13);
    noise(.16 + p*0.2, .22 + p*0.2);
    tone(130 - p*40, .12 + p*0.1, "sine", .06 + p*0.06);
  }
}

/* Wrecked, pinned or ordered mid-flight: put the car down where it is and let
   the state that interrupted it take over. */
function killLaunch(){
  if(airborne()) dropEffect("launched");
  G.airT = 0; G.airMax = 0; G.airPow = 0;
  brakeOff();
}

function updateLaunch(dt, st){
  if(G.launchCD > 0){
    G.launchCD = Math.max(0, G.launchCD - dt);
    /* the meter refilling IS the cooldown, so one bar answers both questions */
    G.airMeter = airborne() ? 0 : clamp(1 - G.launchCD/AIR_CD, 0, 1);
    G.airWind = 0;
  }
  if(airborne()){
    G.airT = Math.max(0, G.airT - dt);
    if(G.airT <= 0) landCar();
    return;
  }
  if(!brakeHeld()) G.brakeSpent = false;     /* everything is off: a new hold may start */
  if(G.brakeOn && !canBrake()){ brakeOff(); return; }
  brakeEngage();                             /* held through whatever stopped it, and now clear */
  if(G.brakeOn){
    G.airMeter = clamp(G.airMeter - dt/AIR_BRAKE, 0, 1);
    if(G.airMeter < 1e-9) G.airMeter = 0;    /* land exactly on empty, not on float dust */
    /* Stopped, and still holding: there is no more speed to give up, so the
       clock itself becomes the charge. */
    if(G.airMeter === 0) G.airWind = clamp(G.airWind + dt/AIR_WIND, 0, 1);
    /* Smoke off the back while it is scrubbing speed, green once you are under
       the notch, and a hard white spray while it winds - so the state of the
       charge is visible on the car as well as on the bar. */
    const wind = G.airWind;
    if(wind > 0){
      G.shake = Math.max(G.shake, 1.5 + wind*5);
      if(Math.random() < dt*(30 + wind*90)){
        const a = rand(0, 6.2832), sp = rand(50, 120 + wind*220);
        addFx(G.x + rand(-carW*0.4, carW*0.4), playerY + carH*rand(0.1, 0.42),
              Math.cos(a)*sp, Math.sin(a)*sp*0.6 + rand(10, 90),
              rand(.2, .5), rand(2, 5 + wind*3),
              Math.random() < 0.4 + wind*0.4 ? "#FFFFFF" : "#7CF7A6");
      }
    } else if(G.speed > 30 && Math.random() < dt*26){
      const armed = G.airMeter <= AIR_ARM;
      addFx(G.x + rand(-carW*0.36, carW*0.36), playerY + carH*0.40,
            rand(-40, 40), rand(30, 130), rand(.25, .5), rand(2, 5),
            armed ? (Math.random() < 0.5 ? "#7CF7A6" : "#2FBF63") : "#B9BEC6");
    }
  } else if(st === "running" && G.launchCD <= 0 && G.airMeter < 1){
    G.airMeter = 1; G.airWind = 0;
  }
}

/* Called by both the key and the finger coming off. */
function releaseBrake(){
  if(!G.brakeOn) return;
  if(airArmed()) launchCar();
  else brakeOff();
}

/* ---- the same launch, with a bot's finger on it ---------------------
   Not a bot version of the mechanic - the mechanic. Same two phases, same
   constants, same meter, same arming notch, same cooldown, same landing rule.
   All the AI supplies is the hold and the release: when to put the brake on,
   how much of the wind-up it is willing to stand still for, and when to let
   go. A bot that gets pinned, ordered or wrecked halfway through loses the
   charge exactly the way you do. */
function rivalAirPower(R){
  const drained = clamp((AIR_ARM - R.airMeter)/AIR_ARM, 0, 1);
  return clamp(drained*AIR_STOP_POW + R.airWind*(1 - AIR_STOP_POW), 0, 1);
}
function rivalAirborne(R){ return !!R && R.airT > 0; }
function canBrakeRival(R){
  return ruleOn("boost") &&
         G.state === "running" && R.dead <= 0 && R.finished === null &&
         R.shock <= 0 && R.ordered <= 0 && R.launchCD <= 0 && R.airT <= 0;
}
function rivalBrakeOff(R){
  R.brakeOn = false;
  R.airWind = 0;                               /* a wind-up not spent is a wind-up lost */
  R.airWhy = null;
  if(R.brakeHeld) R.brakeSpent = true;         /* still down: dead until released */
  if(R.launchCD <= 0) R.airMeter = 1;
}
function launchRival(R){
  const p = rivalAirPower(R);
  R.airPow = p;
  R.airMax = R.airT = lerp(AIR_MIN_T, AIR_MAX_T, p);
  R.launchCD = AIR_CD;
  R.brakeOn = false; R.airWind = 0; R.airMeter = 0;
  R.boosting = false; R.airWhy = null;
  if(R.brakeHeld) R.brakeSpent = true;         /* one hold, one launch */
  const n = Math.round(lerp(12, 44, p));
  for(let i=0;i<n;i++){
    const a = rand(1.1, 2.05), sp = rand(90, 300)*(0.6 + p*1.5);
    addFx(R.x + rand(-carW*0.4, carW*0.4), R.y + carH*0.42,
          Math.cos(a)*sp, Math.sin(a)*sp, rand(.3,.9), rand(2,6),
          i % 3 === 0 ? "#7CF7A6" : (i % 3 === 1 ? "#2FBF63" : "#FFFFFF"));
  }
  if(onScreen(R.y)){ G.shake = Math.max(G.shake, 3 + p*7); tone(190, .12, "square", .05); }
}
/* Coming down. Whatever is under it in this lane is written off - the same
   rule your own landing runs, which is why the air has to be cleared first:
   airborne cars meet nobody, so the test would find nobody. */
function landRival(R){
  const p = R.airPow;
  R.airT = 0; R.airPow = 0; R.airMax = 0;
  const under = carAt(R.lane, R.y, R);
  /* The player's entry in racers() carries obj:null, and safeCar(null) reports
     safe - so asking safeCar(under.obj) about a player under the wheels always
     came back "leave them alone" and a bot could never land on you. Each side
     gets asked its own question. */
  const lands = !!under && (under.me ? !playerUntouchable() : !safeCar(under.obj));
  if(lands){
    if(under.me) destroyCar(R); else wreckRival(under.obj, R);
    if(onScreen(R.y)) G.shake = Math.max(G.shake, 10 + p*10);
  } else {
    puffFx(R.x, R.y + carH*0.42);
    if(onScreen(R.y)){
      G.shake = Math.max(G.shake, 3 + p*8);
      noise(.12 + p*0.14, .16 + p*0.14);
    }
  }
}
/* Pinned, ordered or written off mid-flight: put it down where it is and let
   whatever interrupted it take over. */
function killLaunchRival(R){
  if(!R) return;
  R.airT = 0; R.airMax = 0; R.airPow = 0;
  rivalBrakeOff(R);
}
/* Only worth shaking the screen and making a noise for something the player
   can actually see happen. */
function onScreen(y){ return y > VW_TOP - carH*2 && y < VW_BOT + carH*2; }

/* One frame of the mechanic for one bot, run before it thinks, so the think
   sees the road it is actually on. */
function updateRivalLaunch(R, dt, s){
  if(R.launchCD > 0){
    R.launchCD = Math.max(0, R.launchCD - dt);
    R.airMeter = R.airT > 0 ? 0 : clamp(1 - R.launchCD/AIR_CD, 0, 1);
    R.airWind = 0;
  }
  if(R.airT > 0){
    R.airT = Math.max(0, R.airT - dt);
    if(R.airT <= 0) landRival(R);
    return;
  }
  if(R.human){
    /* Exactly what brakeEngage does for player one: a hold that could not
       start yet keeps trying until it can, and a hold already spent stays
       dead until the stick comes back up. */
    if(!R.brakeHeld) R.brakeSpent = false;
    if(!R.brakeOn && R.brakeHeld && !R.brakeSpent && canBrakeRival(R)){
      R.brakeOn = true; R.boosting = false;
    }
  }
  if(R.brakeOn && !canBrakeRival(R)){ rivalBrakeOff(R); return; }
  if(R.brakeOn){
    R.airMeter = clamp(R.airMeter - dt/AIR_BRAKE, 0, 1);
    if(R.airMeter < 1e-9) R.airMeter = 0;
    if(R.airMeter === 0) R.airWind = clamp(R.airWind + dt/AIR_WIND, 0, 1);
    /* A person decides when to let go, exactly as player one does - the
       stick coming back up is the release and nothing here second-guesses it.
       The smoke below is the mechanic, not the mind, so it still runs. */
    if(R.human){
      if(Math.random() < dt*(12 + R.airWind*40)){
        const a2 = rand(0, 6.2832), sp2 = rand(50, 120 + R.airWind*200);
        addFx(R.x + rand(-carW*0.4, carW*0.4), R.y + carH*rand(0.1, 0.42),
              Math.cos(a2)*sp2, Math.sin(a2)*sp2*0.6 + rand(10, 90),
              rand(.2, .5), rand(2, 5),
              R.airWind > 0 && Math.random() < 0.5 ? "#FFFFFF"
                : (R.airMeter <= AIR_ARM ? "#7CF7A6" : "#B9BEC6"));
      }
      return;
    }
    R.airHold -= dt;
    const armed = R.airMeter <= AIR_ARM;
    const p = rivalAirPower(R);
    /* Let go when the charge is what it came for - or when it has run out of
       patience, or when the reason it started has gone away. A driver that
       has changed its mind while stopped still has to spend the charge: the
       meter does not come back for free. */
    const stale = s && R.airWhy === "land" && (!s.front || s.front.safe);
    if(armed && (p >= R.airAim - 0.01 || R.airHold <= 0 || stale)) launchRival(R);
    else if(!armed && R.airHold <= -1.2) rivalBrakeOff(R);
    /* a little smoke off the back, so a bot winding up reads the same way you do */
    if(R.airWind > 0 && Math.random() < dt*(12 + R.airWind*40)){
      const a = rand(0, 6.2832), sp = rand(50, 120 + R.airWind*200);
      addFx(R.x + rand(-carW*0.4, carW*0.4), R.y + carH*rand(0.1, 0.42),
            Math.cos(a)*sp, Math.sin(a)*sp*0.6 + rand(10, 90),
            rand(.2, .5), rand(2, 5), Math.random() < 0.5 ? "#FFFFFF" : "#7CF7A6");
    } else if(R.airWind <= 0 && Math.random() < dt*14){
      addFx(R.x + rand(-carW*0.36, carW*0.36), R.y + carH*0.40,
            rand(-40, 40), rand(30, 130), rand(.25, .5), rand(2, 5),
            R.airMeter <= AIR_ARM ? "#2FBF63" : "#B9BEC6");
    }
    return;
  }
  /* not braking: is there a reason to start? A person is the reason, and they
     say so with the stick - nothing decides it for them. */
  if(R.human) return;
  if(!s || R.launchCD > 0 || !canBrakeRival(R)) return;
  const want = botAirWant(R, s);
  if(!want) return;
  R.brakeOn = true;
  R.airWhy = want.why;
  R.airAim = clamp(want.aim, 0, 1);
  /* how long it is prepared to sit there before spending whatever it has */
  R.airHold = AIR_BRAKE + AIR_WIND*clamp(want.aim, 0, 1) + 0.4;
}

function spawnWave(){
  const free = [];
  for(let l=0;l<3;l++){
    let ok = true;
    for(let i=0;i<G.traffic.length;i++){
      const t = G.traffic[i];
      if(t.lane === l && t.y < carH*2.6){ ok = false; break; }
    }
    if(ok) free.push(l);
  }
  if(free.length < 2) return;                       /* never seal the road */
  const ramp = clamp(G.tier/MAX_TIER, 0, 1);
  let count = (free.length === 3 && Math.random() < 0.35 + ramp*0.35) ? 2 : 1;
  count = Math.min(count, free.length - 1);
  for(let n=0;n<count;n++){
    const l = free.splice(randi(0, free.length-1), 1)[0];
    const p = TRAFFIC_PAINT[randi(0, TRAFFIC_PAINT.length-1)];
    const w = carW*rand(0.94, 1.06);
    G.traffic.push({
      lane:l, x:laneCX(l), y:-carH*rand(1.2, 2.2),
      w:w, h:w*rand(1.8, 2.35),
      spd:rand(155, 285), paint:p, passed:false
    });
  }
}

/* Traffic drifts at different speeds, so cars spawned apart can still line
   up into an unpassable row. This finds those rows and opens them. */
function breakWalls(){
  const n = G.traffic.length;
  if(n < 3) return;
  const margin = carH*0.55;
  for(let i=0;i<n;i++){
    const a = G.traffic[i];
    if(a.y > playerY - carH*0.6) continue;
    const row = {}; row[a.lane] = a;
    for(let j=0;j<n;j++){
      if(j === i) continue;
      const b = G.traffic[j];
      if(Math.abs(b.y - a.y) < (a.h + b.h)/2 + margin) row[b.lane] = b;
    }
    const keys = Object.keys(row);
    if(keys.length < 3) continue;
    let off = null;
    for(let k=0;k<keys.length;k++){
      const c = row[keys[k]];
      if(c.y < -c.h*0.6 && (!off || c.y < off.y)) off = c;
    }
    if(off){ G.traffic.splice(G.traffic.indexOf(off), 1); return; }
    const mid = row[1] || row[keys[0]];
    mid.spd = Math.min(G.speed*0.94, mid.spd + 320);
    return;
  }
}

/* ================================================================
   TRAPS  -  one hazard per track, placed at random
   ================================================================ */
function speedMult(){
  return Math.min(1 + Math.min(G.tier, MAX_TIER)*MULT_STEP, MAX_MULT);
}

/* keep a hazard fully on the asphalt so it is always possible to avoid */
function onRoad(x, half){
  return clamp(x, roadX + 8 + half, roadX + roadW - 8 - half);
}

/* Rarer items are rarer. The seeker is pointless in the lead, so it is not
   offered to whoever is already first. */
function rollItem(leader){
  const pool = ITEM_IDS.filter(function(id){ return !(id === "seeker" && leader); });
  let total = 0;
  pool.forEach(function(id){ total += RARITY[ITEMS[id].rarity].weight; });
  let r = Math.random()*total;
  for(let i=0;i<pool.length;i++){
    r -= RARITY[ITEMS[pool[i]].rarity].weight;
    if(r <= 0) return pool[i];
  }
  return pool[0];
}
function leaderOf(who){
  const mine = who === "me" ? G.meters : metersOf(who);
  const all = [G.meters].concat(G.rivals.map(metersOf));
  return mine >= Math.max.apply(null, all) - 0.01;
}

/* Rivals live in screen space and are only pinned at 30000px, which is well over
   two kilometres either way. A row planted at the top of your screen is about
   fifty metres up the road and swept away twenty-four metres behind you, so the
   whole bubble world was an eighty metre band strapped to your car: anyone
   further ahead than that was already past the row before it existed and never
   met a bubble in their life, and anyone dropped behind lost every row before it
   reached them. The road has to be the same road for all six, so a row is now
   planted the same distance ahead of whoever leads and kept until whoever trails
   is through it. When you are the one in front both come out exactly where they
   always did. */
function fieldTopY(){
  let y = playerY;
  for(let i=0;i<G.rivals.length;i++){
    const R = G.rivals[i];
    if(R.finished === null && R.y < y) y = R.y;
  }
  return y;
}
function fieldBottomY(){
  let y = playerY;
  for(let i=0;i<G.rivals.length;i++){
    const R = G.rivals[i];
    if(R.finished === null && R.y > y) y = R.y;
  }
  return y;
}
function bubbleCullY(){ return fieldBottomY() + (H + 120 - playerY); }

function spawnBubbleRow(){
  G.boxes.push({ y:fieldTopY() - playerY - 90, gone:0, s:Math.random(),
                 life:BUBBLE_LIFE, blink:0, ph:0, doomed:false });
}

function updateBubbles(dt, d, st){
  if(st === "running" && G.finished === null && ruleOn("bubbles")){
    G.boxGap += d;
    if(G.boxGap >= G.nextRow){
      G.boxGap = 0; spawnBubbleRow();
      G.nextRow = rand(BUBBLE_GAP[0], BUBBLE_GAP[1]);
    }
  }
  const c = carHit();
  const br2 = bubbleR()*bubbleR();
  const cull = bubbleCullY();
  for(let i=G.boxes.length-1;i>=0;i--){
    const row = G.boxes[i];
    row.y += d;
    if(row.y > cull){ G.boxes.splice(i,1); continue; }
    if(row.gone === 7){ G.boxes.splice(i,1); continue; }   /* all three collected */

    /* Run the clock down, then flash, then drop it. Only while the race is
       actually live, so a row does not quietly expire behind a pause screen
       or during the run-out after the flag. A flashing bubble still counts:
       it is on the road until it is gone, so taking one is never a gamble on
       which half of the blink you arrived in. */
    if(st === "running" && G.finished === null){
      if(row.doomed){
        /* the clock ran out: flash it down and take it away */
        row.blink -= dt;
        row.ph += dt*(10 + 22*(1 - clamp(row.blink/BUBBLE_BLINK, 0, 1)));
        if(row.blink <= 0){ G.boxes.splice(i,1); continue; }
      } else {
        /* The clock is a stall-breaker now, nothing more: it only runs when the
           road has all but stopped - pinned, ordered, wrecked - so a row cannot
           hang about forever with nothing moving. While the race is actually
           running a row lives until the back of the field is through it, however
           far the field is strung out. Ageing it in transit was flashing rows
           away mid-road: a leader half a kilometre up and a tail-ender half a
           kilometre back is thirty-eight seconds of travel, and thirty seconds
           of clock took the row off the road before the back half ever saw it. */
        const roadSpeed = dt > 0 ? d/dt : 0;
        if(roadSpeed < BASE_SPEED*0.15) row.life -= dt;
        if(row.life <= 0){ row.doomed = true; row.blink = BUBBLE_BLINK; }
        else {
          /* Otherwise flash only as a warning that the road is about to take
             it. Worked out fresh each frame from where it is and how fast the
             road is running, so easing off the throttle puts the bubble back
             to solid instead of losing it - a warning must never be the thing
             that removes something you could still have reached. */
          const leaveIn = roadSpeed > 1 ? (cull - row.y)/roadSpeed : 1e9;
          row.blink = leaveIn <= BUBBLE_BLINK ? leaveIn : 0;
          if(row.blink > 0)
            row.ph += dt*(10 + 22*(1 - clamp(row.blink/BUBBLE_BLINK, 0, 1)));
        }
      }
    }
    /* A row is three bubbles, not one pick. Sweep all three and you take all
       three: each rolls on its own and the newest is the one in your hand, so a
       second bubble trades the first away rather than bouncing off. The only
       lock left is the bit in `gone`, which is per bubble - that is all this
       ever needed, and it is what stopped two cars sharing a single bubble on
       the same frame. */
    for(let l=0;l<3;l++){
      if(row.gone & (1 << l)) continue;                     /* this one is already gone */
      const bx = laneCX(l), by = row.y + Math.sin(G.scroll*0.01 + l*2 + row.s*6)*6;
      /* you */
      if(st === "running" && G.dead <= 0 && G.finished === null){
        const p = nearestOnCar(c, bx, by);
        const dx = p.x - bx, dy = p.y - by;
        if(dx*dx + dy*dy <= br2){
          row.gone |= (1 << l);
          takeBubble("me", bx, by);
          continue;                                         /* the rest of the row is still live */
        }
      }
      /* and everyone else */
      for(let n=0;n<G.rivals.length;n++){
        const R = G.rivals[n];
        if(R.dead > 0 || R.finished !== null) continue;
        const rc = { x:R.x, y:R.y, hw:carW*0.40, hh:carH*0.42 };
        const p2 = nearestOnCar(rc, bx, by);
        const ex = p2.x - bx, ey = p2.y - by;
        if(ex*ex + ey*ey <= br2){
          row.gone |= (1 << l);
          takeBubble(R, bx, by);
          break;                                            /* one bubble, one taker */
        }
      }
    }
  }
}
/* One pickup, whoever made it. Rolling straight into `item` is the whole of the
   override: what you were holding is simply gone.

   The bot fuse needs a word. A bot arms a timer when it picks something up and
   fires when the timer runs out, and re-rolling that timer on every bubble
   meant a bot crossing a whole row kept pushing its own shot further away and
   came out the far side having fired none of three items. It now keeps whichever
   fuse is shorter, so more bubbles can only ever make a bot quicker to shoot. */
function takeBubble(who, bx, by){
  const me = who === "me";
  const holder = me ? G : who;
  const had = !!holder.item;
  holder.item = rollItem(leaderOf(who));
  if(had) holder.swapT = ITEM_SWAP;
  if(!me){
    const roll = rand(0.6, 2.4);
    holder.useT = had && holder.useT > 0 ? Math.min(holder.useT, roll) : roll;
    holder.itemHold = 0;                 /* a fresh item is a fresh decision */
  }
  popFx(bx, by, RARITY[ITEMS[holder.item].rarity].col);
}
function popFx(x, y, col){
  for(let i=0;i<14;i++){
    const a = rand(0, 6.2832), sp = rand(60, 210);
    addFx(x, y, Math.cos(a)*sp, Math.sin(a)*sp, rand(.3,.6), rand(2,4), i % 2 ? col : "#FFFFFF");
  }
  tone(880, .07, "sine", .06);
  later(function(){ tone(1320, .09, "sine", .06); }, 60);
}

/* ---------------- using an item ---------------- */
function useItem(who){
  const me = who === "me";
  const holder = me ? G : who;
  const id = holder.item;
  if(!id) return false;
  if(me && (G.state !== "running" || G.dead > 0 || G.shockT > 0 ||
            G.orderedT > 0 || G.finished !== null)) return false;
  if(!me && (who.dead > 0 || who.shock > 0 || who.ordered > 0 || who.finished !== null)) return false;
  holder.item = null;
  const x = me ? G.x : who.x, y = me ? playerY : who.y;

  if(id === "can"){
    holder.canT = CAN_TIME;
    for(let i=0;i<18;i++)
      addFx(x + rand(-carW*0.3, carW*0.3), y + carH*0.4, rand(-70,70), rand(90,260),
            rand(.3,.6), rand(2,5), i % 2 ? "#FF9A4A" : "#FFE8C0");
    tone(320, .18, "square", .09);
    later(function(){ tone(560, .22, "square", .08); }, 110);
  } else if(id === "oil"){
    const k = SLICK_KINDS[(Math.random()*SLICK_KINDS.length)|0];
    const rx = rand(k.rx[0], k.rx[1]), ry = rand(k.ry[0], k.ry[1]);
    const o = {
      x:x, y:y + carH*0.42 + ry,
      rx:rx, ry:ry, r:Math.max(rx, ry),
      rot:rand(-k.rot, k.rot), jit:k.jit, sheen:k.sheen,
      spots:Math.floor(rand(k.spots[0], k.spots[1] + 0.999)),
      s:Math.random(), life:OIL_LIFE, fade:0, owner:me ? "me" : who
    };
    /* Back it off until the collision test itself says the car that dropped it
       is clear. Rotation, the ragged edge and the shape all push the real reach
       past ry, so ask the predicate rather than guess a margin - this stays
       right even if the families are retuned later. */
    const own = { x:x, y:y, hw:carW*0.40, hh:carH*0.42 };
    for(let g=0; g<16 && slickHits(o, own); g++) o.y += 5;
    G.slicks.push(o);
    tone(150, .25, "sawtooth", .07);
  } else if(id === "seeker"){
    fireSeeker(me ? "me" : who);
  }
  return true;
}

/* the seeker: one target, the leader, and nothing survives the trip */
function seekerTarget(owner){
  const all = [{ me:true, obj:null, m:G.meters, out:G.dead > 0 || finishedMe() }].concat(
    G.rivals.map(function(R){ return { me:false, obj:R, m:metersOf(R),
                                       out:R.dead > 0 || finishedCar(R) }; }));
  /* A winner is off the target list of every offensive system, this one
     included - it has finished, and nothing may touch its result. */
  const others = all.filter(function(a){
    return (owner === "me" ? !a.me : a.obj !== owner) && !a.out;
  });
  if(!others.length) return null;
  others.sort(function(a, b){ return b.m - a.m; });
  return others[0];
}
/* every seeker measurement in one place, so the drawing and the collision
   never drift apart */
function missileDims(){
  const len = carH*MISSILE_LEN;
  return {
    len:  len,
    nose: len*0.58,                 /* how far the tip sits ahead of centre */
    tail: len*0.42,                 /* how far the thruster sits behind it */
    hw:   carW*MISSILE_BODY,        /* body half width */
    fin:  carW*MISSILE_FIN          /* fins reach this far from centre */
  };
}
/* it is long enough now that testing the centre alone lets the nose sail
   clean through a car, so the whole spine gets sampled */
function missileSpine(m){
  const D = missileDims();
  const len = Math.max(1, Math.sqrt(m.vx*m.vx + m.vy*m.vy));
  const ux = m.vx/len, uy = m.vy/len;
  return [
    { x:m.x + ux*D.nose,      y:m.y + uy*D.nose },
    { x:m.x + ux*D.nose*0.55, y:m.y + uy*D.nose*0.55 },
    { x:m.x,                  y:m.y },
    { x:m.x - ux*D.tail*0.6,  y:m.y - uy*D.tail*0.6 }
  ];
}
function fireSeeker(owner){
  const t = seekerTarget(owner);
  if(!t) return;
  const D = missileDims();
  const x = owner === "me" ? G.x : owner.x, y = owner === "me" ? playerY : owner.y;
  G.missiles.push({
    /* clear of the launching car, tail first, so nothing overlaps the bonnet */
    x:x, y:y - carH*0.5 - D.tail, vx:0, vy:-MISSILE_SPEED*0.3,
    owner:owner, mark:t.me ? "me" : t.obj, life:14, fade:0
  });
  noise(.4, .4); tone(210, .5, "sawtooth", .12);
}
function markPos(mark){
  return mark === "me" ? { x:G.x, y:playerY, gone:G.dead > 0 }
                       : { x:mark.x, y:mark.y, gone:mark.dead > 0 };
}
function markImmune(mark){ return mark === "me" ? immuneMe() : immuneCar(mark); }

function updateMissiles(dt, d){
  for(let i=G.missiles.length-1;i>=0;i--){
    const m = G.missiles[i];
    m.life -= dt;
    if(m.fade > 0){                                   /* slipped past a ghost */
      m.fade -= dt;
      m.x += m.vx*dt; m.y += m.vy*dt + d;
      addFx(m.x, m.y, rand(-40,40), rand(-40,40), .3, 3, "rgba(255,180,120,0.8)");
      if(m.fade <= 0 || m.life <= 0) G.missiles.splice(i,1);
      continue;
    }
    const p = markPos(m.mark);
    if(p.gone || m.life <= 0){ G.missiles.splice(i,1); continue; }

    /* Phasing does not save you from this. Vapour goes through cars, traps and
       orbs; the seeker is the one thing that still finds it. */
    if(markImmune(m.mark)){                           /* wait it out */
      m.x = lerp(m.x, p.x, 1 - Math.pow(0.2, dt));
      m.y = lerp(m.y, p.y + carH*2.2, 1 - Math.pow(0.2, dt));
      addFx(m.x, m.y, rand(-30,30), rand(20,90), .25, 2.5, "#FFB07A");
      continue;
    }
    const dx = p.x - m.x, dy = p.y - m.y;
    const len = Math.max(1, Math.sqrt(dx*dx + dy*dy));
    m.vx = lerp(m.vx, dx/len*MISSILE_SPEED, 1 - Math.pow(0.0005, dt));
    m.vy = lerp(m.vy, dy/len*MISSILE_SPEED, 1 - Math.pow(0.0005, dt));
    const wk = worldRate();                           /* the clock reaches it too */
    m.x += m.vx*dt*wk; m.y += m.vy*dt*wk;
    const D = missileDims(), spine = missileSpine(m);
    const back = spine[3];
    for(let f=0;f<2;f++)
      addFx(back.x + rand(-D.hw*0.6, D.hw*0.6), back.y, rand(-60,60), rand(-30,70),
            .3, rand(D.hw*0.28, D.hw*0.55), f ? "#FFC078" : "#FF8A3A");

    /* it clears everything it passes through, along its whole length */
    const sweep = D.hw*1.3, sw2 = sweep*sweep;
    for(let k=G.traps.length-1;k>=0;k--){
      const o = G.traps[k];
      for(let s=0;s<spine.length;s++){
        const ox = o.x - spine[s].x, oy = o.y - spine[s].y;
        if(ox*ox + oy*oy < sw2){ smashFx(o.x, o.y, 26, "#FFD9A0", G.car); G.traps.splice(k,1); break; }
      }
    }
    for(let k=G.slicks.length-1;k>=0;k--){
      const o = G.slicks[k];
      for(let s=0;s<spine.length;s++){
        const ox = o.x - spine[s].x, oy = o.y - spine[s].y;
        if(ox*ox + oy*oy < sw2){ G.slicks.splice(k,1); break; }
      }
    }
    const all = racers();
    const hw2 = D.hw*D.hw;
    for(let k=0;k<all.length;k++){
      const a = all[k];
      if(a.out) continue;
      if(m.owner === "me" ? a.me : a.obj === m.owner) continue;
      /* Immunity and the flag stop it. Phasing does not - vapour is the one
         thing the seeker still finds - and neither does a running ultimate. */
      if(a.me ? immuneMe() : immuneCar(a.obj)) continue;
      const box = { x:a.me ? G.x : a.obj.x, y:a.y, hw:carW*0.40, hh:carH*0.42 };
      let px = 0, py = 0, touch = false;
      for(let s=0;s<spine.length && !touch;s++){
        const q2 = nearestOnCar(box, spine[s].x, spine[s].y);
        const qx = q2.x - spine[s].x, qy = q2.y - spine[s].y;
        if(qx*qx + qy*qy <= hw2){ touch = true; px = q2.x; py = q2.y; }
      }
      if(!touch) continue;
      const isMark = (m.mark === "me" && a.me) || m.mark === a.obj;
      if(a.me) destroyCar(); else wreckRival(a.obj, m.owner, true);
      seekerBoom(px, py);
      if(isMark || true){ G.missiles.splice(i,1); break; }
    }
  }
}
function seekerBoom(x, y){
  for(let i=0;i<46;i++){
    const a = rand(0, 6.2832), sp = rand(110, 540);
    addFx(x, y, Math.cos(a)*sp, Math.sin(a)*sp, rand(.45,1.05), rand(4,10),
          i%3 === 0 ? "#FFE3B0" : (i%3 === 1 ? "#FF8A2B" : "#C6482A"));
  }
  G.shake = Math.max(G.shake, 26);
  noise(.6, .5); tone(80, .45, "sawtooth", .16);
}

/* The slick catches people for fifteen seconds and then stops being a threat,
   fading out where it lies. A catch removes it on the spot - no fade, so there
   is never a frame where a spent-looking slick is still live. */
function updateSlicks(dt, d, st){
  const c = carHit();
  for(let i=G.slicks.length-1;i>=0;i--){
    const o = G.slicks[i];
    o.y += d;
    if(o.y > VW_BOT + 120){ G.slicks.splice(i,1); continue; }

    if(o.fade > 0){                              /* spent: still visible, harmless */
      o.fade -= dt;
      if(o.fade <= 0) G.slicks.splice(i,1);
      continue;
    }
    o.life -= dt;
    if(o.life <= 0){ o.fade = OIL_FADE; continue; }

    /* vapour goes straight over it - the same rule the traps use, and the one
       the garage promises: Phantom passes through everything */
    if(st === "running" && !noContact("me") && !airborne() && G.finished === null){
      if(slickHits(o, c)){
        if(burning("me")) smashFx(o.x, o.y, o.r*1.1, "#7A5AA0", G.car);
        else { if(!warded("me")) G.slipT = SLIP_TIME; slickSplash(o); noise(.2, .2); }
        clutterUp("me");                        /* contact deepens Rose's clutter */
        G.slicks.splice(i,1); continue;
      }
    }
    for(let n=0;n<G.rivals.length;n++){
      const R = G.rivals[n];
      if(noContact(R)) continue;
      const rc = { x:R.x, y:R.y, hw:carW*0.40, hh:carH*0.42 };
      if(slickHits(o, rc)){
          if(burning(R)) smashFx(o.x, o.y, o.r*1.1, "#7A5AA0", R.car);
        else { if(!warded(R)){ R.slip = SLIP_TIME; botBlame(R, o.owner); } slickSplash(o); }
        clutterUp(R);
        G.slicks.splice(i,1);
        break;
      }
    }
  }
}
/* The outline read back as a number, so the edge you can see is the edge that
   catches you - the same trick the puddles use. */
function slickFactor(o, ang){
  const n = 9;
  const a = ((ang % 6.2832) + 6.2832) % 6.2832;
  const f = a/6.2832*n, i0 = Math.floor(f) % n, i1 = (i0 + 1) % n, tt = f - Math.floor(f);
  const j0 = 1 - o.jit + ((o.s*113.3 + i0*41.17) % 1)*o.jit*2;
  const j1 = 1 - o.jit + ((o.s*113.3 + i1*41.17) % 1)*o.jit*2;
  return lerp(j0, j1, tt)*0.95;
}

/* Turn the car into the slick's frame, then squash that frame until the slick
   is a unit circle - then the nearest-point test is exact against the ragged
   outline rather than against a circle that never matched it. The rotated car
   is taken as its bounding box, which is a shade generous at these angles. */
function slickHits(o, box){
  const ca = Math.cos(-o.rot), sa = Math.sin(-o.rot);
  const dx = box.x - o.x, dy = box.y - o.y;
  const lx = dx*ca - dy*sa, ly = dx*sa + dy*ca;
  const hw = Math.abs(box.hw*ca) + Math.abs(box.hh*sa);
  const hh = Math.abs(box.hw*sa) + Math.abs(box.hh*ca);
  const sx = 1/o.rx, sy = 1/o.ry;
  const cx = lx*sx, cy = ly*sy, bw = hw*sx, bh = hh*sy;
  const nx = clamp(0, cx - bw, cx + bw);
  const ny = clamp(0, cy - bh, cy + bh);
  const d = Math.sqrt(nx*nx + ny*ny);
  if(d === 0) return true;                       /* centre inside the car */
  return d <= slickFactor(o, Math.atan2(ny, nx));
}

/* it leaves with whoever drove into it, so throw the oil up as it goes -
   otherwise a slick vanishing in one frame just reads as a glitch */
function slickSplash(o){
  for(let i=0;i<14;i++){
    const a = rand(0, 6.2832), sp = rand(40, 170);
    addFx(o.x + Math.cos(a)*o.r*0.5, o.y + Math.sin(a)*o.r*0.35,
          Math.cos(a)*sp, Math.sin(a)*sp*0.6 - rand(20, 90),
          rand(.25, .5), rand(2, 4.5),
          i % 3 === 0 ? "#7A5AA0" : "#14141C");
  }
}

function spawnTrap(){
  if(!ruleOn("traps")) return;             /* a race that asked for a clean road */
  if(G.seam !== null) return;              /* leave the handover clear */
  const b = G.biome, lane = randi(0, 2);
  if(b === "city"){
    const rx = rand(laneW*0.30, laneW*0.48), ry = rx*rand(0.52, 0.82);
    G.traps.push({ b:b, kind:"puddle", x:onRoad(laneCX(lane) + rand(-laneW*0.16, laneW*0.16), rx),
                   y:VW_TOP - ry - 50, rx:rx, ry:ry, s:Math.random(), hit:0, nm:0 });
  } else if(b === "space"){
    /* blast stays under three quarters of a lane so a neighbouring lane is always safe */
    /* The ring comes in above the whole field - on one screen that is just
       above the top of it - and is a spot on the road from there on. How long
       the rock has is set here, from how long the road would take to carry
       that spot down to the row it is aimed at at this pace: at a steady pace
       it lands exactly where it always did, and anything the driver does to
       the road speed afterwards moves the landing rather than the drop. */
    const y = VW_TOP - rand(300, 460);  /* warning first, then the long drop */
    const aim = VW_TOP + playerY;       /* the row it is thrown at */
    const pace = Math.max(G.speed, BASE_SPEED*speedMult()*0.75);
    const max = clamp((aim - y)/pace, METEOR_MIN_T, METEOR_MAX_T);
    G.traps.push({ b:b, kind:"meteor", x:onRoad(laneCX(lane) + rand(-laneW*0.06, laneW*0.06), 6),
                   y:y, fall:max, max:max,
                   r:laneW*rand(0.42, 0.60), mr:rand(13, 21)*SCENE,
                   s:Math.random(), phase:0, t:0, nm:0 });
  } else {
    const dir = Math.random() < 0.5 ? 1 : -1, r = rand(15, 25)*SCENE;
    G.traps.push({ b:b, kind:"weed", r:r, s:Math.random(), age:0, rot:rand(0, 6.28),
                   x: dir > 0 ? roadX - 46*SCENE : roadX + roadW + 46*SCENE,
                   y: VW_TOP - 70*SCENE, nm:0,
                   vx: dir*(roadW + 92*SCENE)/rand(2.1, 3.1),
                   fall: rand(0.48, 0.66) });
  }
}

/* --- collision. Tight shapes, tested against the car body only, so the
       wheels and the spoiler overhang never trigger a false hit. --- */
function carHit(){
  return { x:G.x, y:playerY, hw:carW*0.40, hh:carH*0.42 };
}
/* The drawn puddle is a jittered blob, not an ellipse. This reads the same
   jitter back so the edge you can see is the edge that catches you. */
function puddleFactor(p, ang){
  const n = 11;
  const a = ((ang % 6.2832) + 6.2832) % 6.2832;
  const f = a/6.2832*n, i0 = Math.floor(f) % n, i1 = (i0 + 1) % n, tt = f - Math.floor(f);
  const j0 = 0.68 + ((p.s*131.7 + i0*47.31) % 1)*0.56;
  const j1 = 0.68 + ((p.s*131.7 + i1*47.31) % 1)*0.56;
  return lerp(j0, j1, tt)*0.95;
}
/* The nearest point on the car to the puddle centre is NOT the nearest point
   in ellipse space, so testing it there missed glancing hits. Squash both
   shapes so the puddle becomes a unit circle, then the test is exact. */
function puddleHits(o, box, yAt){
  const oy = yAt === undefined ? o.y : yAt;
  const sx = 1/o.rx, sy = 1/o.ry;
  const cx = (box.x - o.x)*sx, cy = (box.y - oy)*sy;   /* car relative to the puddle */
  const hw = box.hw*sx, hh = box.hh*sy;
  const nx = clamp(0, cx - hw, cx + hw);
  const ny = clamp(0, cy - hh, cy + hh);
  const d = Math.sqrt(nx*nx + ny*ny);
  if(d === 0) return true;                       /* centre inside the car */
  return d <= puddleFactor(o, Math.atan2(ny, nx));
}
/* the closest the hazard got to this car during the frame, not just where it ended */
function sweptY(o, moved, cy){
  const prev = o.y - moved;
  return clamp(cy, Math.min(prev, o.y), Math.max(prev, o.y));
}

/* While an ultimate is running the meter is its remaining duration, so
   rewards and penalties wait until it has finished rather than cutting it
   short or extending it. */
function ultDelta(who, amount){
  if(who === "me"){
    if(G.ultOn || G.orbs > 0) return;
    G.ult = clamp(G.ult + amount, 0, 1);
  } else if(who){
    if(who.ultOn) return;
    who.ult = clamp(who.ult + amount, 0, 1);
  }
}
/* did this hazard slip past close enough to count as a dodge? */
/* Credit for getting out of the way at the last moment: either you squeezed
   past it, or you swerved out of the lane it was about to take you in. */
/* A trap that has gone past without touching anybody. Dodging pays nothing
   any more, but the mark still has to be set: the rival clutter roll reads
   this bitmask to decide which traps a cluttered driver fails to see. */
function markPassed(o, box, bit){
  if(o.nm & bit) return;
  if(o.y < box.y) return;                        /* not past us yet */
  o.nm |= bit;
}

function nearestOnCar(c, px, py){
  return { x:clamp(px, c.x - c.hw, c.x + c.hw), y:clamp(py, c.y - c.hh, c.y + c.hh) };
}

function updateTraps(dt, d, st){
  const racing = st === "running" && G.dead <= 0;
  const power = G.ultOn ? CARS[G.car].power : null;
  const shielded = G.ultOn && CARS[G.car].power !== "storm";
  /* Up in the air the road is simply not where you are: the trap neither
     catches you nor gets smashed, it goes by underneath and is still there
     when you come down. */
  const live = racing && G.immune <= 0 && !shielded && G.shockT <= 0 && !finishedMe() && !airborne();
  const smash = racing && power === "burn" && !airborne();   /* Redd wrecks what it touches */
  const c = carHit();
  for(let i=G.traps.length-1;i>=0;i--){
    const o = G.traps[i];
    if(o.kind === "weed"){
      o.age += dt;
      const wk = worldRate();                    /* chronokinesis drags it too */
      o.x += o.vx*dt*wk;
      o.y += d*lerp(1, o.fall, wk);
      o.rot += o.vx*dt*wk/o.r;
      if(o.x < roadX-100 || o.x > roadX+roadW+100 || o.y > VW_BOT+100){ G.traps.splice(i,1); continue; }
      if((live || smash) && !(o.hit & 1)){
        const wy = sweptY(o, d*o.fall, c.y);
        const p = nearestOnCar(c, o.x, wy);
        const dx = p.x - o.x, dy = p.y - wy;
        if(dx*dx + dy*dy <= o.r*o.r*0.86){
          if(smash) smashFx(o.x, o.y, o.r*1.2, "#D8C49A");
          else hitWeed(o);
          G.traps.splice(i,1); continue;
        }
      }
      continue;
    }
    if(o.kind === "meteor"){
      /* The ring is a spot on the road, so it rides the scroll like every
         other hazard. How far the rock still has to fall is seconds, and the
         only thing allowed to stretch them is chronokinesis - that is the
         world's clock, and it is meant to reach a falling rock. Nothing a
         driver does to their own road speed touches the drop: it lands when
         it was always going to land, wherever the ring has got to by then. */
      const wk = worldRate();
      o.y += d; o.t += dt*wk;
      if(o.phase === 0){
        o.fall = Math.max(0, o.fall - dt*wk);
        if(o.fall <= 0) detonate(o, live);
        else if(racing && o.fall < rockLead(o)){
          const alt = rockAlt(o);
          if(alt < carH*0.55){                       /* a rock straight on the roof */
            const my = o.y - alt;
            const p2 = nearestOnCar(c, o.x, my);
            const dx = p2.x - o.x, dy = p2.y - my;
            if(dx*dx + dy*dy <= o.mr*o.mr) detonate(o, live);
          }
        }
      } else if(o.phase === 1){
        if(o.t > 0.4){ o.phase = 2; o.t = 0; }
      } else if(o.t > 1.6){ G.traps.splice(i,1); continue; }
      if(o.y > VW_BOT + 400) G.traps.splice(i,1);
      continue;
    }

    o.y += d;                                  /* world-fixed: always scrolls with the road */
    if(o.y > VW_BOT + 260){ G.traps.splice(i,1); continue; }
    if((!live && !smash) || (o.hit & 1)) continue;
    if(puddleHits(o, c, sweptY(o, d, c.y))){
      o.hit |= 1;
      if(smash){ smashFx(o.x, o.y, o.rx*1.1, "#7FC2EC", G.car); G.traps.splice(i,1); continue; }
      hitPuddle();
    }
    markPassed(o, c, 1);
  }
}

/* The rock always reaches the ground. Anything caught in the blast goes with it. */
function detonate(o, live){
  o.phase = 1; o.t = 0;
  G.shake = 18;
  for(let i=0;i<26;i++){
    const a = rand(0, 6.2832), sp = rand(60, 300);
    addFx(o.x, o.y, Math.cos(a)*sp, Math.sin(a)*sp, rand(.35,.85), rand(2,6),
          i%3 === 0 ? "#FFE3B0" : (i%3 === 1 ? "#FF8A2B" : "#C6482A"));
  }
  for(let i=0;i<8;i++)
    addFx(o.x, o.y, rand(-70,70), rand(-130,-20), rand(.6,1.1), rand(4,8), "#2E2A34");
  noise(.5, .5); tone(70, .4, "sawtooth", .16);
  if(live){
    const c2 = carHit();
    const p3 = nearestOnCar(c2, o.x, o.y);
    const dx = p3.x - o.x, dy = p3.y - o.y;
    if(dx*dx + dy*dy <= o.r*o.r) destroyCar();
  }
  for(let n=0;n<G.rivals.length;n++){
    const R = G.rivals[n];
    if(safeCar(R) || R.ultOn) continue;
    const rc = { x:R.x, y:R.y, hw:carW*0.40, hh:carH*0.42 };
    const p4 = nearestOnCar(rc, o.x, o.y);
    const rx = p4.x - o.x, ry = p4.y - o.y;
    if(rx*rx + ry*ry <= o.r*o.r) wreckRival(R);
  }
}

/* Water thrown over one windscreen. Every car that goes through a puddle gets
   its own, because in local play every car has a screen of its own to foul. */
function blindSpray(){
  const out = [];
  for(let i=0;i<54;i++)
    out.push({ x:rand(-0.06, 1.06), y:rand(-0.06, 1.06), r:rand(4, 26), s:Math.random() });
  return out;
}
function hitPuddle(){
  ultDelta("me", ULT_ON_TRAP);
  clutterUp("me");                              /* contact deepens Rose's clutter */
  if(warded("me")) return;
  G.blind = BLIND_TIME;
  G.blindPts = blindSpray();
  for(let i=0;i<16;i++){
    const a = rand(-2.6, -0.5);
    addFx(G.x + rand(-carW*0.4, carW*0.4), playerY, Math.cos(a)*rand(70,220), Math.sin(a)*rand(70,240),
          rand(.3,.6), rand(2,5), "#7FC2EC");
  }
  G.shake = 6;
  noise(.3, .3); tone(200, .16, "sine", .07);
}

/* the destroy effect: wreck the car, then respawn it untouchable */
function clearMyUlt(){
  if(CARS[G.car].power === "bloom" && G.bloomOwner === "me") clearBloom();
  if(G.ultOn) endUlt("me");
  G.ult = 0; G.orbs = 0;
}
function destroyCar(by){
  if(G.ultOn) clearMyUlt();                    /* a running ultimate is lost outright */
  scrubBad("me");
  killLaunch();                                /* and so is anything in the air */
  ultDelta("me", ULT_ON_WRECK);
  if(by) ultDelta(by, ULT_ON_KILL);
  G.dead = DEAD_TIME;
  G.shake = 22;
  for(let i=0;i<30;i++){
    const a = rand(0, 6.2832), sp = rand(70, 340);
    addFx(G.x, playerY, Math.cos(a)*sp, Math.sin(a)*sp, rand(.45,1.0), rand(2,7),
          i%3 === 0 ? "#FFD9A0" : (i%3 === 1 ? "#FF7A3A" : "#E21B22"));
  }
  for(let i=0;i<10;i++)
    addFx(G.x, playerY, rand(-110,110), rand(-190,-40), rand(.6,1.2), rand(3,7), "#2A2C33");
  noise(.6, .55); tone(90, .45, "sawtooth", .17);
}

function hitWeed(o){
  ultDelta("me", ULT_ON_TRAP);
  clutterUp("me");                              /* contact deepens Rose's clutter */
  if(warded("me")) return;
  G.slowT = SLOW_TIME;
  G.shake = 8;
  for(let i=0;i<14;i++){
    const a = rand(0, 6.2832), sp = rand(40, 170);
    addFx(o.x, o.y, Math.cos(a)*sp, Math.sin(a)*sp, rand(.3,.7), rand(2,5),
          i%2 ? "#A8895C" : "#D8C49A");
  }
  noise(.24, .24); tone(170, .13, "square", .07);
}

/* Redd blowing a hazard apart on contact */
function smashFx(x, y, r, tint, whose){
  const car = CARS[whose || G.car];
  for(let i=0;i<20;i++){
    const a = rand(0, 6.2832), sp = rand(70, 300);
    addFx(x, y, Math.cos(a)*sp, Math.sin(a)*sp, rand(.3,.7), rand(2,6),
          i % 3 === 0 ? tint : (i % 3 === 1 ? car.flame[0] : car.flame[1]));
  }
  G.shake = Math.max(G.shake, 7);
  noise(.22, .3);
}

function respawnFx(){
  for(let i=0;i<18;i++){
    const a = (i/18)*6.2832;
    addFx(G.x + Math.cos(a)*carW*0.6, playerY + Math.sin(a)*carH*0.4,
          Math.cos(a)*70, Math.sin(a)*70, .45, 3, "#FF7A7F");
  }
  tone(660, .1, "sine", .09);
  later(function(){ tone(990, .12, "sine", .09); }, 90);
}

function addFx(x, y, vx, vy, life, r, c){
  if(G.fx.length > 240) G.fx.shift();          /* two cars can throw a lot of sparks */
  G.fx.push({ x:x, y:y, vx:vx, vy:vy, life:life, max:life, r:r, c:c });
}
function updateFx(dt, d){
  for(let i=G.fx.length-1;i>=0;i--){
    const f = G.fx[i];
    f.life -= dt;
    if(f.life <= 0){ G.fx.splice(i,1); continue; }
    f.x += f.vx*dt;
    f.y += f.vy*dt + d*0.55;
    f.vx *= 0.94; f.vy *= 0.94;
  }
}
