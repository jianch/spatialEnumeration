/* A single jsPsych trial owns the entire visual/audio schedule.
 * Visual times are browser draw timestamps, not photodiode measurements.
 * Audio times are scheduled Web Audio times, not measured speaker onsets.
 */
(function (root) {
  'use strict';
  const D = root.EnumerationDesign;
  // Exposes current stimulus timing for diagnostics; input and audio belong to jsPsych.
  root.EnumerationRuntime = { active: null };
  // Called synchronously by an existing Continue/Start gesture. Lock the body
  // so control survives jsPsych replacing the contents between trials.
  root.EnumerationMouse = {
    acquire() {
      if (document.pointerLockElement === document.body) return Promise.resolve();
      return new Promise((resolve, reject) => {
        let timer;
        function cleanup() {
          clearTimeout(timer);
          document.removeEventListener('pointerlockchange', changed);
          document.removeEventListener('pointerlockerror', failed);
        }
        function changed() { if (document.pointerLockElement === document.body) {cleanup();resolve();} }
        function failed() {cleanup();reject(new Error('Mouse control could not start. Keep the experiment window active, reload, and try again.'));}
        if (typeof document.body.requestPointerLock !== 'function') {failed();return;}
        document.addEventListener('pointerlockchange', changed);
        document.addEventListener('pointerlockerror', failed);
        timer = setTimeout(failed, 5000);
        try {document.body.requestPointerLock()?.catch(failed);} catch {failed();}
      });
    },
    release() {
      if (!document.pointerLockElement) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {cleanup();reject(new Error('Mouse control could not be released. Press Escape and reload to recover saved records.'));}, 5000);
        function cleanup() {clearTimeout(timer);document.removeEventListener('pointerlockchange', changed);}
        function changed() {if (!document.pointerLockElement) {cleanup();resolve();}}
        document.addEventListener('pointerlockchange', changed);
        document.exitPointerLock();
      });
    }
  };
  const P = root.jsPsychModule.ParameterType;

  function drawSymbol(ctx, symbol, x, y, diameter) {
    ctx.beginPath();
    for (const path of D.cueSegments(symbol)) {
      path.forEach(([dx, dy], i) => {
        if (i === 0) ctx.moveTo(x + dx * diameter, y + dy * diameter);
        else ctx.lineTo(x + dx * diameter, y + dy * diameter);
      });
    }
    ctx.stroke();
  }
  root.drawEnumerationSymbol = drawSymbol;

  class EnumerationPlugin {
    static info = {
      name: 'enumeration-response-signal', version: '0.15.0',
      parameters: {
        row: { type: root.jsPsychModule.ParameterType.OBJECT, default: undefined },
        settings: { type: root.jsPsychModule.ParameterType.OBJECT, default: undefined }
      },
      data: {
        response: {type: P.INT}, rt: {type: P.FLOAT}, reported_number: {type: P.INT},
        rt_tone_ms: {type: P.FLOAT}, rt_array_ms: {type: P.FLOAT}, rt_pad_ms: {type: P.FLOAT},
        correct_timely: {type: P.BOOL}, numerical_correct: {type: P.BOOL},
        timing_compliant: {type: P.BOOL}, accuracy_all_scheduled: {type: P.INT},
        premature: {type: P.BOOL}, late: {type: P.BOOL}, timeout: {type: P.BOOL},
        fast_response: {type: P.BOOL}, timing_flag: {type: P.BOOL},
        technical_abort: {type: P.STRING},
        pointer_events: {type: P.OBJECT, array: true}, raw_events: {type: P.OBJECT, array: true},
        frame_timestamps_ms: {type: P.FLOAT, array: true}, frame_intervals: {type: P.OBJECT, array: true}
      }
    };
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    trial(display, trial) {
      const row = trial.row, s = trial.settings, c = s.config, t = c.timing, g = c.geometry;
      const api = this.jsPsych.pluginAPI, audio = api.audioContext();
      if (!audio || audio.state !== 'running') {
        this.jsPsych.finishTrial({...row, technical_abort: 'audio_not_running', timing_compliant: false, accuracy_all_scheduled: 0});
        return;
      }
      document.body.classList.add('enum-active');
      display.innerHTML = '<canvas class="enum-canvas" aria-label="Enumeration trial"></canvas><div class="enum-fixation" aria-hidden="true"><span></span><span></span><i></i></div><div class="enum-cursor" aria-hidden="true" hidden><svg viewBox="0 0 18 24"><path d="M1 1V20L6 15L10 23L14 21L10 13H17Z" fill="#fff" stroke="#101010" stroke-width="1.5" stroke-linejoin="round"/></svg></div><div class="enum-number-pad" role="group" aria-label="Number response pad" hidden></div><div class="enum-trial-reminder"></div>';
      const canvas = display.querySelector('canvas'), ctx = canvas.getContext('2d');
      const width = innerWidth, height = innerHeight, ratio = devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      ctx.scale(ratio, ratio);
      const center = {x: width / 2, y: height / 2}, ppd = s.pixelsPerDegree;
      const maskEnabled = row.mask_enabled !== false;
      const plan = D.framePlan(t, s.frameMs, row.array_duration_ms);
      if (!maskEnabled) {plan.maskFrames=0;plan.maskMs=0;}
      const typography = root.EnumerationDisplay.applyCalibration(c, s.pixelsPerMm);
      const layout = D.responseLayout(width, height, ppd, g, c.responsePad, s.pixelsPerMm);
      if (!layout.fits) {
        document.body.classList.remove('enum-active');
        this.jsPsych.finishTrial({...row, technical_abort:'response_pad_does_not_fit', timing_flag:true, timing_compliant:false, accuracy_all_scheduled:0}); return;
      }
      const cross = display.querySelector('.enum-fixation');
      cross.style.setProperty('--fix-size', `${g.fixationDiameterDeg*ppd}px`);
      cross.style.setProperty('--fix-stroke', `${Math.max(1,g.fixationStrokeDeg*ppd)}px`);
      cross.style.setProperty('--fix-colour',g.foreground);
      cross.style.setProperty('--fix-inner-size', `${g.fixationInnerDiameterDeg*ppd}px`);
      cross.style.setProperty('--fix-contrast', g.fixationContrast);
      const pad = display.querySelector('.enum-number-pad');
      Object.assign(pad.style,{left:`${layout.left_px}px`,top:`${layout.top_px}px`,width:`${layout.width_px}px`,gap:`${layout.gap_px}px`,gridTemplateColumns:`repeat(${layout.columns},${layout.button_width_px}px)`});
      pad.innerHTML=c.responsePad.numbers.map(n=>`<button type="button" class="enum-number" data-number="${n}" style="height:${layout.button_height_px}px" tabindex="-1">${n}</button>`).join('');
      const reminder=display.querySelector('.enum-trial-reminder');
      Object.assign(reminder.style,{left:`${layout.reminder_left_px}px`,top:`${layout.reminder_top_px}px`,width:`${layout.reminder_width_px}px`,height:`${layout.reminder_height_px}px`});
      const cursor = display.querySelector('.enum-cursor');
      const resetPosition = {x_px:center.x, y_px:center.y+c.mouseCursor.resetBelowDeg*ppd};
      const buttons = Array.from(pad.querySelectorAll('[data-number]'));
      const fixFrames = Math.max(1, Math.round(row.fixation_ms / s.frameMs));
      const cueFrames = Math.max(1, Math.round(t.cueMs / s.frameMs));
      const postFrames = Math.max(1, Math.round(t.postCueMs / s.frameMs));
      const arrayFrame = fixFrames + cueFrames + postFrames;
      const maskFrame = arrayFrame + plan.arrayFrames;
      const maskOffFrame = maskFrame + plan.maskFrames;
      const preparedMasks = [];
      const maskRandom = D.rng(row.mask_seed);
      const maskDiameter = g.apertureDiameterDeg * ppd;
      for (let side = 0; maskEnabled && side < 2; side++) {
        const mask = document.createElement('canvas');
        mask.width = mask.height = Math.ceil(maskDiameter * ratio);
        const mctx = mask.getContext('2d');
        mctx.scale(ratio, ratio);
        const tile = Math.max(2, g.maskTileDeg * ppd);
        for (let y = 0; y < maskDiameter; y += tile) for (let x = 0; x < maskDiameter; x += tile) {
          const v = Math.round(maskRandom() * 255);
          mctx.fillStyle = `rgb(${v},${v},${v})`;
          mctx.fillRect(x, y, tile + 0.5, tile + 0.5);
        }
        preparedMasks.push(mask);
      }
      const events = [], pointers = [], frames = [], frameGaps = [];
      const start = performance.now();
      let frame = 0, raf, done = false, source, envelope;
      let stage = '', arrayPerf = null, arrayOffPerf = null, maskPerf = null, maskOffPerf = null, visualEndPerf = null;
      let tonePerf = null, toneAudio = null, toneOutputEstimate = null, audioClockSample = null;
      let cuePerf = null, cueOffPerf = null, fixationPerf = null, padPerf = null, latestPointer = null, pointerAtPad = null;
      let sawTone = false, deadlineLogged = false, responseChosen = false, started = false;
      let responseChosenPerf = null, itiPerf = null, cursorResetPerf = null, pointerAtReset = null;
      let resizeFlag = false, fullscreenExit = false;
      const runtime = { started: false, row, stage: '', pixelsPerDegree: ppd, arrayPerfMs: null, tonePerfMs: null, cursor: null, cursorResetPosition: resetPosition, config: c };
      root.EnumerationRuntime.active = runtime;
      const log = (type, value = {}) => events.push({type, perf_ms: performance.now(), ...value});
      function paint(next) {
        stage = next; runtime.stage = next; canvas.dataset.stage = next;
        reminder.hidden = !['fixation','cue','preparation'].includes(next);
        reminder.textContent = 'Look at the centre dot, only respond after hearing tone.';
        ctx.fillStyle = g.background; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = ctx.strokeStyle = g.foreground;
        ctx.lineWidth = Math.max(1, 0.035 * ppd);
        if (next === 'cue') {
          ctx.lineWidth = Math.max(1, g.cueStrokeDeg * ppd);
          drawSymbol(ctx, row.cue_symbol, center.x, center.y - g.cueOffsetAboveDeg * ppd, g.cueDiameterDeg * ppd);
        }
        if (next === 'array') {
          const x = center.x + (row.target_side === 'left' ? -1 : 1) * g.eccentricityDeg * ppd;
          for (const p of row.dot_coordinates_deg) {
            ctx.beginPath(); ctx.arc(x + p.x * ppd, center.y + p.y * ppd, g.dotDiameterDeg * ppd / 2, 0, Math.PI * 2); ctx.fill();
          }
        }
        if (next === 'mask') {
          preparedMasks.forEach((mask, i) => {
            const x = center.x + (i === 0 ? -1 : 1) * g.eccentricityDeg * ppd;
            ctx.save(); ctx.beginPath(); ctx.arc(x, center.y, maskDiameter / 2, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(mask, x - maskDiameter / 2, center.y - maskDiameter / 2, maskDiameter, maskDiameter); ctx.restore();
          });
        }
        log('visual_draw', {stage: next, frame_index: frame});
      }
      function scheduleTone() {
        const perfSample = performance.now(), audioSample = audio.currentTime;
        toneAudio = audioSample + row.signal_delay_ms / 1000;
        tonePerf = perfSample + (toneAudio - audioSample) * 1000;
        audioClockSample = {perf_ms: perfSample, audio_s: audioSample};
        if (audio.getOutputTimestamp) {
          const stamp = audio.getOutputTimestamp();
          if (stamp.contextTime > 0 && stamp.performanceTime > 0) toneOutputEstimate = stamp.performanceTime + (toneAudio - stamp.contextTime) * 1000;
        }
        runtime.tonePerfMs = tonePerf;
        ({source, envelope} = root.EnumerationAudio.playTone(audio, t, toneAudio));
        log('tone_scheduled', {audio_onset_s: toneAudio, scheduled_perf_ms: tonePerf, delay_from_array_ms: tonePerf - arrayPerf});
        // This watchdog also fires if animation frames stop. A response cannot cut the target or mask short.
        const visualEnd = arrayPerf + (plan.arrayFrames + plan.maskFrames) * s.frameMs;
        api.setTimeout(() => finish(), Math.max(0, Math.max(tonePerf + t.responseDeadlineMs + t.lateObservationMs + t.responseFeedbackMs, visualEnd) + t.itiMs - performance.now() + 2));
      }
      function trackPointer(e) {
        if (!started || done || document.pointerLockElement !== document.body || e.sourceCapabilities?.firesTouchEvents) return;
        latestPointer = {x_px:Math.max(0,Math.min(width-1,latestPointer.x_px+(e.movementX || 0))),
          y_px:Math.max(0,Math.min(height-1,latestPointer.y_px+(e.movementY || 0))),perf_ms:performance.now()};
        updateCursor();
      }
      function buttonAtCursor() {
        if (pad.hidden || !latestPointer) return null;
        return buttons.find(button => {
          const rect = button.getBoundingClientRect();
          return latestPointer.x_px>=rect.left && latestPointer.x_px<rect.right && latestPointer.y_px>=rect.top && latestPointer.y_px<rect.bottom;
        }) || null;
      }
      function updateCursor() {
        Object.assign(cursor.style,{left:`${latestPointer.x_px}px`,top:`${latestPointer.y_px}px`});
        runtime.cursor = {...latestPointer};
        const hovered = buttonAtCursor();
        buttons.forEach(button => button.classList.toggle('hovered',button===hovered));
      }
      function auditPointer(e) {
        if (!started || document.pointerLockElement !== document.body) return;
        const button = buttonAtCursor();
        const value = button ? Number(button.dataset.number) : null;
        const stamp = performance.now();
        const inWindow = padPerf !== null && !pad.hidden && tonePerf !== null && stamp <= tonePerf + t.responseDeadlineMs + t.lateObservationMs;
        const primary = !e.sourceCapabilities?.firesTouchEvents && e.button === 0;
        const event = {value, perf_ms:stamp, x_px:latestPointer.x_px, y_px:latestPointer.y_px, pointer_type:e.sourceCapabilities?.firesTouchEvents?'touch':'mouse',
          button:e.button, accepted:primary && inWindow && value !== null && !responseChosen,
          before_tone:tonePerf===null || stamp<tonePerf, outside_capture_window:!inWindow,
          response_already_chosen:responseChosen};
        pointers.push(event);
        if (event.accepted) {
          responseChosen=true;responseChosenPerf=stamp;button.classList.add('selected');
          event.distance_from_pad_onset_px=pointerAtPad ? Math.hypot(event.x_px-pointerAtPad.x_px,event.y_px-pointerAtPad.y_px) : null;
          event.distance_from_pad_centre_px=Math.hypot(event.x_px-layout.home_x_px,event.y_px-layout.home_y_px);
          pad.classList.add('responded');
        }
        e.preventDefault();
      }
      function showPad(now) {
        if (padPerf!==null) return;
        pad.hidden=false;padPerf=performance.now();
        updateCursor();
        pointerAtPad=latestPointer ? {...latestPointer,age_ms:padPerf-latestPointer.perf_ms} : null;
        log('response_pad_shown',{pad_perf_ms:padPerf,scheduled_tone_perf_ms:tonePerf});
      }
      function finish(reason = null) {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf); api.clearAllTimeouts();
        document.removeEventListener('mousedown', auditPointer);
        document.removeEventListener('mousemove', trackPointer);
        document.removeEventListener('pointerlockchange', onPointerLock);
        document.removeEventListener('visibilitychange', onVisibility);
        root.removeEventListener('blur', onBlur); root.removeEventListener('resize', onResize);
        document.removeEventListener('fullscreenchange', onFullscreen);
        try { source?.stop(); } catch { /* It may already have finished. */ }
        source?.disconnect(); envelope?.disconnect();
        log('trial_end', {reason});
        const response = arrayPerf !== null && tonePerf !== null ? D.scoreResponse(pointers, tonePerf, arrayPerf, row.target_numerosity, t, padPerf) : {
          response: null, reported_number: null, correct_timely: null, timing_compliant: false, accuracy_all_scheduled: 0, timeout: true
        };
        const arrayDuration = arrayPerf !== null && arrayOffPerf !== null ? arrayOffPerf - arrayPerf : null;
        const maskDuration = maskPerf !== null && maskOffPerf !== null ? maskOffPerf - maskPerf : null;
        const criticalGaps = frameGaps.filter(gap => gap.frame_index >= arrayFrame && gap.frame_index <= maskOffFrame);
        const timingFlag = reason !== null || arrayDuration === null || (maskEnabled && maskDuration === null) ||
          criticalGaps.some(gap => gap.interval_ms > s.frameMs * t.frameGapMultiplier) ||
          Math.abs(arrayDuration - plan.arrayFrames * s.frameMs) > s.frameMs * 0.75 ||
          (maskEnabled && Math.abs(maskDuration - plan.maskFrames * s.frameMs) > s.frameMs * 0.75);
        root.EnumerationRuntime.active = null;
        document.body.classList.remove('enum-active');
        thisPlugin.jsPsych.finishTrial({
          ...row, ...response, rt: response.rt_tone_ms ?? null,
          technical_abort: reason, timing_flag: timingFlag, resize_flag: resizeFlag, fullscreen_exit: fullscreenExit,
          frame_plan: plan, measured_frame_interval_ms: s.frameMs,
          pixels_per_degree: ppd, viewport_width_px: width, viewport_height_px: height, device_pixel_ratio: ratio,
          trial_start_perf_ms: start, fixation_draw_perf_ms: fixationPerf,
          cue_draw_perf_ms: cuePerf, cue_off_draw_perf_ms: cueOffPerf,
          array_draw_perf_ms: arrayPerf, array_off_draw_perf_ms: arrayOffPerf, mask_enabled: maskEnabled, visual_sequence_end_perf_ms: visualEndPerf, mask_draw_perf_ms: maskPerf, mask_off_draw_perf_ms: maskOffPerf,
          array_duration_browser_ms: arrayDuration, mask_duration_browser_ms: maskDuration,
          cue_to_array_browser_ms: cuePerf !== null && arrayPerf !== null ? arrayPerf - cuePerf : null,
          tone_scheduled_perf_ms: tonePerf, tone_scheduled_audio_s: toneAudio,
          tone_output_estimate_perf_ms: toneOutputEstimate, audio_clock_sample: audioClockSample,
          audio_base_latency_s: audio.baseLatency ?? null, audio_output_latency_s: audio.outputLatency ?? null,
          pointer_events: pointers, raw_events: events, frame_timestamps_ms: frames, frame_intervals: frameGaps,
          response_method:'mouse_number_pad', response_pad_draw_perf_ms:padPerf, pad_delay_from_tone_ms:padPerf!==null&&tonePerf!==null?padPerf-tonePerf:null,
          response_pad_layout:layout, trial_start_method:'automatic_cursor_reset', pointer_position_at_pad_onset:pointerAtPad,
          cursor_control:'pointer_lock', pointer_coordinate_system:'virtual_cursor_css_px',
          cursor_reset_position:resetPosition, cursor_reset_perf_ms:cursorResetPerf, pointer_position_at_cursor_reset:pointerAtReset,
          fixation_shape:g.fixationShape, fixation_extent_deg:g.fixationDiameterDeg,
          fixation_inner_diameter_deg:g.fixationInnerDiameterDeg, fixation_stroke_deg:g.fixationStrokeDeg,
          pixels_per_mm:s.pixelsPerMm, typography,
          cue_width_deg:g.cueDiameterDeg, cue_stroke_deg:g.cueStrokeDeg,
          response_deadline_ms:t.responseDeadlineMs, late_observation_ms:t.lateObservationMs,
          response_feedback_ms:t.responseFeedbackMs, response_chosen_perf_ms:responseChosenPerf, iti_draw_perf_ms:itiPerf,
          ignored_keyboard_responses:true, cue_center_above_fixation_deg:g.cueOffsetAboveDeg
        });
      }
      const thisPlugin = this;
      function onVisibility() { if (document.hidden) { log('visibility_loss'); finish('visibility_loss'); } }
      function onBlur() { log('window_blur'); finish('window_blur'); }
      function onResize() { resizeFlag = true; log('resize'); finish('viewport_resize'); }
      function onFullscreen() { if (s.requireFullscreen && !document.fullscreenElement) { fullscreenExit = true; finish('fullscreen_exit'); } }
      function onPointerLock() {
        if (document.pointerLockElement === document.body) begin();
        else if (started) finish('pointer_lock_lost');
      }
      function tick() {
        if (done) return;
        const now = performance.now();
        if (frames.length) frameGaps.push({frame_index: frame, interval_ms: now - frames.at(-1)});
        frames.push(now);
        if (frame === 0) { paint('fixation'); fixationPerf = performance.now(); }
        if (frame === fixFrames) { paint('cue'); cuePerf = performance.now(); }
        if (frame === fixFrames + cueFrames) { paint('preparation'); cueOffPerf = performance.now(); }
        if (frame === arrayFrame) {
          paint('array'); arrayPerf = performance.now(); runtime.arrayPerfMs = arrayPerf;
          scheduleTone();
        }
        if (frame === maskFrame) {
          paint(maskEnabled ? 'mask' : 'wait');arrayOffPerf=performance.now();
          if (maskEnabled) maskPerf=arrayOffPerf;
          else visualEndPerf=arrayOffPerf;
        }
        if (maskEnabled && frame === maskOffFrame) { paint('wait'); maskOffPerf=performance.now();visualEndPerf=maskOffPerf; }
        if (tonePerf !== null) {
          if (audio.state !== 'running') { finish('audio_interrupted'); return; }
          if (now >= tonePerf && padPerf===null) showPad(now);
          if (now >= tonePerf && !sawTone) { sawTone = true; log('tone_time_observed_on_frame', {scheduled_perf_ms: tonePerf}); }
          if (now >= tonePerf + t.responseDeadlineMs && !deadlineLogged) { deadlineLogged = true; log('response_deadline_observed_on_frame'); }
          const responseEnd = responseChosenPerf===null ? tonePerf+t.responseDeadlineMs+t.lateObservationMs : responseChosenPerf+t.responseFeedbackMs;
          if (now>=responseEnd && visualEndPerf!==null && itiPerf===null) {paint('iti');pad.hidden=true;itiPerf=performance.now();log('response_pad_hidden');}
          if (itiPerf!==null && now>=itiPerf+t.itiMs) {finish();return;}
        }
        frame++; raf = requestAnimationFrame(tick);
      }
      function begin() {
        if (started || done) return;
        if (audio.state !== 'running') {finish('audio_interrupted');return;}
        started=true;runtime.started=true;
        cursor.hidden=false;
        cursorResetPerf=performance.now();
        latestPointer={...resetPosition,perf_ms:cursorResetPerf};pointerAtReset={...latestPointer};
        updateCursor();
        log('cursor_reset',{...pointerAtReset});
        paint('fixation');
        log('fixation_sequence_start');
        raf=requestAnimationFrame(tick);
      }
      document.addEventListener('mousedown',auditPointer);
      document.addEventListener('mousemove',trackPointer);
      document.addEventListener('pointerlockchange',onPointerLock);
      document.addEventListener('visibilitychange', onVisibility); root.addEventListener('blur', onBlur);
      root.addEventListener('resize', onResize); document.addEventListener('fullscreenchange', onFullscreen);
      if (document.pointerLockElement === document.body) begin();
      else finish('pointer_lock_not_active');
    }
  }
  root.jsPsychEnumeration = EnumerationPlugin;
})(window);
