(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.EnumerationConfig = config;
})(globalThis, function () {
  'use strict';
  return {
    experimentVersion: '0.16.0-pilot',
    jsPsychVersion: '8.3.0',
    design: {
      numerosities: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      signalDelaysMs: [100, 150, 225, 350, 600, 1000, 1600, 2500, 3500],
      // Trials per numerosity x signal-delay cell across both sessions.
      trialsPerCell: 20, sessions: 2, blockSize: 90,
      stimulusPoolSeed: 'enumeration-stimulus-pool-v2',
      cues: {left: 'arrow-left', right: 'arrow-right', neutral: 'arrow-neutral'}
    },
    timing: {
      fixationMinMs: 500, fixationMaxMs: 800,
      cueMs: 100, postCueMs: 400,
      referenceHz: 120, arrayFramesAtReference: 8, maskFramesAtReference: 12,
      pilotRefreshTolerance: 0.05,
      responseDeadlineMs: 3000, lateObservationMs: 250, responseFeedbackMs: 300,
      fastResponseFlagMs: 100, itiMs: 500,
      toneMs: 100, toneFrequencyHz: 2000, toneGain: 0.08,
      frameGapMultiplier: 1.5
    },
    geometry: {
      eccentricityDeg: 5, apertureDiameterDeg: 4,
      dotDiameterDeg: 0.4, minCenterSeparationDeg: 1.0,
      cueDiameterDeg: 0.7, cueStrokeDeg: 0.07, cueOffsetAboveDeg: 0.8,
      fixationShape: 'bullseye-crosshair', fixationDiameterDeg: 0.6,
      fixationInnerDiameterDeg: 0.2, fixationStrokeDeg: 0.2, fixationContrast: '#ffffff',
      defaultScreenWidthCm: 34.5, defaultViewingDistanceCm: 70,
      background: '#808080', foreground: '#101010',
      maskTileDeg: 0.12
    },
    displaySetup: {
      device: '16-inch MacBook Pro built-in display', brightnessPercent: 100,
      automaticBrightness: false, trueTone: false, nightShift: false,
      power: 'AC', refreshMode: 'ProMotion on supported Apple silicon models',
      verification: 'assumed; browser cannot verify display settings'
    },
    training: {
      cueTrials: 3, numberPadTrials: 5, toneTrials: 5, mixedTrials: 8,
      feedbackMs: 900, arrayDurationsMs: [200/3, 150, 300]
    },
    demo: { numerosities: [3, 6], signalDelaysMs: [150, 600], trialsPerCell: 5, arrayDurationsMs: [200/3, 100, 150, 250, 400] },
    responsePad: {
      numbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      buttonWidthMm: 11, buttonHeightMm: 11, gapMm: 2, marginMm: 4,
      numberGlyphHeightMm: 4.75, reminderGlyphHeightMm: 3.8,
      reminderLineHeightMm: 7
    },
    mouseCursor: {resetBelowDeg: 0.8},
    typography: {instructionCapitalHeightMm: 3.8, headingCapitalHeightMm: 5.5},
    dependencies: {
      core: '8.3.0', htmlButton: '2.1.0', fullscreen: '2.1.0', callFunction: '2.1.0'
    }
  };
});
