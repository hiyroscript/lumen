"use strict";

/* SEREN - the race itself: the world it runs through, the grid it starts
   with, the lifecycle around it, the finish, and the per-frame update that
   drives all of it. */

/* scenery generated above the seam already belongs to the incoming track */
function topBiome(){ return G.seam === null ? G.biome : G.next; }

/* Where two tracks meet, the ground interlocks instead of butting up against
   a line: a wandering edge, calm across the driving surface so the lanes stay
   readable, wide and irregular out on the shoulders where terrain would. */
function buildSeamShape(){
  const N = 11;
  G.seamPts = [];
  for(let i=0;i<N;i++){
    const x = (W/(N-1))*i;
    const onRoad = x > roadX - sideW*0.5 && x < roadX + roadW + sideW*0.5;
    const amp = onRoad ? 14 : 54;
    G.seamPts.push({ x:x, o:(Math.random()*2-1)*amp });
  }
  G.seamPts[0].o *= 0.6;
  G.seamPts[N-1].o *= 0.6;

  /* patches of each ground scattered into the other, thinning out with distance */
  G.seamBits = [];
  const lw = Math.max(0, roadX - 4), rx = roadX + roadW + 4;
  for(let i=0;i<34;i++){
    const left = Math.random() < 0.5;
    if(left && lw < 8) continue;
    if(!left && W - rx < 8) continue;
    G.seamBits.push({
      x: left ? rand(0, lw) : rand(rx, W),
      dy:(Math.random()*2-1)*180,
      r: rand(7, 27),
      s: Math.random()
    });
  }
}

/* ---------------- world seeding ---------------------------------- */
function makeBuilding(b){
  return { b:b, y:0, h:rand(80,210), tone:randi(0,2), s:Math.random(), tank:Math.random()<0.3, extra:Math.random()<0.13 };
}
function makeProp(b, side, y){
  return { b:b, side:side, y:y, kind:randi(0,2), s:Math.random() };
}
function makeFeature(b, y){ return { b:b, y:y }; }
function seedWorld(){
  const b = G.biome;
  G.build = [[],[]]; G.props = []; G.walks = [];
  for(let s=0;s<2;s++){          /* index 0 = lowest on screen, last = highest */
    let edge = H + 60;
    while(edge > -260){
      const o = makeBuilding(b);
      o.y = edge - o.h;
      G.build[s].push(o);
      edge = o.y - rand(8,26);
    }
  }
  let py = H + 40;
  while(py > -220){ G.props.push(makeProp(b, randi(0,1), py)); py -= rand(120,260); }
  G.walks = [makeFeature(b,-700), makeFeature(b,-2400)];
}

/* Hand over to a new track. The seam is planted just above the last piece
   of the old scenery, so the two worlds meet without a gap. */
function switchTrack(){
  if(G.tracksLeft === 0) return;
  if(G.tracksLeft > 0){
    G.tracksLeft--;
    if(G.tracksLeft === 0) G.finishAt = G.meters + FINISH_STRETCH;   /* flag on the last one */
  }
  const opts = TRACK_IDS.filter(function(id){ return id !== G.biome; });
  G.next = opts[randi(0, opts.length-1)];
  /* anchor on the contiguous scenery only - crossings are queued far ahead
     and would otherwise push the seam several screens out of sight */
  let top = -200;
  for(let s=0;s<2;s++){ const a = G.build[s]; if(a.length) top = Math.min(top, a[a.length-1].y); }
  if(G.props.length) top = Math.min(top, G.props[G.props.length-1].y);
  G.seam = top - 8;
  buildSeamShape();
  for(let s=0;s<2;s++){
    const a = G.build[s];
    for(let i=0;i<a.length;i++) if(a[i].y + a[i].h <= G.seam) a[i].b = G.next;
  }
  for(let i=0;i<G.props.length;i++) if(G.props[i].y < G.seam) G.props[i].b = G.next;
  for(let i=0;i<G.walks.length;i++) if(G.walks[i].y < G.seam) G.walks[i].b = G.next;
  G.trackT = TRACK_SECONDS;
}

/* ================================================================
   RACERS  -  two rivals that drive the way a person would
   ================================================================ */
