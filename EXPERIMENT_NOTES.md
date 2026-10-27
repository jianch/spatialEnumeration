# Spatial cueing and enumeration — full experiment

This copy adds automatic DataPipe backups and final exports. See [DATAPIPE_SETUP.md](DATAPIPE_SETUP.md) before running it; the original experiment remains separate.

This repository runs the complete experiment with a 60 Hz minimum display requirement. The separate demonstration is not included. This entry point always runs the full schedule and full training; it has no demonstration selector.

Double-click **Start Experiment.command**, then open **http://127.0.0.1:8766** in Chrome. Keep the server window open. Alternatively, run `npm start` in this folder. Node.js is required. Libraries are bundled and there is no build step. `ENUMERATION_PORT` can override this folder's default port.

## Session procedure

1. Enter a nonidentifying participant code, choose session 1 or 2, and enter the measured screen width and viewing distance. Defaults are 34.5 cm and 70 cm. Check the 50 mm ruler at 100% browser zoom, then confirm the measurement checkbox.
2. Enter the assigned stimulus version, 0–44. Reuse the participant code and assignment version in session 2. The initial assignment is derived from the code; the researcher can override it to balance recruitment. The default random seed includes the participant code and session.
3. Use the current display settings: built-in 16-inch MacBook Pro screen, full brightness, automatic brightness/True Tone/Night Shift off, and AC power. Fullscreen is required, and the measured browser refresh rate must meet a nominal 60 Hz minimum, allowing the existing 5% measurement tolerance (at least 57 Hz measured). Faster displays, including 120 Hz, are accepted without an upper limit. A failed display check prevents training and main trials.
4. Follow this order: check sound → check display → check each arrow meaning once (3 questions) → 5 number-pad trials → 5 tone trials without masks → 8 full practice trials with masks → main blocks. All practice runs once; accuracy and timing are recorded without performance thresholds or automatic repeats. Number-pad trials show only “Click N”.
5. Complete nine blocks of 90 main trials, with eight self-paced breaks. The experiment cursor resets automatically below fixation before every trial; no manual return or visible circle is needed. The reminder reads “Look at the centre dot, only respond after hearing tone.” The number row shares its position and appears at the tone. Immediately press your best estimate with the left mouse button. There is no numerical correctness feedback during main trials.
6. Download both the full JSON and trial CSV at completion. A JSON backup can also be downloaded during breaks. Return for the other session using the same experiment copy and stimulus assignment.

If setup fails, the diagnostic page reports screen fit, measured browser frame rate, fullscreen, and sound separately. Use **Check again** after correcting the failed item, or download the setup record. The width entry is the measured horizontal visible screen width, not the diagonal. The 34.5 cm default is for the existing 16-inch setup; measure a different MacBook's display rather than reusing that default. Restore 100% browser zoom with Command–0. A 60 Hz display is sufficient; ProMotion is optional. Stimulus sizes remain calibrated to the entered physical measurements.

## Preserved parameters

| Setting | Current value |
| --- | --- |
| Main schedule | 810 trials per session; 1,620 across two sessions |
| Numerosities | 1–9 |
| Signal delays from array onset | 100, 150, 225, 350, 600, 1,000, 1,600, 2,500, 3,500 ms |
| Cue allocation per session | 486 valid, 162 invalid, 162 neutral; target sides balanced in each cell |
| Fixation / cue / preparation | 500–800 / 100 / 400 ms |
| Minimum browser frame rate | Nominally 60 Hz; 5% measurement tolerance; no upper limit |
| Main array / bilateral mask | Approximately 66.7 / 100 ms: 4 / 6 frames at 60 Hz, 8 / 12 frames at 120 Hz |
| Full practice exposures | Approximately 66.7, 150, 300 ms; 3/3/2 trials, with masks |
| Response signal | 2,000 Hz sine tone, 100 ms |
| Response deadline | 3,000 ms after scheduled tone; 250 ms late-observation interval |
| Selection feedback / ITI | 300 / 500 ms; mask finishes before advancing |
| Dot / aperture / eccentricity | 0.4° / 4° / 5° |
| Minimum dot centre spacing | 1.0° |
| Response pad | Mouse only, horizontal 0–9; 11 mm buttons, 2 mm gaps |

Version `0.16.0-full` uses one round of 3 arrow questions, 5 number-pad trials, 5 unmasked tone trials, and 8 masked full practice trials. The former extra unmasked section and performance-based practice repeats are removed. Dot exposures remain approximately 66.7, 150, and 300 ms, distributed 2/2/1 in tone practice and 3/3/2 in full practice. The experiment cursor resets automatically 0.8° below fixation; existing Continue/Start buttons activate browser Pointer Lock without a separate notice. Control releases for instructions and breaks. Escape flags an interrupted trial. JSON records reset positions/times, virtual coordinates, `mask_enabled`, and practice completion/accuracy/timing diagnostics.

The nominal minimum browser refresh rate remains 60 Hz. `config.js` and `docs/parameters.json` contain the current settings. `referenceHz: 120` defines the original duration units (8 frames = 66.7 ms, 12 frames = 100 ms); it is not the admission requirement. Durations are converted to whole frames using the measured browser interval. Higher refresh rates remain supported, and rounding at other rates can slightly change achieved durations. Measured intervals and browser draw times remain in exports. Use the same display settings across sessions and record the measured rate.

Full runs are distinguished by `metadata.experiment_variant: "full"`, `metadata.setup.mode: "full"`, main-row `mode: "full"`, and `enumeration_full_…` export filenames. `metadata.display_validation.minimum_refresh_met` is the refresh admission decision; `reference_refresh_match` is retained as an informational comparison with the 120 Hz duration reference. The `enumeration-stimulus-pool-v2` IDs and coordinates retain their original `pilot` prefix. Demonstration settings remain in the shared design module for regression checks; the participant entry point does not use them.

