"use strict";

/* SEREN - Canvas 2D drawing. Cars, tracks, scenery, hazards, particles and
   the effects that sit over them. Draw order here is behaviour: it is what
   decides what covers what. This file reads game state and never changes
   it. */

/* ---------------- drawing helpers -------------------------------- */
function rr(x,y,w,h,r){
  r = Math.min(r, Math.abs(w)/2, Math.abs(h)/2);
  ctx.beginPath();
  if(ctx.roundRect){ ctx.roundRect(x,y,w,h,r); return; }
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
function fillRR(x,y,w,h,r,c){ rr(x,y,w,h,r); ctx.fillStyle=c; ctx.fill(); }

function drawCar(x, y, w, h, p, tilt, isPlayer, boosting){
  ctx.save();
  ctx.translate(x, y);
  if(tilt) ctx.rotate(tilt);
  if(p.style === "jet") drawJet(w, h, p, isPlayer, boosting);
  else if(p.style === "buggy") drawBuggy(w, h, p, isPlayer, boosting);
  else if(p.style === "wedge") drawWedge(w, h, p, isPlayer, boosting);
  else if(p.style === "coupe") drawCoupe(w, h, p, isPlayer, boosting);
  else if(p.style === "cruiser") drawCruiser(w, h, p, isPlayer, boosting);
  else drawGT(w, h, p, isPlayer, boosting);
  ctx.restore();
}

function flames(w, h, hot, cool){
  ctx.globalAlpha = 0.75;
  fillRR(-w*0.30, h*0.50, w*0.18, h*0.30, w*0.09, hot);
  fillRR( w*0.12, h*0.50, w*0.18, h*0.30, w*0.09, hot);
  ctx.globalAlpha = 0.5;
  fillRR(-w*0.26, h*0.50, w*0.10, h*0.46, w*0.05, cool);
  fillRR( w*0.16, h*0.50, w*0.10, h*0.46, w*0.05, cool);
  ctx.globalAlpha = 1;
}

/* Redd and all traffic: a squat, square-shouldered muscle car */
function drawGT(w, h, p, isPlayer, boosting){
  fillRR(-w/2+3, -h/2+7, w, h, w*0.26, "rgba(0,0,0,0.42)");

  const ww = w*0.17, wh = h*0.16;
  fillRR(-w/2-ww*0.30, -h*0.29, ww, wh, ww*0.4, "#0C0D10");
  fillRR( w/2-ww*0.70, -h*0.29, ww, wh, ww*0.4, "#0C0D10");
  fillRR(-w/2-ww*0.30,  h*0.13, ww, wh, ww*0.4, "#0C0D10");
  fillRR( w/2-ww*0.70,  h*0.13, ww, wh, ww*0.4, "#0C0D10");

  fillRR(-w/2, -h/2, w, h, w*0.26, p.body);
  rr(-w/2, -h/2, w, h, w*0.26);
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = Math.max(1, w*0.03); ctx.stroke();

  fillRR(-w*0.42, -h/2+h*0.012, w*0.84, h*0.062, w*0.08, p.dark);
  fillRR(-w*0.34, -h/2+h*0.022, w*0.20, h*0.038, w*0.04, "#FFE8C0");
  fillRR( w*0.14, -h/2+h*0.022, w*0.20, h*0.038, w*0.04, "#FFE8C0");

  fillRR(-w*0.34, -h*0.20, w*0.68, h*0.42, w*0.16, p.dark);
  fillRR(-w*0.29, -h*0.17, w*0.58, h*0.13, w*0.08, p.glass);
  fillRR(-w*0.29,  h*0.09, w*0.58, h*0.10, w*0.07, p.glass);

  if(isPlayer){
    ctx.fillStyle = p.dark;
    ctx.fillRect(-w*0.16, -h*0.46, w*0.09, h*0.24);
    ctx.fillRect( w*0.07, -h*0.46, w*0.09, h*0.24);
    fillRR(-w*0.06, h*0.24, w*0.12, h*0.16, w*0.05, p.dark);
  }

  fillRR(-w*0.46, h*0.40, w*0.92, h*0.075, w*0.06, p.dark);
  fillRR(-w*0.36, h*0.415, w*0.22, h*0.036, w*0.03, "#FF4A50");
  fillRR( w*0.14, h*0.415, w*0.22, h*0.036, w*0.03, "#FF4A50");

  if(boosting) flames(w, h, (p.flame && p.flame[0]) || "#FF7A3A", (p.flame && p.flame[1]) || "#FFD9A0");
}

/* Phantom: a low, curvy sports car - same road-going shape as Redd,
   but tapered and swept where Redd is square */
function jetBody(w, h){
  ctx.beginPath();
  ctx.moveTo(-w*0.27, -h*0.50);
  ctx.quadraticCurveTo(-w*0.46, -h*0.45, -w*0.48, -h*0.24);
  ctx.lineTo(-w*0.50, h*0.14);
  ctx.quadraticCurveTo(-w*0.50, h*0.45, -w*0.35, h*0.50);
  ctx.lineTo( w*0.35, h*0.50);
  ctx.quadraticCurveTo( w*0.50, h*0.45,  w*0.50, h*0.14);
  ctx.lineTo( w*0.48, -h*0.24);
  ctx.quadraticCurveTo( w*0.46, -h*0.45,  w*0.27, -h*0.50);
  ctx.quadraticCurveTo(0, -h*0.56, -w*0.27, -h*0.50);
  ctx.closePath();
}
function drawJet(w, h, p, isPlayer, boosting){
  ctx.save(); ctx.translate(3, 7);
  jetBody(w, h); ctx.fillStyle = "rgba(0,0,0,0.42)"; ctx.fill();
  ctx.restore();

  const ww = w*0.155, wh = h*0.155;                    /* four wheels, wide stance */
  fillRR(-w/2-ww*0.26, -h*0.30, ww, wh, ww*0.4, "#0C0D10");
  fillRR( w/2-ww*0.74, -h*0.30, ww, wh, ww*0.4, "#0C0D10");
  fillRR(-w/2-ww*0.26,  h*0.15, ww, wh, ww*0.4, "#0C0D10");
  fillRR( w/2-ww*0.74,  h*0.15, ww, wh, ww*0.4, "#0C0D10");

  jetBody(w, h);
  ctx.fillStyle = p.body; ctx.fill();
  ctx.strokeStyle = "rgba(12,32,64,0.42)"; ctx.lineWidth = Math.max(1, w*0.03); ctx.stroke();

  ctx.save();
  jetBody(w, h); ctx.clip();
  ctx.fillStyle = p.trim;                              /* blue nose and sills */
  ctx.beginPath();
  ctx.moveTo(0, -h*0.56); ctx.lineTo(w*0.34, -h*0.16); ctx.lineTo(-w*0.34, -h*0.16);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(-w*0.52, -h*0.10, w*0.09, h*0.46);
  ctx.fillRect( w*0.43, -h*0.10, w*0.09, h*0.46);
  if(isPlayer){                                        /* twin stripes over the spine */
    ctx.fillRect(-w*0.135, -h*0.50, w*0.085, h);
    ctx.fillRect( w*0.05,  -h*0.50, w*0.085, h);
  }
  ctx.restore();

  fillRR(-w*0.30, -h*0.455, w*0.20, h*0.032, w*0.02, "#8FE3FF");   /* light bar */
  fillRR( w*0.10, -h*0.455, w*0.20, h*0.032, w*0.02, "#8FE3FF");

  fillRR(-w*0.32, -h*0.15, w*0.64, h*0.40, w*0.15, p.dark);        /* cabin */
  ctx.beginPath();                                                  /* windshield */
  ctx.moveTo(-w*0.26, -h*0.05); ctx.lineTo(w*0.26, -h*0.05);
  ctx.lineTo(w*0.20, -h*0.13);  ctx.lineTo(-w*0.20, -h*0.13);
  ctx.closePath(); ctx.fillStyle = p.glass; ctx.fill();
  ctx.beginPath();                                                  /* rear glass */
  ctx.moveTo(-w*0.23, h*0.13); ctx.lineTo(w*0.23, h*0.13);
  ctx.lineTo(w*0.19, h*0.21);  ctx.lineTo(-w*0.19, h*0.21);
  ctx.closePath(); ctx.fill();

  fillRR(-w*0.44, h*0.37, w*0.88, h*0.062, w*0.05, p.trim);        /* ducktail spoiler */
  fillRR(-w*0.34, h*0.385, w*0.20, h*0.032, w*0.02, "#8FE3FF");    /* tail lights */
  fillRR( w*0.14, h*0.385, w*0.20, h*0.032, w*0.02, "#8FE3FF");
  [-w*0.15, w*0.15].forEach(function(tx){                          /* exhaust tips */
    ctx.beginPath(); ctx.arc(tx, h*0.455, w*0.062, 0, 6.2832);
    ctx.fillStyle = p.dark; ctx.fill();
  });

  if(boosting) flames(w, h, p.flame[0], p.flame[1]);
}

/* Bolt: a short, wide, high-clearance buggy with an exposed roll cage */
function drawBuggy(w, h, p, isPlayer, boosting){
  fillRR(-w/2+3, -h/2+7, w*1.02, h*0.94, w*0.2, "rgba(0,0,0,0.42)");

  const ww = w*0.21, wh = h*0.19;                 /* fat knobbly tyres, well proud */
  fillRR(-w/2-ww*0.55, -h*0.33, ww, wh, ww*0.32, "#0C0D10");
  fillRR( w/2-ww*0.45, -h*0.33, ww, wh, ww*0.32, "#0C0D10");
  fillRR(-w/2-ww*0.55,  h*0.14, ww, wh, ww*0.32, "#0C0D10");
  fillRR( w/2-ww*0.45,  h*0.14, ww, wh, ww*0.32, "#0C0D10");
  ctx.fillStyle = "#3A3A3A";
  ctx.fillRect(-w/2-ww*0.5, -h*0.27, ww*0.9, wh*0.16);
  ctx.fillRect( w/2-ww*0.4, -h*0.27, ww*0.9, wh*0.16);
  ctx.fillRect(-w/2-ww*0.5,  h*0.20, ww*0.9, wh*0.16);
  ctx.fillRect( w/2-ww*0.4,  h*0.20, ww*0.9, wh*0.16);

  fillRR(-w*0.52, -h*0.40, w*1.04, h*0.80, w*0.10, p.body);   /* short wide tub */
  rr(-w*0.52, -h*0.40, w*1.04, h*0.80, w*0.10);
  ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = Math.max(1, w*0.035); ctx.stroke();

  ctx.fillStyle = p.dark;                                      /* hazard chevrons */
  for(let i=0;i<3;i++){
    ctx.save();
    ctx.beginPath();
    rr(-w*0.52, -h*0.40, w*1.04, h*0.80, w*0.10); ctx.clip();
    ctx.beginPath();
    const yy = -h*0.38 + i*h*0.27;
    ctx.moveTo(-w*0.52, yy + h*0.09); ctx.lineTo(0, yy);
    ctx.lineTo(w*0.52, yy + h*0.09);  ctx.lineTo(w*0.52, yy + h*0.15);
    ctx.lineTo(0, yy + h*0.06);       ctx.lineTo(-w*0.52, yy + h*0.15);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  fillRR(-w*0.48, -h*0.50, w*0.96, h*0.075, w*0.04, p.dark);   /* bull bar */
  fillRR(-w*0.36, -h*0.485, w*0.16, h*0.042, w*0.02, "#FFF3B0");
  fillRR( w*0.20, -h*0.485, w*0.16, h*0.042, w*0.02, "#FFF3B0");

  fillRR(-w*0.30, -h*0.20, w*0.60, h*0.40, w*0.09, p.dark);    /* open cockpit */
  fillRR(-w*0.25, -h*0.16, w*0.50, h*0.30, w*0.07, p.glass);
  ctx.strokeStyle = "#DADADA"; ctx.lineWidth = Math.max(1.4, w*0.045);
  ctx.beginPath();                                             /* roll cage */
  ctx.moveTo(-w*0.28, -h*0.18); ctx.lineTo(w*0.28, h*0.18); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w*0.28, -h*0.18); ctx.lineTo(-w*0.28, h*0.18); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w*0.30, h*0.02); ctx.lineTo(w*0.30, h*0.02); ctx.stroke();

  fillRR(-w*0.50, h*0.30, w*1.00, h*0.085, w*0.045, p.dark);   /* high rear wing */
  ctx.fillStyle = p.body;
  ctx.fillRect(-w*0.10, h*0.24, w*0.06, h*0.10);
  ctx.fillRect( w*0.04, h*0.24, w*0.06, h*0.10);
  fillRR(-w*0.40, h*0.42, w*0.18, h*0.038, w*0.02, "#FF6A3A");
  fillRR( w*0.22, h*0.42, w*0.18, h*0.038, w*0.02, "#FF6A3A");

  if(boosting) flames(w, h, p.flame[0], p.flame[1]);
}