function spawnRivals(){
  /* Whoever is being driven by a person gets the car that person chose, in
     seat order; the bots take what is left. The field is always six cars, so
     two players leave four bots, three leave three and four leave two - and
     every car in the game is on the road in every local race. */
  const taken = G.local ? G.picks.slice(0, G.players) : [G.car];
  const spare = CAR_IDS.filter(function(id){ return taken.indexOf(id) < 0; });
  const seats = G.local ? G.picks.slice(1, G.players) : [];
  /* People first, always; the bots take what is left of the grid. How much is
     left is the rule, and the standard rule is "all of it" - which is the six
     cars this has always put on the road. A custom race can ask for fewer, or
     for none at all, and then the field is just the people. */
  const others = seats.concat(spare.slice(0, botsWanted())).slice(0, FIELD_SIZE - 1);
  /* front row alongside you, the rest lined up behind */
  const front = [0, 1, 2].filter(function(l){ return l !== G.lane; });
  const grid = front.concat([0, 1, 2]);          /* row one beside you, row two behind */
  const rows = [0, 0, 1, 1, 1];
  G.rivals = others.map(function(id, i){
    const lane = grid[i];
    const back = rows[i]*carH*1.6;
    return {
      car:id, lane:lane, x:laneCX(lane), y:playerY + back, tilt:0,
      /* a person on the controls, or the bot mind */
      human:i < seats.length, seat:i + 1, pad:i + 1,
      padId:(G.padIds && G.padIds[i + 1] !== undefined ? G.padIds[i + 1] : null),
      pk:newPadKeys(),
      wantBoost:false, blindPts:[], petals:[],
      abs:0, changeT:rand(0.2, 0.7),          /* standing start: everyone from zero */
      slow:0, blind:0, dead:0, immune:0, shock:0, launch:0, bumpCD:0,
      chrono:0, ordered:0, orderBy:null, clutter:0, clutterLv:0, cleanse:0,
      orderDir:1, slip:0,
      item:null, itemRow:-1, canT:0, useT:rand(0.6, 2.4), item:null, canT:0, useT:0,
      inDanger:false, willReact:true, reactT:0, swapT:0,
      ult:0, ultOn:false, ultT:0, ultMax:ULT_TIME, powered:0,
      ultWait:rand(1, 3), ultHeld:0, orbs:0, fireT:0, orbFireT:0,
      charge:1, boostLock:false, boosting:false,
      finished:null, parkM:0,
      /* the launch, on exactly the player's terms: a brake that sheds speed,
         a wind-up that spends time, a meter that is the speed left in the car,
         and a cooldown that is the meter coming back */
      brakeOn:false, brakeHeld:false, brakeSpent:false,
      airMeter:1, airWind:0, airT:0, airMax:0, airPow:0,
      launchCD:0, airAim:0, airHold:0, airWhy:null,
      /* the thinking part: who it is currently interested in, what it meant to
         do next, and how long that intention is allowed to stand */
      temper:makeTemper(id), sense:null, senseT:0, plan:null, planT:0,
      hurtBy:null, hurtT:0, itemHold:0
    };
  });
  /* Player one first, then the seats in order: this is the list the split
     screen is cut from and the order the colours are handed out in. */
  G.humans = ["me"];
  for(let i=0;i<G.rivals.length;i++) if(G.rivals[i].human) G.humans.push(G.rivals[i]);
  G.pad = 0; G.seat = 0; G.pk = newPadKeys();
  G.padId = (G.local && G.padIds && G.padIds[0] !== undefined) ? G.padIds[0] : null;
}

/* Both racing modes run to a flag; only endless has no line to reach. Local
   play is Race against bots with people in some of the cars, so everything
   that asks "is there a finish?" has to count it. */
function toFlag(){ return G.mode === "bots" || G.mode === "local"; }

/* distance along the road, in metres, for anyone on it */
function metersOf(R){ return R ? G.meters + (playerY - R.y)*0.075 : G.meters; }
function rivalMeters(){ return G.rivals.length ? metersOf(G.rivals[0]) : 0; }

/* ---------------- race lifecycle --------------------------------- */
function clearTimers(){ G.timers.forEach(clearTimeout); G.timers = []; }
function later(fn, ms){ G.timers.push(setTimeout(fn, ms)); }

function startRace(){
  clearTimers();
  if(!G.rules) G.rules = defaultRules();   /* the standard game, unless one was set */
  $("#pausePanel").classList.remove("on");
  $("#overPanel").classList.remove("on");
  $("#newBest").classList.remove("on");
  const bd = $("#ovBoard"); if(bd) bd.classList.remove("on");
  /* How many columns the canvas is cut into has to be settled before anything
     is measured, because a column is what W means from here on. */
  VIEWS = G.local ? clamp(G.players, 2, LOCAL_MAX) : 1;
  document.body.classList.toggle("local", !!G.local);
  G.humans = [];
  resize();
  G.lane = 1; G.x = laneCX(1); G.tilt = 0;
  G.scroll = 0; G.speed = 0; G.meters = 0; G.dist = 0;      /* standing start */
  G.biome = "city"; G.next = null; G.seam = null; G.trackT = TRACK_SECONDS;
  curTrackKey = TRACKS.city.key;
  $("#trackName").textContent = t(curTrackKey);
  G.charge = 1; G.boosting = false; G.keyBoost = false; G.ptrBoost = false;
  G.traffic = []; G.shake = 0; G.relGap = 0; G.nextGap = 430;
  G.traps = []; G.fx = []; G.trapGap = 0; G.nextTrap = 620;
  G.tier = 0; G.speedT = SPEED_SECONDS; G.blind = 0; G.blindPts = [];
  G.dead = 0; G.immune = 0; G.slowT = 0; G.swipeLock = 0;
  G.ult = 0; G.ultOn = false; G.boostLock = false; G.ultArmed = true;
  G.ultT = 0; G.ultMax = ULT_TIME; G.powered = 0; G.orbFireT = 0;
  G.orbs = 0; G.bolts = []; G.shockT = 0; G.launchT = 0; G.bumpCD = 0;
  G.brakeOn = false; G.brakeKey = false; G.brakePtr = false; G.brakeSpent = false;
  G.airMeter = 1; G.airWind = 0;
  G.airT = 0; G.airMax = 0; G.airPow = 0; G.launchCD = 0;
  G.chronoT = 0; G.chronoWorld = 0; G.chronoOwner = null;
  G.orderedT = 0; G.orderBy = null;
  G.bloomT = 0; G.clutterLv = 0; G.cleanseT = 0; G.petals = []; G.slipT = 0;
  G.item = null; G.swapT = 0; G.boxes = []; G.slicks = []; G.missiles = []; G.canT = 0;
  G.padBoost = false; G.padBrake = false; G.pk = newPadKeys();
  G.boxGap = 0; G.nextRow = rand(2200, 3400);      /* the first row comes a bit sooner */
  G.lastTap = -9; G.tapClock = 0;
  G.sirenOwner = null; G.bloomOwner = null;
  clearEffects();                    /* nothing carries over from the last race */
  G.cdT = 0; G.cdStep = -1; G.wasCounting = false;
  G.raceT = 0; G.finishAt = 0; G.finished = null; G.results = []; G.parkRot = 0;
  G.raceDone = false;
  G.tracksLeft = -1;
  $("#ovTitle").textContent = t("over");
  $("#ovLead").textContent = t("overLead");
  spawnRivals();
  seedWorld();
  paintHUD(true);
  G.state = "countdown";
  runCountdown();
  loopStart();
  engineStart();
}

