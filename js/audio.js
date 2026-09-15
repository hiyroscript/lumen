"use strict";

/* SEREN - sound, generated rather than loaded.
   The context is created lazily on the first call, so it is always born
   inside a user gesture and browsers do not refuse it. */

/* ---------------- sound (generated, no files) -------------------- */
let actx=null, master=null, engineNode=null;
let soundOn = store.get("seren.sound") !== "0";

function audio(){
  if(actx) return actx;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = soundOn ? 0.9 : 0;
    master.connect(actx.destination);
  }catch(e){ actx = null; }
  return actx;
}
function tone(freq, dur, type, vol){
  const c = audio(); if(!c || !soundOn) return;
  if(c.state === "suspended") c.resume();
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || "square"; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(vol || 0.12, c.currentTime + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur + 0.03);
}
function noise(dur, vol){
  const c = audio(); if(!c || !soundOn) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i] = (Math.random()*2-1) * (1 - i/n);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1400;
  const g = c.createGain(); g.gain.value = vol || 0.4;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
function engineStart(){
  const c = audio(); if(!c) return;
  if(c.state === "suspended") c.resume();
  if(engineNode) return;
  const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
  o.type = "sawtooth"; o.frequency.value = 52;
  f.type = "lowpass"; f.frequency.value = 320;
  g.gain.value = 0.05;
  o.connect(f); f.connect(g); g.connect(master); o.start();
  engineNode = {o:o,g:g,f:f};
}
function engineSet(r){ if(engineNode) engineNode.o.frequency.value = 46 + r*74; }
function engineStop(){ if(engineNode){ try{ engineNode.o.stop(); }catch(e){} engineNode = null; } }
function setSound(on){
  soundOn = on; store.set("seren.sound", on ? "1" : "0");
  if(master) master.gain.value = on ? 0.9 : 0;
  /* The two glyphs swap by class rather than inline style, so the stylesheet
     stays the one place that decides how a hidden icon is hidden. */
  $("#icSoundOn").classList.toggle("off", !on);
  $("#icSoundOff").classList.toggle("off", on);
  if(!on) engineStop();
}
