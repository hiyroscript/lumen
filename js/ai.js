"use strict";

/* REDLINE - the bot mind: sense, weigh, act.
   A difficulty changes how well a driver thinks, never what its car is
   allowed to do - every decision below hands off to the same mechanics the
   player's own inputs call. */

/* lanes this car should stay out of: hazards, and traffic it would run into.
   `far` reads the extra distance a difficulty buys; `at` projects the whole
   test forward by that many seconds, which is how the better drivers see a
   hazard arriving rather than a hazard arrived. */
function laneRisk(R, far, at){
  const D = diff();
  /* Petals blind a person; for a bot we take the same information away, so it
     misjudges the road exactly as you would with a cluttered screen. */
  const blind = R.clutter > 0 ? lerp(0.30, 0.06, clutterK(R.clutterLv)) : 1;
  const look = (far ? 360 + D.look : 360)*blind;
  /* Where the road will have carried everything by then. The car's own drift
     goes in too - a bot sliding backwards through the field meets a hazard
     sooner than one pulling away from it. */
  const t = at || 0;
  const roll = t > 0 ? (G.speed - R.abs)*t : 0;
  const risk = [0,0,0];
  for(let i=0;i<G.traps.length;i++){
    const o = G.traps[i];
    if(o.kind === "meteor" && o.phase !== 0) continue;
    if(R.clutter > 0 && ((o.nm >> 3) % 2) === 0) continue;   /* misses half of them */
    const ahead = (R.y + roll) - (o.y + (t > 0 ? G.speed*t : 0));
    if(ahead < -40 || ahead > look) continue;
    risk[clamp(Math.floor((o.x - roadX)/laneW), 0, 2)] = 1;
  }
  for(let i=0;i<G.traffic.length;i++){
    const t2 = G.traffic[i], ahead = R.y - t2.y;
    if(ahead > -60 && ahead < 340) risk[t2.lane] = 1;
  }
  /* Oil is a hazard like any other. It is not read at all below the settings
     that would notice it, which is why an easy bot drives straight through
     the slick you just laid and a brutal one goes round it. */
  if(D.skill >= 0.4){
    for(let i=0;i<G.slicks.length;i++){
      const o = G.slicks[i];
      if(o.fade > 0) continue;
      const ahead = R.y - o.y;
      if(ahead < -40 || ahead > look*0.8) continue;
      risk[clamp(Math.floor((o.x - roadX)/laneW), 0, 2)] = 1;
    }
  }
  const all = racers();
  for(let i=0;i<all.length;i++){
    const a = all[i];
    if(a.out || a.obj === R) continue;
    if(noContact(a.me ? "me" : a.obj)) continue;      /* nothing to run into */
    const ahead = R.y - a.y;
    if(ahead > 0 && ahead < 300) risk[a.lane] = 1;    /* held up behind them */
  }
  return risk;
}

/* ================================================================
   THE BOT MIND
   ================================================================
   Three parts, in this order, every think-tick:

     sense   build one honest picture of the race from where this car sits
     weigh   score every action it could take against that picture
     act     take the best one, and remember what it was going to do next

   Two rules hold the whole thing together. The first is that nothing in here
   asks whether a car has a person behind it: the player is a row in the same
   list as everybody else, scored by the same terms, and a bot fighting
   another bot for third place three hundred metres up the road runs exactly
   this code. The second is that the mind only ever decides - the doing is
   handed straight back to the same functions your own inputs call, so a bot
   barging, launching, dropping oil or pressing its ultimate is running the
   mechanic you are running, not a version of it written for bots. */

