# Spatial cueing enumeration response signal pilot

Version 0.11.0 uses jsPsych 8.3.0 with mouse responses, arrow cues above a persistent bull’s-eye plus crosshair fixation marker, and valid, invalid, and neutral conditions. The 20-trial demonstration and practice include varied target exposures. The main design retains 810 trials per session and its fixed 66.7 ms exposure. Settings remain provisional for piloting and model recovery.

## Run on this computer

Double-click **Start Experiment.command**, then open **http://127.0.0.1:8765** in Chrome and keep the server window open. Alternatively, use `npm start` if Node is installed. All libraries are bundled; participant data remain on this computer.

1. Enter a participant code without an identifying name and choose the quick demonstration first.
2. Use the built-in 16-inch MacBook Pro display at full brightness, with automatic brightness, True Tone and Night Shift off, and AC power connected. The screen-width default is about 34.5 cm and viewing distance is 70 cm; verify both before pilot data collection. Use fullscreen and browser zoom at 100%. Pilot mode still requires a measured refresh rate within 5% of 120 Hz.
3. Keep the participant code and stimulus assignment version the same across sessions. Arrow meanings are fixed.
4. Confirm that the high-pitched sound is audible. Complete arrow comprehension, number-pad familiarisation, tone practice, and mixed practice using mouse buttons.
5. Timed trials start automatically; no Ready button is shown. Keep the pointer near the response pad between trials. Look at the central dot during the target display. When the tone sounds and the pad appears, select your best estimate immediately with the left mouse button.
6. Download the full JSON and trial CSV at completion. The setup page can export previous browser recovery runs.

The updated HTML also enables generated Web Audio tones for direct-file previews. The local server is the verified and recommended launch method; recovery storage can differ between launch methods. Use one method consistently and download exports. Previous runs retain their original configuration and records.

The operator setup page uses 16-pixel form text, a 28-pixel heading (26 pixels in narrow panels), and 14-pixel helper text. Compact spacing and paired assignment/seed fields keep the form readable on the MacBook screen.

## Mouse number pad

The response pad is a single horizontal row: 0 1 2 3 4 5 6 7 8 9, ascending from left to right. There is no Other option or supplementary entry form. Keyboard presses cannot select a numerical response.

The pad is hidden until the scheduled tone is reached on an animation frame. Its actual appearance timestamp is recorded, so `rt_pad_ms` can be distinguished from `rt_tone_ms`. Its complete rectangle is below both target apertures and does not replace the canvas. Buttons measure 11 × 11 mm, with 2 mm gaps, for a 128 mm row. Their CSS dimensions use the measured screen width and browser screen width; the row does not shrink to fit. Its top is 4 mm below the bottom edge of the target apertures. The reminder occupies a 7 mm line box above it, separated by 3.2 mm. Number-pad familiarisation uses the same dimensions without a time limit. Font sizes are calibrated using canvas glyph bounds: numerals target 4.75 mm visible height, instruction capitals and reminder capitals 3.8 mm, and heading capitals 5.5 mm. Actual rasterized ink may vary slightly with font rendering. Setup fails if adequate space is unavailable.

Each timed trial begins automatically with fixation and a reminder to look at the central dot and wait for the tone. The reminder disappears at target onset. The response row appears below its fixed position when the tone sounds; the text remains hidden during the target and response sequence. No click is needed to start an individual trial. Cursor position is not standardised by a Ready click; keep the pointer near the pad between trials. The first left mouse **press** on a visible number is permanent; click release is not the measured selection event. Right-button, touch, keyboard, hidden-pad, and intertrial inputs cannot select an answer. The selected number highlights for 300 ms. The intertrial interval then begins once the complete target and mask sequence has finished; the participant does not have to wait out the remaining response window. Pointer events, the most recent observed mouse position at pad onset (or null when unknown), its age, and distance from that position to the response are retained for diagnostics. This is displacement between two observed positions, not a complete movement path.

