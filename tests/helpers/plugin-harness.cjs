const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('../../config.js');
const D = require('../../design.js');

// Exercise the actual plugin against a controlled frame/audio clock. Browser
// pages still check rendered CSS and real browser event/timing behaviour.
function trialHarness(row, changeConfig = () => {}, initiallyLocked = true, environment = {}) {
  const config = structuredClone(C);
  changeConfig(config);
  let now = environment.startPerfMs ?? 1000, nextFrame = null, record = null;
  const draws = [], tones = [], timers = new Map();
  function element() {
    const listeners = new Map();
    return {
      hidden: false, style: {setProperty(name, value) {this[name] = value;}}, dataset: {},
      classList: {add() {}, remove() {}, toggle() {}}, listeners,
      addEventListener(type, callback) {listeners.set(type, callback);},
      removeEventListener(type) {listeners.delete(type);}
    };
  }
  function canvas() {
    const node = element();
    const context = {
      scale() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      save() {}, restore() {}, clip() {}, drawImage() {},
      arc(x,y,radius) {draws.push({stage:node.dataset.stage,x,y,radius});},
      fill() {}, fillText() {throw new Error('Timed targets must use dots, not numerals.');}
    };
    node.getContext = () => context;
    return node;
  }
  const display = element(), pad = element(), reminder = element(), cursor = element(), cross = element(), screenCanvas = canvas();
  pad.hidden = true;
  const buttons = config.responsePad.numbers.map(number => ({...element(),dataset:{number:String(number)},closest() {return this;}}));
  display.querySelector = selector => ({canvas:screenCanvas,'.enum-fixation':cross,'.enum-number-pad':pad,'.enum-trial-reminder':reminder,'.enum-cursor':cursor})[selector];
  const body=element();
  const document = {...element(),body,createElement:canvas,hidden:false,pointerLockElement:initiallyLocked?body:null};
  body.requestPointerLock = () => {document.pointerLockElement=body;document.listeners.get('pointerlockchange')?.();};
  document.exitPointerLock = () => {document.pointerLockElement=null;document.listeners.get('pointerlockchange')?.();};
  pad.querySelectorAll = () => buttons;
  const audio = {state:'running',baseLatency:0,outputLatency:0};
  Object.defineProperty(audio, 'currentTime', {get: () => now/1000});
  const jsPsych = {
    pluginAPI: {
      audioContext: () => audio,
      setTimeout(callback, delay) {timers.set(callback,now+delay);},
      clearAllTimeouts() {timers.clear();}
    },
    finishTrial(data) {record=data;}
  };
  const root = {
    ...element(),EnumerationDesign:D,EnumerationRuntime:{active:null},
    EnumerationDisplay:{applyCalibration:()=>({})},
    EnumerationAudio:{playTone(context,timing,start) {tones.push(start);return {source:{stop() {},disconnect() {}},envelope:{disconnect() {}}};}},
    jsPsychModule:{ParameterType:new Proxy({}, {get: (_,key) => key})}
  };
  const frameMs = 1000/(environment.refreshHz ?? 120);
  const settings = {config,frameMs,pixelsPerDegree:D.pixelsPerDegree(34.5,70,1728),pixelsPerMm:1728/345,requireFullscreen:false};
  const layout = D.responseLayout(1728,1117,settings.pixelsPerDegree,config.geometry,config.responsePad,settings.pixelsPerMm);
  buttons.forEach((button,i) => {button.getBoundingClientRect=()=>({left:layout.left_px+i*(layout.button_width_px+layout.gap_px),right:layout.left_px+i*(layout.button_width_px+layout.gap_px)+layout.button_width_px,top:layout.top_px,bottom:layout.top_px+layout.button_height_px});});
  const context = vm.createContext({window:root,document,innerWidth:1728,innerHeight:1117,devicePixelRatio:1,
    setTimeout,clearTimeout,performance:{now:()=>now},requestAnimationFrame:callback => {nextFrame=callback;return 1;},cancelAnimationFrame:()=>{nextFrame=null;}});
  vm.runInContext(fs.readFileSync(require.resolve('../../plugin-enumeration.js'),'utf8'),context);
  const plugin = new root.jsPsychEnumeration(jsPsych);
  plugin.trial(display,{row,settings});
  function advance(frames = 1) {
    for(let i=0;i<frames;i++) {
      now+=frameMs;
      const callback=nextFrame;nextFrame=null;if(callback)callback();
      for(const [timer,deadline] of timers) if(now>=deadline) {timers.delete(timer);timer();}
    }
  }
  function until(condition, maxFrames = 1500) {
    for(let i=0;i<maxFrames&&!condition();i++)advance();
    assert.ok(condition(),'Expected trial state was reached');
  }
  function move(x, y, extra = {}) {
    const current=root.EnumerationRuntime.active.cursor;
    document.listeners.get('mousemove')?.({type:'mousemove',buttons:0,movementX:x-current.x_px,movementY:y-current.y_px,...extra});
  }
  function press(number, extra = {}) {
    const rect=buttons.find(button=>Number(button.dataset.number)===number).getBoundingClientRect();
    move((rect.left+rect.right)/2,(rect.top+rect.bottom)/2);
    document.listeners.get('mousedown')?.({type:'mousedown',button:0,buttons:1,clientX:0,clientY:0,
      target:display,preventDefault() {},...extra});
  }
  return {config,display,pad,reminder,cursor,document,mouse:root.EnumerationMouse,draws,tones,settings,advance,until,move,press,
    active:()=>root.EnumerationRuntime.active,record:()=>record,now:()=>now,
    restart:()=>plugin.trial(display,{row,settings}),blur:()=>root.listeners.get('blur')?.(),
    unlock:()=>{document.pointerLockElement=null;document.listeners.get('pointerlockchange')?.();}};
}

function dotRow(phase = 'tone_training') {
  return D.practiceRows(C,C.design.cues,'plugin-check',9,phase).find(row=>row.target_numerosity===6);
}

module.exports = {trialHarness, dotRow};