/* Every other car on the road, described in the terms a driver thinks in. */
function fieldView(self){
  const out = [];
  const add = function(me, obj){
    const o = me ? G : obj;
    out.push({
      me:me, obj:obj, who:me ? "me" : obj, car:me ? G.car : obj.car,
      x:me ? G.x : obj.x, y:me ? playerY : obj.y, lane:me ? G.lane : obj.lane,
      m:me ? G.meters : metersOf(obj),
      spd:me ? G.speed : obj.abs,
      out:me ? (G.dead > 0 || finishedMe()) : (obj.dead > 0 || finishedCar(obj)),
      safe:me ? playerUntouchable() : safeCar(obj),
      touch:!(me ? noContact("me") : noContact(obj)),
      air:me ? airborne() : obj.airT > 0,
      ultOn:!!o.ultOn, ult:o.ultOn ? 1 : (o.ult || 0),
      power:CARS[me ? G.car : obj.car].power,
      slow:me ? G.slowT : obj.slow,
      shock:me ? G.shockT : obj.shock,
      ordered:me ? G.orderedT : obj.ordered,
      slip:me ? G.slipT : obj.slip,
      blind:me ? G.blind : obj.blind,
      clutter:me ? G.bloomT : obj.clutter,
      item:o.item || null
    });
  };
  if(self !== "me") add(true, null);
  for(let i=0;i<G.rivals.length;i++) if(G.rivals[i] !== self) add(false, G.rivals[i]);
  return out;
}

/* How exposed a car is this instant: everything that has taken its speed, its
   steering or its controls away, plus having a barrier on one side and
   nothing to answer with. This is the number that decides whether a bot
   bothers - hitting a car that can hit back is worth much less than
   finishing one that cannot. */
function softness(a){
  if(!a || a.out || a.safe || !a.touch) return 0;
  let v = 0;
  if(a.shock > 0)   v += 1.05;                 /* stopped dead */
  if(a.ordered > 0) v += 0.85;                 /* no controls at all */
  if(a.slip > 0)    v += 0.50;                 /* its steering is backwards */
  if(a.slow > 0)    v += 0.40;
  if(a.clutter > 0) v += 0.35;                 /* it cannot see the road */
  if(a.blind > 0)   v += 0.30;
  if(a.lane === 0 || a.lane === 2) v += 0.55;  /* a barrier to be put into */
  if(!a.ultOn && a.ult < 0.5) v += 0.18;       /* nothing to answer with */
  return clamp(v/2.3, 0, 1);
}

/* How much of a problem another car is to this one. Distance, direction, what
   it is carrying and how quickly it is arriving - and no term anywhere for
   who is driving it. The car two lengths back with a full meter is the threat
   whoever that is. */
function threatOf(R, a, mine){
  if(!a || a.out) return 0;
  const gap = Math.abs(a.m - mine);
  if(gap > 240) return 0;
  let v = 1 - gap/240;
  v *= a.m < mine ? 1 : 0.7;                   /* the one closing on you is worse */
  if(a.ultOn) v *= 2.3;
  else if(a.ult >= 1) v *= 1.75;
  else v *= 0.7 + a.ult*0.6;
  if(a.item) v *= 1.25;
  if(!a.touch) v *= 0.35;                      /* it cannot reach you either */
  return clamp(v, 0, 3);
}

/* Is a seeker currently chasing this car? Counters the same way it does for
   you: there is no dodging it, so the answer is a reason to reach for an
   ultimate, not a reason to change lane. */
function incomingMissile(who){
  for(let i=0;i<G.missiles.length;i++){
    const m = G.missiles[i];
    if(m.fade > 0) continue;
    if(m.mark === who) return true;
  }
  return false;
}

