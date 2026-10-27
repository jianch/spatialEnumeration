// Synthetic test participants only. Never combine these files with human data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {gzipSync} = require('node:zlib');
const C = require('../config.js');
const D = require('../design.js');
const {harness} = require('../tests/helpers/full-experiment-harness.cjs');
const {trialHarness} = require('../tests/helpers/plugin-harness.cjs');
const out = path.resolve(process.argv[2] || path.join(__dirname, '../output/testmonkey'));
fs.mkdirSync(out, {recursive:true});
const write = (name, value) => fs.writeFileSync(path.join(out,name), typeof value === 'string' ? value : JSON.stringify(value,null,2));
function normal(random) {return Math.sqrt(-2*Math.log(Math.max(1e-12,random())))*Math.cos(2*Math.PI*random());}
function probability(row, scenario, person, item = 0) {
  const n = row.target_numerosity, t = row.signal_delay_ms;
  const direction = {valid:1, neutral:0, invalid:-1}[row.cue_validity];
  let ceiling = 0.995 - 0.028 * Math.max(0,n-2);
  let onset = 35 + 12*n, tau = (70 + 48*n)*Math.exp(person.speed);
  if (scenario === 'faster_processing') {
    tau *= Math.exp(-direction*(0.16+0.024*n));
    onset -= direction*(12+5*n);
  }
  if (scenario === 'persistent_fidelity') ceiling += direction*0.055*n/9;
  ceiling = Math.min(0.998, Math.max(0.15,ceiling));
  let p = 0.10+(ceiling-0.10)*(1-Math.exp(-Math.max(0,t-onset)/tau));
  let logit = Math.log(p/(1-p)) + person.ability + item;
  if (scenario === 'constant_logodds') logit += direction*0.27;
  return 1/(1+Math.exp(-logit));
}
function wrongNumber(n, random) {
  const choices = C.responsePad.numbers.filter(x=>x!==n);
  const weights = choices.map(x=>Math.exp(-Math.abs(x-n)/1.25)*(x<n?1.3:1));
  let u=random()*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<choices.length;i++){u-=weights[i];if(u<=0)return choices[i];}
  return choices.at(-1);
}

