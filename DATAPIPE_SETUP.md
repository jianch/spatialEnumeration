# Connect automatic saving to DataPipe

This is a separate copy of the full experiment. It retains the original trial design and stores data locally in the browser. It also sends a JSON backup at each of the eight breaks, then sends the complete JSON and trial CSV at the end.

## 1. Set up DataPipe

1. In DataPipe, connect your chosen storage provider, such as Google Drive. Signing in with Google alone does not connect Drive.
2. Choose **New Experiment**, select Google Drive, enter a title, and create the experiment. Choose a parent Drive folder if desired.
3. Open the experiment dashboard and copy its **Experiment ID**. Turn on **Accept new data** for testing and collection.
4. Under **Validation**, allow both JSON and CSV, and remove the default required-field chip `trial_type`. The full JSON has `metadata`, `config`, `scheduled_trials`, and `records` at its top level; trial fields are nested in `records`. DataPipe checks required JSON fields only at the top level. Each backup and final file is a separate text submission: a completed session sends 10 files (8 backups, final JSON and final CSV). Leave the session limit off or allow for all submissions, including pilots and retries.

See https://pipe.jspsych.org/docs/experiments and https://pipe.jspsych.org/docs/experiments/sending-data for the current DataPipe settings.

## 2. Enter the ID in this copy

Your supplied experiment ID, `ynAsjMgatrZl`, is already entered in `datapipe-config.js`. To use a different DataPipe experiment, open that file and replace the ID between the single quotes:

```js
window.ENUMERATION_DATAPIPE_ID = 'ynAsjMgatrZl';
```

Save the file. This ID identifies the DataPipe experiment and is visible to anyone who can load the experiment page. It is not a password. Do not put Google passwords or tokens in these files. With no ID, the setup page shows a warning and automatic uploads are disabled.

## 3. Run a test

Start the experiment using `Start Experiment.command` or `npm start`, and open the printed address in Chrome. The computer must have internet access even when the experiment itself runs locally. Use a test participant code, not real participant data, during testing.

At each break, the Continue button is disabled while the backup request is underway (up to 30 seconds). The page reports whether it was saved, accepted by DataPipe for later delivery, rejected, or could not be confirmed. You can download a local JSON backup. At the end, keep the page open until the separate JSON and CSV statuses appear. Download both files as a fallback. A retry creates a fresh filename: if the first response was lost, both copies may eventually appear.

Check the DataPipe dashboard and its linked storage folder for a block backup and both final files. A queued status means DataPipe accepted the data but has not yet confirmed delivery to the storage provider. Resolve rejected or unconfirmed uploads before relying on the setup. Test a full-length session with the actual equipment and inspect the recovered files; automated tests use a mock and do not contact your DataPipe account.

Files are named using the participant code, the UTC timestamp at which each file is prepared, and a label: for example, `P001_20261027T061524123Z_block_1.json`, `P001_20261027T071524123Z_final.json`, and `P001_20261027T071524124Z_final.csv`. Manual downloads use a block, `backup`, `final`, or `recovered` label. Session number and the unique run ID remain inside the data. Timestamps are distinct within a run, including retries. DataPipe rejects duplicate names; if different runs using the same code produce an identical name, retry or download the file locally. Participant codes are visible in filenames and may appear in DataPipe logs, so use nonidentifying codes.

Backup snapshots include the complete planned schedule and all records produced up to the break. Uploads occur during breaks or after completion, outside the timed trials. The browser's local recovery and manual download options remain available. DataPipe has a per-request size limit; large text payloads are compressed by compatible browsers, and failed uploads require the manual fallback.

DataPipe receives data but does not host the experiment. To run it from other computers, separately publish this folder on an appropriate web host. Check your institution's requirements for research data and hosting before collecting participant data.