/* ---- sense ---- */
function botSense(R){
  const D = diff(), M = R.temper;
  const mine = metersOf(R);
  const all = fieldView(R);
  const s = {
    D:D, M:M, mine:mine, all:all,
    now:laneRisk(R), soon:laneRisk(R, true, D.read),
    place:1, field:1, losing:false, tight:false, boxed:false,
    front:null, frontGap:1e9, back:null, backGap:1e9,
    target:null, threat:null, threatClose:false,
    seeker:incomingMissile(R), clean:[], taken:[]
  };
  let close = 0;
  for(let i=0;i<all.length;i++){
    const a = all[i];
    if(a.out) continue;
    s.field++;
    if(a.m > mine) s.place++;
    const gy = R.y - a.y;                       /* + this car is up the road */
    if(Math.abs(a.m - mine) < 90) close++;
    if(a.lane === R.lane && a.touch){
      if(gy > 0 && gy < s.frontGap){ s.frontGap = gy; s.front = a; }
      if(gy < 0 && -gy < s.backGap){ s.backGap = -gy; s.back = a; }
    }
    const th = threatOf(R, a, mine);
    if(!s.threat || th > threatOf(R, s.threat, mine)) if(th > 0) s.threat = a;
  }
  s.tight = close >= 2;
  s.losing = mine < G.meters - 15;
  s.threatClose = !!s.threat && Math.abs(s.threat.m - mine) < 70;

  /* which of the two doors are open, read through whatever is fouling the
     screen - clutter must never invent an opening it cannot see */
  const opts = [R.lane-1, R.lane+1].filter(function(l){ return l >= 0 && l <= 2; });
  s.opts = opts;
  s.clean = opts.filter(function(l){
    if(s.now[l] || carAt(l, R.y, R)) return false;
    return !(R.clutter > 0 && Math.random() < lerp(0.35, 0.80, clutterK(R.clutterLv)));
  });
  s.taken = opts.filter(function(l){ return !s.now[l] && carAt(l, R.y, R); });
  s.boxed = s.clean.length === 0;
  s.target = botTarget(R, s);
  return s;
}

/* ---- who is worth doing something to ----
   Free-for-all, in one function. Every reachable car is scored on what
   hurting it is worth and how easily it can be hurt, and the highest number
   wins. Two bots scrapping over fourth run this against each other with the
   player nowhere in the list. */
function botTarget(R, s){
  const D = s.D, M = s.M;
  let best = null, bestV = 0;
  for(let i=0;i<s.all.length;i++){
    const a = s.all[i];
    if(a.out || a.safe || !a.touch) continue;
    if(Math.abs(a.lane - R.lane) > 1) continue;      /* one lane at a time, same as you */
    const gap = a.m - s.mine;                        /* + up the road */
    const near = Math.abs(gap);
    if(near > 190) continue;
    let v = 1 - near/190;
    if(gap > 0) v *= 1.35;                           /* it is costing you a place now */
    else v *= 0.85 + 0.55*threatOf(R, a, s.mine);    /* it is about to take one */
    v *= 0.40 + softness(a)*1.15;                    /* hit what can actually be hit */
    if(a.ultOn) v *= 0.18;                           /* an ultimate wins that exchange */
    else if(a.ult >= 1) v *= 1.35;                   /* take it off them first */
    if(R.hurtBy === a.who && R.hurtT > 0) v *= 1.3 + M.spite*0.5;
    v *= 0.55 + M.spite*0.9;
    v *= 0.25 + D.hunt;
    if(D.noise > 0) v *= 1 + rand(-D.noise, D.noise);
    if(v > bestV){ bestV = v; best = a; }
  }
  return bestV > 0.30 ? best : null;
}

/* ---- what a lane is worth ---- */
function laneScore(R, l, s){
  const D = s.D, M = s.M;
  let v = 0;
  if(s.now[l]) v -= 120;
  if(s.soon[l]) v -= 16 + D.skill*30;               /* only good drivers read that far */
  if(carAt(l, R.y, R)) v -= 44;
  let clear = 900;
  for(let i=0;i<s.all.length;i++){
    const a = s.all[i];
    if(a.out || !a.touch || a.lane !== l) continue;
    const gy = R.y - a.y;
    if(gy > 0 && gy < clear) clear = gy;
  }
  v += clamp(clear, 0, 900)/900*(10 + D.skill*26);
  /* A bubble in that lane is a reason to be in it. Read the same way a person
     reads it - only the ones close enough to still be reachable, and only by
     drivers whose screen is not full of petals. */
  if(R.clutter <= 0){
    for(let i=0;i<G.boxes.length;i++){
      const row = G.boxes[i];
      if(row.gone & (1 << l)) continue;
      const gy = R.y - row.y;
      if(gy < carH*0.5 || gy > 620) continue;
      v += (12 + D.skill*16)*(1 - gy/620);
      break;
    }
  }
  if(l === 1) v += 2 + D.skill*5;                   /* the middle keeps both doors open */
  else v -= D.guard*3*(1 - M.nerve);                /* a wall to be shoved into */
  if(l === R.lane) v += 5;                          /* changing lane costs time */
  if(D.noise > 0) v += rand(-D.noise, D.noise)*24;
  return v;
}