/* Timestamp: a hard-edged wedge, all straight lines and sharp corners */
function wedgePath(w, h){
  ctx.beginPath();
  ctx.moveTo(0, -h*0.52);
  ctx.lineTo(w*0.38, -h*0.10);
  ctx.lineTo(w*0.46,  h*0.30);
  ctx.lineTo(w*0.40,  h*0.50);
  ctx.lineTo(-w*0.40, h*0.50);
  ctx.lineTo(-w*0.46, h*0.30);
  ctx.lineTo(-w*0.38, -h*0.10);
  ctx.closePath();
}
function drawWedge(w, h, p, isPlayer, boosting){
  ctx.save(); ctx.translate(3, 7);
  wedgeShell(w, h); ctx.fillStyle = "rgba(0,0,0,0.42)"; ctx.fill();
  ctx.restore();

  const ww = w*0.155, wh = h*0.15;
  fillRR(-w*0.44-ww*0.5, -h*0.31, ww, wh, ww*0.4, "#0C0D10");
  fillRR( w*0.44-ww*0.5, -h*0.31, ww, wh, ww*0.4, "#0C0D10");
  fillRR(-w*0.46-ww*0.5,  h*0.14, ww, wh, ww*0.4, "#0C0D10");
  fillRR( w*0.46-ww*0.5,  h*0.14, ww, wh, ww*0.4, "#0C0D10");

  wedgeShell(w, h);
  ctx.fillStyle = p.body; ctx.fill();
  ctx.strokeStyle = "rgba(4,20,12,0.45)"; ctx.lineWidth = Math.max(1, w*0.03); ctx.stroke();

  ctx.save(); wedgeShell(w, h); ctx.clip();
  ctx.fillStyle = p.dark;                                /* black bonnet and roof band */
  ctx.beginPath();
  ctx.moveTo(-w*0.30, -h*0.52); ctx.lineTo(w*0.30, -h*0.52);
  ctx.lineTo(w*0.24, -h*0.28);  ctx.lineTo(-w*0.24, -h*0.28);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(-w*0.48, h*0.24, w*0.96, h*0.10);
  if(isPlayer){ ctx.fillStyle = p.trim; ctx.fillRect(-w*0.045, -h*0.52, w*0.09, h*1.04); }
  ctx.restore();

  fillRR(-w*0.34, -h*0.52, w*0.68, h*0.05, w*0.025, p.dark);       /* front splitter */
  fillRR(-w*0.30, -h*0.508, w*0.16, h*0.030, w*0.015, "#D6FFE9");  /* slim headlights */
  fillRR( w*0.14, -h*0.508, w*0.16, h*0.030, w*0.015, "#D6FFE9");

  fillRR(-w*0.32, -h*0.24, w*0.64, h*0.44, w*0.12, p.dark);        /* cabin */
  ctx.beginPath();                                                  /* raked windscreen */
  ctx.moveTo(-w*0.26, -h*0.11); ctx.lineTo(w*0.26, -h*0.11);
  ctx.lineTo(w*0.19, -h*0.21);  ctx.lineTo(-w*0.19, -h*0.21);
  ctx.closePath(); ctx.fillStyle = p.glass; ctx.fill();
  ctx.beginPath();                                                  /* fastback glass */
  ctx.moveTo(-w*0.25, h*0.05); ctx.lineTo(w*0.25, h*0.05);
  ctx.lineTo(w*0.20, h*0.16);  ctx.lineTo(-w*0.20, h*0.16);
  ctx.closePath(); ctx.fill();

  ctx.beginPath();                                                  /* clock badge */
  ctx.arc(0, -h*0.37, w*0.085, 0, 6.2832);
  ctx.fillStyle = p.dark; ctx.fill();
  ctx.strokeStyle = p.trim; ctx.lineWidth = Math.max(1.4, w*0.028);
  ctx.beginPath(); ctx.arc(0, -h*0.37, w*0.085, 0, 6.2832); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -h*0.405); ctx.lineTo(0, -h*0.37); ctx.lineTo(w*0.05, -h*0.352);
  ctx.stroke();

  fillRR(-w*0.44, h*0.40, w*0.88, h*0.06, w*0.028, p.dark);         /* ducktail */
  fillRR(-w*0.36, h*0.415, w*0.72, h*0.028, w*0.014, "#3FD98A");    /* full-width bar */

  if(boosting) flames(w, h, p.flame[0], p.flame[1]);
}
function wedgeShell(w, h){
  /* long, low and straight-sided, tapering to a narrow fastback tail */
  ctx.beginPath();
  ctx.moveTo(-w*0.30, -h*0.54);
  ctx.lineTo( w*0.30, -h*0.54);
  ctx.quadraticCurveTo( w*0.46, -h*0.50,  w*0.47, -h*0.26);
  ctx.lineTo( w*0.48, h*0.16);
  ctx.quadraticCurveTo( w*0.47, h*0.46,  w*0.34, h*0.54);
  ctx.lineTo(-w*0.34, h*0.54);
  ctx.quadraticCurveTo(-w*0.47, h*0.46, -w*0.48, h*0.16);
  ctx.lineTo(-w*0.47, -h*0.26);
  ctx.quadraticCurveTo(-w*0.46, -h*0.50, -w*0.30, -h*0.54);
  ctx.closePath();
}