/* Driven from the frame loop rather than timers, so pausing stops it dead. */
function runCountdown(){
  const box = $("#count"), lights = box.querySelectorAll(".gantry i");
  box.classList.add("on");
  lights.forEach(function(l){ l.className = ""; });
  G.cdT = 0; G.cdStep = -1;
  countStep(0);
}
function countStep(n){
  if(n === G.cdStep) return;
  G.cdStep = n;
  const box = $("#count"), num = $("#countNum"), lights = box.querySelectorAll(".gantry i");
  const label = n < 3 ? String(3 - n) : "GO";
  num.textContent = label;
  num.classList.remove("pop"); void num.offsetWidth; num.classList.add("pop");
  lights.forEach(function(l, i){ l.className = n >= 3 ? "go" : (i <= n ? "lit" : ""); });
  tone(n >= 3 ? 900 : 420, .12, "square", .13);
}
function tickCountdown(dt){
  if(G.state !== "countdown") return;
  G.cdT += dt;
  countStep(Math.min(3, Math.floor(G.cdT)));
  if(G.cdT >= 3 && G.state === "countdown"){
    G.state = "running";
    later(function(){ $("#count").classList.remove("on"); }, 420);
  }
}

function pause(on){
  if(on && G.state !== "running" && G.state !== "countdown") return;
  if(!on && G.state !== "paused") return;
  if(on) G.wasCounting = G.state === "countdown";
  G.state = on ? "paused" : (G.wasCounting ? "countdown" : "running");
  if(!on) G.wasCounting = false;                 /* or every later resume rewinds */
  $("#pausePanel").classList.toggle("on", on);
  if(!on){
    const lead = $("#pauseLead");
    if(lead) lead.textContent = t("pausedLead");
  }
  if(on){ engineStop(); } else { engineStart(); }
}

function leave(){
  clearTimers();
  const bd = $("#ovBoard"); if(bd) bd.classList.remove("on");
  if(!G.local && (G.state === "running" || G.state === "paused") && Math.floor(G.meters) > best){
    best = Math.floor(G.meters);
    store.set("seren.best", best);
    paintBest();
  }
  G.state = "idle";
  document.body.classList.remove("local");
  VIEWS = 1;
  engineStop();
  loopStop();
  $("#pausePanel").classList.remove("on");
  $("#overPanel").classList.remove("on");
  $("#count").classList.remove("on");
  show("home");
}

function crash(){
  if(G.state !== "running") return;
  G.state = "over";
  killLaunch();
  G.shake = 16;
  engineStop();
  noise(.5, .5);
  tone(120, .4, "sawtooth", .16);
  flash(.85, 260);
  const m = Math.floor(G.meters);
  const isBest = m > best;
  if(isBest){ best = m; store.set("seren.best", best); }
  paintBest();
  later(function(){
    $("#ovDist").textContent = m;
    $("#ovBest").textContent = best;
    $("#newBest").classList.toggle("on", isBest);
    $("#overPanel").classList.add("on");
  }, 620);
}

function flash(a, ms){
  const f = $("#flash");
  f.style.transition = "none"; f.style.opacity = a;
  requestAnimationFrame(function(){
    f.style.transition = "opacity " + ms + "ms ease-out";
    f.style.opacity = 0;
  });
}

/* who has crossed the flag, and where each of them ends up */
/* A finisher does not stop where it crossed and it does not get shuffled into
   a grid afterwards. It is given a mark the moment it crosses - a lane and a
   distance past the flag, both read straight off its finishing place - and
   rolls out onto it. First place rolls furthest, and every place behind stops
   one step earlier, so the field parks in the order it finished and no two
   cars are ever aimed at the same piece of road. */
/* The staircase can start in any of the three lanes and still be a staircase,
   so it starts in whichever one the field is closest to already. Ordering the
   cars by how far down the road they are guesses the finishing order well
   enough at the flag, and the rotation that leaves the most of them in the lane
   they are already in is the one that makes the fewest cars cut across the
   others on the roll-out. Picked once, when the first car crosses, so every
   later finisher joins the same staircase. */
function pickParkRot(){
  const all = [{ lane:G.lane, m:G.meters }].concat(
    G.rivals.map(function(R){ return { lane:R.lane, m:metersOf(R) }; }));
  all.sort(function(a, b){ return b.m - a.m; });
  let bestRot = 0, bestCost = 1e9;
  for(let rot=0;rot<3;rot++){
    let cost = 0;
    for(let i=0;i<all.length;i++) if(all[i].lane !== (i + rot) % 3) cost++;
    if(cost < bestCost){ bestCost = cost; bestRot = rot; }
  }
  return bestRot;
}
function parkLaneFor(place){ return (place - 1 + G.parkRot) % 3; }
function parkMeters(place){
  const field = G.rivals.length + 1;
  return G.finishAt + carH*(PARK_BASE + (field - place)*PARK_STEP)*0.075;
}
/* The marks are distances along the road, not places on the screen, so a car
   already parked recedes correctly while the rest of the field is still
   racing - and lands exactly where it should the moment you stop too. */
function parkY(m){ return playerY - (m - G.meters)/0.075; }

