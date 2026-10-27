(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EnumerationDesign = api;
})(globalThis, function () {
  'use strict';
  function hash(value) {
    let h = 2166136261;
    for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let state = hash(seed);
    return function () {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(values, random) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function cueMapping(cues) {
    return {...cues};
  }
  // Normalised paths shared by instruction SVGs and the timed canvas display.
  function cueSegments(symbol) {
    if (!['arrow-left', 'arrow-right', 'arrow-neutral'].includes(symbol)) throw new Error('Unknown arrow cue: ' + symbol);
    const paths = [[[-0.5, 0], [0.5, 0]]];
    if (symbol !== 'arrow-right') paths.push([[-0.25, -0.2], [-0.5, 0], [-0.25, 0.2]]);
    if (symbol !== 'arrow-left') paths.push([[0.25, -0.2], [0.5, 0], [0.25, 0.2]]);
    return paths;
  }
  function generateDots(n, geometry, seed) {
    const random = rng(seed), points = [];
    const radius = (geometry.apertureDiameterDeg - geometry.dotDiameterDeg) / 2;
    for (let restart = 0; restart < 200; restart++) {
      points.length = 0;
      for (let attempts = 0; attempts < 10000 && points.length < n; attempts++) {
        const r = radius * Math.sqrt(random()), theta = 2 * Math.PI * random();
        const p = { x: r * Math.cos(theta), y: r * Math.sin(theta) };
        if (points.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= geometry.minCenterSeparationDeg)) points.push(p);
      }
      if (points.length === n) return points.map(p => ({x: +p.x.toFixed(6), y: +p.y.toFixed(6)}));
    }
    throw new Error('Unable to generate nonoverlapping dots; revise geometry.');
  }
  function hullArea(points) {
    if (points.length < 3) return 0;
    const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [], upper = [];
    for (const p of sorted) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
    for (const p of sorted.slice().reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
    const polygon = lower.slice(0, -1).concat(upper.slice(0, -1));
    return Math.abs(polygon.reduce((a, p, i) => a + p.x * polygon[(i + 1) % polygon.length].y - p.y * polygon[(i + 1) % polygon.length].x, 0)) / 2;
  }
  function metrics(points, geometry) {
    const distances = points.map((p, i) => Math.min(...points.filter((_, j) => i !== j).map(q => Math.hypot(p.x - q.x, p.y - q.y))));
    return {
      convex_hull_area_deg2: hullArea(points),
      total_dot_area_deg2: points.length * Math.PI * (geometry.dotDiameterDeg / 2) ** 2,
      aperture_density_per_deg2: points.length / (Math.PI * (geometry.apertureDiameterDeg / 2) ** 2),
      min_center_spacing_deg: points.length > 1 ? Math.min(...distances) : null,
      mean_nearest_neighbor_deg: points.length > 1 ? distances.reduce((a, b) => a + b, 0) / distances.length : null,
      bounding_width_deg: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)) + geometry.dotDiameterDeg,
      bounding_height_deg: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) + geometry.dotDiameterDeg
    };
  }
  function makeDesign(config, options) {
    const { seed, session = 1, assignmentVersion = 0, mode = 'pilot' } = options;
    const demo = mode === 'demo';
    const d = demo ? {...config.design, ...config.demo, sessions: 1, blockSize: 20} : config.design;
    if (!Number.isInteger(session) || session < 1 || session > d.sessions) throw new Error('Invalid session number.');
    if (!demo && (d.trialsPerCell % (5 * d.sessions * 2) !== 0)) throw new Error('trialsPerCell must support 3:1:1 cue ratios and side balance in every session.');
    const random = rng(seed), mapping = cueMapping(d.cues);
    const durationRotation = Math.floor(assignmentVersion / 5) % d.signalDelaysMs.length;
    const validityRotation = assignmentVersion % 5;
    const cyclesPerSession = d.trialsPerCell / (5 * d.sessions);
    const rows = [];
    for (const n of d.numerosities) for (let group = 0; group < d.signalDelaysMs.length; group++) {
      for (let slot = 0; slot < d.trialsPerCell; slot++) {
        const cycle = Math.floor(slot / 5);
        const rowSession = demo ? 1 : Math.floor(cycle / cyclesPerSession) + 1;
        if (rowSession !== session) continue;
        const conditionCode = (slot + validityRotation) % 5;
        const cueValidity = conditionCode < 3 ? 'valid' : conditionCode === 3 ? 'invalid' : 'neutral';
        const delayIndex = (group + durationRotation) % d.signalDelaysMs.length;
        // Alternating cycles gives equal side counts for each cue/delay/numerosity/session.
        const sideCode = demo ? (slot + group + n) % 2 : (cycle + group + n) % 2;
        const targetSide = sideCode ? 'right' : 'left';
        const cueMeaning = cueValidity === 'neutral' ? 'neutral' : cueValidity === 'valid' ? targetSide : targetSide === 'left' ? 'right' : 'left';
        const poolIndex = group * d.trialsPerCell + slot;
        const imageId = `${d.stimulusPoolSeed}/${demo ? 'demo' : 'pilot'}-n${n}-i${poolIndex}`;
        const coordinates = generateDots(n, config.geometry, `${d.stimulusPoolSeed}/${demo ? 'demo' : 'pilot'}/${n}/${poolIndex}`);
        rows.push({
          task: 'enumeration', phase: 'main', mode, session,
          target_numerosity: n, cue_validity: cueValidity,
          cue_meaning: cueMeaning, cue_symbol: mapping[cueMeaning],
          target_side: targetSide, signal_delay_ms: d.signalDelaysMs[delayIndex],
          configuration_id: imageId, stimulus_pool_version: d.stimulusPoolSeed, dot_coordinates_deg: coordinates,
          stimulus_metrics: metrics(coordinates, config.geometry),
          mask_seed: `${seed}/mask/${rows.length}`,
          fixation_ms: config.timing.fixationMinMs + Math.floor(random() * (config.timing.fixationMaxMs - config.timing.fixationMinMs + 1)),
          assignment_version: assignmentVersion
        });
      }
    }
    // Stratify blocks by numerosity; shuffle the already assigned conditions within each stratum.
    const blockCount = Math.ceil(rows.length / d.blockSize);
    const blocks = Array.from({ length: blockCount }, () => []);
    for (const n of d.numerosities) {
      const stratum = shuffle(rows.filter(r => r.target_numerosity === n), random);
      stratum.forEach((row, i) => blocks[i % blockCount].push(row));
    }
    let order = 0;
    const scheduled = blocks.flatMap((block, i) => shuffle(block, random).map((row, j) => ({...row, block: i + 1, trial_in_block: j + 1, scheduled_order: ++order})));
    const durations = demo ? config.demo.arrayDurationsMs : [config.timing.arrayFramesAtReference * 1000 / config.timing.referenceHz];
    const exposures = shuffle(Array.from({length:scheduled.length}, (_,i)=>durations[i%durations.length]), rng(seed+'/exposures'));
    return scheduled.map((row,i)=>({...row, array_duration_ms:exposures[i],
      signal_delay_requested_ms:row.signal_delay_ms,
      signal_delay_ms:demo ? Math.max(row.signal_delay_ms, exposures[i]) : row.signal_delay_ms}));
  }
  function practiceRows(config, mapping, seed, count, phase) {
    const random = rng(seed);
    const numerosities = shuffle(Array.from({length:count}, (_, i) => config.design.numerosities[i % config.design.numerosities.length]), random);
    const delays = shuffle(Array.from({length:count}, (_, i) => config.design.signalDelaysMs[i % config.design.signalDelaysMs.length]), random);
    const validities = shuffle(Array.from({length:count}, (_, i) => ['valid','valid','valid','invalid','neutral'][i % 5]), random);
    const durations = config.training.arrayDurationsMs;
    const exposures = shuffle(Array.from({length:count},(_,i)=>durations[i%durations.length]), random);
    return Array.from({length: count}, (_, i) => {
      const n = numerosities[i];
      const validity = validities[i];
      const side = random() < 0.5 ? 'left' : 'right';
      const meaning = validity === 'neutral' ? 'neutral' : validity === 'valid' ? side : side === 'left' ? 'right' : 'left';
      const dots = generateDots(n, config.geometry, `${seed}/practice/${i}`);
      return {
        task: 'enumeration', phase, practice: true,
        target_numerosity: n, target_side: side, cue_validity: validity,
        cue_meaning: meaning, cue_symbol: mapping[meaning],
        array_duration_ms: exposures[i], signal_delay_requested_ms: delays[i],
        signal_delay_ms: Math.max(delays[i], exposures[i]),
        fixation_ms: config.timing.fixationMinMs + Math.floor(random() * (config.timing.fixationMaxMs - config.timing.fixationMinMs + 1)),
        configuration_id: `${phase}-${seed}-${i}`, dot_coordinates_deg: dots,
        stimulus_metrics: metrics(dots, config.geometry), mask_seed: `${seed}/mask/${i}`,
        block: 0, scheduled_order: i + 1, use_dots: true
      };
    });
  }
  function pixelsPerDegree(screenWidthCm, viewingDistanceCm, screenWidthPx) {
    if (![screenWidthCm, viewingDistanceCm, screenWidthPx].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid viewing calibration.');
    return 2 * viewingDistanceCm * Math.tan(Math.PI / 360) * screenWidthPx / screenWidthCm;
  }
  function framePlan(timing, measuredFrameMs, targetDurationMs = null) {
    const targetMs = targetDurationMs ?? timing.arrayFramesAtReference * 1000 / timing.referenceHz;
    const maskMs = timing.maskFramesAtReference * 1000 / timing.referenceHz;
    return { arrayFrames: Math.max(1, Math.round(targetMs / measuredFrameMs)), maskFrames: Math.max(1, Math.round(maskMs / measuredFrameMs)), targetMs, maskMs };
  }
  function responseLayout(width, height, ppd, geometry, pad, pixelsPerMm) {
    if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) throw new Error('Invalid physical display calibration.');
    // The reminder and response row share a centre line below the target apertures.
    const count = pad.numbers.length;
    const buttonWidth = pad.buttonWidthMm * pixelsPerMm;
    const buttonHeight = pad.buttonHeightMm * pixelsPerMm;
    const gap = pad.gapMm * pixelsPerMm, margin = pad.marginMm * pixelsPerMm;
    const padWidth = count * buttonWidth + (count - 1) * gap;
    const left = (width - padWidth) / 2;
    const top = height / 2 + geometry.apertureDiameterDeg * ppd / 2 + margin;
    const reminderHeight = pad.reminderLineHeightMm * pixelsPerMm;
    return {button_width_px: buttonWidth, button_height_px: buttonHeight, gap_px: gap, width_px: padWidth, height_px: buttonHeight,
      left_px: left, top_px: top, home_x_px: width / 2, home_y_px: top + buttonHeight / 2,
      columns: count, reminder_top_px: top + (buttonHeight - reminderHeight) / 2, reminder_height_px: reminderHeight,
      reminder_left_px: margin, reminder_width_px: width - 2 * margin, pixels_per_mm: pixelsPerMm,
      button_width_mm: pad.buttonWidthMm, button_height_mm: pad.buttonHeightMm, gap_mm: pad.gapMm,
      aperture_margin_mm: pad.marginMm,
      fits: left >= margin && top + buttonHeight + margin <= height};
  }
  function scoreResponse(events, tonePerfMs, arrayPerfMs, n, timing, padPerfMs = null) {
    const first = events.find(e => e.accepted !== false && Number.isInteger(e.value) && e.value >= 0 && e.value <= 9) || null;
    const rt = first ? first.perf_ms - tonePerfMs : null;
    const timely = first !== null && rt >= 0 && rt <= timing.responseDeadlineMs;
    const numeric = first?.value ?? null;
    return {
      response: numeric, reported_number: numeric, response_route: first ? 'number_pad' : null,
      rt_tone_ms: rt, rt_array_ms: first ? first.perf_ms - arrayPerfMs : null,
      rt_pad_ms: first && padPerfMs !== null ? first.perf_ms - padPerfMs : null,
      premature: first !== null && rt < 0, late: first !== null && rt > timing.responseDeadlineMs,
      timeout: first === null || rt > timing.responseDeadlineMs,
      fast_response: timely && rt < timing.fastResponseFlagMs,
      timing_compliant: timely, numerical_correct: first ? numeric === n : null,
      correct_timely: timely ? numeric === n : null,
      accuracy_all_scheduled: timely && numeric === n ? 1 : 0,
      signed_error: numeric === null ? null : numeric - n
    };
  }
  function csv(rows) {
    const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const cell = v => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return '"' + s.replaceAll('"', '""') + '"'; };
    return [keys.map(cell).join(','), ...rows.map(row => keys.map(k => cell(row[k])).join(','))].join('\r\n');
  }
  return { hash, rng, shuffle, cueMapping, cueSegments, generateDots, metrics, makeDesign, practiceRows, pixelsPerDegree, framePlan, responseLayout, scoreResponse, csv };
});
