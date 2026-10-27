const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomUUID, createHash} = require('node:crypto');
const C = require('../config.js');
const D = require('../design.js');

const {harness, nodes} = require('./helpers/full-experiment-harness.cjs');

test('full entry point builds the exact single-pass training sequence before nine main blocks', async () => {
  const h = await harness();
  const app = h.context.EnumerationApp;
  assert.equal(app.metadata.setup.mode, 'full');
  assert.equal(app.metadata.experiment_variant, 'full');
  assert.equal(app.rows.length, 810);
  assert.ok(app.rows.every(row => row.mode === 'full' && row.array_duration_ms === 200 / 3));
  const all = nodes(h.timeline);
  assert.equal(all.filter(n => typeof n.data === 'function' && n.data().task === 'cue_training').length, 3);
  const pad = all.filter(n => n.data?.task === 'number_pad_training');
  assert.equal(pad.length, 5);
  assert.equal(new Set(pad.map(n => n.data.requested_number)).size, 5);
  assert.deepEqual(Array.from(pad, n => n.data.number_pad_check), [1, 2, 3, 4, 5]);
  assert.ok(pad.every((n, i) => n.data.number_pad_check_total === 5 && !n.stimulus.includes('Number-pad check')&&n.stimulus.includes(`<h1>Click ${n.data.requested_number}</h1>`)));
  assert.ok(all.filter(n => n.loop_function).every(n => !nodes(n.timeline).some(child => child.data?.task === 'number_pad_training')));
  const procedures = all.filter(n => n.timeline_variables);
  assert.deepEqual(Array.from(procedures, n => n.timeline_variables.length), [5, 8, ...Array(9).fill(90)]);
  assert.ok(procedures.slice(0, 2).every(n => n.timeline_variables.every(v => v.row.use_dots === true)));
  assert.ok(procedures[0].timeline_variables.every(v=>v.row.phase==='tone_training'&&v.row.mask_enabled===false));
  assert.ok(procedures[1].timeline_variables.every(v=>v.row.phase==='mixed_practice'&&v.row.mask_enabled===true));
  const cue=all.filter(n=>typeof n.data==='function'&&n.data().task==='cue_training');
  assert.deepEqual(Array.from(cue,n=>n.data().cue_meaning).sort(),['left','neutral','right']);
  const order=[all.find(n=>n.data?.task==='sound_check'),all.find(n=>n.data?.task==='display_check'),cue[0],pad[0],procedures[0],procedures[1],procedures[2]].map(n=>all.indexOf(n));
  assert.ok(order.every((index,i)=>index>=0&&(i===0||index>order[i-1])));
  assert.ok(!all.some(n=>n.timeline_variables?.some(v=>v.row.phase==='unmasked_practice')));
  assert.ok(all.filter(n=>typeof n.stimulus==='string').every(n=>!n.stimulus.includes('Enable mouse control')));
  assert.equal(all.filter(n => n.data?.task === 'break').length, 8);
  const session2 = await harness({session: '2'});
  assert.equal(new Set([...app.rows, ...session2.context.EnumerationApp.rows].map(r => r.configuration_id)).size, 1620);
});

test('full entry point refuses unmeasured calibration, windowed runs, and invalid assignments or sessions', async () => {
  for (const [overrides, message] of [[{verified: null}, /Verify the physical/], [{fullscreen: null}, /require fullscreen/],
    [{assignment: '45'}, /assignment version/], [{assignment: '1.5'}, /assignment version/], [{session: '3'}, /Choose session/]]) {
    const h = await harness(overrides);
    assert.equal(h.timeline, undefined);
    assert.match(h.status.textContent, message);
  }
});

test('stale configuration cannot silently expand the number-pad check to ten items', async () => {
  const stale = structuredClone(C);
  delete stale.training.numberPadTrials;
  const h = await harness({}, {EnumerationConfig: stale, console: {...console, error() {}}});
  assert.equal(h.timeline, undefined);
  assert.match(h.context.document.getElementById('experiment').innerHTML, /Reload the experiment page/);
});

test('training runs once and proceeds to main trials after completion regardless of practice accuracy', async () => {
  const h=await harness(),all=nodes(h.timeline);
  assert.ok(all.filter(n=>n.loop_function).every(n=>nodes(n.timeline).some(child=>child.data?.task==='display_check')));
  const main=all.find(n=>n.conditional_function&&n.timeline?.[0]?.data?.task==='main_instructions');
  assert.equal(main.conditional_function(),false);
  h.records.push(...Array.from({length:3},()=>({task:'cue_training',correct:false})),
    ...Array.from({length:5},()=>({task:'enumeration',phase:'tone_training',timing_compliant:false,timeout:true})),
    ...Array.from({length:8},()=>({task:'enumeration',phase:'mixed_practice',timing_compliant:false,timeout:true})));
  for(const task of ['cue_training_result','tone_training_result','mixed_practice_result','training_result'])all.find(n=>n.data?.task===task).func();
  const training=h.context.EnumerationApp.metadata.training;
  assert.equal(training.cue_attempts,1);
  assert.equal(training.cue_completed,3);
  assert.equal(training.cue_correct,0);
  assert.equal(training.tone_training_completed,5);
  assert.equal(training.mixed_practice_completed,8);
  assert.equal(training.tone_training_attempts,1);
  assert.equal(training.mixed_practice_attempts,1);
  assert.equal(training.completed,true);
  assert.equal(main.conditional_function(),true);
});