/* Rose: soft and round, petal shapes worked into the bodywork */
function drawCoupe(w, h, p, isPlayer, boosting){
  ctx.save(); ctx.translate(3, 7);
  coupeShell(w, h); ctx.fillStyle = "rgba(0,0,0,0.42)"; ctx.fill();
  ctx.restore();

  const ww = w*0.16, wh = h*0.155;                    /* four wheels, wide rear track */
  fillRR(-w*0.42-ww*0.5, -h*0.30, ww, wh, ww*0.42, "#0C0D10");
  fillRR( w*0.42-ww*0.5, -h*0.30, ww, wh, ww*0.42, "#0C0D10");
  fillRR(-w*0.50-ww*0.5,  h*0.15, ww, wh, ww*0.42, "#0C0D10");
  fillRR( w*0.50-ww*0.5,  h*0.15, ww, wh, ww*0.42, "#0C0D10");

  coupeShell(w, h);
  ctx.fillStyle = p.body; ctx.fill();
  ctx.strokeStyle = "rgba(24,6,34,0.45)"; ctx.lineWidth = Math.max(1, w*0.03); ctx.stroke();

  ctx.save(); coupeShell(w, h); ctx.clip();
  ctx.fillStyle = p.trim;                             /* pink flanks and a centre stripe */
  ctx.fillRect(-w*0.54, -h*0.06, w*0.10, h*0.40);
  ctx.fillRect( w*0.44, -h*0.06, w*0.10, h*0.40);
  if(isPlayer) ctx.fillRect(-w*0.05, -h*0.54, w*0.10, h*1.08);
  ctx.restore();

  fillRR(-w*0.40, -h*0.50, w*0.80, h*0.055, w*0.03, p.dark);      /* front bumper */
  fillRR(-w*0.33, -h*0.487, w*0.17, h*0.033, w*0.016, "#FFF0FA"); /* headlights */
  fillRR( w*0.16, -h*0.487, w*0.17, h*0.033, w*0.016, "#FFF0FA");

  fillRR(-w*0.33, -h*0.26, w*0.66, h*0.46, w*0.14, p.dark);       /* glasshouse */
  ctx.beginPath();                                                 /* windscreen */
  ctx.moveTo(-w*0.27, -h*0.13); ctx.lineTo(w*0.27, -h*0.13);
  ctx.lineTo(w*0.22, -h*0.22);  ctx.lineTo(-w*0.22, -h*0.22);
  ctx.closePath(); ctx.fillStyle = p.glass; ctx.fill();
  ctx.beginPath();                                                 /* rear glass */
  ctx.moveTo(-w*0.25, h*0.06); ctx.lineTo(w*0.25, h*0.06);
  ctx.lineTo(w*0.21, h*0.15);  ctx.lineTo(-w*0.21, h*0.15);
  ctx.closePath(); ctx.fill();

  ctx.beginPath();                                                 /* bloom badge */
  for(let i=0;i<5;i++){
    const a = -1.5708 + (i/5)*6.2832;
    ctx.moveTo(0, -h*0.36);
    ctx.arc(Math.cos(a)*w*0.075, -h*0.36 + Math.sin(a)*h*0.042, w*0.055, 0, 6.2832);
  }
  ctx.fillStyle = p.trim; ctx.fill();
  ctx.beginPath(); ctx.arc(0, -h*0.36, w*0.036, 0, 6.2832);
  ctx.fillStyle = "#FFF0FA"; ctx.fill();

  fillRR(-w*0.42, h*0.40, w*0.84, h*0.065, w*0.03, p.dark);        /* boot lid */
  fillRR(-w*0.34, h*0.415, w*0.19, h*0.034, w*0.016, "#FFD9F2");
  fillRR( w*0.15, h*0.415, w*0.19, h*0.034, w*0.016, "#FFD9F2");

  if(boosting) flames(w, h, p.flame[0], p.flame[1]);
}
function coupeShell(w, h){
  /* a car: rounded nose, straight doors, full hips over the rear wheels */
  ctx.beginPath();
  ctx.moveTo(-w*0.22, -h*0.52);
  ctx.lineTo( w*0.22, -h*0.52);
  ctx.quadraticCurveTo( w*0.42, -h*0.50,  w*0.44, -h*0.30);
  ctx.lineTo( w*0.46, h*0.10);
  ctx.quadraticCurveTo( w*0.50, h*0.44,  w*0.30, h*0.52);
  ctx.lineTo(-w*0.30, h*0.52);
  ctx.quadraticCurveTo(-w*0.50, h*0.44, -w*0.46, h*0.10);
  ctx.lineTo(-w*0.44, -h*0.30);
  ctx.quadraticCurveTo(-w*0.42, -h*0.50, -w*0.22, -h*0.52);
  ctx.closePath();
}
/* Siren: a big square patrol cruiser with a light bar across the roof */
function drawCruiser(w, h, p, isPlayer, boosting){
  /* Siren: a long, square patrol sedan - notched three-box shape, push bar
     at the front, and a light bar across the roof. */
  fillRR(-w/2+3, -h*0.54+7, w*1.02, h*1.08, w*0.08, "rgba(0,0,0,0.44)");

  const ww = w*0.18, wh = h*0.16;
  fillRR(-w/2-ww*0.30, -h*0.32, ww, wh, ww*0.3, "#0C0D10");
  fillRR( w/2-ww*0.70, -h*0.32, ww, wh, ww*0.3, "#0C0D10");
  fillRR(-w/2-ww*0.30,  h*0.16, ww, wh, ww*0.3, "#0C0D10");
  fillRR( w/2-ww*0.70,  h*0.16, ww, wh, ww*0.3, "#0C0D10");

  fillRR(-w*0.46, -h*0.54, w*0.92, h*1.08, w*0.07, p.body);   /* long square body */
  rr(-w*0.46, -h*0.54, w*0.92, h*1.08, w*0.07);
  ctx.strokeStyle = "rgba(0,0,0,0.42)"; ctx.lineWidth = Math.max(1, w*0.032); ctx.stroke();

  ctx.save(); rr(-w*0.46, -h*0.54, w*0.92, h*1.08, w*0.07); ctx.clip();
  ctx.fillStyle = p.dark;                                    /* black door panels */
  ctx.fillRect(-w*0.46, -h*0.10, w*0.92, h*0.34);
  ctx.fillStyle = p.body;
  ctx.fillRect(-w*0.30, -h*0.06, w*0.60, h*0.10);            /* white shield block */
  ctx.restore();

  fillRR(-w*0.52, -h*0.58, w*1.04, h*0.055, w*0.02, p.dark);  /* push bar */
  ctx.fillStyle = p.dark;
  ctx.fillRect(-w*0.30, -h*0.60, w*0.045, h*0.10);
  ctx.fillRect( w*0.26, -h*0.60, w*0.045, h*0.10);
  fillRR(-w*0.36, -h*0.50, w*0.18, h*0.035, w*0.015, "#FFF3D0");
  fillRR( w*0.18, -h*0.50, w*0.18, h*0.035, w*0.015, "#FFF3D0");

  fillRR(-w*0.34, -h*0.30, w*0.68, h*0.20, w*0.05, p.dark);   /* three-box cabin */
  fillRR(-w*0.29, -h*0.27, w*0.58, h*0.13, w*0.03, p.glass);
  fillRR(-w*0.34,  h*0.18, w*0.68, h*0.18, w*0.05, p.dark);
  fillRR(-w*0.29,  h*0.21, w*0.58, h*0.11, w*0.03, p.glass);

  /* The light bar. A real patrol car does not run one lamp at a time with the
     other dead - both halves are lit and they alternate which one is at full
     brightness, so the bar reads as on the whole time it is on. The old
     version left one side unlit on every beat, which looked like a fault. */
  const lit = G.state === "running" &&
              ((G.ultOn && G.car === "siren") ||
               G.rivals.some(function(R){ return R.car === "siren" && R.ultOn; }));
  const beat = Math.floor(G.scroll*0.05) % 2 === 0;
  fillRR(-w*0.40, -h*0.08, w*0.80, h*0.075, w*0.02, p.dark);  /* roof light bar */
  fillRR(-w*0.37, -h*0.068, w*0.34, h*0.05, w*0.015,
         lit ? (beat ? "#BBD8FF" : "#5E8FD8") : "#2B4E8C");
  fillRR( w*0.03, -h*0.068, w*0.34, h*0.05, w*0.015,
         lit ? (beat ? "#D8666B" : "#FFB9BC") : "#8C2B2F");
  if(lit){
    /* both lamps throw, the leading one harder, so the roof is never dark */
    const blueA = beat ? 0.42 : 0.20, redA = beat ? 0.20 : 0.42;
    ctx.globalAlpha = blueA;
    ctx.beginPath(); ctx.arc(-w*0.20, -h*0.045, w*(beat ? 0.56 : 0.40), 0, 6.2832);
    ctx.fillStyle = "#4D8BFF"; ctx.fill();
    ctx.globalAlpha = redA;
    ctx.beginPath(); ctx.arc( w*0.20, -h*0.045, w*(beat ? 0.40 : 0.56), 0, 6.2832);
    ctx.fillStyle = "#FF4A50"; ctx.fill();
    ctx.globalAlpha = 0.9;                                    /* hot centres */
    ctx.beginPath(); ctx.arc(-w*0.20, -h*0.045, w*0.07, 0, 6.2832);
    ctx.fillStyle = "#EAF2FF"; ctx.fill();
    ctx.beginPath(); ctx.arc( w*0.20, -h*0.045, w*0.07, 0, 6.2832);
    ctx.fillStyle = "#FFECED"; ctx.fill();
    ctx.globalAlpha = 1;
  }

  fillRR(-w*0.46, h*0.44, w*0.92, h*0.06, w*0.02, p.dark);
  fillRR(-w*0.36, h*0.452, w*0.20, h*0.034, w*0.015, "#FF4A50");
  fillRR( w*0.16, h*0.452, w*0.20, h*0.034, w*0.015, "#FF4A50");

  if(boosting) flames(w, h, p.flame[0], p.flame[1]);
}

const ROOF = ["#22242A", "#1A1C21", "#2B2E35"];
const ROCK = ["#B08A5E", "#9C7550", "#C4A277"];

/* ---- side scenery: one silhouette per track ---- */
function roofBlock(b, x0, bw){
  ctx.fillStyle = ROOF[b.tone];
  ctx.fillRect(x0, b.y, bw, b.h);
  ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(x0, b.y, bw, 3);
  ctx.fillStyle = "rgba(0,0,0,0.35)";       ctx.fillRect(x0, b.y + b.h - 4, bw, 4);
  ctx.fillStyle = "rgba(255,255,255,0.045)";
  for(let v=0; v<3; v++){
    const vy = b.y + 16 + v*(b.h-32)/3 + b.s*10;
    if(vy > b.y+6 && vy < b.y+b.h-14) ctx.fillRect(x0+bw*0.18, vy, bw*0.28, 8);
  }
  const cx = x0 + bw/2;
  if(b.tank && b.h > 110){
    ctx.beginPath(); ctx.arc(cx + bw*0.18, b.y + b.h*0.62, Math.min(bw*0.16, 13), 0, 6.2832);
    ctx.fillStyle = "#3A3D44"; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 2; ctx.stroke();
  }
  if(b.extra && b.h > 150){
    ctx.beginPath(); ctx.arc(cx, b.y + b.h*0.4, Math.min(bw*0.3, 20), 0, 6.2832);
    ctx.strokeStyle = "rgba(226,27,34,0.75)"; ctx.lineWidth = 3; ctx.stroke();
  }
}

function rockBlock(b, x0, bw){
  const pad = bw*0.05, r = Math.min(bw*0.34, 26);
  fillRR(x0+pad+3, b.y+9, bw-pad*2, b.h-14, r, "rgba(120,92,58,0.35)");
  fillRR(x0+pad,   b.y,   bw-pad*2, b.h-10, r, ROCK[b.tone]);
  fillRR(x0+pad+bw*0.10, b.y + b.h*0.10, (bw-pad*2)*0.52, (b.h-10)*0.38, r*0.7, "rgba(255,255,255,0.12)");
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  for(let i=0;i<2;i++){
    const yy = b.y + b.h*(0.42 + i*0.26) + b.s*10;
    if(yy > b.y+8 && yy < b.y+b.h-16) ctx.fillRect(x0+pad+bw*0.16, yy, (bw-pad*2)*0.58, 3);
  }
  if(b.tank && b.h > 120){
    ctx.beginPath(); ctx.arc(x0+bw*0.5, b.y+b.h*0.72, Math.min(bw*0.14, 9), 0, 6.2832);
    ctx.fillStyle = "#8A6A46"; ctx.fill();
  }
}

function starBlock(b, x0, bw){
  for(let i=0;i<9;i++){
    const f = (b.s*97.3 + i*37.77) % 1, g2 = (b.s*53.1 + i*61.31) % 1;
    const x = x0 + 3 + f*(bw-6), y = b.y + g2*b.h;
    if(y < CT-4 || y > CB+4) continue;
    ctx.beginPath(); ctx.arc(x, y, 0.7 + ((f*g2*7) % 1)*1.5, 0, 6.2832);
    ctx.fillStyle = i % 4 === 0 ? "rgba(178,200,255,0.9)" : "rgba(255,255,255," + (0.32 + f*0.5).toFixed(2) + ")";
    ctx.fill();
  }
}

function drawSide(s, id){
  const arr = G.build[s];
  const x0 = s === 0 ? 0 : roadX + roadW + sideW;
  const bw = s === 0 ? roadX - sideW : W - x0;
  if(bw <= 2) return;
  for(let i=0;i<arr.length;i++){
    const b = arr[i];
    if(b.b !== id || b.y > CB+10 || b.y + b.h < CT-10) continue;
    if(id === "city") roofBlock(b, x0, bw);
    else if(id === "desert") rockBlock(b, x0, bw);
    else starBlock(b, x0, bw);
  }
}

/* ---- roadside props ---- */
function drawProps(id){
  if(id === "space") return;          /* the void stays empty apart from stars */
  for(let i=0;i<G.props.length;i++){
    const p = G.props[i];
    if(p.b !== id || p.y < CT-30 || p.y > CB+30) continue;
    const cx = p.side === 0 ? roadX - sideW/2 : roadX + roadW + sideW/2;
    const rad = Math.min(sideW*0.38, 11);
    if(id === "city"){
      if(p.kind === 0){
        fillRR(cx-3, p.y-6, 6, 12, 3, "#E21B22");
        fillRR(cx-5, p.y-2, 10, 3, 1.5, "#B3151B");
      } else if(p.kind === 1){
        ctx.beginPath(); ctx.arc(cx, p.y, rad, 0, 6.2832); ctx.fillStyle = "#5C6B58"; ctx.fill();
        ctx.beginPath(); ctx.arc(cx-2, p.y-2, rad*0.45, 0, 6.2832); ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(cx, p.y, rad*0.7, 0, 6.2832); ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fill();
      }
    } else if(id === "desert"){
      if(p.kind === 0){                                   /* cactus */
        fillRR(cx-3.5, p.y-10, 7, 20, 3.5, "#5F7A55");
        fillRR(cx-9, p.y-3, 5.5, 10, 2.7, "#546D4B");
        fillRR(cx+3.5, p.y-7, 5.5, 11, 2.7, "#546D4B");
      } else if(p.kind === 1){                            /* shoulder marker */
        fillRR(cx-2, p.y-7, 4, 14, 2, "#EDEEF1");
        fillRR(cx-2, p.y-7, 4, 5, 2, "#E21B22");
      } else {                                            /* scrub */
        ctx.fillStyle = "rgba(120,96,60,0.5)";
        for(let k=0;k<4;k++){
          const a = p.s*6.28 + k*1.57;
          ctx.beginPath(); ctx.arc(cx + Math.cos(a)*5, p.y + Math.sin(a)*5, 2.6, 0, 6.2832); ctx.fill();
        }
      }
    }
  }
}