function checkFinish(){
  if(!G.finishAt || (G.state !== "running" && G.state !== "over")) return;
  if(!G.results.length) G.parkRot = pickParkRot();   /* set once, by the first car home */
  for(let i=0;i<G.rivals.length;i++){
    const R = G.rivals[i];
    if(R.finished === null && metersOf(R) >= G.finishAt){
      R.finished = G.results.length + 1;
      G.results.push({ me:false, car:R.car, place:R.finished });
      R.lane = parkLaneFor(R.finished);          /* the lane its place earned */
      R.parkM = metersOf(R);                     /* rolls out from where it crossed */
      if(R.ultOn) endUlt(R);
      R.boosting = false; R.orbs = 0;
      scrubBad(R);                               /* Winner: out of play, and clean */
    }
  }
  if(G.finished === null && G.meters >= G.finishAt){
    G.finished = G.results.length + 1;
    G.results.push({ me:true, car:G.car, place:G.finished });
    G.lane = parkLaneFor(G.finished);           /* your car takes its lane too */
    if(G.ultOn) endUlt("me");
    G.orbs = 0; G.boosting = false;
    G.keyBoost = G.ptrBoost = G.ultKey = G.padBoost = false;
    scrubBad("me");                             /* Winner: out of play, and clean */
    killLaunch();                              /* nobody crosses the line mid-flight */
    if(!G.local) finishRace();
  }
  /* On one screen the race is over when your car crosses. On four it is over
     when the last person's does - the board is not settled until everybody has
     a place on it, and a player still driving must not have the screen taken
     away mid-corner. Bots left on the road finish behind, as they always do. */
  if(G.local && G.finished !== null && !G.raceDone && allHumansHome()){
    G.raceDone = true;
    finishRace();
  }
}
function allHumansHome(){
  for(let i=0;i<G.humans.length;i++){
    const who = G.humans[i];
    if((who === "me" ? G.finished : who.finished) === null) return false;
  }
  return true;
}

function finishRace(){
  /* Keep the world running so the car actually rolls to a stop on the line
     rather than the line freezing on top of it. */
  engineStop();
  const m = Math.floor(G.meters);
  /* Four people on one machine do not share a personal best, and the car that
     covered this distance may not even have been player one's to drive. Local
     play reads the record and never writes it. */
  const isBest = !G.local && m > best;
  if(isBest){ best = m; store.set("seren.best", best); paintBest(); }
  tone(660, .18, "square", .12);
  later(function(){ tone(880, .18, "square", .12); }, 150);
  later(function(){ tone(1180, .3, "square", .12); }, 300);
  G.parkWait = 2.2;
  later(function(){
    G.state = "over";
    if(G.local){
      $("#ovTitle").textContent = localWinner();
      $("#ovLead").textContent = localBoard();
    } else {
      $("#ovTitle").textContent = t("finished");
      $("#ovLead").textContent = t("yourPlace") + ": " + placeWord(G.finished);
      const bd = $("#ovBoard"); if(bd) bd.classList.remove("on");
    }
    $("#ovDist").textContent = m;
    $("#ovBest").textContent = best;
    $("#newBest").classList.toggle("on", isBest);
    $("#overPanel").classList.add("on");
  }, 700);
}
function placeWord(n){ return t("place" + clamp(n, 1, 6)); }
/* Whoever came first out of the people in the room - and if the whole podium
   went to bots, the race is simply over. */
function localWinner(){
  for(let i=0;i<G.humans.length;i++){
    const who = G.humans[i];
    const pl = who === "me" ? G.finished : who.finished;
    if(pl === 1) return t("playerN") + " " + (i + 1) + " " + t("localWon");
  }
  return t("localOver");
}
/* The whole grid as it finished: six cars in order, the ones with people in
   them wearing their colour and their number. A single line of "P1 3rd" told
   you your place and nothing about the race. */
function localBoard(){
  const rows = [];
  for(let i=0;i<G.humans.length;i++){
    const who = G.humans[i];
    rows.push({ who:who, seat:i, car:who === "me" ? G.car : who.car,
                place:(who === "me" ? G.finished : who.finished) || placeOf(who) });
  }
  for(let i=0;i<G.rivals.length;i++){
    const R = G.rivals[i];
    if(R.human) continue;
    rows.push({ who:R, seat:-1, car:R.car, place:R.finished || placeOf(R) });
  }
  rows.sort(function(a, b){ return a.place - b.place; });
  const host = $("#ovBoard");
  if(host){
    let html = "";
    for(let i=0;i<rows.length;i++){
      const r = rows[i], seated = r.seat >= 0;
      html += '<div class="r' + (seated ? " seat" : "") + '">' +
              '<span class="pl">' + placeWord(r.place) + '</span>' +
              '<span class="chip"' + (seated ? ' style="background:' + PCOLS[r.seat] + '"' : '') + '></span>' +
              '<span class="nm">' + t(CARS[r.car].key) + '</span>' +
              '<span class="by">' + (seated ? t("playerN") + " " + (r.seat + 1) : t("botShort")) + '</span>' +
              '</div>';
    }
    host.innerHTML = html;
    host.classList.add("on");
  }
  /* the lead line stays a one-glance summary of the people in the room */
  const out = [];
  for(let i=0;i<G.humans.length;i++){
    const r = rows.find(function(x){ return x.seat === i; });
    out.push("P" + (i + 1) + " " + placeWord(r.place));
  }
  return out.join("   \u00b7   ");
}