/* ---- what an ultimate is worth right now ----
   Every car's ultimate does a different job, so every car reads a different
   road. None of this changes what the ultimate does or how fast the meter
   fills - it is the judgement of when to spend it, which is the only thing a
   difficulty is allowed to buy. */
function botUltValue(R, s){
  const p = CARS[R.car].power;
  const D = s.D, M = s.M;
  let v = 0, ahead = 0, near = 0, behind = 0, reach = 0, wreck = 0;
  for(let i=0;i<s.all.length;i++){
    const a = s.all[i];
    if(a.out) continue;
    const gy = R.y - a.y;
    if(Math.abs(gy) < 640) near++;
    if(gy > 0 && gy < 640) ahead++;
    if(gy < 0 && gy > -420) behind++;
    if(gy > 0 && gy < SIREN_RANGE && !a.safe && a.touch) reach++;
    if(!a.safe && a.touch && Math.abs(a.lane - R.lane) <= 1 && gy > -carH && gy < 340) wreck++;
  }
  if(p === "burn"){
    /* Redd: it writes off whatever it touches, traps included. Worth pressing
       when there is something in front of it to touch. */
    v += clamp(wreck, 0, 3)*0.42;
    if(s.now[R.lane] || s.soon[R.lane]) v += 0.22;
  } else if(p === "phase"){
    /* Phantom: nothing on the road reaches it. Worth pressing when something
       is about to - a seeker locked on, a lane with no way out, a wall of
       cars to drive straight through. */
    if(s.seeker) v += 1.1;
    if(s.now[R.lane] && s.boxed) v += 0.85;
    else if(s.boxed) v += 0.4;
    v += clamp(ahead, 0, 3)*0.16;
    if(s.threatClose) v += 0.3;
  } else if(p === "storm"){
    /* Bolt: three orbs and they only ever go up the road, so it is worth
       exactly as much as there is company in front of it. */
    let n = 0;
    for(let i=0;i<s.all.length;i++){
      const a = s.all[i];
      if(a.out || a.safe || !a.touch) continue;
      if(R.y - a.y > 0) n++;
    }
    v += clamp(n, 0, 3)*0.36;
    if(n >= 2) v += 0.22;
  } else if(p === "freeze"){
    /* Timestamp: the world halves and it does not, so it gains on everybody
       at once - and on nobody at all if it is already clear out in front. */
    v += clamp(near, 0, 5)*0.16;
    if(s.place > 1) v += 0.3;
    if(s.tight) v += 0.2;
  } else if(p === "bloom"){
    /* Rose: everyone else loses the screen, which is worth what the company
       is worth. */
    v += clamp(near, 0, 5)*0.15;
    if(behind) v += 0.2;
    if(s.tight) v += 0.25;
  } else if(p === "siren"){
    /* Siren: clears the road in front of it and wipes whatever is stuck to
       it, so it answers a bad state as readily as it answers traffic. */
    v += clamp(reach, 0, 3)*0.4;
    if(R.slow > 0 || R.slip > 0 || R.chrono > 0 || R.clutter > 0) v += 0.5;
    if(R.ordered > 0 || R.shock > 0) v += 0.35;
    if(s.seeker) v += 0.2;
  }
  /* and every one of them is also five seconds of doubled pace */
  if(s.losing) v += 0.3;
  if(s.now[R.lane]) v += 0.12;
  return v;
}

/* Press it, hold it, or leave it. Judgement only: the meter fills off the
   same clock the player's fills off at every setting. */