async function fullSession(session, refreshHz, options = {}) {
  const sessionOut=options.outputDir || out;
  fs.mkdirSync(sessionOut,{recursive:true});
  let readinessStamp=0;
  const h = await harness({participant:'SYNTHETIC_MONKEY', session:String(session), assignment:'0'},
    {requestAnimationFrame:fn=>queueMicrotask(()=>fn(readinessStamp+=1000/refreshHz))});
  const app=h.context.EnumerationApp, j=app.jsPsych;
  h.audio.resume=async()=>{h.audio.state='running';};
  const random=D.rng('testmonkey-v1/session-'+session);
  let clock=1000, controls=0;
  const leaves=[], injectionCounts={};
  const count=key=>injectionCounts[key]=(injectionCounts[key]||0)+1;
  // Execute all production timeline nodes and callbacks. The adapter replaces
  // jsPsych's browser scheduler; the enumeration plugin itself is unchanged.
  async function walk(timeline, variables={}) {
    for(const node of timeline) {
      if(node.conditional_function && !node.conditional_function())continue;
      if(node.timeline) {
        let loops=0;
        do {
          const from=h.records.length;
          if(node.timeline_variables)for(const v of node.timeline_variables)await walk(node.timeline,{...variables,...v});
          else await walk(node.timeline,variables);
          if(!node.loop_function)break;
          const data={filter(criteria){return {last(n){return {values:()=>h.records.slice(from).filter(r=>Object.entries(criteria).every(([k,v])=>r[k]===v)).slice(-n)};}};}};
          if(!node.loop_function(data))break;
          assert.ok(++loops<3,'Readiness loop terminates');
        }while(true);
        continue;
      }
      let data=typeof node.data==='function'?node.data():{...node.data};
      node.on_load?.();
      if(node.func) {
        const result=node.async?await new Promise(resolve=>node.func(resolve)):node.func();
        data={...data, value:result};
      } else if(node.row) {
        const trial={...node,row:variables.row};
        node.on_start?.(trial);
        const row=trial.row;
        const q=trialHarness(row,()=>{},true,{refreshHz,startPerfMs:clock});
        const isMain=row.phase==='main', i=row.scheduled_order;
        let injection='ordinary';
        if(isMain && i===241) {
          injection=session===1?'blur_abort':'pointer_lock_abort';
          q.advance(8); if(session===1)q.blur();else q.unlock();
        } else {
          if(isMain&&i%149===0){q.press(row.target_numerosity);count('pre_tone_click_ignored');}
          q.until(()=>!q.pad.hidden);
          const p=options.responseProbability ? options.responseProbability(row) : probability(row,'faster_processing',{ability:0,speed:0});
          const number=random()<p?row.target_numerosity:wrongNumber(row.target_numerosity,random);
          let rt=350+random()*300;
          if(isMain&&i%101===0)injection='omission';
          else if(isMain&&i%113===0){injection='late';rt=3100;}
          if(injection!=='omission') {
            q.until(()=>q.now()>=q.active().tonePerfMs+rt);
            if(isMain&&i%127===0){q.press(number,{button:2});count('nonprimary_click_ignored');}
            q.press(number);
          }
          q.until(()=>q.record()!==null);
        }
        count(injection);
        data={...q.record(),synthetic:true,synthetic_source:'virtual_production_plugin',test_injection:injection};
        if(isMain&&i%149===0)assert.ok(data.pointer_events.some(e=>e.before_tone&&!e.accepted));
        if(isMain&&i%127===0)assert.ok(data.pointer_events.some(e=>e.button===2&&!e.accepted));
        assert.equal(data.technical_abort,injection==='blur_abort'?'window_blur':injection==='pointer_lock_abort'?'pointer_lock_lost':null);
        if(injection==='omission')assert.equal(data.reported_number,null);
        if(injection==='late')assert.equal(data.late,true);
        if(!data.technical_abort) {
          assert.equal(data.timing_flag,false);
          assert.equal(data.mask_enabled,row.mask_enabled!==false);
          assert.equal(data.raw_events.some(e=>e.type==='visual_draw'&&e.stage==='mask'),row.mask_enabled!==false);
          assert.ok(data.iti_draw_perf_ms>=data.visual_sequence_end_perf_ms);
          if(data.response_chosen_perf_ms!==null)assert.ok(data.iti_draw_perf_ms+1e-6>=data.response_chosen_perf_ms+C.timing.responseFeedbackMs);
          if(injection==='ordinary')assert.equal(data.timing_compliant,true);
        }
        clock=q.now();
      } else if(node.choices) {
        let response=0;
        if(data?.task==='cue_training')response={left:0,right:1,neutral:2}[data.cue_meaning];
        if(data?.task==='number_pad_training')response=data.requested_number;
        const stimulus=typeof node.stimulus==='function'?node.stimulus():node.stimulus;
        data={...data,response:node.choices.length?response:null,stimulus,rt:node.choices.length?250:null};
        const button=j.getDisplayElement().querySelectorAll('.jspsych-btn')[0];
        if(button.clickOptions?.capture){button.click();await Promise.resolve();}
        controls++;
        clock+=node.trial_duration??250;
      }
      data={...data,trial_index:h.records.length,synthetic:true};
      node.on_finish?.(data);
      h.records.push(data);leaves.push(data.task||'framework_control');
    }
  }
  await walk(h.timeline);
  j._options.on_finish();
  app.metadata.synthetic=true;
  if(options.generatingModel)app.metadata.generating_model=options.generatingModel;
  app.metadata.test_environment={kind:'Node VM; virtual display, mouse, audio and timeline adapter',refresh_hz:refreshHz,physical_timing_verified:false,browser_exports_verified:false,local_recovery_verified:false};
  app.metadata.display_check={...app.metadata.display_check,note:'Virtual readiness check, not a measured physical display'};
  const timed=h.records.filter(r=>r.task==='enumeration'),main=timed.filter(r=>r.phase==='main');
  assert.equal(app.metadata.status,'complete');assert.equal(main.length,810);
  assert.equal(timed.length,823);assert.equal(new Set(main.map(r=>r.unique_trial_id)).size,810);
  assert.deepEqual(main.map(r=>r.configuration_id),Array.from(app.rows,r=>r.configuration_id));
  assert.equal(h.records.filter(r=>r.task==='break').length,8);
  assert.equal(h.records.filter(r=>r.task==='cue_training').length,3);
  assert.equal(h.records.filter(r=>r.task==='number_pad_training').length,5);
  assert.equal(app.metadata.training.completed,true);
  // Use the actual application's JSON/CSV export paths, replacing only the
  // browser Blob-download transport. IndexedDB is unavailable in this adapter.
  const blobs=new Map(),downloads=[];
  h.context.Blob=Blob;
  h.context.URL={createObjectURL(blob){const key='blob:'+blobs.size;blobs.set(key,blob);return key;},revokeObjectURL(){}};
  h.context.setTimeout=()=>0;
  h.context.document.createElement=()=>({click(){downloads.push({name:this.download,blob:blobs.get(this.href)});}});
  app.exportCurrent('json');app.exportCurrent('csv');
  const json=await downloads[0].blob.text(),csv=await downloads[1].blob.text();
  const parsed=JSON.parse(json);
  assert.equal(parsed.scheduled_trials.length,810);assert.equal(parsed.records.length,h.records.length);
  fs.writeFileSync(path.join(sessionOut,`SYNTHETIC_MONKEY_s${session}.json.gz`),gzipSync(json));
  fs.writeFileSync(path.join(sessionOut,`SYNTHETIC_MONKEY_s${session}.csv`),csv);
  return {session,virtual_refresh_hz:refreshHz,main_trials:main.length,timed_training_trials:timed.length-main.length,records:h.records.length,breaks:8,controls,virtual_timed_and_instruction_minutes:(clock-1000)/60000,accuracy_all_scheduled:main.reduce((a,r)=>a+r.accuracy_all_scheduled,0)/810,injections:injectionCounts,export_path_roundtrip:true,physical_timing_verified:false};
}

