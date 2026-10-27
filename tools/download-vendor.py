"""Download exact published jsPsych builds; no package manager is needed."""
from pathlib import Path
from urllib.request import urlopen
import hashlib
import json

root = Path(__file__).resolve().parents[1]
assets = {
    'jspsych.js': 'https://unpkg.com/jspsych@8.3.0/dist/index.browser.js',
    'jspsych.css': 'https://unpkg.com/jspsych@8.3.0/css/jspsych.css',
    'plugin-html-keyboard-response.js': 'https://unpkg.com/@jspsych/plugin-html-keyboard-response@2.2.0/dist/index.browser.js',
    'plugin-html-button-response.js': 'https://unpkg.com/@jspsych/plugin-html-button-response@2.1.0/dist/index.browser.js',
    'plugin-survey-html-form.js': 'https://unpkg.com/@jspsych/plugin-survey-html-form@2.1.0/dist/index.browser.js',
    'plugin-fullscreen.js': 'https://unpkg.com/@jspsych/plugin-fullscreen@2.1.0/dist/index.browser.js',
    'plugin-call-function.js': 'https://unpkg.com/@jspsych/plugin-call-function@2.1.0/dist/index.browser.js',
    'JSPsych-LICENSE.txt': 'https://raw.githubusercontent.com/jspsych/jsPsych/main/license.txt',
}
vendor = root / 'vendor'
vendor.mkdir(exist_ok=True)
manifest = {}
for name, url in assets.items():
    with urlopen(url, timeout=30) as response:
        data = response.read()
    if not data:
        raise RuntimeError(f'Empty dependency: {name}')
    (vendor / name).write_bytes(data)
    manifest[name] = {'url': url, 'sha256': hashlib.sha256(data).hexdigest()}
    print(f'Downloaded {name} ({len(data)} bytes)')
(vendor / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