function botUltNow(R, s, dt){
  if(R.ultOn || R.ult < 1) return false;
  if(R.shock > 0 || R.ordered > 0 || R.dead > 0 || finishedCar(R)) return false;
  const D = s.D, M = s.M;
  R.ultHeld += dt;
  if(D.judge < 0.2){
    /* the bottom of the range does not read the road at all - the meter is
       full, so sooner or later the button gets pressed */
    R.ultWait -= dt*(0.5 + D.ult*3)*(0.5 + Math.random());
    if(R.ultWait > 0) return false;
    R.ultWait = rand(1, 4);
    return true;
  }
  const bar = (0.55 + M.patience*0.8)*(0.35 + D.judge*0.9);
  /* A held ultimate is not free. The meter is full and stays full, so every
     second it sits there is a second of the next charge that will never be
     spent - hold it long enough and the race is simply one ultimate short.
     The bar therefore comes down to nothing well inside a cycle. Judgement
     buys the pick of the moment within that window, never the right to skip
     a turn, which is why the sharper drivers now spend more of what they
     charge rather than less. */
  const window = ULT_CHARGE*(0.09 + M.patience*0.13);
  const worn = bar*Math.max(0, 1 - R.ultHeld/window);
  return botUltValue(R, s) >= worn;
}

/* ---- what the thing in its hand is worth ---- */
function botItemWorth(R, s){
  const id = R.item;
  const D = s.D, M = s.M;
  if(id === "can"){
    /* free speed, and worth the most on a piece of road it can actually use */
    let v = 0.35;
    if(!s.now[R.lane] && !s.soon[R.lane]) v += 0.45;
    if(s.frontGap > carH*4) v += 0.3;
    if(s.losing) v += 0.25;
    if(R.canT > 0 || R.ultOn) v -= 0.9;              /* never stack it on itself */
    if(R.slow > 0 || R.shock > 0) v -= 0.3;
    if(s.front && s.frontGap < carH*2) v -= 0.35;    /* nowhere to put it */
    return v;
  }
  if(id === "oil"){
    /* it goes on the road behind, so it is worth exactly what is behind */
    let v = 0.1;
    if(s.back && s.backGap < carH*6) v += 0.75 - s.backGap/(carH*12);
    for(let i=0;i<s.all.length;i++){
      const a = s.all[i];
      if(a.out || !a.touch) continue;
      const gy = a.y - R.y;
      if(gy > 0 && gy < carH*7 && Math.abs(a.lane - R.lane) <= 1) v += 0.22;
    }
    if(s.threat && s.threat.m < s.mine) v += 0.25;
    if(s.place === 1) v += 0.15;                     /* leading: everything is behind */
    return v;
  }
  if(id === "seeker"){
    /* one target, the leader, and nothing survives the trip - so the only
       question worth asking is whether the trip would land */
    const t = seekerTarget(R);
    if(!t) return -1;
    const mark = t.me ? "me" : t.obj;
    if(t.me ? immuneMe() : immuneCar(t.obj)) return D.judge > 0.5 ? -1 : 0.4;
    if(incomingMissile(mark) && D.judge > 0.6) return -1;   /* already on its way */
    let v = 0.7;
    if(t.m - s.mine > 40) v += 0.3;                  /* the further gone, the better */
    if(s.place === 1) v -= 0.5;                      /* pointless from the front */
    return v;
  }
  return 0.5;
}
function botItemNow(R, s, dt){
  if(!R.item) return false;
  if(R.shock > 0 || R.ordered > 0 || R.dead > 0 || finishedCar(R)) return false;
  const D = s.D, M = s.M;
  R.itemHold += dt;
  if(D.judge < 0.2){
    R.useT -= dt*(0.6 + D.ult);                      /* easy still just counts down */
    return R.useT <= 0;
  }
  const bar = (0.5 + M.patience*0.55)*(0.4 + D.judge*0.85);
  const worn = bar*Math.max(0.2, 1 - R.itemHold/(3.5 + M.patience*9));
  return botItemWorth(R, s) >= worn;
}

/* ---- when to leave the road ----
   Four reasons, and a difficulty decides how many of them a driver has worked
   out. Everyone understands the first one. Only the top of the range treats a
   full wind-up as a piece of racecraft, because only the top of the range can
   read whether standing still for three seconds is survivable from here. */
