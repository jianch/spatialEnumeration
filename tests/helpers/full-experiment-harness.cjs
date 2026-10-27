const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomUUID, createHash} = require('node:crypto');
const C = require('../../config.js');
const D = require('../../design.js');

// Run the real entry point with a DOM/framework adapter to inspect its full
// timeline and readiness decisions without waiting through timed trials.
async function harness(overrides = {}, environment = {}, entryPoint = 'full') {
  const entryRoot=path.resolve(__dirname,entryPoint==='full'?'../..':'../reference-pilot');
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {innerHTML: '', value: '34.5', style: {},
      textContent: '', dataset: {}, classList: {add() {},remove() {}}, querySelector() {return element('continue-button');}, querySelectorAll(selector) {return selector==='button'?Array.from({length:10},(_,i)=>element('number-'+i)):[element('continue-button')];}, addEventListener(type, fn, options) {this[type] = fn;this[type+'Options']=options;}, replaceChildren() {this.innerHTML = '';}});
    return elements.get(id);
  };
  let timeline, clock = 0;
  const records = [];
  const collection = values => ({values: () => values, count: () => values.length,
    filter: criteria => collection(values.filter(r => Object.entries(criteria).every(([key, value]) => r[key] === value))),
    last: count => collection(values.slice(-count))});
  const audio = {state: 'running'};
  const jsPsych = {getDisplayElement: () => element('experiment'), abortExperiment: message => {throw new Error(message);}, run: async nodes => {timeline = nodes;}, data: {get: () => collection(records)},
    timelineVariable: name => ({timelineVariable: name})};
  const context = {EnumerationConfig: structuredClone(require(path.join(entryRoot,'config.js'))), EnumerationDesign: require(path.join(entryRoot,'design.js')),
    EnumerationAudio: {initializationOptions: () => ({}), unlock: async () => audio, checkTone() {}},
    EnumerationDisplay: {applyCalibration: () => ({})}, EnumerationMouse: {acquire: async () => {context.document.pointerLockElement=context.document.body;},release: async () => {context.document.pointerLockElement=null;}}, initJsPsych: options => {jsPsych._options = options; return jsPsych;},
    jsPsychEnumeration: {}, jsPsychCallFunction: {}, jsPsychHtmlButtonResponse: {}, jsPsychFullscreen: {},
    document: {getElementById: element, querySelector: element, querySelectorAll: () => [], fullscreenElement: {},
      body: element('body'), hidden: false, hasFocus: () => true},
    crypto: {randomUUID}, indexedDB: {open() {throw new Error('Storage disabled in unit harness');}},
    FormData: class {constructor(form) {this.form = form;} get(key) {return this.form.values[key] ?? null;}},
    location: {protocol: 'http:'}, screen: {width: 1728, height: 1117}, innerWidth: 1728, innerHeight: 1117,
    navigator: {userAgent: 'NODE_FULL_ENTRY_TEST'}, devicePixelRatio: 2, console,
    requestAnimationFrame: fn => queueMicrotask(() => fn(clock += 1000 / 120)), ...environment};
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(entryRoot, 'app.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  const form = element('setup-form');
  form.values = {participant: 'FULL_TEST', mode: 'demo', session: '1', assignment: '0',
    screen_width: '34.5', viewing_distance: '70', verified: 'on', fullscreen: 'on', seed: '', ...overrides};
  await form.submit({preventDefault() {}, currentTarget: form});
  return {context, timeline, records, audio, status: element('setup-status')};
}

function nodes(timeline) {return timeline.flatMap(node => [node, ...nodes(node.timeline || [])]);}

module.exports = {harness, nodes};
