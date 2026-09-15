#!/usr/bin/env node
/* Dependency-free menu behavior checks. The DOM and Canvas are test doubles:
   this verifies state/event wiring, not browser layout, artwork, or hardware. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, base), 'utf8');
function fixture(desktop = true) {
  let document;
  const ctx = new Proxy({}, {get(o, k) {
    if(k in o) return o[k];
    if(k === 'measureText') return () => ({width:20});
    if(String(k).startsWith('create')) return () => ({addColorStop(){}});
    return () => {};
  }});
  class Element {
    constructor(tag = 'div', attrs = {}) {
      this.tagName = tag.toUpperCase(); this.attrs = attrs; this.children = []; this.parentElement = null;
      this.style = {setProperty(){}}; this.events = {}; this.inert = false; this._text = '';
      this.disabled = 'disabled' in attrs; this.clientWidth = 400; this.clientHeight = 800;
      this.classList = {
        contains: c => (this.attrs.class || '').split(/\s+/).includes(c),
        add: c => this.classList.toggle(c, true), remove: c => this.classList.toggle(c, false),
        toggle: (c, on) => {const set = new Set((this.attrs.class || '').split(/\s+/).filter(Boolean));
          on = on === undefined ? !set.has(c) : on; on ? set.add(c) : set.delete(c); this.attrs.class = [...set].join(' '); return on;}
      };
    }
    get id(){return this.attrs.id || '';}
    get isConnected(){return !!this.closest('html');}
    get tabIndex(){return +(this.attrs.tabindex || 0);}
    set tabIndex(v){this.attrs.tabindex = String(v);}
    getAttribute(k){return this.attrs[k] ?? null;}
    setAttribute(k,v){this.attrs[k] = String(v);}
    hasAttribute(k){return k in this.attrs;}
    removeAttribute(k){delete this.attrs[k];}
    appendChild(el){el.parentElement = this;this.children.push(el);return el;}
    get textContent(){return this._text + this.children.map(c => c.textContent).join('');}
    set textContent(v){this._text = String(v);this.children = [];}
    get innerHTML(){return this._html || '';}
    set innerHTML(v){this._html = v;this.children = [];this._text = '';parse(v,this);}
    matches(s){
      s = s.trim();
      if(s.includes(':not(:disabled)')){if(this.disabled) return false;s = s.replace(':not(:disabled)','');}
      if(s === '[inert]') return this.inert;
      const tag = s.match(/^[\w-]+/);if(tag && this.tagName !== tag[0].toUpperCase()) return false;
      for(const m of s.matchAll(/#([\w-]+)/g)) if(this.id !== m[1]) return false;
      for(const m of s.matchAll(/\.([\w-]+)/g)) if(!this.classList.contains(m[1])) return false;
      for(const m of s.matchAll(/\[([\w-]+)(?:=['"]?([^'"\]]+)['"]?)?\]/g)) {
        if(!this.hasAttribute(m[1])) return false;
        if(m[2] !== undefined && this.getAttribute(m[1]) !== m[2]) return false;
      }
      return true;
    }
    querySelectorAll(s){const found=[];const walk=e=>{for(const c of e.children){if(s.split(',').some(q=>c.matches(q)))found.push(c);walk(c);}};walk(this);return found;}
    querySelector(s){return this.querySelectorAll(s)[0] || null;}
    closest(s){for(let e=this;e;e=e.parentElement)if(s.split(',').some(q=>e.matches(q)))return e;return null;}
    contains(el){for(let e=el;e;e=e.parentElement)if(e===this)return true;return false;}
    getClientRects(){return this.closest('.screen') && !this.closest('.screen').classList.contains('on') ? [] : [{}];}
    getBoundingClientRect(){return {width:100,height:120,left:0,top:0,right:100,bottom:120};}
    getContext(){return ctx;}
    addEventListener(k,fn){(this.events[k] ||= []).push(fn);}
    focus(){if(this.disabled || this.closest('[inert]'))return;document.activeElement=this;this.dispatch('focus');}
    blur(){document.activeElement=document.body;}
    dispatch(k, extra={}){const event={target:this,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...extra};for(let e=this;e;e=e.parentElement)for(const fn of e.events[k] || [])fn.call(e,event);return event;}
    click(){if(!this.disabled && !this.closest('[inert]')){this.focus();this.dispatch('click');}}
  }
  function parse(html, root){
    const stack=[root];
    for(const m of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<\/?([\w-]+)([^>]*)>|([^<]+)/g)) {
      if(m[3]){stack.at(-1)._text += m[3];continue;}
      if(m[0].startsWith('</')){if(stack.length>1)stack.pop();continue;}
      const attrs={};for(const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)')?/g))attrs[a[1]]=a[2]??a[3]??'';
      const el=stack.at(-1).appendChild(new Element(m[1],attrs));
      if(!['meta','link','img','input','br','hr','source'].includes(m[1]) && !m[0].endsWith('/>'))stack.push(el);
    }
  }
  document = new Element('document');parse(read('index.html'),document);
  document.documentElement=document.querySelector('html');document.body=document.querySelector('body');document.activeElement=document.body;
  document.getElementById=id=>document.querySelector('#'+id);
  document.createElement=tag=>new Element(tag);
  const timers=[];const pads=[];const saves=new Map();
  const sandbox={document,console,Math,Date,performance:{now:()=>0},navigator:{getGamepads:()=>pads},
    getComputedStyle:el=>({visibility:el.getClientRects().length?'visible':'hidden'}),
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},setInterval:()=>1,clearInterval(){},
    localStorage:{getItem:k=>saves.get(k)??null,setItem:(k,v)=>saves.set(k,v)},Image:class{},Path2D:class{}};
  sandbox.window={matchMedia:q=>({matches:q.includes('hover') && desktop}),innerWidth:1000,innerHeight:800,devicePixelRatio:1,addEventListener(){}};
  const context=vm.createContext(sandbox);
  const run=code=>vm.runInContext(code,context);
  for(const file of ['core','i18n','data','audio','runtime','ui','local','ai','mechanics','race','render','hud','input','main'])run(read('js/'+file+'.js'));
  const $=s=>document.querySelector(s);
  const click=id=>{assert.ok($('#'+id),'missing '+id);$('#'+id).click();};
  const boot=()=>{timers.shift()();};
  return {run,$,click,boot,pads,document,timers,saves};
}
let checks=0;
function test(name, fn){fn();checks++;console.log('  ok  '+name);}
const f=fixture();const {run,$,click}=f;
f.boot();
test('first visit opens language and gates Home',()=>{assert.ok($('#langWrap').classList.contains('on'));assert.ok($('#home').inert);});
f.document.querySelector('[data-lang="en"]').click();
test('language choice persists and releases Home',()=>{assert.equal(f.saves.get('seren.lang'),'en');assert.equal($('#home').inert,false);});
click('btnSound');click('btnSound');
for(const language of ['en','fr']){
  run('lang = '+JSON.stringify(language)+'; applyLang()');
  click('btnStart');
  test(language+' mode navigation and focus isolation',()=>{assert.equal(run('menuScreen'),'modes');assert.ok($('#home').inert);assert.equal($('#modes').inert,false);assert.ok($('#cars').inert);});
  click('modeBots');
  for(const diff of ['Easy','Medium','Hard','Brutal']){
    click('diff'+diff);
    test(language+' '+diff+' reaches car showroom',()=>{assert.equal(run('G.diff'),diff.toLowerCase());assert.equal(run('menuScreen'),'cars');assert.ok($('#carHeroName').textContent);});
    click('btnCloseCars');
  }
  click('btnCloseDiffs');click('btnCloseModes');
  click('btnGarage');
  for(const tab of ['Cars','Tracks','Items','Effects']){click('tab'+tab);test(language+' reference '+tab,()=>{assert.ok($('#garageBody').children.length);assert.equal($('#tab'+tab).getAttribute('aria-selected'),'true');});}
  click('btnCloseGarage');
}
for(const count of [2,3,4]){
  click('btnStart');click('modeLocal');click('count'+count);
  test(count+' players wait for enough controllers',()=>{assert.equal(run('G.players'),count);assert.equal($('#btnPadsGo').disabled,true);});
  f.pads.length=0;for(let i=0;i<count;i++)f.pads.push({index:i*2,connected:true,id:i===0?'<test controller>':'Controller '+i,axes:[0,0],buttons:Array.from({length:18},()=>({pressed:false,value:0}))});
  run('padsRefresh()');
  test(count+' controller assignments and readiness',()=>{assert.equal($('#btnPadsGo').disabled,false);assert.equal($('#padList').children.length,count);assert.ok($('#padList').innerHTML.includes('&lt;test controller&gt;'));});
  f.pads[0].connected=false;run('padsRefresh()');assert.ok($('#btnPadsGo').disabled);
  f.pads[0].connected=true;run('padsRefresh()');
  click('btnPadsGo');assert.deepEqual(Array.from(run('G.padIds')),f.pads.map(p=>p.index));
  click('styleCustom');
  for(let n=0;n<=6-count;n++){
    $('[data-bots="'+n+'"]').click();
    test(count+' players / '+n+' bots',()=>{assert.equal(run('botsWanted()'),n);assert.equal($('[data-diff="easy"]').disabled,n===0);assert.equal(f.document.activeElement.getAttribute('data-bots'),String(n));});
  }
  for(const d of ['easy','medium','hard','brutal']){$('[data-diff="'+d+'"]').click();assert.equal(run('G.diff'),d);}
  for(const rule of ['traps','bubbles','boost','ults']){
    $('[data-rule="'+rule+'"]').click();assert.equal(run('G.rules.'+rule),false);assert.equal($('[data-rule="'+rule+'"]').getAttribute('aria-checked'),'false');
  }
  click('btnCustomGo');click('carRedd');
  test(count+' turn-taking, taken cars, and Back undo',()=>{assert.ok($('#carRedd').disabled);assert.equal(run('pickTurn'),1);click('btnCloseCars');assert.equal(run('pickTurn'),0);assert.equal($('#carRedd').disabled,false);});
  click('btnCloseCars');click('btnCloseCustom');click('styleStandard');
  test(count+' Standard clears custom rules',()=>{assert.equal(run('G.custom'),false);assert.ok(run('G.rules.traps && G.rules.bubbles && G.rules.boost && G.rules.ults'));});
  click('diffMedium');
  f.pads[0].connected=false;run('carPadTick(.016)');assert.equal($('#carPadState').textContent,run('t("padMissing")'));
  f.pads[0].connected=true;run('carPadTick(.016)');assert.equal($('#carPadState').textContent,run('t("padReady")'));
  run('carStep(1)');assert.equal(run('carCur'),1);assert.ok($('#carPhantom').classList.contains('cursor'));
  // Exercise the actual controller edge handler, not only its helpers.
  f.pads[0].buttons[0].pressed=true;run('carPadTick(.016)');f.pads[0].buttons[0].pressed=false;
  assert.equal(run('G.picks[0]'),'phantom');
  for(let i=1;i<count;i++)click('carRandom');
  test(count+' picks start the unchanged local race',()=>{assert.equal(run('menuScreen'),'race');assert.equal(run('G.state'),'countdown');assert.equal(run('G.picks.length'),count);assert.equal(new Set(run('G.picks')).size,count);});
  run('pause(true)');assert.ok($('.hud').inert);click('btnResume');assert.equal($('.hud').inert,false);
  run('pause(true)');click('btnQuit');f.pads.length=0;
}
click('btnStart');click('modeEndless');click('carRandom');
test('Endless random pick starts race',()=>{assert.equal(run('G.mode'),'endless');assert.equal(run('G.state'),'countdown');});
run('pause(true)');click('btnQuit');
click('btnStart');click('modeBots');click('diffHard');click('carRedd');
run('G.finished = 1; finishRace()');f.timers.at(-1)();
test('results isolate focus and replay returns to race',()=>{assert.equal(run('G.state'),'over');assert.ok($('.hud').inert);assert.equal(f.document.activeElement.id,'btnAgain');click('btnAgain');assert.equal(run('G.state'),'countdown');assert.equal($('.hud').inert,false);});
run('pause(true)');click('btnQuit');click('btnStart');
test('native Enter does not bypass a focused mode',()=>{const event=$('#modeBots').dispatch('keydown',{key:'Enter'});assert.equal(!!event.defaultPrevented,false);assert.equal(run('menuScreen'),'modes');});
test('Escape follows Back and restores the invoking control',()=>{$('#modeBots').dispatch('keydown',{key:'Escape'});assert.equal(run('menuScreen'),'home');assert.equal(f.document.activeElement.id,'btnStart');});
click('btnLang');f.document.querySelector('[data-lang="fr"]').click();
test('later language switching restores Home focus',()=>{assert.equal(f.saves.get('seren.lang'),'fr');assert.equal(f.document.activeElement.id,'btnLang');});
const mobile=fixture(false);mobile.boot();mobile.document.querySelector('[data-lang="fr"]').click();mobile.click('btnStart');
test('touch capability gates Local with native disabled state',()=>{assert.ok(mobile.$('#modeLocal').disabled);mobile.click('modeLocal');assert.equal(mobile.run('menuScreen'),'modes');});
console.log('\n'+checks+' menu behavior checks passed (DOM/Canvas test doubles; visual and hardware checks separate).');