function botAirWant(R, s){
  const D = s.D, M = s.M;
  if(D.air <= 0 || R.launchCD > 0 || R.airT > 0) return null;
  if(!canBrakeRival(R)) return null;
  const gap = s.frontGap;

  /* 1. get off the road: nothing grounded matters once the wheels leave it */
  if(s.now[R.lane] && s.boxed && Math.random() < 0.35 + D.air*0.6)
    return { why:"escape", aim:0.03 };

  if(D.air < 0.30) return null;                      /* and at the bottom, the only one */

  /* 2. go over the top of whatever is holding this lane up */
  if(s.front && s.front.touch && gap < carH*3.4 && gap > carH*0.7 &&
     Math.random() < 0.25 + M.flair*0.5)
    return { why:"over", aim:clamp(0.28 + M.nerve*0.3, 0, D.wind) };

  if(D.air < 0.60) return null;

  /* 3. come down on somebody. A landing writes off whatever is underneath, so
     a car that cannot get out from under it is worth standing still for. */
  if(s.front && !s.front.safe && s.front.touch && gap < carH*5.5 &&
     softness(s.front) > 0.40 && Math.random() < 0.35 + M.spite*0.6)
    return { why:"land", aim:clamp(0.45 + M.spite*0.4, 0, D.wind) };

  if(D.air < 0.80) return null;

  /* 4. and at the top it is simply quick - but only from a piece of road
     where three seconds of standing still will not be taken off you. */
  if(!s.now[R.lane] && !s.soon[R.lane] && s.backGap > carH*4.5 &&
     !s.threatClose && !s.seeker && s.frontGap > carH*3 &&
     Math.random() < 0.25 + M.flair*0.45)
    return { why:"pace", aim:clamp(0.5 + M.nerve*0.5, 0, D.wind) };

  return null;
}

/* ---- act ----
   One tick of the loop. Sense, weigh, act - and whatever it meant to do next
   is written down rather than committed to, because the next tick reads the
   race again from scratch and throws the note away if it no longer fits. */
