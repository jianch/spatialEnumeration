const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../config.js');
const D = require('../design.js');
const base = {seed: 'P001/s1', assignmentVersion: 0, mode: 'pilot'};

test('two sessions preserve every cell count, side balance, unique images, and block size', () => {
  const all = [];
  for (const session of [1, 2]) {
    const rows = D.makeDesign(C, {...base, session});
    assert.equal(rows.length, 810);
    for (let block = 1; block <= 9; block++) {
      const b = rows.filter(r => r.block === block);
      assert.equal(b.length, 90);
      for (const n of C.design.numerosities) assert.equal(b.filter(r => r.target_numerosity === n).length, 10);
    }
    for (const n of C.design.numerosities) for (const delay of C.design.signalDelaysMs) {
      const cell = rows.filter(r => r.target_numerosity === n && r.signal_delay_ms === delay);
      for (const [condition, count] of [['valid',6], ['invalid',2], ['neutral',2]]) {
        const subset = cell.filter(r => r.cue_validity === condition);
        assert.equal(subset.length, count);
        assert.equal(subset.filter(r => r.target_side === 'left').length, count / 2);
        assert.equal(subset.filter(r => r.target_side === 'right').length, count / 2);
      }
    }
    all.push(...rows);
  }
  assert.equal(new Set(all.map(r => r.configuration_id)).size, 1620);
  for (const row of all) {
    if (row.cue_validity === 'valid') assert.equal(row.cue_meaning, row.target_side);
    if (row.cue_validity === 'invalid') assert.notEqual(row.cue_meaning, row.target_side);
    if (row.cue_validity === 'neutral') assert.equal(row.cue_meaning, 'neutral');
  }
});

test('counterbalancing crosses each image with every delay and 3:1:1 validity assignments', () => {
  const small = structuredClone(C); small.design.numerosities = [6];
  const assignments = new Map();
  for (let version = 0; version < 45; version++) {
    for (const session of [1,2]) for (const row of D.makeDesign(small, {...base, session, assignmentVersion: version})) {
      if (!assignments.has(row.configuration_id)) assignments.set(row.configuration_id, []);
      assignments.get(row.configuration_id).push(row);
    }
  }
  for (const list of assignments.values()) for (const delay of C.design.signalDelaysMs) {
    const subset = list.filter(r => r.signal_delay_ms === delay);
    assert.equal(subset.filter(r => r.cue_validity === 'valid').length, 3);
    assert.equal(subset.filter(r => r.cue_validity === 'invalid').length, 1);
    assert.equal(subset.filter(r => r.cue_validity === 'neutral').length, 1);
    assert.deepEqual(subset[0].dot_coordinates_deg, list[0].dot_coordinates_deg);
  }
});

test('seed reproducibility and fixed semantic arrow meanings', () => {
  assert.deepEqual(D.makeDesign(C, {...base, session:1}), D.makeDesign(C, {...base, session:1}));
  assert.notDeepEqual(D.makeDesign(C, {...base, seed:'another', session:1}), D.makeDesign(C, {...base, session:1}));
  assert.deepEqual(D.cueMapping(C.design.cues), {left:'arrow-left',right:'arrow-right',neutral:'arrow-neutral'});
  const rows = D.makeDesign(C, {...base, session:1});
  for (const row of rows) {
    assert.equal(row.cue_symbol, {left:'arrow-left',right:'arrow-right',neutral:'arrow-neutral'}[row.cue_meaning]);
    assert.equal('cue_version' in row, false);
  }
  const practice = D.practiceRows(C, D.cueMapping(C.design.cues), 'practice', 15, 'mixed_practice');
  for (const row of practice) assert.equal(row.cue_symbol, C.design.cues[row.cue_meaning]);
});

test('dots fit the aperture and minimum spacing for all pilot stimuli', () => {
  for (const session of [1, 2]) for (const row of D.makeDesign(C, {...base, session})) {
    const points = row.dot_coordinates_deg;
    assert.equal(points.length, row.target_numerosity);
    for (const p of points) assert.ok(Math.hypot(p.x, p.y) <= (C.geometry.apertureDiameterDeg - C.geometry.dotDiameterDeg)/2 + 0.000002);
    for (let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) assert.ok(Math.hypot(points[i].x-points[j].x, points[i].y-points[j].y) >= C.geometry.minCenterSeparationDeg - 0.000002);
  }
});

test('mouse scoring preserves the first number, timing failures, and ignored events', () => {
  const score = list => D.scoreResponse(list.map(([value,perf_ms,accepted=true])=>({value,perf_ms,accepted})),1000,900,6,C.timing,1010);
  assert.equal(score([[6,1200]]).correct_timely, true);
  assert.equal(score([[5,1200],[6,1250]]).response,5);
  assert.equal(score([[6,1200]]).rt_pad_ms,190);
  assert.equal(score([[6,1000+C.timing.responseDeadlineMs+100]]).late,true);
  assert.equal(score([]).timeout,true);
  assert.equal(score([[0,1200]]).reported_number,0);
  assert.equal(score([[6,1050]]).fast_response,true);
  assert.equal(score([[6,1000,false],[5,1200]]).response,5);
  assert.equal(score([[6,2500]]).timing_compliant,true);
  assert.equal(score([[6,1000+C.timing.responseDeadlineMs]]).timing_compliant,true);
  assert.equal(score([[6,1000+C.timing.responseDeadlineMs+0.01]]).timing_compliant,false);
  assert.equal(score([['o',1200]]).response,null);
});