/* ---- road surface, markings, crossings ---- */
function drawRoad(id, T){
  ctx.fillStyle = T.road; ctx.fillRect(roadX, CT, roadW, CB - CT);
  if(id === "space"){
    const bh = 58, per = bh*RAINBOW.length, base = perTop(-(G.scroll % per), per) - per;
    ctx.globalAlpha = 0.52;
    for(let i=0; base + i*bh < CB; i++){
      const y = base + i*bh;
      if(y + bh < CT) continue;
      ctx.fillStyle = RAINBOW[((i % RAINBOW.length) + RAINBOW.length) % RAINBOW.length];
      ctx.fillRect(roadX, y, roadW, bh+1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(6,6,14,0.36)"; ctx.fillRect(roadX, CT, roadW, CB - CT);
    return;
  }
  const gap = 190, off = G.scroll % gap;
  ctx.fillStyle = id === "desert" ? "rgba(216,190,146,0.06)" : "rgba(255,255,255,0.028)";
  for(let y = perTop(off, gap) - gap; y < CB; y += gap) ctx.fillRect(roadX, y, roadW, 2);
  if(id === "desert"){
    const p = 330, o2 = G.scroll % p;
    ctx.fillStyle = "rgba(214,188,144,0.14)";
    for(let y = perTop(o2, p) - p; y < CB; y += p){
      ctx.fillRect(roadX, y, roadW*0.2, 58);
      ctx.fillRect(roadX + roadW*0.74, y + 150, roadW*0.26, 42);
    }
  }
}

function drawEdges(id, T){
  if(id === "space"){
    const vh = CB - CT;
    ctx.fillStyle = "rgba(92,225,230,0.16)";
    ctx.fillRect(roadX-10, CT, 10, vh); ctx.fillRect(roadX+roadW, CT, 10, vh);
    ctx.fillStyle = T.shoulder;
    ctx.fillRect(roadX-4, CT, 4, vh); ctx.fillRect(roadX+roadW, CT, 4, vh);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(roadX-2.5, CT, 1.5, vh); ctx.fillRect(roadX+roadW+1, CT, 1.5, vh);
  } else {
    ctx.fillStyle = T.shoulder;
    ctx.fillRect(roadX-4, CT, 4, CB - CT); ctx.fillRect(roadX+roadW, CT, 4, CB - CT);
  }
}

function drawMarks(id, T){
  const dash = 46, gap = 44, per = dash+gap, d0 = G.scroll % per;
  ctx.fillStyle = T.mark;
  for(let l=1;l<3;l++){
    const lx = roadX + laneW*l - 2.5;
    for(let y = perTop(d0, per) - per; y < CB; y += per) ctx.fillRect(lx, y, 5, dash);
  }
  if(id !== "space"){
    ctx.fillStyle = T.edge;
    ctx.fillRect(roadX + 7, CT, 3, CB - CT);
    ctx.fillRect(roadX + roadW - 10, CT, 3, CB - CT);
  }
}

/* only the city has anything crossing the road */
function drawFeatures(id){
  if(id !== "city") return;
  for(let i=0;i<G.walks.length;i++){
    const f = G.walks[i];
    if(f.b !== id || f.y < CT-70 || f.y > CB+10) continue;
    ctx.fillStyle = "rgba(237,238,241,0.82)";
    const n = 7, sw2 = roadW/(n*2-1);
    for(let k=0;k<n;k++) ctx.fillRect(roadX + k*sw2*2, f.y, sw2, 46);
  }
}

/* ---- how each hazard looks ---- */
function smoothPath(pts){
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[0].x + pts[n-1].x)/2, (pts[0].y + pts[n-1].y)/2);
  for(let i=0;i<n;i++){
    const a = pts[i], b = pts[(i+1) % n];
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x)/2, (a.y + b.y)/2);
  }
  ctx.closePath();
}
function puddlePath(p, k){
  const n = 11, pts = [];
  for(let i=0;i<n;i++){
    const a = (i/n)*6.2832;
    const j = 0.68 + ((p.s*131.7 + i*47.31) % 1)*0.56;
    pts.push({ x:p.x + Math.cos(a)*p.rx*j*k, y:p.y + Math.sin(a)*p.ry*j*k });
  }
  smoothPath(pts);
}
function drawPuddle(p){
  ctx.save();
  puddlePath(p, 1.0);
  ctx.fillStyle = "rgba(28,86,150,0.66)"; ctx.fill();
  puddlePath(p, 0.66);
  ctx.fillStyle = "rgba(16,54,104,0.58)"; ctx.fill();
  ctx.beginPath();
  if(ctx.ellipse) ctx.ellipse(p.x - p.rx*0.24, p.y - p.ry*0.28, p.rx*0.36, p.ry*0.19, -0.35, 0, 6.2832);
  else ctx.arc(p.x - p.rx*0.24, p.y - p.ry*0.28, p.rx*0.28, 0, 6.2832);
  ctx.fillStyle = "rgba(150,208,246,0.42)"; ctx.fill();
  ctx.beginPath();
  if(ctx.ellipse) ctx.ellipse(p.x + p.rx*0.30, p.y + p.ry*0.24, p.rx*0.17, p.ry*0.10, 0.4, 0, 6.2832);
  else ctx.arc(p.x + p.rx*0.30, p.y + p.ry*0.24, p.rx*0.12, 0, 6.2832);
  ctx.fillStyle = "rgba(150,208,246,0.24)"; ctx.fill();
  puddlePath(p, 1.0);
  ctx.strokeStyle = "rgba(126,196,244,0.5)"; ctx.lineWidth = 1.6; ctx.stroke();
  for(let i=0;i<2;i++){
    const a = p.s*6.28 + i*2.4;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(a)*p.rx*1.35, p.y + Math.sin(a)*p.ry*1.4, 2.4 + ((p.s*17 + i) % 1)*2.6, 0, 6.2832);
    ctx.fillStyle = "rgba(28,86,150,0.55)"; ctx.fill();
  }
  ctx.restore();
}

/* A rock on the way down, the ground it is aimed at, and the crater after. */
function drawMeteor(o){
  if(o.phase === 0){
    const prog = clamp(1 - o.fall/Math.max(0.01, o.max), 0, 1);
    const per = lerp(0.46, 0.13, prog);
    const on = (o.t % per) < per*0.55;

    ctx.save();
    ctx.globalAlpha = on ? 0.30 : 0.12;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.2832);
    ctx.fillStyle = "#E21B22"; ctx.fill();
    ctx.globalAlpha = on ? 0.95 : 0.38;
    ctx.strokeStyle = "#E21B22"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = 0.8;                                   /* ring closing on impact */
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(o.x, o.y, 3 + o.r*(1 - prog)*0.9, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    if(o.fall < rockLead(o)){
      const k = clamp(o.fall/rockLead(o), 0, 1);
      const alt = rockAlt(o), sc = 1 + k*0.5;
      const mx = o.x, my = o.y - alt, mr = o.mr*sc;

      ctx.save();
      ctx.globalAlpha = 0.14 + (1-k)*0.3;                    /* shadow closing in */
      ctx.beginPath();
      if(ctx.ellipse) ctx.ellipse(o.x, o.y, o.mr*(0.45 + (1-k)*0.6), o.mr*(0.3 + (1-k)*0.4), 0, 0, 6.2832);
      else ctx.arc(o.x, o.y, o.mr*(0.45 + (1-k)*0.6), 0, 6.2832);
      ctx.fillStyle = "#000"; ctx.fill();
      ctx.globalAlpha = 1;

      const len = 95 + 80*k;                                 /* fire trail */
      const g2 = ctx.createLinearGradient(mx, my - len, mx, my);
      g2.addColorStop(0, "rgba(255,120,40,0)");
      g2.addColorStop(1, "rgba(255,176,74,0.8)");
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(mx - mr*0.8, my); ctx.lineTo(mx, my - len); ctx.lineTo(mx + mr*0.8, my);
      ctx.closePath(); ctx.fill();

      ctx.beginPath();                                       /* glow */
      ctx.arc(mx, my, mr*1.7, 0, 6.2832);
      ctx.fillStyle = "rgba(255,140,50,0.22)"; ctx.fill();

      ctx.beginPath();                                       /* the rock */
      for(let i=0;i<9;i++){
        const a = (i/9)*6.2832;
        const rr = mr*(0.72 + ((o.s*83.1 + i*37.7) % 1)*0.5);
        const px = mx + Math.cos(a)*rr, py = my + Math.sin(a)*rr;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = "#2B2530"; ctx.fill();
      ctx.strokeStyle = "rgba(255,150,60,0.75)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(mx - mr*0.15, my - mr*0.1, mr*0.42, 0, 6.2832);
      ctx.fillStyle = "#FFCE86"; ctx.fill();
      ctx.restore();
    }
    return;
  }

  if(o.phase === 1){
    const k = clamp(o.t/0.4, 0, 1), rr = o.r*(0.4 + k*1.1);
    ctx.save();
    ctx.globalAlpha = (1-k)*0.8;
    ctx.beginPath(); ctx.arc(o.x, o.y, rr, 0, 6.2832);
    ctx.fillStyle = "#FFA24E"; ctx.fill();
    ctx.globalAlpha = 1-k;
    ctx.strokeStyle = "#FFE7C0"; ctx.lineWidth = 3 + (1-k)*6;
    ctx.beginPath(); ctx.arc(o.x, o.y, rr, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = Math.max(0, 1 - k*2.3);
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r*0.55*(1 - k*0.5), 0, 6.2832);
    ctx.fillStyle = "#FFFFFF"; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  const k = clamp(o.t/1.6, 0, 1);                            /* scorched ground */
  ctx.save();
  ctx.globalAlpha = 0.6*(1-k);
  ctx.fillStyle = "#0E0A12"; blob(o.x, o.y, o.r*0.78, o.s);
  ctx.globalAlpha = 0.32*(1-k);
  ctx.fillStyle = "#C6482A"; blob(o.x, o.y, o.r*0.4, o.s + 0.3);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawWeed(o){
  const a = Math.min(1, o.age/0.45);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath();
  if(ctx.ellipse) ctx.ellipse(o.x + 3, o.y + o.r*0.55, o.r*0.92, o.r*0.34, 0, 0, 6.2832);
  else ctx.arc(o.x + 3, o.y + o.r*0.55, o.r*0.6, 0, 6.2832);
  ctx.fillStyle = "rgba(60,44,22,0.24)"; ctx.fill();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.rot);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#8E7043"; ctx.lineWidth = 2.1;
  for(let i=0;i<9;i++){
    const ang = (i/9)*6.2832 + ((o.s*77.3 + i*13.71) % 1)*0.55;
    const rr = o.r*(0.5 + ((o.s*41.1 + i*29.13) % 1)*0.52);
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang)*rr*0.12, Math.sin(ang)*rr*0.12);
    ctx.lineTo(Math.cos(ang)*rr, Math.sin(ang)*rr);
    ctx.lineTo(Math.cos(ang + 0.75)*rr*0.72, Math.sin(ang + 0.75)*rr*0.72);
    ctx.stroke();
  }
  ctx.strokeStyle = "#C2A067"; ctx.lineWidth = 1.4;
  for(let i=0;i<3;i++){
    ctx.beginPath(); ctx.arc(0, 0, o.r*(0.62 + i*0.16), i*1.7, i*1.7 + 4.2); ctx.stroke();
  }
  ctx.restore();
}

/* How far above its own mark a trap actually puts ink on the screen. Only the
   meteor reaches: the rock comes in three hundred pixels up with a fire trail
   above that again, so a cull that read the ring alone threw the rock away on
   any screen whose window the landing spot had already left. That is never
   player one - the mark is always at or above their row - which is the whole
   reason this only ever showed up on somebody else's half of the split. */
function trapReach(o){
  return o.kind === "meteor" ? METEOR_ALT + 190 + o.mr*1.6 : 40;
}
function drawTraps(id){
  for(let i=0;i<G.traps.length;i++){
    const o = G.traps[i];
    if(o.b !== id) continue;
    const up = trapReach(o), down = (o.r || o.ry || 0) + 60;
    if(o.y - up > CB || o.y + down < CT) continue;
    if(o.kind === "puddle") drawPuddle(o);
    else if(o.kind === "meteor") drawMeteor(o);
    else drawWeed(o);
  }
}