function rivalThink(R, dt){
  const s = R.sense || botSense(R);
  R.sense = s;
  const D = s.D, M = s.M;

  /* Up in the air there is only one question worth asking, and it is where
     this is going to come down. Nothing on the road can be barged, blocked or
     defended against from up there - but the ground it lands on still counts,
     so a driver good enough to think about it aims for a clean piece. */
  if(R.airT > 0){
    if(s.now[R.lane] && s.clean.length && Math.random() < 0.3 + D.skill*0.7){
      let bl = s.clean[0], bv = -1e9;
      for(let i=0;i<s.clean.length;i++){
        const sc = laneScore(R, s.clean[i], s);
        if(sc > bv){ bv = sc; bl = s.clean[i]; }
      }
      rivalSteer(R, bl);
    }
    return;
  }

  /* a note from last tick, still good? */
  let plan = null;
  if(R.plan && R.planT > 0){
    R.planT -= 1;
    plan = R.plan;
    if(plan.kind === "barge"){
      const v = plan.at;
      if(!v || v.out || v.safe || !v.touch || Math.abs(v.lane - R.lane) > 1 ||
         Math.abs(v.m - s.mine) > 200) plan = null;
    }
    if(plan && s.now[plan.lane]) plan = null;        /* the road changed its mind for us */
  }
  if(!plan) R.plan = null;

  /* 1. get out of trouble. This comes before everything: a bot standing in a
     hazard has no plan worth keeping. */
  if(s.now[R.lane]){
    if(R.willReact && R.reactT <= 0){
      if(s.clean.length){
        let bl = s.clean[0], bv = -1e9;
        for(let i=0;i<s.clean.length;i++){
          const sc = laneScore(R, s.clean[i], s);
          if(sc > bv){ bv = sc; bl = s.clean[i]; }
        }
        return rivalSteer(R, bl);
      }
      if(s.taken.length) return rivalSteer(R, s.taken[0]);    /* shove through */
    }
    return;
  }

  /* 2. carry out the note, if it survived */
  if(plan && plan.kind === "barge" && plan.at && !s.soon[plan.lane]){
    R.plan = null;
    return rivalSteer(R, plan.lane);
  }

  /* 3. offence. The target came out of botTarget, which never asks who is
     driving - so this is bots barging bots as readily as bots barging you. */
  const t = s.target;
  if(t && !s.soon[R.lane]){
    const side = t.lane - R.lane;
    const soft = softness(t);
    /* worth it if the shove has somewhere to put them, and much more so if
       that somewhere is off the road entirely */
    const wall = side !== 0
      ? (t.lane + side < 0 || t.lane + side > 2)
      : (t.lane === 0 || t.lane === 2);
    let want = D.aggro*(0.5 + M.spite)*(0.4 + soft*1.4);
    if(wall) want *= 2.1;                            /* a wreck, not a nudge */
    if(t.ult >= 1) want *= 1.35;
    if(s.soon[t.lane]) want *= 0.35;                 /* do not follow them into it */
    if(side !== 0 && Math.random() < want){
      /* a good driver looks at what the shove leaves behind: taking a car out
         beside you hands the lane to whoever was sitting behind you */
      if(D.skill > 0.5 && s.back && s.backGap < carH*2.2 && Math.random() < D.skill*0.6){
        /* not now - it costs more than it wins */
      } else {
        if(D.plan > 0){
          R.plan = { kind:"lane", lane:R.lane, at:null };
          R.planT = D.plan;
        }
        return rivalSteer(R, t.lane);
      }
    }
    if(side === 0 && s.frontGap < carH*1.6 && !t.safe && Math.random() < want*0.6){
      /* right on its bumper: line up the shove for the next tick rather than
         sitting behind it losing time */
      const to = t.lane === 0 ? 1 : (t.lane === 2 ? 1 : (Math.random() < 0.5 ? 0 : 2));
      if(s.clean.indexOf(to) >= 0 && D.plan > 0){
        R.plan = { kind:"barge", lane:t.lane, at:t };
        R.planT = D.plan;
        return rivalSteer(R, to);
      }
    }
  }

  /* 4. defend the place. Cover the lane whoever is closing on you would use. */
  if(Math.random() < D.block*(0.5 + M.guard)){
    let cover = null, worst = 0;
    for(let i=0;i<s.all.length;i++){
      const a = s.all[i];
      if(a.out || !a.touch) continue;
      const behind = a.y - R.y;
      if(behind < carH*0.9 || behind > carH*3.6) continue;
      if(a.m >= s.mine) continue;
      const th = threatOf(R, a, s.mine);
      if(a.lane !== R.lane && s.opts.indexOf(a.lane) >= 0 &&
         !s.now[a.lane] && !s.soon[a.lane] && th > worst){ worst = th; cover = a.lane; }
    }
    if(cover !== null) return rivalSteer(R, cover);
  }

  /* 5. otherwise take the best lane on offer. At the bottom of the range the
     scores are so noisy that this is a drift; at the top it is a line. */
  let bestL = R.lane, bestV = laneScore(R, R.lane, s);
  for(let i=0;i<s.opts.length;i++){
    const l = s.opts[i];
    if(carAt(l, R.y, R)) continue;
    const v = laneScore(R, l, s);
    if(v > bestV){ bestV = v; bestL = l; }
  }
  if(bestL !== R.lane && Math.random() < 0.35 + D.skill*0.6) return rivalSteer(R, bestL);

  /* nothing better on offer: lean on whoever is in the way, now and then */
  if(s.taken.length && !s.soon[s.taken[0]]){
    const v = carAt(s.taken[0], R.y, R);
    const shove = (0.03 + D.aggro*0.22)*(0.5 + M.spite);
    if(v && Math.random() < shove) rivalSteer(R, s.taken[0]);
  }
}

/* Rebuild a bot's picture of the race if the one it is holding has gone
   stale. Higher settings look more often, which is most of what "reassesses
   the race more frequently" comes down to. */
function botLook(R, dt, force){
  if(!force && R.sense && R.senseT > 0) return R.sense;
  const D = diff();
  R.senseT = rand(D.tick[0], D.tick[1])*0.4;
  R.sense = botSense(R);
  return R.sense;
}

/* Whoever last did something to this car, remembered for a few seconds. It is
   not a grudge system - it is one term in the target score, so a bot that has
   just been shoved is a little likelier to shove back than to pick on a
   stranger. */
function botBlame(victim, by){
  if(!victim || !by || victim === by) return;
  victim.hurtBy = by;
  victim.hurtT = 6;
}
