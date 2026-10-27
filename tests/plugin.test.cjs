const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('../config.js');
const D = require('../design.js');

const {trialHarness, dotRow} = require('./helpers/plugin-harness.cjs');

test('each timed trial automatically resets the cursor below fixation without movement or a circle', () => {
  const h=trialHarness(dotRow()),active=h.active(),p=active.cursorResetPosition;
  assert.equal(active.started,true);
  assert.equal(active.cursor.x_px,p.x_px);
  assert.equal(active.cursor.y_px,p.y_px);
  assert.ok(!h.display.innerHTML.includes('enum-mouse-home'));
  assert.ok(!h.display.innerHTML.includes('enum-pointer-prompt'));
  assert.ok(!h.display.innerHTML.includes('Enable mouse control'));
  assert.equal(h.cursor.hidden,false);
  assert.equal(h.reminder.textContent,'Look at the centre dot, only respond after hearing tone.');
  const layout=D.responseLayout(1728,1117,h.settings.pixelsPerDegree,C.geometry,C.responsePad,h.settings.pixelsPerMm);
  assert.equal(parseFloat(h.reminder.style.top)+parseFloat(h.reminder.style.height)/2,layout.top_px+layout.height_px/2);
  assert.ok(p.y_px>1117/2+C.geometry.fixationDiameterDeg*h.settings.pixelsPerDegree/2);
  h.until(()=>!h.pad.hidden);
  assert.equal(h.reminder.hidden,true);
  h.press(6);
  h.until(()=>h.record()!==null);
  const record=h.record();
  assert.equal(record.trial_start_method,'automatic_cursor_reset');
  assert.equal(record.cursor_control,'pointer_lock');
  assert.ok(record.fixation_draw_perf_ms>=record.cursor_reset_perf_ms);
  assert.equal(record.pointer_position_at_pad_onset.x_px,p.x_px);
  assert.equal(record.pointer_position_at_pad_onset.y_px,p.y_px);
  assert.equal(record.correct_timely,true);
  assert.equal(record.technical_abort,null);
  assert.equal(h.display.listeners.size,0);
  assert.equal(h.document.pointerLockElement,h.document.body);
  h.restart();
  assert.equal(h.active().started,true);
  assert.equal(h.active().cursor.x_px,p.x_px);
  assert.equal(h.active().cursor.y_px,p.y_px);
  assert.equal(h.pad.hidden,true);
  h.blur();
});

test('existing button gestures acquire mouse control; missing control aborts without an activation notice', async () => {
  const h=trialHarness(dotRow(),()=>{},false);
  assert.equal(h.record().technical_abort,'pointer_lock_not_active');
  assert.equal(h.active(),null);
  assert.ok(!h.display.innerHTML.includes('Enable mouse control'));
  await h.mouse.acquire();
  h.restart();
  assert.equal(h.active().started,true);
  h.move(-500,-500);
  assert.equal(h.active().cursor.x_px,0);
  assert.equal(h.active().cursor.y_px,0);
  h.move(5000,5000);
  assert.equal(h.active().cursor.x_px,1727);
  assert.equal(h.active().cursor.y_px,1116);
  h.unlock();
  assert.equal(h.record().technical_abort,'pointer_lock_lost');
  assert.equal(h.active(),null);
  assert.equal(h.document.listeners.size,0);
});

test('tone practice clears the array without drawing a mask and retains correct timing', () => {
  for (const exposure of C.training.arrayDurationsMs) {
    const h=trialHarness({...dotRow(),phase:'tone_training',mask_enabled:false,array_duration_ms:exposure,signal_delay_ms:Math.max(100,exposure)});
    h.until(()=>!h.pad.hidden);
    h.press(6);
    h.until(()=>h.record()!==null);
    const r=h.record();
    assert.equal(r.mask_enabled,false);
    assert.equal(r.frame_plan.maskFrames,0);
    assert.equal(r.frame_plan.maskMs,0);
    assert.equal(r.mask_draw_perf_ms,null);
    assert.equal(r.mask_off_draw_perf_ms,null);
    assert.equal(r.mask_duration_browser_ms,null);
    assert.ok(!r.raw_events.some(event=>event.type==='visual_draw'&&event.stage==='mask'));
    assert.ok(Math.abs(r.array_duration_browser_ms-exposure)<0.001);
    assert.equal(r.visual_sequence_end_perf_ms,r.array_off_draw_perf_ms);
    assert.ok(r.iti_draw_perf_ms>=r.visual_sequence_end_perf_ms);
    assert.ok(r.iti_draw_perf_ms>=r.response_chosen_perf_ms+C.timing.responseFeedbackMs);
    assert.equal(r.timing_flag,false);
    assert.equal(r.correct_timely,true);
  }
});

test('masked full practice draws dot targets and preserves target, mask, tone, and feedback timing', () => {
  for(const phase of ['mixed_practice']) {
    const row={...dotRow(phase),array_duration_ms:200/3,signal_delay_ms:100};
    const h=trialHarness(row);
    h.until(()=>h.active().arrayPerfMs!==null);
    assert.equal(h.reminder.hidden,true);
    assert.equal(h.draws.filter(draw=>draw.stage==='array').length,row.target_numerosity);
    assert.equal(h.pad.hidden,true);
    h.press(5);
    h.until(()=>!h.pad.hidden);
    assert.equal(h.active().stage,'mask');
    h.press(6);
    h.press(5);
    h.until(()=>h.record()!==null);
    const r=h.record();
    assert.equal(r.response,6);
    assert.equal(r.pointer_events.filter(e=>e.accepted).length,1);
    assert.equal(r.pointer_events[0].accepted,false);
    assert.equal(r.numerical_correct,true);
    assert.equal(r.timing_flag,false);
    assert.ok(Math.abs(r.array_duration_browser_ms-200/3)<0.001);
    assert.ok(Math.abs(r.mask_duration_browser_ms-100)<0.001);
    assert.ok(r.response_pad_draw_perf_ms>=r.tone_scheduled_perf_ms);
    assert.ok(r.response_chosen_perf_ms<r.mask_off_draw_perf_ms);
    assert.ok(r.iti_draw_perf_ms>=r.mask_off_draw_perf_ms);
    assert.ok(r.iti_draw_perf_ms>=r.response_chosen_perf_ms+C.timing.responseFeedbackMs);
    assert.ok(Math.abs(h.tones[0]*1000-r.array_draw_perf_ms-100)<0.001);
  }
});

test('omission and interruption retain the automatic cursor reset and end cleanly', () => {
  const omitted=trialHarness(dotRow());
  omitted.until(()=>omitted.record()!==null);
  assert.equal(omitted.record().timeout,true);
  assert.equal(omitted.record().response,null);
  assert.ok(omitted.record().iti_draw_perf_ms>=omitted.record().tone_scheduled_perf_ms+C.timing.responseDeadlineMs+C.timing.lateObservationMs);
  const interrupted=trialHarness(dotRow());
  interrupted.advance(30);interrupted.blur();
  assert.equal(interrupted.record().technical_abort,'window_blur');
  assert.ok(interrupted.record().cursor_reset_perf_ms!==null);
  assert.equal(interrupted.active(),null);
  assert.equal(interrupted.display.listeners.size,0);
});
