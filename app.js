(function () {
  'use strict';
  const C = window.EnumerationConfig, D = window.EnumerationDesign, A = window.EnumerationAudio;
  const mount = document.getElementById('experiment');
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if (!window.initJsPsych || !window.jsPsychEnumeration || !window.jsPsychCallFunction || !window.EnumerationDisplay || !A) {
    mount.innerHTML = '<div class="intro"><h1>Experiment files are missing</h1><p>Install the bundled libraries using tools/download-vendor.py, then reload.</p></div>';
    return;
  }
  let jsPsych, audio, setup, metadata, settings, rows, lastEnum = null;
  let mouseGesture = Promise.resolve();
  let trainingComplete = false, setupReady = false, storageError = null, db;
  const runId = crypto.randomUUID();
  let lastFileTimestamp = 0;
  function action(fn, task) {
    return {type: jsPsychCallFunction, func: fn, data: {task}};
  }
  function asyncAction(fn, task) {
    return {type: jsPsychCallFunction, async: true, data: {task}, func: done => {
      Promise.resolve().then(() => fn(jsPsych.getDisplayElement())).then(value => done(value ?? {})).catch(error => {
        console.error(error);
        jsPsych.abortExperiment(`<div class="instructions"><h1>Experiment interrupted</h1><p>${escape(error.message)}</p><p>Reload the setup page to recover saved records.</p></div>`);
      });
    }};
  }
  async function openBackup() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('enumeration-full-experiment-backup', 1);
      request.onupgradeneeded = () => {
        const b = request.result;
        b.createObjectStore('runs', {keyPath: 'run_id'});
        b.createObjectStore('records', {keyPath: ['run_id', 'trial_index']});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function save(store, value) {
    if (!db) return;
    try {
      const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value);
      tx.onerror = () => { storageError = tx.error?.message || 'Local backup failed'; };
      tx.onabort = () => { storageError = tx.error?.message || 'Local backup failed'; };
    } catch (e) { storageError = e.message; }
  }
  function getAll(store) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(store).objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  function download(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function bundle() { return {metadata, config: C, scheduled_trials: rows, records: jsPsych.data.get().values()}; }
  function summaries(records) {
    return records.filter(r => r.task === 'enumeration').map(r => {
      const {raw_events, frame_timestamps_ms, frame_intervals, pointer_events, stimulus_metrics, ...summary} = r;
      return {...summary, ...stimulus_metrics,
        frame_count: frame_timestamps_ms?.length ?? 0,
        max_frame_interval_ms: frame_intervals?.length ? Math.max(...frame_intervals.map(f => f.interval_ms)) : null};
    });
  }
  function fileName(participantId, kind, format) {
    // Keep timestamps distinct even if two files are prepared in the same millisecond.
    lastFileTimestamp = Math.max(Date.now(), lastFileTimestamp + 1);
    const timestamp = new Date(lastFileTimestamp).toISOString().replace(/[-:.]/g, '');
    return `${participantId}_${timestamp}_${kind}.${format}`;
  }
  function exportCurrent(format, explicitKind = null) {
    const b = bundle();
    const kind = explicitKind || (metadata.finished_at ? 'final' : 'backup');
    const filename = fileName(setup.participantId, kind, format);
    if (format === 'json') download(JSON.stringify(b), filename, 'application/json');
    else download(D.csv(summaries(b.records)), filename, 'text/csv');
  }
  function uploadDescription(result) {
    if (result.status === 'saved') return 'Saved to the storage provider.';
    if (result.status === 'queued') return 'Accepted by DataPipe; waiting for delivery to storage.';
    if (result.status === 'not_configured') return 'DataPipe is not configured; download the files.';
    if (result.status === 'uncertain') return 'Upload could not be confirmed. Download the files; a copy may still have arrived.';
    return `Upload failed (${result.detail}). Download the files.`;
  }
  async function uploadFile(kind, data, extension) {
    const filename = fileName(setup.participantId, kind, extension);
    const result = window.EnumerationDataPipe ? await window.EnumerationDataPipe.send(window.ENUMERATION_DATAPIPE_ID, filename, data) : {status: 'not_configured'};
    metadata.data_uploads = metadata.data_uploads || [];
    metadata.data_uploads.push({kind, ...result, checked_at: new Date().toISOString()});
    save('runs', {run_id: runId, metadata, config: C, scheduled_trials: rows});
    return result;
  }
  function startBreakBackup(block) {
    bindExports();
    const status = document.getElementById('break-upload-status');
    const next = jsPsych.getDisplayElement().querySelector('[data-choice="0"]');
    next.disabled = true;
    status.textContent = 'Saving a backup. Please wait before continuing.';
    uploadFile(`block_${block}`, JSON.stringify(bundle()), 'json').then(result => {
      status.textContent = `Block ${block} backup: ${uploadDescription(result)}`;
    }).catch(() => {status.textContent = 'Backup could not be confirmed. Download the backup before continuing.';})
      .finally(() => {next.disabled = false;});
  }
  function bindExports() {
    document.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', () => exportCurrent(button.dataset.export, button.dataset.exportKind)));
  }
  function symbolHtml(symbol) {
    const mark = D.cueSegments(symbol).map(path => '<path d="' + path.map(([x,y],i) => `${i ? 'L' : 'M'}${24+x*32} ${24+y*32}`).join(' ') + '"/>').join('');
    return `<svg width="48" height="48" viewBox="0 0 48 48" role="img" aria-label="${symbol}"><g fill="none" stroke="currentColor" stroke-width="${32*C.geometry.cueStrokeDeg/C.geometry.cueDiameterDeg}">${mark}</g></svg>`;
  }
  function legend(mapping) { return '<div class="symbol-legend">' + Object.entries(mapping).map(([meaning, symbol]) => `<div class="symbol-item">${symbolHtml(symbol)}<span>${meaning === 'neutral' ? 'Neither side predicted' : 'Likely ' + meaning}</span></div>`).join('') + '</div>'; }
  function page(html, choices = ['Continue'], extra = {}) {
    return {type: jsPsychHtmlButtonResponse, stimulus: `<div class="instructions">${html}</div>`, choices, button_layout: 'flex', ...extra};
  }
  function mousePage(html, choices = ['Continue'], extra = {}) {
    return page(html, choices, {...extra, on_load: () => {
      extra.on_load?.();
      jsPsych.getDisplayElement().querySelectorAll('.jspsych-btn').forEach(button => {
        button.dataset.mouseStart = 'true';
        button.addEventListener('click', () => {
          // Request mouse control before fullscreen consumes the click gesture.
          const requests = [EnumerationMouse.acquire(), audio.resume()];
          if (settings.requireFullscreen && !document.fullscreenElement) requests.push(document.documentElement.requestFullscreen());
          mouseGesture = Promise.all(requests);
          mouseGesture.catch(() => {}); // The timeline awaits and reports failures.
        }, {capture: true, once: true});
      });
    }});
  }
  function positionPracticePad() {
    const layout = D.responseLayout(innerWidth, innerHeight, settings.pixelsPerDegree, C.geometry, C.responsePad, settings.pixelsPerMm);
    const group = document.getElementById('jspsych-html-button-response-btngroup');
    document.body.classList.add('enum-pad-practice');
    group.classList.add('number-practice-group');
    Object.assign(group.style, {left: `${layout.left_px}px`, top: `${layout.top_px}px`, width: `${layout.width_px}px`,
      height: `${layout.height_px}px`, gap: `${layout.gap_px}px`, gridTemplateColumns: `repeat(${layout.columns},${layout.button_width_px}px)`});
    group.querySelectorAll('button').forEach(button => {button.style.height = `${layout.button_height_px}px`;});
    return layout;
  }
  function mainInstructions() {
    const demo = setup.mode === 'demo';
    const blockCount = new Set(rows.map(row => row.block)).size;
    const title = demo ? 'Main-trial demonstration' : 'Main experiment';
    const button = demo ? 'Begin demonstration' : 'Begin main experiment';
    return mousePage(`<section class="main-introduction" aria-label="${title}">
      <div class="main-intro-banner"><p class="main-intro-kicker">Practice complete</p><h1>${title}</h1></div>
      <div class="main-intro-body">
        <p class="main-intro-transition"><strong>${demo ? 'Your practice is finished. Next is a short demonstration of the main trials.' : 'Your practice is finished. Your responses from the next trial onward are part of the main experiment.'}</strong></p>
        <p class="main-intro-schedule">${rows.length} trials · ${blockCount} ${blockCount === 1 ? 'block' : 'blocks'}${blockCount > 1 ? ' · breaks between blocks' : ''}</p>
        <p class="main-intro-reminder"><strong>Look at the centre dot, only respond after hearing tone.</strong></p>
        <ol><li>Keep looking at the centre dot while the dot array flashes. Use the arrow to prepare for the likely side.</li>
        <li>After the tone, click your best estimate immediately, even if you are uncertain. Your first number click is recorded.</li>
        <li>You will no longer be told whether your answer is correct. The selected number will briefly highlight.</li></ol>
        <p>The cursor returns below fixation before every trial. When you are ready, click <strong>${button}</strong>.</p>
      </div></section>`, [button], {
      data: {task: 'main_instructions', main_trial_count: rows.length, main_block_count: blockCount},
      on_load: () => document.body.classList.add('enum-main-intro'),
      on_finish: () => document.body.classList.remove('enum-main-intro')
    });
  }
  function feedback(html) { return {type: jsPsychHtmlButtonResponse, stimulus: () => `<div class="instructions">${typeof html === 'function' ? html() : html}</div>`, choices: [], button_layout: 'flex', response_ends_trial: false, trial_duration: C.training.feedbackMs, data: {task: 'practice_feedback'}}; }
  async function measureRefresh(display) {
    display.innerHTML = '<div class="instructions"><h1>Checking the display</h1><p>Keep this window visible for a moment.</p></div>';
    const intervals = []; let previous;
    for (let i = 0; i < 100; i++) {
      const stamp = await new Promise(resolve => requestAnimationFrame(resolve));
      if (previous !== undefined && i > 10) intervals.push(stamp - previous);
      previous = stamp;
    }
    const sorted = intervals.slice().sort((a, b) => a - b);
    const frameMs = sorted[Math.floor(sorted.length / 2)];
    return {frame_ms: frameMs, refresh_hz: 1000 / frameMs, intervals_ms: intervals};
  }
  function guard() {
    return {
      timeline: [mousePage('<h1>Ready to continue?</h1><p>Return to the experiment window and keep it visible. The interrupted trial has been saved and will not be repeated.</p>'),
        asyncAction(async () => {await mouseGesture;}, 'resume_after_interruption')],
      conditional_function: () => document.hidden || !document.hasFocus() || audio.state !== 'running' ||
        document.pointerLockElement !== document.body || (settings.requireFullscreen && !document.fullscreenElement)
    };
  }
  function enumerationProcedure(trialRows, phase, attemptGetter = null) {
    // Define the procedure once; jsPsych resolves the current scheduled row on each iteration.
    const nodes = [guard(), {
      type: jsPsychEnumeration, row: jsPsych.timelineVariable('row'), settings,
      on_start: trial => {
        const row = trial.row, attempt = attemptGetter ? attemptGetter() : 0;
        trial.row = {...row, phase, training_attempt: attempt,
          participant_id: setup.participantId, session: setup.session,
          unique_trial_id: `${runId}/${phase}/${row.configuration_id}/${row.scheduled_order}` + (attemptGetter ? '/attempt-' + attempt : '')};
      },
      on_finish: data => { lastEnum = data; }
    }];
    if (phase !== 'main') nodes.push(feedback(() => {
      const r = lastEnum;
      if (r.technical_abort) return '<p>The trial was interrupted. Keep the window visible and maintain fixation.</p>';
      if (r.premature) return '<p>Too early. Look at the centre dot, only respond after hearing tone.</p>';
      if (r.late) return '<p>Too late. Click your number immediately after the tone.</p>';
      if (r.timeout) return '<p>Respond promptly after the tone, even if you are uncertain.</p>';
      const timing = r.fast_response ? 'Your response was unusually fast. Look at the centre dot, only respond after hearing tone.' : `Response after tone: ${Math.round(r.rt_tone_ms)} ms.`;
      return `<p>${r.numerical_correct ? 'Correct.' : 'The display contained ' + r.target_numerosity + '.'}</p><p>${timing}</p>`;
    }));
    return {timeline: [
      asyncAction(async () => {await mouseGesture;}, 'prepare_mouse_control'),
      {timeline: nodes, timeline_variables: trialRows.map(row => ({row})), randomize_order: false},
      asyncAction(() => EnumerationMouse.release(), 'release_mouse_control')
    ]};
  }
  function cueTraining(mapping) {
    const trials = D.shuffle(['left', 'right', 'neutral'], D.rng(setup.seed + '/cue-training'));
    const training = [];
    for (const meaning of trials) {
      let correct;
      training.push({type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="instructions">${symbolHtml(mapping[meaning])}<p>Which location does this arrow predict?</p></div>`,
        choices: ['Left', 'Right', 'Either side'], button_layout: 'flex',
        data: () => ({task: 'cue_training', training_attempt: 1, cue_meaning: meaning}),
        on_finish: data => { data.correct = data.response === {left: 0, right: 1, neutral: 2}[meaning]; correct = data.correct; }
      }, feedback(() => `<p>${correct ? 'Correct.' : 'This symbol means ' + meaning + '.'}</p>`));
    }
    return {timeline: [
      page('<h1>Check the arrow meanings</h1>' + legend(mapping) + '<p>Check each arrow once. Single-headed arrows predict the correct side on three out of four directional trials. The double-headed arrow means either location is equally likely; it does not mean dots appear on both sides.</p>'),
      ...training,
      action(() => {
        const recent = jsPsych.data.get().filter({task: 'cue_training'}).values();
        metadata.training.cue_completed = recent.length;
        metadata.training.cue_correct = recent.filter(r => r.correct).length;
        metadata.training.cue_attempts = 1;
      }, 'cue_training_result')
    ]};
  }
  function timedTraining(mapping, phase, count, maskEnabled, instructions) {
    const practice = D.practiceRows(C, mapping, setup.seed + '/' + phase, count, phase)
      .map(row => ({...row, mask_enabled: maskEnabled}));
    return {timeline: [
      mousePage(instructions), enumerationProcedure(practice, phase, () => 1),
      action(() => {
        const recent = jsPsych.data.get().filter({task: 'enumeration', phase}).values();
        metadata.training[phase + '_completed'] = recent.length;
        metadata.training[phase + '_attempts'] = 1;
        metadata.training[phase + '_timely_proportion'] = recent.filter(r => r.timing_compliant && !r.technical_abort).length / count;
      }, phase + '_result')
    ]};
  }
  function displayProblemHtml() {
    const v = metadata.display_validation;
    const state = passed => passed ? 'Pass' : 'Needs attention';
    const rows = [
      ['Screen fit', v.geometry_fits, `${v.viewport_width_css_px} × ${v.viewport_height_css_px} browser pixels; needs at least ${v.required_width_css_px} × ${v.required_height_css_px} at the entered calibration`],
      ['Browser frame rate', v.minimum_refresh_met, `${v.refresh_hz.toFixed(1)} Hz measured; minimum ${v.required_refresh_hz} Hz (${C.timing.pilotRefreshTolerance * 100}% measurement tolerance; pass from ${v.minimum_refresh_hz.toFixed(1)} Hz)`],
      ['Fullscreen', v.fullscreen_ready, v.fullscreen_ready ? 'Active' : 'Not active'],
      ['Sound', v.audio_ready, v.audio_state]
    ];
    let html = '<h1>Display setup needs attention</h1>';
    html += v.geometry_fits ? '<p>The stimuli and response pad fit this screen. Another setup check failed.</p>' : '<p>The calibrated stimuli or response pad do not fit the available browser area.</p>';
    html += '<table><thead><tr><th>Check</th><th>Result</th><th>Measured setup</th></tr></thead><tbody>' + rows.map(([name, passed, detail]) => `<tr><th>${name}</th><td>${state(passed)}</td><td>${escape(detail)}</td></tr>`).join('') + '</tbody></table>';
    if (!v.geometry_fits) html += `<p>Press Command–0 to restore 100% browser zoom, close browser side panels, and use fullscreen. Verify the measured visible screen width (${setup.screenWidthCm} cm) and viewing distance (${setup.viewingDistanceCm} cm). Screen width means the horizontal visible display, not its diagonal. End this run and return to setup if either entry needs correcting.</p>`;
    if (!v.minimum_refresh_met) html += `<p>The browser frame rate is below the ${C.timing.minimumRefreshHz} Hz minimum, allowing ${C.timing.pilotRefreshTolerance * 100}% measurement tolerance. Keep power connected, use Chrome, and keep the experiment window active while checking again. Both 60 Hz and faster displays are supported; target and mask durations are converted to whole frames at the measured rate.</p>`;
    if (!v.fullscreen_ready) html += '<p>Check again will request fullscreen. Accept fullscreen presentation to continue.</p>';
    if (!v.audio_ready) html += '<p>Check again will try to resume sound. Keep this page active.</p>';
    return html + '<p>You can save the setup record below. Main trials remain blocked until all checks pass.</p><p><button type="button" class="secondary" data-export="json">Download setup record</button></p>';
  }
  function buildTimeline(mapping) {
    const timeline = [];
    if (settings.requireFullscreen) timeline.push({type: jsPsychFullscreen, fullscreen_mode: true, delay_after: 300, data: {task: 'fullscreen'}});
    let displayGesture = Promise.resolve();
    const displayCheck = asyncAction(async display => {
      await displayGesture;
      const refresh = await measureRefresh(display); metadata.display_check = refresh;
      settings.frameMs = refresh.frame_ms;
      const referenceMatch = Math.abs(refresh.refresh_hz / C.timing.referenceHz - 1) <= C.timing.pilotRefreshTolerance;
      const minimumRefreshHz = C.timing.minimumRefreshHz * (1 - C.timing.pilotRefreshTolerance);
      const minimumRefreshMet = Number.isFinite(refresh.refresh_hz) && refresh.refresh_hz >= minimumRefreshHz;
      const physicalWidthPx = screen.width;
      settings.pixelsPerDegree = D.pixelsPerDegree(setup.screenWidthCm, setup.viewingDistanceCm, physicalWidthPx);
      settings.pixelsPerMm = physicalWidthPx / (setup.screenWidthCm * 10);
      const typography = EnumerationDisplay.applyCalibration(C, settings.pixelsPerMm);
      const ppd = settings.pixelsPerDegree;
      const padLayout = D.responseLayout(innerWidth, innerHeight, ppd, C.geometry, C.responsePad, settings.pixelsPerMm);
      const fits = padLayout.fits && innerWidth / 2 > (C.geometry.eccentricityDeg + C.geometry.apertureDiameterDeg / 2) * ppd + 10 && innerHeight > C.geometry.apertureDiameterDeg * ppd + 20;
      const fullscreenReady = !settings.requireFullscreen || !!document.fullscreenElement;
      const audioReady = audio.state === 'running';
      setupReady = fits && minimumRefreshMet && audioReady && fullscreenReady;
      metadata.setup_ready = setupReady;
      metadata.display_validation = {
        geometry_fits: fits, minimum_refresh_met: minimumRefreshMet,
        reference_refresh_match: referenceMatch, fullscreen_ready: fullscreenReady,
        audio_ready: audioReady, audio_state: audio.state, refresh_hz: refresh.refresh_hz,
        required_refresh_hz: C.timing.minimumRefreshHz, minimum_refresh_hz: minimumRefreshHz,
        reference_refresh_hz: C.timing.referenceHz,
        viewport_width_css_px: innerWidth, viewport_height_css_px: innerHeight,
        required_width_css_px: Math.ceil(Math.max(padLayout.width_px + 2 * C.responsePad.marginMm * settings.pixelsPerMm, Math.floor(2 * (C.geometry.eccentricityDeg + C.geometry.apertureDiameterDeg / 2) * ppd + 20) + 1)),
        required_height_css_px: Math.ceil(Math.max(Math.floor(C.geometry.apertureDiameterDeg * ppd + 20) + 1, C.geometry.apertureDiameterDeg * ppd + 2 * padLayout.height_px + 4 * C.responsePad.marginMm * settings.pixelsPerMm))
      };
      metadata.display_calibration = {screen_width_css_px: physicalWidthPx, viewport_width_css_px: innerWidth, viewport_height_css_px: innerHeight, screen_width_cm: setup.screenWidthCm, viewing_distance_cm: setup.viewingDistanceCm, pixels_per_degree: ppd, pixels_per_mm: settings.pixelsPerMm, typography, response_pad_layout: padLayout, entered_values_verified: setup.calibrationVerified};
      save('runs', {run_id: runId, metadata, config: C, scheduled_trials: rows});
      return {task: 'display_check', ...refresh, ...metadata.display_validation};
    }, 'display_check');
    const displayProblem = page('', ['Check again', 'End session'], {
      stimulus: () => `<div class="instructions display-diagnostics">${displayProblemHtml()}</div>`,
      data: {task: 'display_setup_problem'},
      on_load: () => {
        bindExports();
        document.querySelector('[data-choice="0"]').addEventListener('click', () => {
          const requests = [audio.resume()];
          if (settings.requireFullscreen && !document.fullscreenElement) requests.push(document.documentElement.requestFullscreen());
          displayGesture = Promise.allSettled(requests);
        }, {capture: true});
      }
    });
    timeline.push({timeline: [displayCheck, {timeline: [displayProblem], conditional_function: () => !setupReady}],
      loop_function: data => !setupReady && data.filter({task: 'display_setup_problem'}).last(1).values()[0]?.response === 0});
    const body = [];
    body.push(page(`<h1>Count the dots; respond after the tone</h1><p>Keep looking at the small centre dot inside the fixation marker during the dot display. An arrow above the marker predicts where the dots are likely to appear. The dots will flash briefly and be followed by masks.</p><p><strong>Look at the centre dot, only respond after hearing tone.</strong> When the number pad appears, click your best estimate as soon as you can, even if you are uncertain. You have ${C.timing.responseDeadlineMs/1000} seconds after the tone.</p><p>The horizontal row runs from 0 to 9, left to right, in the same position as the reminder. The cursor returns automatically below fixation before every trial; you do not need to move it back. Your first left-button press on a number is recorded; keyboard presses do not give answers.</p><p>Your number briefly highlights after selection. Selecting a number does not stop the mask.</p>`));
    body.push(cueTraining(mapping));
    body.push(page(`<h1>Practice the number pad</h1><p>Click the requested number with your mouse. There are ${C.training.numberPadTrials} checks and no time limit in this exercise.</p>`));
    if (!Number.isInteger(C.training.numberPadTrials) || C.training.numberPadTrials < 1 || C.training.numberPadTrials > C.responsePad.numbers.length) {
      throw new Error('Experiment files are out of date. Reload the experiment page before starting a new run.');
    }
    const numberValues = D.shuffle(C.responsePad.numbers, D.rng(setup.seed + '/pad')).slice(0, C.training.numberPadTrials);
    for (const [index, number] of numberValues.entries()) {
      let correct, practiceLayout;
      body.push({type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="instructions"><h1>Click ${number}</h1></div>`,
        choices: C.responsePad.numbers.map(String), button_layout: 'grid', grid_rows: null, grid_columns: 10,
        button_html: choice => `<button class="jspsych-btn number-practice">${choice}</button>`,
        data: {task: 'number_pad_training', requested_number: number, number_pad_check: index + 1, number_pad_check_total: numberValues.length},
        on_load: () => {practiceLayout = positionPracticePad();},
        on_finish: data => {
          document.body.classList.remove('enum-pad-practice');
          data.response_pad_layout = practiceLayout;data.pixels_per_mm = settings.pixelsPerMm;
          data.viewport_width_px = innerWidth;data.viewport_height_px = innerHeight;
          data.reported_number=C.responsePad.numbers[data.response];correct=data.reported_number===number;data.correct=correct;
        }
      }, feedback(() => `<p>${correct ? 'Correct.' : 'Click the requested number.'}</p>`));
    }
    body.push(timedTraining(mapping, 'tone_training', C.training.toneTrials, false, '<h1>Practice responding to the tone</h1><p>Practice five trials. A dot array will flash beside fixation without a mask. The cursor returns automatically below fixation before each trial. Look at the centre dot, only respond after hearing tone. Then click your best estimate immediately.</p>'));
    body.push(timedTraining(mapping, 'mixed_practice', C.training.mixedTrials, true, '<h1>Practice full experiment trials</h1><p>Practice eight full trials. A dot array will flash beside fixation and be followed by masks. Use the brief dot display to decide your answer. Look at the centre dot, only respond after hearing tone. Then report your best estimate promptly.</p>'));
    body.push(action(() => {
      trainingComplete = true;
      metadata.training.completed = true;
      save('runs', {run_id: runId, metadata, config: C, scheduled_trials: rows});
    }, 'training_result'));
    const main = [mainInstructions()];
    for (const block of [...new Set(rows.map(r => r.block))]) {
      main.push(enumerationProcedure(rows.filter(r => r.block === block), 'main'));
      if (block !== rows.at(-1).block) main.push(mousePage(`<h1>Take a break</h1><p>Block ${block} is complete. Rest your eyes and hands, then continue when ready.</p><p id="break-upload-status" role="status"></p><p><button type="button" class="secondary" data-export="json" data-export-kind="block_${block}">Download backup</button></p>`, ['Continue'], {on_load: () => startBreakBackup(block), data: {task: 'break', block}}));
    }
    body.push({timeline: main, conditional_function: () => trainingComplete});
    timeline.push({timeline: body, conditional_function: () => setupReady});
    if (settings.requireFullscreen) timeline.push({type: jsPsychFullscreen, fullscreen_mode: false, delay_after: 0});
    return timeline;
  }
  function completion() {
    metadata.finished_at = new Date().toISOString();
    metadata.completed_main_trials = jsPsych.data.get().filter({task: 'enumeration', phase: 'main'}).count();
    metadata.training = {...metadata.training};
    metadata.status = metadata.completed_main_trials === rows.length ? 'complete' : 'setup_or_training_incomplete';
    save('runs', {run_id: runId, metadata, config: C, scheduled_trials: rows});
    mount.innerHTML = `<div class="intro"><h1>${metadata.status === 'complete' ? 'Session complete' : 'Session ended'}</h1><p>Thank you. ${metadata.completed_main_trials} main trials were recorded.</p><p id="final-upload-status" role="status">Sending the full JSON and trial CSV. Please keep this page open.</p><p>Download both files as a backup. The JSON includes the full schedule and event records; the CSV contains trial summaries.</p><button data-export="json">Download full JSON</button><button data-export="csv">Download trial CSV</button><button type="button" id="retry-upload" class="secondary" hidden>Retry unconfirmed uploads</button>${storageError ? `<p class="notice">Local backup could not be saved: ${escape(storageError)}. Download the files before leaving.</p>` : '<p class="small">A local recovery copy is also stored in this browser.</p>'}<p><a href="./">Return to setup</a></p></div>`;
    bindExports();
    window.EnumerationApp.finished = true;
    const results = {};
    const finalStatus = document.getElementById('final-upload-status');
    const retry = document.getElementById('retry-upload');
    const warnBeforeLeaving = event => {event.preventDefault();event.returnValue = '';};
    async function sendFinal() {
      retry.hidden = true;
      finalStatus.textContent = 'Sending the full JSON and trial CSV. Please keep this page open.';
      window.addEventListener('beforeunload', warnBeforeLeaving);
      try {
        for (const format of ['json', 'csv']) {
          if (results[format] && ['saved', 'queued'].includes(results[format].status)) continue;
          const b = bundle();
          const contents = format === 'json' ? JSON.stringify(b) : D.csv(summaries(b.records));
          results[format] = await uploadFile('final', contents, format);
        }
        finalStatus.textContent = `JSON: ${uploadDescription(results.json)} CSV: ${uploadDescription(results.csv)}`;
        retry.hidden = !Object.values(results).some(r => ['failed', 'uncertain'].includes(r.status));
      } finally {window.removeEventListener('beforeunload', warnBeforeLeaving);}
    }
    retry.addEventListener('click', sendFinal);
    sendFinal().catch(() => {finalStatus.textContent = 'Uploads could not be confirmed. Download both files before leaving.'; retry.hidden = false;});
  }
  async function start(event) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form), status = document.getElementById('setup-status');
    const participantId = String(values.get('participant')).trim();
    // This entry point always runs the full design, including full training.
    const mode = 'full';
    setup = {participantId, mode, session: Number(values.get('session')),
      screenWidthCm: Number(values.get('screen_width')), viewingDistanceCm: Number(values.get('viewing_distance')),
      assignmentVersion: Number(values.get('assignment')),
      seed: String(values.get('seed')).trim() || `${participantId}/session-${values.get('session')}`,
      calibrationVerified: values.get('verified') === 'on', fullscreen: values.get('fullscreen') === 'on'};
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(participantId)) {status.textContent = 'Use a participant code containing letters, numbers, underscores, or hyphens.';return;}
    if (!Number.isInteger(setup.session) || setup.session < 1 || setup.session > C.design.sessions) {status.textContent = 'Choose session 1 or 2.';return;}
    if (!Number.isInteger(setup.assignmentVersion) || setup.assignmentVersion < 0 || setup.assignmentVersion >= C.design.signalDelaysMs.length * 5) {document.getElementById('researcher-setup').open = true;status.textContent = 'Choose a stimulus assignment version from 0 to 44.';return;}
    if (!setup.calibrationVerified) {document.getElementById('researcher-setup').open = true;status.textContent = 'Verify the physical monitor width and viewing distance before a full experiment session.';return;}
    if (!setup.fullscreen) {document.getElementById('researcher-setup').open = true;status.textContent = 'Full experiment sessions require fullscreen presentation.';return;}
    try {
      jsPsych = initJsPsych({display_element: 'experiment', ...A.initializationOptions(location.protocol), on_finish: completion,
        on_data_update: record => save('records', {...record, run_id: runId}),
        on_close: () => {if (!metadata) return; if (metadata.status === 'running') metadata.status = 'window_closed'; save('runs', {run_id: runId, metadata, config: C, scheduled_trials: rows});}
      });
      audio = await A.unlock(jsPsych);
      // Audible check on a user gesture unlocks sound before any timed trials.
      A.checkTone(audio, C.timing);
      rows = D.makeDesign(C, setup);
      settings = {config: C, frameMs: 1000 / C.timing.referenceHz,
        pixelsPerDegree: D.pixelsPerDegree(setup.screenWidthCm, setup.viewingDistanceCm, screen.width),
        pixelsPerMm: screen.width / (setup.screenWidthCm * 10), requireFullscreen: setup.fullscreen};
      EnumerationDisplay.applyCalibration(C, settings.pixelsPerMm);
      metadata = {run_id: runId, experiment_version: C.experimentVersion, jspsych_version: C.jsPsychVersion, experiment_variant: 'full',
        dependencies: C.dependencies, started_at: new Date().toISOString(), setup,
        cue_mapping: D.cueMapping(C.design.cues),
        response_method: 'mouse_number_pad', trial_start_method: 'automatic_cursor_reset', cursor_control: 'pointer_lock',
        display_assumptions: {...C.displaySetup}, presentation_protocol: location.protocol, training: {},
        user_agent: navigator.userAgent, screen: {width: screen.width, height: screen.height, pixel_ratio: devicePixelRatio},
        backup_status: db ? 'available' : 'unavailable', status: 'running'};
      save('runs', {run_id: runId, metadata, config: C, scheduled_trials: rows});
      window.EnumerationApp = {jsPsych, settings, metadata, rows, finished: false, exportCurrent, summaries};
      // jsPsych appends its display wrapper to an explicit display_element.
      // Remove the operator launcher before handing this element to the timeline.
      mount.replaceChildren();
      await jsPsych.run([page('<h1>Check the sound</h1><p>Did you hear the tone? Adjust the sound level before continuing. Use the same audio equipment throughout the session.</p>', ['I heard the tone'], {data: {task: 'sound_check'}}), ...buildTimeline(metadata.cue_mapping)]);
    } catch (e) {
      if (status.isConnected) status.textContent = e.message;
      else mount.innerHTML = `<div class="intro"><h1>Experiment interrupted</h1><p>${escape(e.message)}</p><p>Reload this page to recover saved records and return to setup.</p></div>`;
      console.error(e);
    }
  }
  async function renderSetup() {
    try {db = await openBackup();} catch (e) {storageError = e.message;}
    mount.innerHTML = `<div class="intro setup-page"><h1>Spatial cueing and enumeration</h1>
      <section class="general-instructions" aria-labelledby="general-instructions-title">
        <h2 id="general-instructions-title">Your task</h2>
        <p>Estimate how many dots appear in each brief flash.</p>
        <ol><li>Keep looking at the centre dot throughout each trial.</li>
        <li>An arrow indicates where the dots are likely to appear: left, right, or either side.</li>
        <li>A dot array will flash beside the centre dot. A patterned mask may follow. Remember the number of dots.</li>
        <li>After the tone, immediately click your best estimate on the number pad, even if you are unsure. Your first click is recorded.</li></ol>
        <p class="notice"><strong>Look at the centre dot, only respond after hearing tone.</strong></p>
        <p>You will check the sound and display, then practise before the main experiment. A separate page will tell you when the main experiment begins. You can rest between blocks.</p>
      </section>
      ${window.ENUMERATION_DATAPIPE_ID ? '' : '<p class="notice">DataPipe is not configured. Enter the experiment ID in datapipe-config.js before collecting data.</p>'}
      <form id="setup-form">
      <div class="form-grid"><label>Participant code<input name="participant" id="participant" required maxlength="40" placeholder="P001" pattern="[A-Za-z0-9_-]+"></label>
      <label>Session<select name="session"><option value="1">1</option><option value="2">2</option></select></label></div>
      <details id="researcher-setup" class="setup-details"><summary>Researcher setup</summary>
      <p class="small">Confirm calibration before starting. Use 100% browser zoom and keep the viewing distance steady.</p>
      
      <div class="form-grid"><label>Physical screen width (cm)<input name="screen_width" type="number" min="10" max="200" step="0.1" value="${C.geometry.defaultScreenWidthCm}" required></label><label>Viewing distance (cm)<input name="viewing_distance" type="number" min="20" max="200" step="0.1" value="${C.geometry.defaultViewingDistanceCm}" required></label></div>
      <p class="small">This line should measure 50 mm. Adjust the screen-width entry if needed.</p><div id="calibration-rule" class="calibration-rule" aria-label="50 millimetre calibration line"></div>
      <p class="small">Use the built-in MacBook Pro display at full brightness, with automatic brightness, True Tone and Night Shift off, and power connected.</p>
      <label><input name="verified" type="checkbox">The physical screen width and viewing distance have been measured.</label>
      <div class="form-grid"><label>Stimulus assignment version (0–44; reuse in session 2)<input name="assignment" type="number" min="0" max="44" value="0" required></label>
      <label>Random seed<input name="seed" placeholder="Defaults to participant code and session"></label></div>
      <label><input name="fullscreen" type="checkbox" checked>Use fullscreen</label>
      </details>
      <p id="setup-status" class="status" role="status"></p><button type="submit">Start and check sound</button></form><div id="recovery"></div></div>`;
    const form = document.getElementById('setup-form');
    form.addEventListener('submit', start);
    form.addEventListener('invalid', event => {
      if (event.target.closest('details')) document.getElementById('researcher-setup').open = true;
    }, true);
    const widthInput = document.querySelector('[name=screen_width]');
    const updateRuler = () => {
      const widthCm = Number(widthInput.value);
      document.getElementById('calibration-rule').style.width = `${widthCm > 0 ? 50 * screen.width / (widthCm * 10) : 0}px`;
    };
    widthInput.addEventListener('input', updateRuler); updateRuler();
    document.getElementById('participant').addEventListener('change', e => {
      const id = e.target.value.trim();
      document.querySelector('[name=assignment]').value = D.hash(id) % (C.design.signalDelaysMs.length * 5);
    });
    if (db) {
      const saved = (await getAll('runs')).sort((a, b) => b.metadata.started_at.localeCompare(a.metadata.started_at)).slice(0, 10);
      if (saved.length) {
        const recovery = document.getElementById('recovery');
        recovery.innerHTML = '<details class="setup-details"><summary>Recover saved data</summary><p class="small">Recovery exports completed records; it does not restart interrupted trials.</p>' + saved.map((r, i) => `<p><button class="secondary" data-recover="${i}">${escape(r.metadata.setup.participantId)} · session ${r.metadata.setup.session} · ${escape(r.metadata.status)}</button></p>`).join('') + '</details>';
        recovery.querySelectorAll('[data-recover]').forEach(button => button.addEventListener('click', async () => {
          const r = saved[Number(button.dataset.recover)], records = (await getAll('records')).filter(v => v.run_id === r.run_id).sort((a, b) => a.trial_index - b.trial_index);
          download(JSON.stringify({metadata: r.metadata, config: r.config, scheduled_trials: r.scheduled_trials, records}), fileName(r.metadata.setup.participantId, 'recovered', 'json'), 'application/json');
        }));
      }
    }
  }
  renderSetup().catch(e => {mount.innerHTML = `<div class="intro"><p>Setup failed: ${escape(e.message)}</p></div>`;});
})();
