/* Generated tones use jsPsych's AudioContext; no local audio file is fetched.
 * The file: override only disables jsPsych's media-loading compatibility switch.
 * It does not alter browser security, permissions, or autoplay rules.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EnumerationAudio = api;
})(globalThis, function () {
  'use strict';
  function initializationOptions(protocol) {
    return {use_webaudio: true, override_safe_mode: protocol === 'file:'};
  }
  async function unlock(jsPsych) {
    const audio = jsPsych.pluginAPI.audioContext();
    if (!audio) {
      if (jsPsych.getInitSettings().use_webaudio === false) {
        throw new Error('jsPsych has disabled audio for this launch method. Start Experiment.command and open the address it prints, or use the updated index.html.');
      }
      throw new Error('Web Audio is unavailable in this browser. Open the experiment in an up-to-date Chrome or Safari browser.');
    }
    await audio.resume();
    if (audio.state !== 'running') throw new Error('Sound could not start. Allow sound for this page, then press Start again.');
    return audio;
  }
  function playTone(audio, timing, start = audio.currentTime) {
    const source = audio.createOscillator(), envelope = audio.createGain();
    const duration = timing.toneMs / 1000, ramp = Math.min(0.005, duration / 2);
    source.type = 'sine'; source.frequency.value = timing.toneFrequencyHz;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(timing.toneGain, start + ramp);
    envelope.gain.setValueAtTime(timing.toneGain, start + duration - ramp);
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(envelope); envelope.connect(audio.destination);
    source.onended = () => {source.disconnect(); envelope.disconnect();};
    source.start(start); source.stop(start + duration);
    return {source, envelope};
  }
  function checkTone(audio, timing) { return playTone(audio, timing); }
  return {initializationOptions, unlock, playTone, checkTone};
});