/* ---------------- update ----------------------------------------- */
function update(dt){
  tickCountdown(dt);
  viewBounds();
  if(G.local){
    padPoll();
    const live = G.state === "running" || G.state === "countdown";
    const seats = G.humans.slice();          /* a menu press can rebuild the list */
    if(live && padsLost(seats)) return;      /* somebody's batteries went */
    for(let i=0;i<seats.length;i++){
      if(live) padDrive(seats[i], dt);
      else padMenuTick(seats[i]);
    }
  }
  const st = G.state;
  if(G.swipeLock > 0) G.swipeLock = Math.max(0, G.swipeLock - dt);
  if(st === "paused" || st === "idle") return;

  /* speed */
  let target, braking = false;
  if(st === "countdown") target = 0;          /* the car holds still on the line */
  else if(G.finished !== null){
    /* Over the line: roll out onto the mark your place earned rather than
       stopping dead on the spot you crossed. Taken outright the way the brake
       is - it can only ever slow you, so finishing never hands speed back -
       and the last few pixels are dropped so the car settles instead of
       creeping. This is checked before the "over" branch because the run-out
       is the point: "over" is also how a wreck ends, and that one does stop
       where it stands. */
    const remPx = Math.max(0, parkMeters(G.finished) - G.meters)/0.075;
    if(remPx*PARK_EASE < 8){
      /* An eased approach never quite arrives, and the last of it is below the
         speed anything can be seen moving at. Close it outright so the car sits
         on the mark rather than two pixels shy of it - two pixels is nothing to
         look at, but it is the difference between the field being evenly spaced
         and being evenly spaced apart from your car. */
      G.meters = parkMeters(G.finished);
      target = 0;
    } else target = remPx*PARK_EASE;
    braking = true;
  }
  else if(st === "over") target = Math.max(0, G.speed - 900*dt);
  else if(airborne()){
    /* Off the road entirely: nothing on the ground reaches up to hold you, so
       a pin or a drag waits until the wheels are back down. The clock still
       reaches you up there, though - chronokinesis is not on the road. */
    target = BASE_SPEED*speedMult()*lerp(AIR_MIN_K, AIR_MAX_K, G.airPow);
    if(G.canT > 0) target *= CAN_SPEED;
    if(G.chronoT > 0) target *= CHRONO_RATE;
  }
  else if(G.dead > 0 || G.shockT > 0) target = 0;   /* wrecked or pinned: you stop,
                                                 the race goes on without you */
  else {
    target = BASE_SPEED*speedMult();
    if(G.ultOn) target *= ULT_SPEED;
    else if(G.slowT > 0) target *= 0.5;
    if(G.chronoT > 0) target *= CHRONO_RATE;     /* dragged down with the world */
    if(G.boosting) target *= 1.5;
    if(G.canT > 0) target *= CAN_SPEED;          /* the can is free speed */
    if(G.launchT > 0) target *= LAUNCH_BOOST;
    /* The meter is the speed left in the car, so the bar and the road can
       never disagree: at nothing on the bar you are stopped. */
    if(G.brakeOn){ target *= G.airMeter; braking = true; }
  }
  /* Everywhere else the car chases its target, which lags a moving one by
     about a seventh of a second - at this drain rate that left it still
     rolling at a tenth of pace with the bar reading empty. Under the brake
     the target is taken outright instead, so "empty" means stopped. It can
     only ever slow the car: if something else already has it below the brake
     line, the brake does not hand speed back. */
  if(braking) G.speed = Math.min(G.speed, target);
  else G.speed = lerp(G.speed, target, 1 - Math.pow(0.001, dt));
  G.scroll += G.speed*dt;
  /* The run-out after the flag is still road covered, so the distance has to
     keep counting through it - the mark is a distance, and it can only be
     reached if the meter that measures it is still running. */
  if(st === "running" || G.finished !== null) G.meters += G.speed*dt*0.075;
  if(st === "running") engineSet(clamp((G.speed-300)/900, 0, 1));

  /* boost charge */
  if(G.boosting){
    G.charge = clamp(G.charge - dt*0.4, 0, 1);
    if(G.charge <= 0.001){                       /* run it dry and it locks out */
      G.charge = 0; G.boostLock = true;
      G.ptrBoost = G.keyBoost = false;
    }
  } else if(st === "running"){
    G.charge = clamp(G.charge + dt*0.14, 0, 1);
    if(G.charge >= 1) G.boostLock = false;       /* only back once it is full */
  }
  setBoost();

  /* lateral */
  const tx = laneCX(G.lane);
  const nx = lerp(G.x, tx, 1 - Math.pow(0.00004, dt));
  G.tilt = clamp((nx - G.x)/dt/2600, -0.28, 0.28) || 0;
  G.x = nx;

  /* world scroll */
  const d = G.speed*dt;
  /* Built and kept for every view at once. On one screen these two numbers are
     0 and H and this is the code it always was; on four they stretch to cover
     the whole spread of the field, which is the difference between a leading
     player driving through scenery and driving through nothing. */
  const wTop = VW_TOP - 260, wBot = VW_BOT + 60;
  for(let s=0;s<2;s++){
    const arr = G.build[s];
    for(let i=0;i<arr.length;i++) arr[i].y += d;
    while(arr.length && arr[0].y > wBot) arr.shift();
    let top = arr.length ? arr[arr.length-1] : null;
    while(!top || top.y > wTop){
      const b = makeBuilding(topBiome());
      b.y = (top ? top.y : wTop) - rand(8,26) - b.h;
      arr.push(b); top = b;
    }
  }
  for(let i=G.props.length-1;i>=0;i--){
    G.props[i].y += d;
    if(G.props[i].y > wBot) G.props.splice(i,1);
  }
  while(!G.props.length || G.props[G.props.length-1].y > VW_TOP - 140)
    G.props.push(makeProp(topBiome(), randi(0,1), (G.props.length ? G.props[G.props.length-1].y : VW_BOT) - rand(120,260)));
  for(let i=G.walks.length-1;i>=0;i--){
    G.walks[i].y += d;
    if(G.walks[i].y > VW_BOT + 80) G.walks.splice(i,1);
  }
  let topWalk = VW_BOT;
  for(let i=0;i<G.walks.length;i++) topWalk = Math.min(topWalk, G.walks[i].y);
  while(!G.walks.length || topWalk > VW_TOP - 1300){
    topWalk = topWalk - rand(1500,2600);
    G.walks.push(makeFeature(topBiome(), topWalk));
  }

  /* the race clock in bots mode: five minutes, then three tracks to the flag */
  if(st === "running" && toFlag() && G.finished === null){
    G.raceT += dt;
    if(G.tracksLeft < 0 && G.raceT >= RACE_MINUTES*60) G.tracksLeft = FINAL_TRACKS;
  }

  /* clocks only run while the car is actually racing */
  if(st === "running"){
    G.trackT -= dt;
    if(G.trackT <= 0 && G.seam === null && G.finishAt === 0) switchTrack();
    if(G.tier < MAX_TIER){
      G.speedT -= dt;
      if(G.speedT <= 0){ G.speedT = SPEED_SECONDS; G.tier++; G.stepFlash = 1.2; }
    } else G.speedT = SPEED_SECONDS;
    G.trapGap += d;
    if(G.trapGap >= G.nextTrap){ G.trapGap = 0; spawnTrap(); G.nextTrap = rand(430, 900); }
  }

  /* ultimate: charges slowly, then burns down over its five seconds */
  if(st === "running"){
    if(G.ultOn) tickUlt("me", dt);
    else if(G.ult < 1 && G.dead <= 0 && ruleOn("ults")) G.ult = Math.min(1, G.ult + dt/ULT_CHARGE);
    if(G.ultKey && G.ultArmed){ fireUlt(); G.ultArmed = false; }
    else if(!G.ultKey && !ptr.on) G.ultArmed = true;
    if(ptr.on && !ptr.moved && ptrCount === 1){    /* one finger, held down */
      ptr.hold = (ptr.hold || 0) + dt;
      if(ptr.hold >= LONG_PRESS && G.ultArmed){ fireUlt(); G.ultArmed = false; }
    } else if(!ptr.on) ptr.hold = 0;
  }

  /* hit states */
  if(G.blind > 0)  G.blind  = Math.max(0, G.blind - dt);
  if(G.shockT > 0) G.shockT = Math.max(0, G.shockT - dt);
  if(G.chronoT > 0) G.chronoT = Math.max(0, G.chronoT - dt);
  if(G.orderedT > 0){
    G.orderedT = Math.max(0, G.orderedT - dt);
    if(G.orderedT === 0) G.orderBy = null;
  }
  if(G.slipT > 0) G.slipT = Math.max(0, G.slipT - dt);
  if(G.canT > 0) G.canT = Math.max(0, G.canT - dt);
  if(G.swapT > 0) G.swapT = Math.max(0, G.swapT - dt);
  if(G.bloomT > 0){
    G.bloomT = Math.max(0, G.bloomT - dt);
    if(G.bloomT === 0){ G.petals = []; G.clutterLv = 0; }
  }
  if(G.cleanseT > 0) G.cleanseT = Math.max(0, G.cleanseT - dt);
  if(G.chronoWorld > 0){ G.chronoWorld = Math.max(0, G.chronoWorld - dt); if(G.chronoWorld === 0) endChrono(); }
  if(G.launchT > 0) G.launchT = Math.max(0, G.launchT - dt);
  updateLaunch(dt, st);
  G.tapClock += dt;
  if(G.bumpCD > 0) G.bumpCD = Math.max(0, G.bumpCD - dt);
  if(G.slowT > 0)  G.slowT  = Math.max(0, G.slowT - dt);
  if(G.immune > 0) G.immune = Math.max(0, G.immune - dt);
  immuneScrub();
  if(G.dead > 0){
    G.dead -= dt;
    if(G.dead <= 0){ G.dead = 0; G.immune = IMMUNE_TIME; respawnFx(); }
  }
  updateBubbles(dt, d, st);
  updateSlicks(dt, d, st);
  updateMissiles(dt, d);
  updateTraps(dt, d, st);
  if(st === "running" && G.dead <= 0 && !airborne()){
    const inFront = carAt(G.lane, playerY, "me");
    if(inFront && inFront.y < playerY) rearEnd("me", inFront);
  }
  updateRivals(dt, st);
  serveOrders();                 /* Siren's orders, made good wherever she ends up */
  updateBolts(dt);
  checkFinish();
  updateFx(dt, d);
  if(G.seam !== null){
    G.seam += d;
    if(G.seam > VW_BOT + 60){
      G.biome = G.next; G.next = null; G.seam = null;
      G.traps = G.traps.filter(function(o){ return o.b === G.biome; });
      curTrackKey = TRACKS[G.biome].key;
      $("#trackName").textContent = t(curTrackKey);
    }
  }

  /* traffic */
  for(let i=G.traffic.length-1;i>=0;i--){
    const t = G.traffic[i];
    t.y += (G.speed - t.spd)*dt;
    t.x = lerp(t.x, laneCX(t.lane), 1 - Math.pow(0.0002, dt));
    if(t.y > VW_BOT+180){ G.traffic.splice(i,1); continue; }
    if(!t.passed && t.y > playerY + carH*0.5){
      t.passed = true;
      if(st === "running" && Math.abs(t.x - G.x) < laneW*1.25){ G.meters += 4; tone(1180, .04, "sine", .05); }
    }
    if(st === "running" &&
       Math.abs(t.x - G.x) < (carW + t.w)*0.42 &&
       Math.abs(t.y - playerY) < (carH + t.h)*0.44) crash();
  }

  if(st === "running" && TRAFFIC_ENABLED){
    breakWalls();
    /* pace spawns by how fast we are closing on traffic, so the gap the
       player actually sees stays readable at every speed */
    G.relGap += Math.max(70, G.speed - 215)*dt;
    if(G.relGap >= G.nextGap){
      G.relGap = 0;
      spawnWave();
      const ramp = clamp(G.tier/MAX_TIER, 0, 1);
      G.nextGap = lerp(372, 268, ramp) * rand(0.92, 1.34);
    }
  }

  if(G.shake > 0) G.shake = Math.max(0, G.shake - dt*38);
  if(G.stepFlash > 0) G.stepFlash = Math.max(0, G.stepFlash - dt);
}