test('pilot and demo entry points use the same three-arrow, five-pad, five-unmasked-tone, eight-masked-practice order', async () => {
  for(const mode of ['pilot','demo']) {
    const h=await harness({mode},{},'pilot'),all=nodes(h.timeline);
    assert.equal(all.filter(n=>typeof n.data==='function'&&n.data().task==='cue_training').length,3);
    assert.equal(all.filter(n=>n.data?.task==='number_pad_training').length,5);
    const procedures=all.filter(n=>n.timeline_variables);
    assert.deepEqual(Array.from(procedures.slice(0,2),n=>n.timeline_variables.length),[5,8]);
    assert.ok(procedures[0].timeline_variables.every(v=>v.row.mask_enabled===false));
    assert.ok(procedures[1].timeline_variables.every(v=>v.row.mask_enabled===true));
    assert.ok(!all.some(n=>n.loop_function));
    assert.equal(h.context.EnumerationApp.rows.length,mode==='demo'?20:810);
  }
});

test('production display gate accepts 60 Hz and faster without an upper limit and rejects below tolerance', async () => {
  const h = await harness();
  const check = nodes(h.timeline).find(n => n.data?.task === 'display_check');
  const execute = () => new Promise(resolve => check.func(resolve));
  await execute();
  assert.equal(h.context.EnumerationApp.metadata.setup_ready, true);
  for (const [hz, expected] of [[30, false], [56.9, false], [57.01, true], [59.94, true], [60, true], [75, true], [120, true], [144, true], [240, true]]) {
    let stamp = 0;
    h.context.requestAnimationFrame = fn => queueMicrotask(() => fn(stamp += 1000 / hz));
    await execute();
    const v = h.context.EnumerationApp.metadata.display_validation;
    assert.equal(v.minimum_refresh_met, expected, `${hz} Hz`);
    assert.equal(h.context.EnumerationApp.metadata.setup_ready, expected, `${hz} Hz`);
    assert.equal(v.required_refresh_hz, 60);
    assert.equal(v.minimum_refresh_hz, 57);
    if (hz === 60) {
      assert.equal(v.reference_refresh_match, false); // Informational; no longer blocks admission.
      const plan = D.framePlan(C.timing, h.context.EnumerationApp.settings.frameMs);
      assert.equal(plan.arrayFrames, 4); assert.equal(plan.maskFrames, 6);
    }
  }
  let slowStamp = 0;
  h.context.requestAnimationFrame = fn => queueMicrotask(() => fn(slowStamp += 1000 / 30));
  await execute();
  assert.equal(h.context.EnumerationApp.metadata.setup_ready, false);
  const validation = h.context.EnumerationApp.metadata.display_validation;
  assert.equal(validation.geometry_fits, true);
  assert.equal(validation.reference_refresh_match, false);
  const problem = nodes(h.timeline).find(n => n.data?.task === 'display_setup_problem');
  assert.match(problem.stimulus(), /stimuli and response pad fit this screen/);
  assert.match(problem.stimulus(), /30.0 Hz measured; minimum 60 Hz/);
  assert.match(problem.stimulus(), /pass from 57.0 Hz/);
});

test('calibrated 14-inch and 16-inch MacBook layouts fit across CSS display scaling', async () => {
  for (const [screenWidthCm, width, height] of [[30.2, 1512, 982], [30.2, 1147, 745], [34.5, 1728, 1117], [34.5, 1152, 745]]) {
    const h = await harness({screen_width: String(screenWidthCm)}, {screen: {width, height}, innerWidth: width, innerHeight: height});
    const check = nodes(h.timeline).find(n => n.data?.task === 'display_check');
    await new Promise(resolve => check.func(resolve));
    assert.equal(h.context.EnumerationApp.metadata.display_validation.geometry_fits, true);
    assert.equal(h.context.EnumerationApp.metadata.setup_ready, true);
  }
});