The source Word protocol, source parameter snapshot, and source implementation notes are archived in `docs/archive/` and describe version 0.11.0, including its former training counts and 120 Hz restriction. Follow this README, `docs/parameters.json`, and `docs/Experimental_design_and_parameters.docx` for the current full experiment. `tools/build-protocol.py` regenerates the current Word protocol using `python-docx`.

## Data and recovery

Participant records stay in the browser until downloaded. The server only serves files. Full runs use the separate IndexedDB database `enumeration-full-experiment-backup`; browser flow checks use a separate test database. Recovery on the setup page exports saved records and the original schedule. Recovery does not resume an unfinished session or replay interrupted trials. Keep using the same browser profile and launch address for recovery.

The JSON contains the full planned main schedule, metadata, configuration, completed training and main records, coordinates, timing events, mouse diagnostics, and frame intervals. The CSV contains completed timed-trial summaries, including training; filter `phase === "main"` for main analyses. An interruption is flagged and retained without replay. The full schedule allows undelivered rows to be identified.

The current timing and mouse deadline retain the source protocol's pilot status. Browser checks do not certify physical display/audio onset, fixation, or mask strength. Session duration depends on response latency; omitting every response takes approximately 81.2 minutes of main timed sequences per session, excluding training and breaks.

## Verification

Run `npm test` for schedule balance, reproducibility, geometry, response scoring, audio, the actual five-item full-entry-point timeline without progress labels, single-pass practice order, automatic cursor reset and pointer-lock interruption handling, and the 60 Hz minimum across 60/120 Hz and faster displays. `tests/flow.html` uses the production training counts (3 arrow questions, 5 number checks, 5 unmasked tone trials, 8 masked full trials), shortened main trials and selected timings, and the production refresh-rate requirement. Records are labelled `FULL_FLOW_TEST`. `tests/integration.html` covers the timed mouse/stimulus edge cases. Neither test page changes `index.html` or production parameters.

`output/source-demo-sha256.json` records historical source hashes from when this copy was created; the original sibling experiment is not included in this repository. Tests retain checksum checks for archived baseline documents and unchanged audio/display modules. Vendor licenses and checksums are preserved in `vendor/`.

## Synthetic testmonkey

Run `npm run testmonkey`, then `npm run testmonkey:analyse` (the analysis needs base R). Outputs go to `output/testmonkey/`; start with `REPORT.md` and `synthetic_recovery.png`. Re-running replaces the synthetic files in that directory. An alternative output directory can be passed to `node tools/testmonkey.cjs PATH` and `Rscript tools/analyse-testmonkey.R PATH`.

The monkey traverses both complete production timelines, including all training and 810 main trials per session, and executes the actual enumeration plugin with virtual frame, canvas, audio and mouse adapters at 60 and 120 Hz. It checks injected omissions, late responses, ignored clicks and interruptions and round-trips the application's export content. It does not run browser jsPsych scheduling, physical display/audio timing, native downloads, permissions, or IndexedDB recovery. Existing browser verification pages remain separate.

The tool also generates a clearly marked, model-based cohort of 45 participants across four illustrative cue-effect scenarios. These cohort rows use the production schedules and scoring but do not traverse the task interface. They support descriptive effect-recovery checks, not a human pilot or a calibrated power calculation. All generated data are synthetic; keep them separate from participant records. The main task varies the response-signal delay at fixed dot exposure, which must be reflected in research hypotheses and interpretation.

## Simulation from the illustrative SAT figures

Run `npm run simulate:figures`, then `npm run analyse:figures` (base R). The separate `output/figure-matched-simulation/REPORT.html` links the trial data, specified parameter table, recovery figures, bootstrap intervals and candidate-model comparisons. Re-running replaces this folder's generated files. The earlier `output/testmonkey/` datasets remain separate.

`tools/figure-sat-model.cjs` explicitly reconstructs rounded onset, rate and plateau values from the supplied parameter image. These are approximate visual readings, not original source numbers. The generator follows the actual 810-trial session schedule for 45 participants under five models: null, onset only, rate only, plateau only and combined. It also executes both complete virtual production timelines using the combined model and saves a separate dense illustration with 200 observations per reference cell.

The cohort is an ideal binomial recovery benchmark without participant/image variation or timing failures. It uses the figures' assumed 1/9 floor and 1–9 reports; the production pad still includes 0. Fits compare candidate SAT families separately at each numerosity, and 200 parametric bootstrap draws per combined-condition curve illustrate uncertainty. These outputs do not establish human power, population uncertainty, physical timing or unique cognitive mechanisms.

## Main-phase transition and response position

The main experiment has a dedicated “Practice complete / Main experiment” page with the trial/block count, response rules, and an explicit **Begin main experiment** button. The short demo is labelled as a demonstration.

The number-pad check, unmasked tone practice, masked full practice, and main trials all use `EnumerationDesign.responseLayout` at the current calibrated viewport size. Every row is fixed at the same horizontal and vertical coordinates, with identical 11 mm buttons and 2 mm gaps. Number-pad checks use the same grey background, and their layout is saved with each check record.

## Opening page

The opening page gives participants a short task overview: maintain central fixation, use the arrow, remember the flashed dots, and respond immediately after the tone. It explains practice and breaks before collecting the participant code and session. Calibration, run selection (where available), assignment, seed, and fullscreen controls are under **Researcher setup**; missing calibration/fullscreen confirmation opens that section automatically. Saved-data recovery is also expandable. Required readiness checks remain in place.