/* ---- the meeting point of two tracks ---- */
function seamClip(above){
  const p = G.seamPts;
  if(!p.length) buildSeamShape();
  const n = G.seamPts.length, y = G.seam, far = above ? CT - 900 : CB + 900;
  ctx.beginPath();
  ctx.moveTo(0, far);
  ctx.lineTo(0, y + G.seamPts[0].o);
  for(let i=0;i<n-1;i++){
    const mx = (G.seamPts[i].x + G.seamPts[i+1].x)/2;
    const my = y + (G.seamPts[i].o + G.seamPts[i+1].o)/2;
    ctx.quadraticCurveTo(G.seamPts[i].x, y + G.seamPts[i].o, mx, my);
  }
  ctx.lineTo(W, y + G.seamPts[n-1].o);
  ctx.lineTo(W, far);
  ctx.closePath();
  ctx.clip();
}

function drawGroundLayer(id, mode){
  ctx.save();
  if(mode) seamClip(mode === "above");
  ctx.fillStyle = TRACKS[id].ground;
  ctx.fillRect(0, CT, W, CB - CT);
  ctx.restore();
}

function drawWorldLayer(id, mode){
  const T = TRACKS[id];
  ctx.save();
  if(mode) seamClip(mode === "above");
  drawSide(0, id); drawSide(1, id);
  drawRoad(id, T);
  drawEdges(id, T);
  drawMarks(id, T);
  drawFeatures(id);
  drawFinish();
  drawTraps(id);
  drawProps(id);
  ctx.restore();
}

