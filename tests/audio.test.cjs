const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../audio.js');

test('generated tones enable Web Audio when launched directly from a local HTML file',()=>{
  assert.deepEqual(A.initializationOptions('file:'),{use_webaudio:true,override_safe_mode:true});
  for(const protocol of ['http:','https:'])assert.deepEqual(A.initializationOptions(protocol),{use_webaudio:true,override_safe_mode:false});
});
test('unlock resumes the framework audio context and distinguishes disabled audio from missing support',async()=>{
  const context={state:'suspended',resume:async()=>{context.state='running';}};
  const j={pluginAPI:{audioContext:()=>context},getInitSettings:()=>({use_webaudio:true})};
  assert.equal(await A.unlock(j),context);
  await assert.rejects(A.unlock({pluginAPI:{audioContext:()=>null},getInitSettings:()=>({use_webaudio:false})}),/jsPsych has disabled audio/);
  await assert.rejects(A.unlock({pluginAPI:{audioContext:()=>null},getInitSettings:()=>({use_webaudio:true})}),/Web Audio is unavailable/);
  await assert.rejects(A.unlock({pluginAPI:{audioContext:()=>({state:'suspended',resume:async()=>{}})}}),/Allow sound/);
});

test('sound check and scheduled signals share the same high-pitched waveform and duration',()=>{
  const C=require('../config.js'),calls=[];
  const audio={currentTime:2,destination:{},createOscillator:()=>({frequency:{},connect(){},disconnect(){},start(t){calls.push(['start',t,this.frequency.value,this.type]);},stop(t){calls.push(['stop',t]);}}),createGain:()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}})};
  A.checkTone(audio,C.timing);A.playTone(audio,C.timing,3);
  assert.deepEqual(calls,[['start',2,2000,'sine'],['stop',2.1],['start',3,2000,'sine'],['stop',3.1]]);
});