test('display diagnostics separate real clipping, fullscreen loss, and suspended audio; recheck can pass', async () => {
  const h = await harness({}, {innerWidth: 600, innerHeight: 260});
  const all = nodes(h.timeline);
  const check = all.find(n => n.data?.task === 'display_check');
  const problem = all.find(n => n.data?.task === 'display_setup_problem');
  const gate = all.find(n => n.timeline?.[0] === check);
  h.context.document.fullscreenElement = null;
  h.audio.state = 'suspended';
  const execute = () => new Promise(resolve => check.func(resolve));
  await execute();
  const validation = h.context.EnumerationApp.metadata.display_validation;
  assert.equal(validation.geometry_fits, false);
  assert.equal(validation.reference_refresh_match, true);
  assert.equal(validation.fullscreen_ready, false);
  assert.equal(validation.audio_ready, false);
  assert.match(problem.stimulus(), /do not fit the available browser area/);
  assert.match(problem.stimulus(), /Command–0/);
  const choice = response => ({filter: () => ({last: () => ({values: () => [{response}]})})});
  assert.equal(gate.loop_function(choice(0)), true);
  assert.equal(gate.loop_function(choice(1)), false);
  h.context.innerWidth = 1728; h.context.innerHeight = 1117;
  h.context.document.fullscreenElement = {};
  h.audio.state = 'running';
  await execute();
  assert.equal(h.context.EnumerationApp.metadata.setup_ready, true);
  assert.equal(gate.loop_function(choice(0)), false);
});

test('archived baseline is preserved and full parameters record the requested training and mouse updates', () => {
  const root = path.join(__dirname, '..');
  const hashes = require('../output/source-demo-sha256.json');
  for (const file of ['audio.js', 'display.js']) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), hashes[file], file);
  }
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, 'docs/archive/parameters-0.11.0.json'))).digest('hex'), hashes['docs/parameters.json']);
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, 'docs/archive/Experimental_design_and_parameters_0.11.0.docx'))).digest('hex'), hashes['docs/Experimental_design_and_parameters.docx']);
  const original = require('../docs/archive/parameters-0.11.0.json');
  const expected = structuredClone(original.config);
  expected.experimentVersion = '0.16.0-full';
  expected.timing.minimumRefreshHz = 60;
  expected.displaySetup.refreshMode = '60 Hz or higher; ProMotion also supported';
  expected.training = {cueTrials:3,numberPadTrials:5,toneTrials:5,mixedTrials:8,feedbackMs:900,arrayDurationsMs:[200/3,150,300]};
  delete expected.responsePad.reminderGapMm;
  expected.mouseCursor = {resetBelowDeg: 0.8};
  assert.deepEqual(C, expected);
});

test('existing start and break buttons acquire mouse control before the next timed procedure', async () => {
  const h=await harness();
  h.audio.resume=async()=>{};
  const all=nodes(h.timeline);
  const pages=all.filter(n=>typeof n.stimulus==='string'&&(n.data?.task==='main_instructions'||/<h1>(Practice responding to the tone|Practice full experiment trials|Take a break)<\/h1>/.test(n.stimulus)));
  assert.equal(pages.length,11);
  for(const page of pages) {
    h.context.document.pointerLockElement=null;
    page.on_load();
    const button=h.context.document.getElementById('continue-button');
    assert.equal(button.dataset.mouseStart,'true');
    assert.equal(button.clickOptions.capture,true);
    button.click();
    await Promise.resolve();
    assert.equal(h.context.document.pointerLockElement,h.context.document.body);
  }
});

test('number-pad checks use the timed response geometry at different viewport sizes', async () => {
  for(const [width,height] of [[1728,1117],[1512,982],[1152,745]]) {
    for(const entryPoint of ['full','pilot']) {
      const h=await harness({}, {innerWidth:width,innerHeight:height,screen:{width,height}}, entryPoint);
      const app=h.context.EnumerationApp;
      const expected=D.responseLayout(width,height,app.settings.pixelsPerDegree,C.geometry,C.responsePad,app.settings.pixelsPerMm);
      for(const trial of nodes(h.timeline).filter(n=>n.data?.task==='number_pad_training')) {
        trial.on_load();
        const group=h.context.document.getElementById('jspsych-html-button-response-btngroup');
        assert.equal(parseFloat(group.style.left),expected.left_px);
        assert.equal(parseFloat(group.style.top),expected.top_px);
        assert.equal(parseFloat(group.style.width),expected.width_px);
        assert.equal(parseFloat(group.style.height),expected.height_px);
        assert.equal(parseFloat(group.style.gap),expected.gap_px);
        for(let i=0;i<10;i++)assert.equal(parseFloat(h.context.document.getElementById('number-'+i).style.height),expected.button_height_px);
        const record={response:trial.data.requested_number};trial.on_finish(record);
        assert.equal(record.response_pad_layout.top_px,expected.top_px);
        assert.equal(record.viewport_width_px,width);
        assert.equal(record.viewport_height_px,height);
      }
    }
  }
});