function blob(x, y, r, s){
  ctx.beginPath();
  for(let i=0;i<7;i++){
    const a = (i/7)*6.2832;
    const rr2 = r*(0.6 + ((s*97.1 + i*29.37) % 1)*0.66);
    const px = x + Math.cos(a)*rr2, py = y + Math.sin(a)*rr2*0.7;
    if(i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/* each ground creeps into the other before giving way completely */
function drawBlend(){
  const oldG = TRACKS[G.biome].ground, newG = TRACKS[G.next].ground;
  for(let i=0;i<G.seamBits.length;i++){
    const b = G.seamBits[i];
    const y = G.seam + b.dy;
    if(y < CT-50 || y > CB+50) continue;
    const f = 1 - Math.abs(b.dy)/190;
    if(f <= 0.02) continue;
    ctx.globalAlpha = 0.1 + f*0.85;
    ctx.fillStyle = b.dy < 0 ? oldG : newG;
    blob(b.x, y, b.r*(0.4 + f*0.8), b.s);
  }
  ctx.globalAlpha = 1;
}

/* the driving surface changes over a stretch rather than at a step */
function drawRoadFade(){
  const oldR = TRACKS[G.biome].road, newR = TRACKS[G.next].road, y = G.seam, d = 84;
  const down = ctx.createLinearGradient(0, y, 0, y + d);
  down.addColorStop(0, withA(newR, 0.5)); down.addColorStop(1, withA(newR, 0));
  ctx.fillStyle = down; ctx.fillRect(roadX, y, roadW, d);
  const up = ctx.createLinearGradient(0, y, 0, y - d);
  up.addColorStop(0, withA(oldR, 0.5)); up.addColorStop(1, withA(oldR, 0));
  ctx.fillStyle = up; ctx.fillRect(roadX, y - d, roadW, d);
}

/* One frame. In a normal game that is one view of the world; in local play it
   is one view per person, cut into equal columns and each shifted so its own
   car sits where player one's sits in theirs. */
let shakeX = 0, shakeY = 0;
function render(){
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, FULLW || W, H);
  if(G.shake > 0.2){
    shakeX = rand(-G.shake, G.shake)*0.5;
    shakeY = rand(-G.shake, G.shake)*0.5;
  } else shakeX = shakeY = 0;
  if(!G.local || G.humans.length < 2){
    VOWN = "me";
    renderView(0);
    return;
  }
  for(let i=0;i<G.humans.length;i++){
    const who = G.humans[i];
    ctx.save();
    ctx.beginPath(); ctx.rect(i*W, 0, W, H); ctx.clip();
    ctx.translate(i*W, 0);
    VOWN = who;
    renderView(camDy(who));
    drawSeatHud(who, i);
    ctx.restore();
  }
  VOWN = "me"; CAMDY = 0; CT = 0; CB = H;
  drawSplitEdges();
}

function renderView(dy){
  CAMDY = dy; CT = -dy; CB = -dy + H;
  ctx.save();
  if(shakeX || shakeY) ctx.translate(shakeX, shakeY);
  ctx.save();
  ctx.translate(0, dy);          /* out of the master frame and into this one */

  if(G.seam === null){
    drawGroundLayer(G.biome, null);
    drawWorldLayer(G.biome, null);
  } else {
    drawGroundLayer(G.next, "above");
    drawGroundLayer(G.biome, "below");
    drawBlend();
    drawWorldLayer(G.next, "above");
    drawWorldLayer(G.biome, "below");
    drawRoadFade();
  }

  for(let i=0;i<G.traffic.length;i++){
    const t2 = G.traffic[i];
    if(t2.y < CT-t2.h*1.5 || t2.y > CB+t2.h) continue;
    drawCar(t2.x, t2.y, t2.w, t2.h, t2.paint, 0, false, false);
  }

  for(let n=0;n<G.rivals.length;n++){
    const RV = G.rivals[n];
    if(G.state === "idle" || RV.dead > 0) continue;
    const rc = CARS[RV.car];
    if(RV.immune > 0 && Math.floor(RV.immune*9) % 2 === 0) continue;
    const sx = RV.shock > 0 ? rand(-3, 3) : 0, sy = RV.shock > 0 ? rand(-3, 3) : 0;
    /* The launch, seen. Every car in the field runs the same mechanic - the
       same meter, the same wind-up, the same landing that writes off whatever
       is underneath - but only player one was ever drawn doing it: rivalHop
       existed and nothing called it, so a bot or a second player left the road
       for real while staying flat on the tarmac. Same arithmetic as the
       player's block below, off that car's own numbers, so a launch looks the
       same whoever spent it. */
    const rhop = rivalHop(RV);
    const rpow = RV.airPow || 0;
    const rsquat = rhop > 0 ? 0 : (RV.airWind || 0);
    const ry = RV.y - rhop*carH*lerp(0.6, AIR_HOP, rpow) + rsquat*carH*0.03;
    const rk = 1 + rhop*lerp(0.20, 0.62, rpow) - rsquat*0.09;
    const rw = carW*rk, rh = carH*rk;
    if(rhop > 0.002) drawAirShadow(rhop, RV.x, RV.y, rpow);
    if(RV.ultOn && rc.power === "burn") drawBurn(rc, RV.x, ry);
    if(RV.ultOn && rc.power === "phase"){ drawPhase(rc, RV.x, ry); ctx.globalAlpha = 0.5; }
    if(RV.ultOn && rc.power === "storm") drawStorm(rc, RV.x, ry);
    if(RV.chrono > 0) drawChronoFog(RV.x, ry, RV.chrono);
    if(RV.ultOn && rc.power === "siren") drawSirenWash(RV.x, ry);
    if(RV.ultOn && rc.power === "freeze") drawTimeAura(rc, RV.x, ry);
    if(RV.ultOn && rc.power === "bloom") drawPetalTrail(rc, RV.x, ry);
    drawCar(RV.x + sx, ry + sy, rw, rh, rc, RV.tilt, true,
            RV.boosting || RV.ultOn || RV.airT > 0);
    ctx.globalAlpha = 1;
    if(G.local && RV.human) drawSeatMark(RV, RV.x + sx, ry + sy);
    if(RV.orbs > 0) drawOrbs(RV, RV.x, ry);
    if(RV.shock > 0) drawShock(RV.x + sx, ry + sy);
  }

  const blink = G.immune > 0 && Math.floor(G.immune*9) % 2 === 0;
  if(G.state !== "idle" && G.dead <= 0 && !blink && (!G.local || playerY >= CT - carH*2 && playerY <= CB + carH*2)){
    const car = CARS[G.car];
    const kx = G.shockT > 0 ? rand(-3, 3) : 0, ky = G.shockT > 0 ? rand(-3, 3) : 0;
    /* Airborne, everything about the player's car moves together: it lifts off
       the road, grows because it is nearer the camera, and leaves a shadow
       behind on the tarmac. The shadow is what actually sells the height -
       without it a bigger car just reads as a bigger car. On the ground with
       the brake wound it does the opposite and squats, so the launch reads as
       a spring going down before it goes up. */
    const hop = airHop();
    const squat = airborne() ? 0 : G.airWind;
    const py = playerY - hop*carH*lerp(0.6, AIR_HOP, G.airPow) + squat*carH*0.03;
    const kk = 1 + hop*lerp(0.20, 0.62, G.airPow) - squat*0.09;
    const cw = carW*kk, ch = carH*kk;
    if(hop > 0.002) drawAirShadow(hop, G.x, playerY, G.airPow);
    if(G.ultOn && car.power === "storm") drawStorm(car, G.x, py);
    if(G.ultOn && car.power === "siren") drawSirenWash(G.x, py);
    if(G.ultOn && car.power === "freeze") drawTimeAura(car, G.x, py);
    if(G.ultOn && car.power === "bloom") drawPetalTrail(car, G.x, py);
    if(G.ultOn && car.power === "burn") drawBurn(car, G.x, py);
    if(G.ultOn && car.power === "phase"){
      for(let i=2;i>=1;i--){                       /* after-images trailing behind */
        ctx.globalAlpha = 0.16/i;
        drawCar(G.x, py + ch*0.28*i, cw, ch, car, G.tilt, true, true);
      }
      ctx.globalAlpha = 1;
      drawPhase(car, G.x, py);
      ctx.globalAlpha = 0.5;
    }
    drawCar(G.x + kx, py + ky, cw, ch, car, G.tilt, true, G.boosting || G.ultOn || airborne());
    ctx.globalAlpha = 1;
    if(G.local) drawSeatMark("me", G.x + kx, py + ky);
    if(G.orbs > 0) drawOrbs("me", G.x, py);
    if(G.shockT > 0) drawShock(G.x + kx, py + ky);
  }

  for(let i=0;i<G.fx.length;i++){
    const f = G.fx[i];
    ctx.globalAlpha = clamp(f.life/f.max, 0, 1);
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832);
    ctx.fillStyle = f.c; ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* the faster the road, the harder it streaks - and it flares for a moment
     each time the pace steps up, so the change is felt as well as measured */
  const flare = clamp(G.stepFlash, 0, 1);
  const sr = clamp((G.speed - 330)/620, 0, 1) + flare*0.5;
  if(sr > 0.02){
    ctx.strokeStyle = "rgba(255,255,255," + Math.min(0.42, 0.05 + sr*0.2).toFixed(3) + ")";
    ctx.lineWidth = 2;
    const streaks = 9 + Math.round(sr*10);
    for(let i=0;i<streaks;i++){
      const x = roadX + ((i*137 + (G.scroll*0.5)) % roadW);
      const y = (i*211 + G.scroll*1.6) % (H+240) - 120;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 40 + sr*120); ctx.stroke();
    }
  }

  drawSlicks();
  drawBubbles();
  drawBolts();
  drawMissiles();
  ctx.restore();                 /* back to the screen this view is drawn on */

  /* Everything from here is on the glass rather than on the road, so it does
     not move with the camera - and it belongs to whoever is looking through
     this particular window. */
  const o = VOWN === "me" ? G : VOWN;
  ctx.fillStyle = vign; ctx.fillRect(0,0,W,H);
  drawLadder();
  const blind = o.blind || 0;
  if(blind > 0) drawBlind(blind, o.blindPts);
  const bloom = VOWN === "me" ? G.bloomT : (VOWN.clutter || 0);
  if(bloom > 0) drawBloom(bloom, o.petals || [], o.clutterLv || 1);
  if(G.chronoWorld > 0) drawChronoWash();
  const chrono = VOWN === "me" ? G.chronoT : (VOWN.chrono || 0);
  if(chrono > 0) drawChronoHeld(chrono);
  ctx.restore();
}

/* Where in the arc the car is: nothing on the road, one at the top of the
   climb. A sine gives the same shape going up as coming down, which is what
   you want here - the launch is a jump, not a throw. */
function airHop(){
  if(!airborne() || G.airMax <= 0) return 0;
  return Math.sin(clamp(1 - G.airT/G.airMax, 0, 1)*Math.PI);
}

/* Where in the arc a bot's car is, for the drawing. */
function rivalHop(R){
  if(R.airT <= 0 || R.airMax <= 0) return 0;
  return Math.sin(clamp(1 - R.airT/R.airMax, 0, 1)*Math.PI);
}

/* The shadow stays on the road where the car would have been, shrinking and
   fading as it climbs, so the height is readable at a glance. It takes the
   spot and the strength rather than reading the player's, because every car
   in the field launches and the shadow is what actually sells the height -
   without it a bigger car just reads as a bigger car. */
function drawAirShadow(hop, cx, cy, pow){
  const deep = hop*lerp(0.5, 1, pow);             /* a big launch throws a smaller shadow */
  const r = carW*0.46*(1 - deep*0.52);
  ctx.save();
  ctx.globalAlpha = 0.44*(1 - deep*0.62);
  ctx.beginPath();
  if(ctx.ellipse) ctx.ellipse(cx, cy + carH*0.16, r, r*0.42, 0, 0, 6.2832);
  else ctx.arc(cx, cy + carH*0.16, r*0.7, 0, 6.2832);
  ctx.fillStyle = "#000000"; ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* Redd alight: a burning shell around the car */
function drawBurn(car, cx, cy){
  const t = G.scroll*0.035;
  const gl = ctx.createRadialGradient(cx, cy, carW*0.2, cx, cy, carW*1.5);
  gl.addColorStop(0, "rgba(255,150,60,0.45)");
  gl.addColorStop(1, "rgba(255,90,20,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(cx - carW*1.6, cy - carH*1.1, carW*3.2, carH*2.2);
  for(let i=0;i<9;i++){
    const side = i % 2 ? 1 : -1;
    const f = (i/9);
    const fy = cy - carH*0.42 + f*carH*0.95;
    const wob = Math.sin(t + i*1.7)*carW*0.08;
    const len = carH*(0.14 + Math.abs(Math.sin(t*1.3 + i))*0.13);
    ctx.beginPath();
    ctx.moveTo(cx + side*carW*0.42 + wob, fy);
    ctx.quadraticCurveTo(cx + side*carW*0.72 + wob, fy - len*0.5,
                         cx + side*carW*0.5 + wob, fy - len);
    ctx.quadraticCurveTo(cx + side*carW*0.40 + wob, fy - len*0.4,
                         cx + side*carW*0.42 + wob, fy);
    ctx.fillStyle = i % 3 === 0 ? car.flame[1] : car.flame[0];
    ctx.globalAlpha = 0.85; ctx.fill();
  }
  ctx.globalAlpha = 1;
  if(Math.random() < 0.7)
    addFx(cx + rand(-carW*0.5, carW*0.5), cy + rand(-carH*0.4, carH*0.4),
          rand(-40, 40), rand(30, 150), rand(.3,.7), rand(2,4),
          Math.random() < 0.5 ? car.flame[0] : car.flame[1]);
}

/* Phantom vapour: a cold halo and a drifting wake */
function drawPhase(car, cx, cy){
  const gl = ctx.createRadialGradient(cx, cy, carW*0.15, cx, cy, carW*1.35);
  gl.addColorStop(0, "rgba(120,205,255,0.4)");
  gl.addColorStop(1, "rgba(60,150,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(cx - carW*1.5, cy - carH*1.0, carW*3.0, carH*2.0);
  if(Math.random() < 0.6)
    addFx(cx + rand(-carW*0.45, carW*0.45), cy + rand(-carH*0.3, carH*0.5),
          rand(-30, 30), rand(40, 140), rand(.35,.8), rand(2,4),
          Math.random() < 0.5 ? car.flame[0] : car.flame[1]);
}

/* three orbs circling whoever is holding them */
function drawOrbs(who, cx, cy){
  const n = who === "me" ? G.orbs : who.orbs;
  if(n <= 0) return;
  const t = G.scroll*0.012 + (who === "me" ? 0 : 1.7);
  for(let i=0;i<n;i++){
    const a = t + (i/ORB_COUNT)*6.2832;
    const ox = cx + Math.cos(a)*carW*0.92, oy = cy + Math.sin(a)*carH*0.52;
    ctx.beginPath(); ctx.arc(ox, oy, 9, 0, 6.2832);
    ctx.fillStyle = "rgba(255,226,77,0.22)"; ctx.fill();
    ctx.beginPath(); ctx.arc(ox, oy, 4.2, 0, 6.2832);
    ctx.fillStyle = "#FFF6C0"; ctx.fill();
    ctx.strokeStyle = "rgba(255,226,77,0.9)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(ox - 3, oy - 5); ctx.lineTo(ox + 1, oy - 1);
    ctx.lineTo(ox - 1, oy + 1); ctx.lineTo(ox + 3, oy + 5);
    ctx.stroke();
  }
}

/* the flash on the way out, quickening as the last of it runs down */
function bubbleFlash(row){
  return row.blink > 0 && Math.sin(row.ph) <= -0.2 ? 0.14 : 1;
}
/* and it draws itself in a little as it goes */
function bubbleShrink(row){
  return row.blink > 0 ? 1 - (1 - clamp(row.blink/BUBBLE_BLINK, 0, 1))*0.18 : 1;
}
function drawBubbles(){
  for(let n=0;n<G.boxes.length;n++){
    const row = G.boxes[n];
    if(row.y < CT-80 || row.y > CB+80) continue;
    for(let l=0;l<3;l++){
      if(row.gone & (1 << l)) continue;                  /* collected: it is gone */
      const x = laneCX(l);
      const t = G.scroll*0.01 + l*2 + row.s*6;
      const y = row.y + Math.sin(t)*7;
      const r = bubbleR()*(1 + Math.sin(t*1.3)*0.045)*bubbleShrink(row);  /* breathes, then shrinks away */

      /* Every bubble still on the road is one you can still take, so none of
         them are drawn faded any more. They used to dim once you had taken one
         from the row, which was honest then and would be a lie now. */
      ctx.save();
      ctx.globalAlpha = bubbleFlash(row);

      const glow = ctx.createRadialGradient(x, y, r*0.6, x, y, r*1.6);
      glow.addColorStop(0, "rgba(180,225,255,0.30)");
      glow.addColorStop(1, "rgba(180,225,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - r*1.7, y - r*1.7, r*3.4, r*3.4);

      /* soap film: clear in the middle, bright at the edge */
      const film = ctx.createRadialGradient(x, y, r*0.2, x, y, r);
      film.addColorStop(0,    "rgba(255,255,255,0.05)");
      film.addColorStop(0.62, "rgba(190,230,255,0.14)");
      film.addColorStop(0.88, "rgba(255,255,255,0.42)");
      film.addColorStop(1,    "rgba(255,255,255,0.08)");
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
      ctx.fillStyle = film; ctx.fill();

      /* thin-film colour sliding around the rim */
      ctx.lineWidth = 2.4;
      const tints = ["rgba(120,235,255,0.85)", "rgba(255,140,225,0.7)", "rgba(255,235,150,0.7)"];
      for(let k=0;k<3;k++){
        ctx.beginPath();
        ctx.arc(x, y, r - 1, t*0.6 + k*2.1, t*0.6 + k*2.1 + 1.5);
        ctx.strokeStyle = tints[k]; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.2; ctx.stroke();

      /* highlights */
      ctx.beginPath();
      if(ctx.ellipse) ctx.ellipse(x - r*0.34, y - r*0.40, r*0.26, r*0.16, -0.7, 0, 6.2832);
      else ctx.arc(x - r*0.34, y - r*0.40, r*0.2, 0, 6.2832);
      ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fill();
      ctx.beginPath(); ctx.arc(x + r*0.42, y + r*0.34, r*0.1, 0, 6.2832);
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fill();

      /* the question mark, readable over any track */
      ctx.font = "700 " + Math.round(r*1.15) + "px Archivo, Arial Narrow, Helvetica, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 3.5; ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(11,11,12,0.72)";
      ctx.strokeText("?", x, y + 1);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText("?", x, y + 1);
      ctx.restore();
    }
  }
}

function slickPath(o, k){
  const ca = Math.cos(o.rot), sa = Math.sin(o.rot);
  const n = 30;
  ctx.beginPath();
  for(let i=0;i<=n;i++){
    const a = i/n*6.2832;
    const f = slickFactor(o, a)*k;
    const px = Math.cos(a)*o.rx*f, py = Math.sin(a)*o.ry*f;
    const x = o.x + px*ca - py*sa, y = o.y + px*sa + py*ca;
    if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/* Tarmac is near enough black on all three tracks - city 16171B, space 0D0D15 -
   and the slick used to be painted black on top of it, so there was barely a
   pixel of difference to see. It is lit rather than darkened now: the body stays
   dark, but a full oil-film rainbow and a bright wet edge do the reading, and
   light on dark works whatever the road under it is doing. The rim is stroked on
   the k=1 outline, which is the same curve slickHits tests, so the bright line
   you swerve around is exactly the line that catches you. */
function drawSlicks(){
  for(let i=0;i<G.slicks.length;i++){
    const o = G.slicks[i];
    if(o.y < CT-90 || o.y > CB+90) continue;
    const a = o.fade > 0 ? clamp(o.fade/OIL_FADE, 0, 1) : 1;
    /* a slow flare across the film, run off the slick's own clock and seed so
       no two pools shimmer together. It parks once the slick is spent, which is
       fine - by then the whole thing is fading out anyway. */
    const shim = 0.85 + 0.15*Math.sin(o.life*3.1 + o.s*6.2832);
    ctx.save();

    /* a soft shadow just proud of the pool, so the bright edge has something to
       sit against and the pale desert road still separates from it */
    ctx.globalAlpha = a*0.45;
    slickPath(o, 1.1);
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fill();

    /* body, then a darker pool inside it so the edge does not read flat */
    ctx.globalAlpha = a;
    slickPath(o, 1);
    ctx.fillStyle = "rgba(12,12,17,0.94)"; ctx.fill();
    slickPath(o, 0.6);
    ctx.fillStyle = "rgba(3,3,6,0.72)"; ctx.fill();

    /* the film: oil on wet tarmac throws a whole rainbow, violet through cyan
       and green into gold. This is the layer that actually carries the slick on
       a black road, so it is worth the extra stops. Thrown off-centre by the
       seed and clipped to the outline. */
    const ga = o.s*6.2832;
    const gx = o.x + Math.cos(ga)*o.rx*0.3, gy = o.y + Math.sin(ga)*o.ry*0.28;
    const gr = Math.max(o.rx, o.ry)*1.02;
    const sh = o.sheen*shim;
    const gl = ctx.createRadialGradient(gx, gy, 1, gx, gy, gr);
    gl.addColorStop(0,    "rgba(232,186,255," + (0.66*sh).toFixed(3) + ")");
    gl.addColorStop(0.26, "rgba(126,192,255," + (0.54*sh).toFixed(3) + ")");
    gl.addColorStop(0.50, "rgba(112,236,192," + (0.42*sh).toFixed(3) + ")");
    gl.addColorStop(0.74, "rgba(244,206,116," + (0.32*sh).toFixed(3) + ")");
    gl.addColorStop(1,    "rgba(150,110,190,0)");
    slickPath(o, 0.98);
    ctx.fillStyle = gl; ctx.fill();

    /* the wet edge, right on the outline - what you catch out of the corner of
       your eye at racing speed, and a fainter one inside it for depth */
    ctx.lineJoin = "round";
    ctx.globalAlpha = a*0.72*shim;
    slickPath(o, 1);
    ctx.strokeStyle = "rgba(206,222,255,0.9)"; ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.globalAlpha = a*0.3;
    slickPath(o, 0.78);
    ctx.strokeStyle = "rgba(180,214,255,0.7)"; ctx.lineWidth = 1.1;
    ctx.stroke();

    /* droplets flung clear of the main body. The highlight is a crescent on the
       lit side, not a ring all the way round - a full outline at this size read
       as a little hollow bubble rather than a spot of oil. */
    for(let n=0;n<o.spots;n++){
      const ang = ((o.s*53.7 + n*39.13) % 1)*6.2832;
      const far = 1.2 + ((o.s*29.3 + n*17.71) % 1)*0.46;
      const rr  = 1.7 + ((o.s*71.9 + n*23.3) % 1)*3.2;
      const px = Math.cos(ang)*o.rx*far, py = Math.sin(ang)*o.ry*far;
      const ca = Math.cos(o.rot), sa2 = Math.sin(o.rot);
      const dx = o.x + px*ca - py*sa2, dy = o.y + px*sa2 + py*ca;
      ctx.globalAlpha = a*0.85;
      ctx.beginPath(); ctx.arc(dx, dy, rr, 0, 6.2832);
      ctx.fillStyle = "rgba(16,15,22,0.9)"; ctx.fill();
      ctx.globalAlpha = a*0.7*shim;
      ctx.beginPath(); ctx.arc(dx, dy, rr*0.86, ga - 1.15, ga + 1.15);
      ctx.strokeStyle = "rgba(198,216,255,0.9)"; ctx.lineWidth = 1.1;
      ctx.lineCap = "round"; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function drawMissiles(){
  const D = missileDims();
  const nose = -D.nose, tail = D.tail, hw = D.hw, fin = D.fin;
  for(let i=0;i<G.missiles.length;i++){
    const m = G.missiles[i];
    const a = m.fade > 0 ? clamp(m.fade/1.2, 0, 1) : 1;
    const ang = Math.atan2(m.vy, m.vx) + 1.5708;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(m.x, m.y); ctx.rotate(ang);

    /* the burn behind it */
    const gl = ctx.createRadialGradient(0, tail*1.05, hw*0.25, 0, tail*1.05, hw*2.6);
    gl.addColorStop(0, "rgba(255,196,120,0.55)");
    gl.addColorStop(1, "rgba(255,138,42,0)");
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, tail*1.05, hw*2.6, 0, 6.2832); ctx.fill();

    /* a shadow so it sits above the road rather than on it */
    ctx.globalAlpha = a*0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    if(ctx.ellipse) ctx.ellipse(hw*0.35, tail*0.30, hw*1.05, D.len*0.42, 0, 0, 6.2832);
    else ctx.arc(hw*0.35, tail*0.30, hw*1.05, 0, 6.2832);
    ctx.fill();
    ctx.globalAlpha = a;

    /* fins under the body */
    ctx.fillStyle = "#5A6472";
    ctx.beginPath();
    ctx.moveTo(-hw*0.94, tail*0.02); ctx.lineTo(-fin, tail*0.96);
    ctx.lineTo(-hw*0.94, tail*0.88); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hw*0.94, tail*0.02); ctx.lineTo(fin, tail*0.96);
    ctx.lineTo(hw*0.94, tail*0.88); ctx.closePath(); ctx.fill();
    /* small forward canards, for the length */
    ctx.beginPath();
    ctx.moveTo(-hw*0.94, nose*0.44); ctx.lineTo(-fin*0.60, nose*0.18);
    ctx.lineTo(-hw*0.94, nose*0.10); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hw*0.94, nose*0.44); ctx.lineTo(fin*0.60, nose*0.18);
    ctx.lineTo(hw*0.94, nose*0.10); ctx.closePath(); ctx.fill();

    /* body */
    ctx.beginPath();
    ctx.moveTo(0, nose);
    ctx.lineTo(hw*0.62, nose*0.72);
    ctx.lineTo(hw, nose*0.40);
    ctx.lineTo(hw, tail);
    ctx.lineTo(-hw, tail);
    ctx.lineTo(-hw, nose*0.40);
    ctx.lineTo(-hw*0.62, nose*0.72);
    ctx.closePath();
    ctx.fillStyle = "#D8DEE6"; ctx.fill();

    /* red warhead */
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#E21B22";
    ctx.beginPath();
    ctx.moveTo(-hw*1.2, nose*1.1); ctx.lineTo(hw*1.2, nose*1.1);
    ctx.lineTo(hw*1.2, nose*0.22); ctx.lineTo(-hw*1.2, nose*0.22);
    ctx.closePath(); ctx.fill();
    /* a darker flank so the cylinder reads round */
    ctx.fillStyle = "rgba(16,17,22,0.16)";
    ctx.beginPath();
    ctx.moveTo(hw*0.42, nose*1.1); ctx.lineTo(hw*1.2, nose*1.1);
    ctx.lineTo(hw*1.2, tail); ctx.lineTo(hw*0.42, tail);
    ctx.closePath(); ctx.fill();
    /* panel lines */
    ctx.strokeStyle = "rgba(90,100,114,0.5)";
    ctx.lineWidth = Math.max(1.4, hw*0.10);
    ctx.beginPath(); ctx.moveTo(-hw, nose*0.06); ctx.lineTo(hw, nose*0.06); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-hw, tail*0.44); ctx.lineTo(hw, tail*0.44); ctx.stroke();
    ctx.restore();

    /* thruster mouth */
    ctx.fillStyle = "#101116";
    ctx.beginPath();
    ctx.moveTo(-hw*0.74, tail); ctx.lineTo(hw*0.74, tail);
    ctx.lineTo(hw*0.54, tail - hw*0.40); ctx.lineTo(-hw*0.54, tail - hw*0.40);
    ctx.closePath(); ctx.fill();

    /* outline last, so the silhouette stays clean */
    ctx.beginPath();
    ctx.moveTo(0, nose);
    ctx.lineTo(hw*0.62, nose*0.72);
    ctx.lineTo(hw, nose*0.40);
    ctx.lineTo(hw, tail);
    ctx.lineTo(-hw, tail);
    ctx.lineTo(-hw, nose*0.40);
    ctx.lineTo(-hw*0.62, nose*0.72);
    ctx.closePath();
    ctx.strokeStyle = "#5A6472"; ctx.lineWidth = Math.max(2, hw*0.13); ctx.stroke();

    ctx.restore();
  }
}

function drawBolts(){
  for(let i=0;i<G.bolts.length;i++){
    const b = G.bolts[i];
    ctx.beginPath(); ctx.arc(b.x, b.y, 13, 0, 6.2832);
    ctx.fillStyle = "rgba(255,226,77,0.24)"; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, 6.2832);
    ctx.fillStyle = "#FFFBDA"; ctx.fill();
    ctx.strokeStyle = "#FFE44D"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - 5, b.y - 8); ctx.lineTo(b.x + 2, b.y - 1);
    ctx.lineTo(b.x - 2, b.y + 1); ctx.lineTo(b.x + 5, b.y + 8);
    ctx.stroke();
  }
}
/* A pinned car, held in a cage of current.

   The old version was five straight scribbles at random angles redrawn every
   frame, which read as noise rather than as electricity. This builds it the
   way an arc actually looks: a bright core glow the car sits in, then jagged
   bolts that start on the bodywork and jump outward in several short segments
   with the kink getting wider as they go, then a couple of rings snapping in
   and out. Everything is driven off a per-frame phase rather than pure random
   per segment, so the arcs hold their shape for a beat and then move - the eye
   reads that as crackling, where per-frame randomness reads as static. */
function boltPath(x0, y0, x1, y1, kink, seed){
  const n = 4;
  ctx.moveTo(x0, y0);
  for(let i=1;i<=n;i++){
    const f = i/n;
    const bx = lerp(x0, x1, f), by = lerp(y0, y1, f);
    const nx = -(y1 - y0), ny = (x1 - x0);
    const nl = Math.max(1, Math.sqrt(nx*nx + ny*ny));
    /* the wander grows along the bolt and dies back at the tip */
    const w = i === n ? 0 : (Math.sin(seed*12.9 + i*4.7) * kink * f);
    ctx.lineTo(bx + nx/nl*w, by + ny/nl*w);
  }
}
function drawShock(cx, cy){
  const t2 = G.scroll*0.06;
  const beat = Math.floor(t2*3);                 /* the arcs hold, then jump */
  ctx.save();

  /* the charge the car is sitting in */
  const g = ctx.createRadialGradient(cx, cy, carW*0.1, cx, cy, carW*1.15);
  g.addColorStop(0, "rgba(255,251,218,0.34)");
  g.addColorStop(0.5, "rgba(255,226,77,0.20)");
  g.addColorStop(1, "rgba(255,200,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - carW*1.3, cy - carH*0.95, carW*2.6, carH*1.9);

  /* bolts jumping off the bodywork */
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for(let i=0;i<7;i++){
    const seed = beat*0.618 + i;
    const a = (i/7)*6.2832 + Math.sin(seed*2.1)*0.5;
    const r1 = carW*0.34, r2 = carW*(0.72 + (Math.sin(seed*5.3)*0.5 + 0.5)*0.42);
    const x0 = cx + Math.cos(a)*r1, y0 = cy + Math.sin(a)*r1*1.35;
    const x1 = cx + Math.cos(a)*r2, y1 = cy + Math.sin(a)*r2*1.25;
    const kink = carW*0.26;
    ctx.globalAlpha = 0.55;                      /* the wide, soft underlayer */
    ctx.strokeStyle = "#FFE44D"; ctx.lineWidth = Math.max(2, carW*0.075);
    ctx.beginPath(); boltPath(x0, y0, x1, y1, kink, seed); ctx.stroke();
    ctx.globalAlpha = 1;                         /* and the hot core on top */
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = Math.max(1, carW*0.028);
    ctx.beginPath(); boltPath(x0, y0, x1, y1, kink, seed); ctx.stroke();
  }

  /* two rings snapping outward, out of step with each other */
  for(let i=0;i<2;i++){
    const f = ((t2*0.9 + i*0.5) % 1);
    ctx.globalAlpha = (1 - f)*0.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, carW*(0.5 + f*0.75), carW*(0.5 + f*0.75)*1.2, 0, 0, 6.2832);
    ctx.strokeStyle = "#FFF6C0"; ctx.lineWidth = Math.max(1, carW*0.05*(1 - f));
    ctx.stroke();
  }

  /* sparks shaken loose */
  ctx.globalAlpha = 1;
  if(Math.random() < 0.55){
    const a = rand(0, 6.2832);
    addFx(cx + Math.cos(a)*carW*0.5, cy + Math.sin(a)*carH*0.4,
          Math.cos(a)*rand(50, 190), Math.sin(a)*rand(50, 190),
          rand(.2,.45), rand(1.5,3.5), Math.random() < 0.5 ? "#FFE44D" : "#FFFFFF");
  }
  ctx.restore();
}
/* Bolt running on absorbed orbs: fast, crackling, but unprotected */
function drawStorm(car, cx, cy){
  const gl = ctx.createRadialGradient(cx, cy, carW*0.15, cx, cy, carW*1.3);
  gl.addColorStop(0, "rgba(255,226,77,0.42)");
  gl.addColorStop(1, "rgba(255,200,0,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(cx - carW*1.4, cy - carH*1.0, carW*2.8, carH*2.0);
  ctx.strokeStyle = "#FFF6C0"; ctx.lineWidth = 2;
  for(let i=0;i<4;i++){
    const a = rand(0, 6.2832);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a)*carW*0.4, cy + Math.sin(a)*carH*0.3);
    ctx.lineTo(cx + Math.cos(a + 0.5)*carW*0.75, cy + Math.sin(a + 0.5)*carH*0.5);
    ctx.stroke();
  }
  if(Math.random() < 0.6)
    addFx(cx + rand(-carW*0.5, carW*0.5), cy + rand(-carH*0.4, carH*0.4),
          rand(-40, 40), rand(40, 160), rand(.3,.6), rand(2,4),
          Math.random() < 0.5 ? "#FFE44D" : "#FFFBDA");
}

/* the flag at the end of the last track */
function drawFinish(){
  if(!G.finishAt || !toFlag()) return;
  const y = playerY - (G.finishAt - G.meters)/0.075;
  if(y < CT-80 || y > CB+40) return;
  const n = 8, cw = roadW/n, rows = 3;
  for(let r=0;r<rows;r++)
    for(let c=0;c<n;c++){
      ctx.fillStyle = (r + c) % 2 ? "#F4F4F6" : "#0B0B0C";
      ctx.fillRect(roadX + c*cw, y + r*13, cw, 13);
    }
  ctx.fillStyle = "rgba(226,27,34,0.9)";
  ctx.fillRect(roadX, y - 5, roadW, 5);
}

/* a ring of stopped time around Timestamp */
function drawTimeAura(car, cx, cy){
  const g2 = ctx.createRadialGradient(cx, cy, carW*0.2, cx, cy, carW*1.5);
  g2.addColorStop(0, "rgba(63,217,138,0.36)");
  g2.addColorStop(1, "rgba(63,217,138,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(cx - carW*1.6, cy - carH*1.1, carW*3.2, carH*2.2);
  ctx.save();
  ctx.strokeStyle = "rgba(214,255,233,0.7)"; ctx.lineWidth = 2;
  for(let i=1;i<=2;i++){
    ctx.beginPath();
    ctx.arc(cx, cy, carW*(0.55 + i*0.32), G.scroll*0.01*i, G.scroll*0.01*i + 4.4);
    ctx.stroke();
  }
  ctx.restore();
}
/* petals streaming off Rose */
function drawPetalTrail(car, cx, cy){
  if(Math.random() < 0.7)
    addFx(cx + rand(-carW*0.5, carW*0.5), cy + rand(-carH*0.3, carH*0.4),
          rand(-60, 60), rand(60, 180), rand(.4,.9), rand(3,6),
          Math.random() < 0.5 ? "#FF7ACF" : "#B45CFF");
}

/* Timestamp: the road under chronokinesis - a green drag over everything,
   thin enough that the world is still perfectly readable. Nobody is stopped
   any more, so this must not read like a wall. */
function drawChronoWash(){
  const a = Math.min(1, G.chronoWorld/0.5);
  ctx.save();
  ctx.globalAlpha = a*0.11;
  ctx.fillStyle = "#3FD98A"; ctx.fillRect(0, 0, W, H);
  /* slow horizontal bands crawling up the screen: the clock, made visible */
  ctx.globalAlpha = a*0.10;
  ctx.fillStyle = "#D6FFE9";
  const gap = 74*SCENE, off = (G.scroll*0.06) % gap;
  for(let y = -gap + off; y < H + gap; y += gap) ctx.fillRect(0, y, W, 2.5*SCENE);
  ctx.globalAlpha = 1;
  ctx.restore();
}
/* And what it looks like from inside: the same green, heavier, with the edges
   of the screen dragging. */
function drawChronoHeld(left){
  const a = Math.min(1, left/0.5);
  ctx.save();
  ctx.globalAlpha = a*0.16;
  ctx.fillStyle = "#1F7A4C"; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W*0.5, H*0.5, Math.min(W, H)*0.28,
                                     W*0.5, H*0.5, Math.max(W, H)*0.72);
  g.addColorStop(0, "rgba(63,217,138,0)");
  g.addColorStop(1, "rgba(63,217,138,0.5)");
  ctx.globalAlpha = a;
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.restore();
}
/* The fog a chronokinetically affected car sits inside. It is held off the
   bodywork deliberately - a ring at arm's length, not a coat of paint - so the
   car underneath stays legible and the fog reads as the air around it. */
function drawChronoFog(cx, cy, left){
  const a = Math.min(1, left/0.4);
  const t2 = G.scroll*0.02;
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, carW*0.78, cx, cy, carW*1.85);
  g.addColorStop(0, "rgba(63,217,138,0)");
  g.addColorStop(0.45, "rgba(63,217,138," + (0.30*a).toFixed(3) + ")");
  g.addColorStop(1, "rgba(31,122,76,0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - carW*2, cy - carH*1.4, carW*4, carH*2.8);
  ctx.globalAlpha = a*0.5;
  for(let i=0;i<7;i++){                          /* clots of it turning slowly */
    const ang = t2*0.5 + (i/7)*6.2832;
    const rr2 = carW*(1.06 + Math.sin(t2 + i*1.9)*0.16);
    const px = cx + Math.cos(ang)*rr2;
    const py = cy + Math.sin(ang)*rr2*0.82;
    ctx.beginPath();
    ctx.arc(px, py, carW*(0.20 + (i % 3)*0.06), 0, 6.2832);
    ctx.fillStyle = i % 2 ? "#3FD98A" : "#D6FFE9";
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawBloom(left, petals, lv){
  const a = Math.min(1, left/0.6);
  /* The stage decides how much of the stored petal set is actually on screen
     and how heavy the wash behind it is. Stage one is what it always was;
     stage five is the whole screen, which is why the top end goes opaque. */
  const k = clutterK(lv);
  const shown = Math.round(petals.length*lerp(0.42, 1, k));
  ctx.save();
  ctx.globalAlpha = a*lerp(0.42, 0.80, k);           /* a much heavier wash */
  ctx.fillStyle = "#5B2A86"; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = a*lerp(0.20, 0.46, k);
  ctx.fillStyle = "#FF7ACF"; ctx.fillRect(0, 0, W, H);

  for(let i=0;i<shown;i++){
    const p = petals[i];
    p.a += p.sp*0.024;
    p.y += p.fall;
    p.x += p.dx + Math.sin(p.a*0.5)*0.0009;          /* drifts sideways as it falls */
    if(p.y > 1.2) p.y = -0.2;
    if(p.x > 1.2) p.x = -0.2; else if(p.x < -0.2) p.x = 1.2;
    const x = p.x*W, y = p.y*H;
    const near = p.layer === 2;

    if(near){                                        /* a soft halo on the close ones */
      ctx.globalAlpha = a*0.30;
      ctx.beginPath(); ctx.arc(x, y, p.r*1.25, 0, 6.2832);
      ctx.fillStyle = "#FF9EDC"; ctx.fill();
    }
    ctx.globalAlpha = clamp(a*(p.layer === 0 ? 0.55 + p.s*0.3 : 0.82 + p.s*0.18)*lerp(1, 1.25, k), 0, 1);
    for(let k=0;k<6;k++){
      const ang = p.a + (k/6)*6.2832;
      ctx.beginPath();
      if(ctx.ellipse) ctx.ellipse(x + Math.cos(ang)*p.r*0.52, y + Math.sin(ang)*p.r*0.52,
                                  p.r*0.58, p.r*0.32, ang, 0, 6.2832);
      else ctx.arc(x + Math.cos(ang)*p.r*0.52, y + Math.sin(ang)*p.r*0.52, p.r*0.44, 0, 6.2832);
      ctx.fillStyle = p.s > 0.66 ? "#FF7ACF" : (p.s > 0.33 ? "#B45CFF" : "#E85FB8");
      ctx.fill();
    }
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(x, y, p.r*0.26, 0, 6.2832);
    ctx.fillStyle = "#FFE4F5"; ctx.fill();
    if(near){                                        /* petals smeared on the glass */
      ctx.globalAlpha = a*0.5;
      ctx.beginPath(); ctx.arc(x - p.r*0.3, y - p.r*0.3, p.r*0.3, 0, 6.2832);
      ctx.fillStyle = "#FFFFFF"; ctx.fill();
    }
  }
  /* The last stage is meant to be the whole screen, and a screen of petals
     still has gaps between them. This closes them. */
  if(lv >= CLUTTER_MAX){
    ctx.globalAlpha = a*0.62;
    ctx.fillStyle = "#7B3FA8"; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a*0.34;
    ctx.fillStyle = "#FFB6E6"; ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* Siren: the road washed in alternating blue and red */
function drawSirenWash(cx, cy){
  const beat = Math.floor(G.scroll*0.03) % 2 === 0;
  /* blue thrown one side, red the other, swapping which one is stronger - so
     the road carries both colours the way it does under a real light bar */
  const pairs = [[-1, "77,139,255", beat ? 0.34 : 0.16],
                 [ 1, "255,74,80",  beat ? 0.16 : 0.34]];
  for(let i=0;i<2;i++){
    const side = pairs[i][0], col = pairs[i][1], a = pairs[i][2];
    const g2 = ctx.createRadialGradient(cx + side*carW*0.5, cy, carW*0.3,
                                        cx + side*carW*0.5, cy, carW*3.0);
    g2.addColorStop(0, "rgba(" + col + "," + a.toFixed(2) + ")");
    g2.addColorStop(1, "rgba(" + col + ",0)");
    ctx.fillStyle = g2;
    ctx.fillRect(cx - carW*3.6, cy - carH*2.4, carW*7.2, carH*4.8);
  }
}

/* water thrown over the view, running off as it clears */
function drawBlind(left, pts){
  const hold = BLIND_TIME - 0.55;
  const a = left > hold ? 1 : clamp(left/hold, 0, 1);
  pts = pts || [];
  ctx.globalAlpha = a*0.6;
  ctx.fillStyle = "#A8CDEA"; ctx.fillRect(0, 0, W, H);
  for(let i=0;i<pts.length;i++){
    const p = pts[i];
    const x = p.x*W, y = p.y*H, r = p.r*(0.75 + a*0.35);
    ctx.globalAlpha = a*0.85;
    ctx.beginPath();
    if(ctx.ellipse) ctx.ellipse(x, y, r, r*(0.6 + p.s*0.7), p.s*3, 0, 6.2832);
    else ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = "rgba(206,232,250,0.9)"; ctx.fill();
    ctx.globalAlpha = a*0.55;
    ctx.beginPath(); ctx.arc(x - r*0.3, y - r*0.34, r*0.34, 0, 6.2832);
    ctx.fillStyle = "#FFFFFF"; ctx.fill();
  }
  ctx.globalAlpha = 1;
}