The response deadline is now 3000 ms after scheduled tone onset in timed practice, demonstration, and main pilot trials. If no number is chosen, the pad remains available through a further 250 ms late-observation interval, then a 500 ms intertrial interval begins. If a number is chosen, selection feedback lasts 300 ms before the intertrial interval, after the mask finishes. A late response also misses the deadline. Timely responses below 100 ms are flagged but retained. The mouse deadline, button size, pad appearance delay, and training compliance require pilot evaluation. Mouse RT includes movement and button-location effects and should not be interpreted as a direct measure of encoding time.

## Cue display and tone

← predicts left, → predicts right, and ↔ means either location is equally likely. Neutral does not indicate simultaneous arrays. The arrow centre is 0.8° above the fixation marker. The fixation marker is a separate persistent display layer throughout fixation, cue, preparation, target, mask, response, and intertrial stages.

The fixation marker follows the bull’s-eye plus crosshair geometry in Appendix A of [Thaler et al. (2013)](https://doi.org/10.1016/j.visres.2012.10.012): a 0.6° dark outer disk, two intersecting white bands 0.2° wide, and a 0.2° dark central dot. Keep looking at the central dot. This target does not verify fixation. Arrows retain nominal dimensions 0.7° by 0.28° and a 0.07° stroke, with a minimum stroke of one CSS pixel. Instructions and timed displays share the same arrow paths. The neutral arrow has two heads and therefore more line segments; total line length is not matched. Predictive arrows can engage both automatic and deliberate orienting. See [Ristic and Kingstone (2006)](https://pubmed.ncbi.nlm.nih.gov/16987781/).

Both sound check and trial signal now use the same high-pitched **2000 Hz sine beep lasting 100 ms**, nominal gain 0.08, with 5 ms ramps. The software gain is not a calibrated sound-pressure level. No previous audio file was found; this waveform implements the requested high-pitched warning tone.

## Timing and exposure

Main trials retain the original 500–800 ms fixation, 100 ms cue, 400 ms preparation, 66.7 ms target, and 100 ms bilateral mask. Main tone delays from array onset remain 100, 150, 225, 350, 600, 1000, 1600, 2500, and 3500 ms. The 100 and 150 ms tones overlap the mask. Pilot mode requires a measured refresh rate within 5% of 120 Hz. Browser draw events and frame intervals are saved.

Mixed practice uses target exposures of approximately **66.7, 150, and 300 ms**, each appearing 30 times in a 90-trial practice section. The 20-trial demonstration uses approximately **66.7, 100, 150, 250, and 400 ms**, each appearing four times. Demonstration base delays are 150 and 600 ms. In practice and demonstration, a delay shorter than the planned target exposure is increased to that exposure duration; the tone can overlap the mask but is not planned while the target remains visible. Both requested and effective signal delays are exported.

Exposure durations are converted to whole frames at the measured refresh rate. Practice and demonstration are for familiarisation and are excluded from main analysis. Longer practice exposure is not an additional main-design factor. Session duration now depends on click latency because trials advance after selection feedback and the complete mask. If every response is omitted, main trials take approximately 81.2 minutes per session before training, breaks, and interruptions; prompt responses shorten this substantially.

## MacBook Pro screen assumptions

At the default 70 cm viewing distance, the physical targets are approximately:

| Element | Visual angle | Physical size |
|---|---|---|
| Dot diameter | 0.4° | 4.89 mm |
| Minimum dot centre spacing | 1.0° | 12.22 mm (7.33 mm edge gap) |
| Array and mask diameter | 4° | 48.9 mm |
| Array centre left/right of fixation | 5° | about 61.1 mm in the program’s linear pixels-per-degree mapping |
| Fixation outer/central disk | 0.6° / 0.2° | 7.33 / 2.44 mm |
| Arrow width/height/stroke | 0.7° / 0.28° / 0.07° | 8.55 / 3.42 / 0.86 mm |
| Arrow centre above fixation | 0.8° | 9.77 mm |
| Mask tile | 0.12° | 1.47 mm |

The renderer uses a constant pixels-per-degree conversion based on one degree. This small-angle mapping places the 5° centre at about 61.1 mm, versus 61.2 mm under an exact tangent conversion. Physical interface sizes use screen width directly and remain fixed in millimetres when viewing distance changes. Angular stimuli scale with entered viewing distance. Native Retina pixels are not treated as CSS pixels. The setup page includes a 50 mm ruler line that updates when the screen-width entry changes. Check it at 100% browser zoom and maintain viewing distance, preferably with a chinrest.

The 34.5 cm width is an approximate starting value for the built-in display, not a completed calibration. Measure the visible screen rather than the laptop chassis. Record the actual MacBook model, display preset, resolution/scaling, browser version, brightness slider setting, and room lighting in the session log. Use the same equipment and settings for every condition and participant. Full brightness means the maximum ordinary SDR slider setting, not the display's advertised HDR peak. Brightness percentage is not a calibrated luminance measurement; the grey background remains #808080.

On supported Apple silicon models, ProMotion is adaptive up to 120 Hz, not a fixed 120 Hz setting. Keep the existing pilot refresh check and per-trial frame records; a MacBook or browser running at 60 Hz will fail the 120 Hz pilot check and can run demonstrations only. A startup check cannot certify physical timing throughout the session. Fullscreen and browser zoom at 100% are required for pilot mode. The browser does not change macOS display settings.

Apple sources: [16-inch display specifications](https://support.apple.com/en-au/121554), [refresh rate settings](https://support.apple.com/en-us/102297), [True Tone](https://support.apple.com/en-au/102147), and [brightness settings](https://support.apple.com/guide/mac-help/mchlp2704/mac).

## Main trial assignment

Numerosity 1–9, target side left/right, and cue validity valid/invalid/neutral are within-participant factors. Overall allocation is 60% valid, 20% invalid, and 20% neutral, corresponding to 75% validity among directional cues.

Each numerosity-by-delay cell has six valid, two invalid, and two neutral trials per session, with equal target-side counts within each condition. Two sessions give 1620 main trials, with nine blocks of 90 per session. Every block has ten trials per numerosity; exact cue ratios apply to cells and sessions, not necessarily each block.

The versioned `enumeration-stimulus-pool-v2` pool provides 180 configurations per numerosity, each shown once per participant across both sessions. Across 45 assignment versions, each configuration occurs at every delay three times valid, once invalid, and once neutral. Assign versions prospectively; hash defaults do not ensure recruitment balance. Configuration IDs and `stimulus_pool_version` identify this pool. Keep the experiment and stimulus pool versions identical across both sessions; the new coordinates must not be treated as the earlier v1 configurations.

Dots are 0.4° in diameter, within a 4° aperture centred 5° left/right, with minimum centre spacing 1.0°. Fixed dot size means total area and density vary with numerosity. Hull area, spacing, and bounding dimensions are exported rather than independently matched.

## Training

Pilot arrow comprehension has six mouse-choice trials, two per meaning, and requires six correct. Pad familiarisation covers 0–9 twice. Tone practice has 36 trials, and mixed practice has 90 trials; each requires at least 90% timely responses without technical interruption. Cue, tone, and mixed sections allow three attempts. Readiness does not depend on an individual's numerical accuracy or cueing effect. The demonstration uses abbreviated training without readiness thresholds.

## jsPsych structure

The app uses `initJsPsych`, `jsPsych.run`, official HTML button, fullscreen, and call-function plugins, standard timeline variables, loop functions, conditional readiness, and jsPsych data callbacks.

A custom `jsPsychEnumeration` plugin owns the complete timed canvas/audio/pad sequence because a response signal and pad can occur while the mask is visible. The plugin uses the framework audio context, timeout helpers, and `finishTrial`. DOM pointer events select numbers; there is no keyboard response listener. Instructions and comprehension use the official HTML button plugin. Data backup uses IndexedDB lifecycle callbacks.

## Data and interpretation

The JSON includes configuration, metadata, all scheduled rows, completed jsPsych records, coordinates, pointer events, visual events, frame intervals, audio timing, automatic-start events, observed pointer position at pad onset, and pad layout. Display assumptions are exported as assumptions; browser code cannot verify brightness, hardware model, True Tone, or Night Shift. The CSV includes enumeration summaries and stimulus metrics; large event/frame arrays remain in JSON.

- `response` and `reported_number`: the selected numeral, rather than a button index.
- `rt` and `rt_tone_ms`: milliseconds from scheduled tone onset to the selected left mouse press.
- `rt_array_ms` and `rt_pad_ms`: time from target onset and actual pad appearance.
- `array_duration_ms`: planned target exposure; `array_duration_browser_ms`: measured browser draw interval.
- `signal_delay_requested_ms` and `signal_delay_ms`: requested and effective signal delay.
- `numerical_correct`: correctness independent of response timing.
- `timing_compliant` and `correct_timely`: deadline compliance and correctness among timely reports; timing failures have null `correct_timely`.
- `accuracy_all_scheduled`: one for a timely correct delivered trial and zero otherwise. Undelivered planned rows are not observed numerical errors.
- `late`, `timeout`, `fast_response`, and `timing_flag`: response and presentation diagnostics. Hidden-pad presses are logged as ignored pointer events.

Focus/visibility loss, resize, fullscreen exit, or audio interruption ends and flags the affected trial without replay. Recovery exports committed records and does not resume an unfinished trial. Looking behaviour is not recorded.

The 0.4° dots and 4° region are literature-informed choices, informed by [Pomè et al.](https://doi.org/10.3758/s13414-020-02178-w) and [Plaisier et al. (2010)](https://doi.org/10.1007/s00221-010-2319-y). The 1° centre spacing is a practical pilot choice and does not establish crowding-free viewing; [Chakravarthi and Herbert (2019)](https://doi.org/10.1016/j.cognition.2018.12.008) demonstrate that crowding can impair subitizing. The 0.12° mask tile still requires validation.

Before confirmatory use, pilot mouse movement and the new 3000 ms deadline, externally validate visual/acoustic onset, assess mask strength, and run parameter/model recovery. The longer deadline is a usability-pilot setting and allows more processing after the signal. Immediate-response instructions remain in place, and actual array-to-click times must inform analysis. Delay-only accuracy curves no longer approximate a narrowly constrained response-signal procedure; onset, rate, and plateau comparisons require a validated timing model and recovery checks. Participant sample size and final analysis rules remain to be determined.

## Files and verification

`config.js` holds settings; `design.js` handles seeded schedules, exposure assignment, geometry, and scoring; `audio.js` supplies the shared beep; `plugin-enumeration.js` coordinates timed events and mouse responses; `app.js` provides setup, training, backup, and exports. `display.js` calibrates interface and glyph sizes. The protocol and parameter snapshot are in `docs/`.

Run `npm test` for design, mouse scoring, exposure, layout, and audio checks. The local `/tests/flow.html` page verifies the shortened complete experiment and exports, while `/tests/integration.html` checks seventeen mouse/stimulus edge cases, including automatic starts and late selection feedback. `/tests/preview.html` provides one layout-inspection trial with explicitly extended cue and response durations and no recovery saving. Flow records are labelled REFACTOR_TEST. The optional CLI runner requires Playwright and Chrome. Tests change only their isolated page configuration.

Runtime dependencies are jsPsych 8.3.0, HTML button response 2.1.0, fullscreen 2.1.0, and call-function 2.1.0. Bundled unused legacy plugin files are preserved with their original checksums. See the MIT license and `vendor/manifest.json`.

Official references: [timeline variables](https://www.jspsych.org/v8/overview/timeline/), [call-function](https://www.jspsych.org/v8/plugins/call-function/), [HTML button response](https://www.jspsych.org/v8/plugins/html-button-response/), and [plugin development](https://www.jspsych.org/v8/developers/plugin-development/).