function cohort() {
  const scenarios=['null','constant_logodds','faster_processing','persistent_fidelity'];
  const file=fs.openSync(path.join(out,'SYNTHETIC_cohort.csv'),'w');
  const columns=['synthetic','scenario','participant_id','session','assignment_version','scheduled_order','block','configuration_id','target_numerosity','cue_validity','target_side','signal_delay_ms','array_duration_ms','response','rt_tone_ms','numerical_correct','timing_compliant','accuracy_all_scheduled','timeout','late','signed_error','generating_probability'];
  fs.writeSync(file,columns.join(',')+'\n');
  let total=0;
  for(let subject=0;subject<45;subject++) {
    const id='SYNTHETIC_'+String(subject+1).padStart(3,'0'),personRandom=D.rng('cohort-v1/'+id);
    const person={ability:normal(personRandom)*0.35,speed:normal(personRandom)*0.12};
    for(const session of [1,2]) {
      const rows=D.makeDesign(C,{seed:id+'/session-'+session,session,assignmentVersion:subject,mode:'full'});
      assert.equal(rows.length,810);
      for(const scenario of scenarios) {
        // Shared draws across scenarios make comparisons paired; these are
        // illustrative sensitivity datasets, not independent human samples.
        const random=D.rng('cohort-responses-v1/'+id+'/'+session);
        const text=[];
        for(const row of rows) {
          const item=normal(D.rng('cohort-item-v1/'+row.configuration_id))*0.15;
          const p=probability(row,scenario,person,item);
          const u=random(),error=wrongNumber(row.target_numerosity,random);
          const status=random(),rt=350+random()*300;
          const omitted=status<0.01,late=!omitted&&status<0.02;
          const number=u<p?row.target_numerosity:error;
          const events=omitted?[]:[{value:number,perf_ms:1000+(late?3100:rt),accepted:true}];
          const score=D.scoreResponse(events,1000,1000-row.signal_delay_ms,row.target_numerosity,C.timing,1000);
          const values=[true,scenario,id,session,subject,row.scheduled_order,row.block,row.configuration_id,row.target_numerosity,row.cue_validity,row.target_side,row.signal_delay_ms,row.array_duration_ms,score.response,score.rt_tone_ms,score.numerical_correct,score.timing_compliant,score.accuracy_all_scheduled,score.timeout,score.late,score.signed_error,p];
          text.push(values.map(v=>v??'').join(','));total++;
        }
        fs.writeSync(file,text.join('\n')+'\n');
      }
    }
  }
  fs.closeSync(file);
  return {participants:45,assignment_versions:'0–44 exactly once',sessions_per_participant:2,main_trials_per_participant_per_scenario:1620,scenarios,rows:total,seed_version:'v1',latency_assumption:'Decision probability depends on scheduled signal delay; the decision is assumed frozen at the tone. Mouse RT is independent motor/report delay. This assumption needs empirical checking.',sampling:'Model-based cohort, not a browser run. 1% omissions and 1% late responses; all score as incorrect. Subject ability SD .35 logit, log speed SD .12, shared item SD .15 logit.',response_support:'0–9, errors favour nearby values; upper truncation can bias large-number signed errors.',purpose:'Illustrative recovery and data-pipeline check; not a calibrated power calculation.'};
}

if(require.main===module)(async()=>{
  const started=new Date().toISOString(),sessions=[];
  for(const [session,hz] of [[1,60],[2,120]]){sessions.push(await fullSession(session,hz));console.log('Full virtual session complete:',session,hz+' Hz');}
  const simulation=cohort();
  const hashes=Object.fromEntries(['config.js','design.js','app.js','plugin-enumeration.js','tests/helpers/plugin-harness.cjs','tests/helpers/full-experiment-harness.cjs','tools/testmonkey.cjs','tools/analyse-testmonkey.R'].map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',name))).digest('hex')]));
  write('validation.json',{synthetic:true,started_at:started,finished_at:new Date().toISOString(),experiment_version:C.experimentVersion,passed:true,sessions,simulation,source_sha256:hashes,limitations:['DOM/canvas/audio/fullscreen/pointer lock and jsPsych scheduling are adapters. No real-browser or physical timing validation.','Each virtual trial executes the production enumeration plugin; the production entry point supplies the complete training and main timeline.','Native download transport and IndexedDB recovery were not exercised; export content was round-tripped using application export code.','Completion includes retained injected interruption records, as in production; completed does not mean all trials are usable.']});
  console.log(JSON.stringify({out,sessions,simulation},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={fullSession};