test('varied exposures stay in practice and demonstration and the pad fits below the target apertures', () => {
  const pilot=D.makeDesign(C,{...base,session:1});
  assert.ok(pilot.every(r=>Math.abs(r.array_duration_ms-200/3)<1e-9 && r.signal_delay_ms===r.signal_delay_requested_ms));
  const demo=D.makeDesign(C,{...base,session:1,mode:'demo'});
  for (const duration of C.demo.arrayDurationsMs) assert.equal(demo.filter(r=>r.array_duration_ms===duration).length,4);
  assert.ok(demo.every(r=>r.signal_delay_ms>=r.array_duration_ms));
  for (const [phase,count] of [['tone_training',C.training.toneTrials],['mixed_practice',C.training.mixedTrials]]) {
    const practice=D.practiceRows(C,C.design.cues,'exposure-test',count,phase);
    assert.equal(practice.length,count);
    assert.deepEqual(practice,D.practiceRows(C,C.design.cues,'exposure-test',count,phase));
    assert.deepEqual(C.training.arrayDurationsMs.map(duration=>practice.filter(r=>r.array_duration_ms===duration).length),phase==='tone_training'?[2,2,1]:[3,3,2]);
    const counts=C.design.numerosities.map(n=>practice.filter(r=>r.target_numerosity===n).length);
    assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
    assert.ok(practice.every(r=>r.use_dots===true&&r.dot_coordinates_deg.length===r.target_numerosity&&r.signal_delay_ms>=r.array_duration_ms));
  }
  const pixelsPerMm=1728/345;
  const ppd=D.pixelsPerDegree(34.5,70,1728);
  const layout=D.responseLayout(1728,1117,ppd,C.geometry,C.responsePad,pixelsPerMm);
  assert.ok(layout.fits);
  assert.equal(layout.columns,10);
  assert.ok(Math.abs(layout.button_width_px/pixelsPerMm-11)<1e-9);
  assert.ok(Math.abs(layout.height_px/pixelsPerMm-11)<1e-9);
  assert.ok(Math.abs(layout.width_px/pixelsPerMm-128)<1e-9);
  assert.ok(Math.abs((layout.top_px-1117/2-C.geometry.apertureDiameterDeg*ppd/2)/pixelsPerMm-4)<1e-9);
  assert.ok(Math.abs(layout.top_px+layout.height_px/2-layout.reminder_top_px-layout.reminder_height_px/2)<1e-9);
  assert.ok(Math.abs(layout.reminder_left_px+layout.reminder_width_px/2-layout.home_x_px)<1e-9);
  const cursorResetY=1117/2+C.mouseCursor.resetBelowDeg*ppd;
  assert.ok(cursorResetY>1117/2+C.geometry.fixationDiameterDeg*ppd/2);
  assert.ok(cursorResetY<layout.top_px);
  assert.equal(D.responseLayout(600,260,ppd,C.geometry,C.responsePad,pixelsPerMm).fits,false);
  assert.equal(D.responseLayout(500,900,ppd,C.geometry,C.responsePad,pixelsPerMm).fits,false);
});

test('frame conversion and CSV escaping', () => {
  assert.equal(D.framePlan(C.timing,1000/120).arrayFrames,8);
  assert.equal(D.framePlan(C.timing,1000/120,150).arrayFrames,18);
  assert.equal(D.framePlan(C.timing,1000/60,400).arrayFrames,24);
  assert.equal(D.framePlan(C.timing,1000/60).arrayFrames,4);
  assert.equal(D.framePlan(C.timing,1000/60).maskFrames,6);
  assert.equal(D.csv([{text:'a,"b"',flag:true}]),'"text","flag"\r\n"a,""b""","true"');
});


test('physical sizes survive display scaling and viewing-distance changes', () => {
  for (const width of [1152,1280,1728,2056]) for (const distance of [60,70,80]) {
    const pixelsPerMm=width/345;
    const ppd=D.pixelsPerDegree(34.5,distance,width);
    const layout=D.responseLayout(width,width*2234/3456,ppd,C.geometry,C.responsePad,pixelsPerMm);
    assert.ok(layout.fits);
    assert.ok(Math.abs(layout.button_width_px/pixelsPerMm-11)<1e-9);
    assert.ok(Math.abs(layout.gap_px/pixelsPerMm-2)<1e-9);
    assert.ok(Math.abs(C.geometry.dotDiameterDeg*ppd/pixelsPerMm-0.4*20*distance*Math.tan(Math.PI/360))<1e-9);
  }
  assert.throws(()=>D.responseLayout(1728,1117,60,C.geometry,C.responsePad,0),/calibration/);
});

test('published parameter snapshot matches the program and stimuli identify their pool', () => {
  assert.deepEqual(require('../docs/parameters.json').config,C);
  const rows=D.makeDesign(C,{...base,session:1});
  assert.ok(rows.every(r=>r.stimulus_pool_version===C.design.stimulusPoolSeed&&r.configuration_id.startsWith(C.design.stimulusPoolSeed+'/')));
});