function updateRival(R, dt, st){
  if(st !== "running" && st !== "over") return;   /* still let them reach the flag */
  const D = diff();

  if(R.slow > 0)   R.slow   = Math.max(0, R.slow - dt);
  if(R.blind > 0)  R.blind  = Math.max(0, R.blind - dt);
  if(R.immune > 0) R.immune = Math.max(0, R.immune - dt);
  if(R.shock > 0){ R.shock = Math.max(0, R.shock - dt); R.boosting = false; }
  if(R.chrono > 0) R.chrono = Math.max(0, R.chrono - dt);
  if(R.cleanse > 0) R.cleanse = Math.max(0, R.cleanse - dt);
  if(R.ordered > 0){
    R.ordered = Math.max(0, R.ordered - dt);
    R.boosting = false;                          /* ordered: no controls at all */
    if(R.ordered === 0) R.orderBy = null;
  }
  if(R.slip > 0) R.slip = Math.max(0, R.slip - dt);
  if(R.canT > 0) R.canT = Math.max(0, R.canT - dt);
  if(R.clutter > 0){
    R.clutter = Math.max(0, R.clutter - dt);
    if(R.clutter === 0){ R.clutterLv = 0; R.petals = []; }
  }
  if(R.launch > 0) R.launch = Math.max(0, R.launch - dt);
  if(R.swapT > 0) R.swapT = Math.max(0, R.swapT - dt);
  if(R.bumpCD > 0) R.bumpCD = Math.max(0, R.bumpCD - dt);
  if(R.changeT > 0) R.changeT -= dt;
  if(R.reactT > 0)  R.reactT -= dt;
  if(R.fireT > 0)   R.fireT -= dt;
  if(R.senseT > 0)  R.senseT -= dt;
  if(R.hurtT > 0){                               /* who last did something to it */
    R.hurtT = Math.max(0, R.hurtT - dt);
    if(R.hurtT === 0) R.hurtBy = null;
  }

  if(R.dead > 0){
    R.dead -= dt;
    if(R.dead <= 0){ R.dead = 0; R.immune = IMMUNE_TIME; }
    R.abs = 0;
    R.y += G.speed*dt;
    return;
  }
  if(R.finished !== null){                     /* over the line: roll out onto the mark */
    killLaunchRival(R);                        /* nobody crosses the line mid-flight */
    R.abs = 0;
    R.tilt = 0;
    /* Eased along the road rather than across the screen. Lerping a screen
       position at a target that is itself sliding away - which it is, for as
       long as anyone is still racing - leaves a permanent gap the size of the
       road speed over the easing rate, about a car length. In road distance
       there is nothing moving to chase, so the car sits exactly on its mark
       and the camera does the rest. */
    R.parkM = lerp(R.parkM, parkMeters(R.finished), 1 - Math.pow(0.02, dt));
    R.y = parkY(R.parkM);
    R.x = lerp(R.x, laneCX(R.lane), 1 - Math.pow(0.00008, dt));
    return;
  }

  /* One honest look at the race, rebuilt on a clock. How often is part of what
     a difficulty buys, and everything below reads the same picture for as long
     as it stands - so a bot can never act on two different versions of the
     road inside one frame. */
  /* A car with a person in it still sees the road - the picture is what the
     ladder, the targeting and the contact rules all read - it simply does not
     act on it. Everything below that decides is skipped; everything that runs
     the mechanic is not. */
  botLook(R, dt);
  const s = R.sense;

  /* The launch, on the player's mechanic and nobody else's. */
  updateRivalLaunch(R, dt, s);

  if(!R.human){
    /* Whatever is in its hand. When to spend it is judgement; what it does when
       spent is useItem, the same door your own item box opens. */
    if(R.item && botItemNow(R, s, dt)) useItem(R);
  }

  /* Ultimate. Filled off exactly the clock the player's fills off - difficulty
     buys the moment it is spent, never how soon it arrives. */
  if(R.ultOn) tickUlt(R, dt);
  else {
    /* Wrecked, the meter stops - exactly as the player's does. It used to keep
       filling for a rival, which was invisible while only bots drove them and
       is a straight advantage the moment a person does. */
    if(R.dead <= 0 && ruleOn("ults")) R.ult = Math.min(1, R.ult + dt/ULT_CHARGE);
    if(R.ult < 1) R.ultHeld = 0;
    else if(!R.human && botUltNow(R, s, dt)){ R.ultHeld = 0; startUlt(R); }
  }

  /* boost: chase with it, sit on it when comfortably clear, and never burn it
     into a hazard or while standing on the brake waiting to go up */
  const clearAhead = !s.now[R.lane];
  if(R.human){
    /* The player's boost, one for one: the same drain, the same refill, the
       same lock-out at nothing and the same refusal to run while the brake is
       down or the controls have been taken away - settled first and spent
       second, which is the order the player's own frame runs in. */
    R.boosting = ruleOn("boost") &&
                 !!R.wantBoost && !R.boostLock && R.charge > 0 && !R.brakeOn &&
                 G.state === "running" && R.dead <= 0 && R.finished === null &&
                 R.shock <= 0 && R.ordered <= 0;
    if(R.boosting){
      R.charge = clamp(R.charge - dt*0.4, 0, 1);
      if(R.charge <= 0.001){ R.charge = 0; R.boostLock = true; R.wantBoost = false; R.boosting = false; }
    } else {
      R.charge = clamp(R.charge + dt*0.14, 0, 1);
      if(R.charge >= 1) R.boostLock = false;
    }
  } else if(R.boosting){
    R.charge = clamp(R.charge - dt*0.4, 0, 1);
    if(R.charge <= 0.001){ R.charge = 0; R.boostLock = true; R.boosting = false; }
    else if(R.charge < D.keep) R.boosting = false;     /* good drivers never run it dry */
    if(!clearAhead && Math.random() < D.boost) R.boosting = false;
    if(R.brakeOn) R.boosting = false;
  } else {
    R.charge = clamp(R.charge + dt*0.14, 0, 1);
    if(R.charge >= 1) R.boostLock = false;
    const gapM = s.mine - G.meters;
    /* Chasing the field rather than chasing you: what it wants is the car it
       is actually racing, whoever that is. */
    const chase = s.front ? 0.85 : (s.place > 1 ? 0.6 : 0.25);
    const eager = chase*(gapM < -20 ? 1.1 : 1)*D.boost*(0.6 + R.temper.nerve*0.7);
    if(ruleOn("boost") && !R.boostLock && !R.brakeOn && R.charge > 0.5 && clearAhead &&
       R.shock <= 0 && R.ordered <= 0 && Math.random() < eager*dt*2) R.boosting = true;
  }
  if(R.human && R.boosting && (R.brakeOn || R.shock > 0 || R.ordered > 0)) R.boosting = false;

  /* pace: identical to everyone else unless something is acting on it */
  let want = BASE_SPEED*speedMult();
  let hold = false;
  if(R.airT > 0){
    /* Off the road entirely: nothing on the ground reaches up to hold it, but
       the clock still does - chronokinesis is not on the road. */
    want *= lerp(AIR_MIN_K, AIR_MAX_K, R.airPow);
    if(R.canT > 0) want *= CAN_SPEED;
    if(R.chrono > 0) want *= CHRONO_RATE;
  } else if(R.shock > 0) want = 0;
  else {
    if(R.ultOn) want *= ULT_SPEED;
    else if(R.slow > 0) want *= 0.5;
    if(R.chrono > 0) want *= CHRONO_RATE;       /* dragged down with the world */
    if(R.boosting) want *= 1.5;
    if(R.canT > 0) want *= CAN_SPEED;
    if(R.launch > 0) want *= LAUNCH_BOOST;
    /* The meter is the speed left in the car, so the bar and the road can
       never disagree, and the brake can only ever slow it. */
    if(R.brakeOn){ want *= R.airMeter; hold = true; }
  }
  if(hold) R.abs = Math.min(R.abs, want);
  else {
    R.abs = lerp(R.abs, want, 1 - Math.pow(0.001, dt));   /* same throttle response as you */
    if(Math.abs(R.abs - want) < 1.5) R.abs = want;
  }

  const ahead = carAt(R.lane, R.y, R);
  if(ahead && ahead.y < R.y) rearEnd(R, ahead);        /* it runs into their back */
  R.y += (G.speed - R.abs)*dt;
  R.y = clamp(R.y, -30000, H + 30000);

  /* reaction: a beat late, and now and then missed entirely */
  const inLane = s.now[R.lane] === 1;
  if(inLane && !R.inDanger){
    R.inDanger = true;
    /* At stage one it still sometimes sees the trap coming; by stage five the
       screen is gone and it never does. */
    R.willReact = R.clutter > 0
      ? Math.random() > lerp(0.55, 1, clutterK(R.clutterLv))
      : Math.random() > D.lapse;
    R.reactT = rand(D.react[0], D.react[1])*(R.clutter > 0 ? lerp(1.8, 3.4, clutterK(R.clutterLv)) : 1);
  } else if(!inLane) R.inDanger = false;

  if(!R.human && R.changeT <= 0 && R.blind <= 0 && R.shock <= 0 && R.ordered <= 0){
    R.changeT = rand(D.tick[0], D.tick[1])*(R.clutter > 0 ? lerp(2.2, 4.2, clutterK(R.clutterLv)) : 1);
    botLook(R, dt, true);                       /* look again, then decide */
    rivalThink(R, dt);
  }
  const tx = laneCX(R.lane);
  const nx = lerp(R.x, tx, 1 - Math.pow(0.00006, dt));
  R.tilt = clamp((nx - R.x)/dt/2600, -0.28, 0.28) || 0;
  R.x = nx;

  /* hazards, on exactly the terms the player gets them - including being over
     the top of them, where the road is simply not where the car is */
  const smash = R.ultOn && CARS[R.car].power === "burn";
  const ghost = R.ultOn && CARS[R.car].power === "phase";
  if(R.immune <= 0 && !ghost && R.airT <= 0 && !finishedCar(R)){
    const rc = { x:R.x, y:R.y, hw:carW*0.40, hh:carH*0.42 };
    const bit = 2 << G.rivals.indexOf(R);
    for(let i=G.traps.length-1;i>=0;i--){
      const o = G.traps[i];
      if(o.kind === "meteor") continue;
      const p = nearestOnCar(rc, o.x, o.y);
      const dx = p.x - o.x, dy = p.y - o.y;
      if(o.hit & bit) continue;                        /* already soaked this one */
      const hit = o.kind === "puddle"
        ? puddleHits(o, rc)
        : dx*dx + dy*dy <= o.r*o.r*0.86;
      if(!hit){ markPassed(o, rc, bit); continue; }
      o.hit |= bit;
      if(smash){ smashFx(o.x, o.y, (o.rx || o.r)*1.1, "#D8C49A", R.car); G.traps.splice(i,1); continue; }
      ultDelta(R, ULT_ON_TRAP);
      clutterUp(R);                                    /* hitting things while blind blinds you more */
      if(warded(R)){ puffFx(o.x, o.y); if(o.kind === "weed") G.traps.splice(i,1); break; }
      if(o.kind === "weed"){ R.slow = SLOW_TIME; puffFx(o.x, o.y); G.traps.splice(i,1); }
      else { R.blind = BLIND_TIME; R.blindPts = blindSpray(); puffFx(o.x, o.y); }
      break;
    }
  }
}

function updateRivals(dt, st){
  for(let i=0;i<G.rivals.length;i++) updateRival(G.rivals[i], dt, st);
}

/* ---------------- loop ------------------------------------------- */
let raf = 0, last = 0;
function frame(ts){
  raf = requestAnimationFrame(frame);
  const dt = last ? Math.min((ts - last)/1000, 0.05) : 0.016;
  last = ts;
  update(dt);
  render();
  paintHUD(false);
}
function loopStart(){ if(!raf){ last = 0; raf = requestAnimationFrame(frame); } }
function loopStop(){ if(raf){ cancelAnimationFrame(raf); raf = 0; } }
