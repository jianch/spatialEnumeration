const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const C=require('../config.js');
const D=require('../design.js');
const M=require('./figure-sat-model.cjs');
const {fullSession}=require('./testmonkey.cjs');
const out=path.resolve(process.argv[2]||path.join(__dirname,'../output/figure-matched-simulation'));
fs.mkdirSync(out,{recursive:true});
const write=(name,value)=>fs.writeFileSync(path.join(out,name),typeof value==='string'?value:JSON.stringify(value,null,2));
const writeCsv=(name,rows)=>write(name,D.csv(rows));
function errorNumber(n,random) {
  // Match the figures' nine-response guessing convention. Zero remains possible
  // in production, but is never selected by this illustrative response model.
  const choices=C.design.numerosities.filter(x=>x!==n);
  return choices[Math.floor(random()*choices.length)];
}
(async()=>{
  const started=new Date().toISOString();
  const parameters=[];
  for(const scenario of M.scenarios)for(let n=1;n<=9;n++)for(const cue of M.cues)parameters.push({scenario,target_numerosity:n,cue_validity:cue,...M.parameters(n,cue,scenario)});
  writeCsv('generating_parameters.csv',parameters);
  write('model_specification.json',{synthetic:true,model:'p(t) = gamma + (plateau - gamma) * (1 - exp(-rate * max(0, t - onset) / 1000))',time_units:'Milliseconds from array onset to scheduled tone; decision assumed frozen at tone',rate_units:'per second',gamma:M.gamma,
    parameter_provenance:'Rounded visual reconstruction of Image #1; not exact original generating values. Single-component models follow Image #3 conceptually, with neutral parameters held common for unchanged components. Image #2 is the combined scenario across numerosities.',
    files:['ChatGPT Image 1 Oct 2026, 16_52_38.png','figure_1_all_numerosities.png','figure_1_candidate_models copy.jpg'],
    scenarios:M.scenarios,parameters,
    cohort_assumptions:{participants:45,sessions:2,trials_per_participant_per_scenario:1620,assignment_versions:'0–44 once each',participant_random_effects:false,image_random_effects:false,timing_failures:false,mouse_rt_ms:'Uniform 350–650; independent of correctness; no effect on decision probability',response_support:'1–9 to match gamma=1/9; production pad still supports 0–9',warning:'Ideal recovery benchmark, not a human power calculation. Full plugin monkey separately retains deliberate edge-case injections.'}});
  const fd=fs.openSync(path.join(out,'SYNTHETIC_figure_cohort.csv'),'w');
  const keys=['synthetic','scenario','participant_id','session','assignment_version','scheduled_order','block','configuration_id','target_numerosity','cue_validity','target_side','signal_delay_ms','array_duration_ms','response','rt_tone_ms','rt_array_ms','numerical_correct','timing_compliant','accuracy_all_scheduled','onset_ms','rate_per_second','plateau','gamma','generating_probability'];
  fs.writeSync(fd,keys.join(',')+'\n');let total=0;
  const counts=new Map();
  for(let subject=0;subject<45;subject++)for(const session of [1,2]) {
    const id='SYNTHETIC_FIGURE_'+String(subject+1).padStart(3,'0');
    const rows=D.makeDesign(C,{seed:id+'/session-'+session,session,assignmentVersion:subject,mode:'full'});
    assert.equal(rows.length,810);
    for(const scenario of M.scenarios) {
      const random=D.rng('figure-model-v1/'+id+'/'+session);const lines=[];
      for(const row of rows) {
        const p=M.parameters(row.target_numerosity,row.cue_validity,scenario);
        const chance=M.probability(row.signal_delay_ms,p),u=random(),wrong=errorNumber(row.target_numerosity,random),rt=350+300*random();
        const number=u<chance?row.target_numerosity:wrong;
        const score=D.scoreResponse([{value:number,perf_ms:1000+rt,accepted:true}],1000,1000-row.signal_delay_ms,row.target_numerosity,C.timing,1000);
        const record={synthetic:true,scenario,participant_id:id,session,assignment_version:subject,scheduled_order:row.scheduled_order,block:row.block,configuration_id:row.configuration_id,target_numerosity:row.target_numerosity,cue_validity:row.cue_validity,target_side:row.target_side,signal_delay_ms:row.signal_delay_ms,array_duration_ms:row.array_duration_ms,response:score.response,rt_tone_ms:score.rt_tone_ms,rt_array_ms:score.rt_array_ms,numerical_correct:score.numerical_correct,timing_compliant:score.timing_compliant,accuracy_all_scheduled:score.accuracy_all_scheduled,...p,generating_probability:chance};
        lines.push(keys.map(k=>record[k]).join(','));total++;
        const key=[scenario,row.target_numerosity,row.cue_validity,row.signal_delay_ms].join('/');
        if(!counts.has(key))counts.set(key,{scenario,target_numerosity:row.target_numerosity,cue_validity:row.cue_validity,signal_delay_ms:row.signal_delay_ms,trials:0,correct:0,generating_probability:chance,...p});
        const cell=counts.get(key);cell.trials++;cell.correct+=score.accuracy_all_scheduled;
      }
      fs.writeSync(fd,lines.join('\n')+'\n');
    }
  }
  fs.closeSync(fd);assert.equal(total,364500);
  for(const cell of counts.values())assert.equal(cell.trials,cell.cue_validity==='valid'?540:180);
  writeCsv('cohort_cell_counts.csv',Array.from(counts.values()).map(x=>({...x,observed_accuracy:x.correct/x.trials})));
  // A dense 200-trial-per-cell illustration reproduces the sampling convention
  // in the supplied figures. It is deliberately kept separate from task data.
  const reference=[],random=D.rng('figure-reference-v1');
  for(const scenario of M.scenarios)for(let n=1;n<=9;n++)for(const cue of M.cues)for(const t of [0,50,100,150,200,250,350,500,700,900,1200,1600,2200,3000,4000]) {
    const chance=M.probability(t,M.parameters(n,cue,scenario));let correct=0;
    for(let j=0;j<200;j++)correct+=Number(random()<chance);
    reference.push({synthetic:true,scenario,target_numerosity:n,cue_validity:cue,time_ms:t,trials:200,correct,generating_probability:chance,observed_accuracy:correct/200});
  }
  writeCsv('SYNTHETIC_reference_200_per_cell.csv',reference);
  const sessions=[];
  for(const [session,hz] of [[1,60],[2,120]]) {
    sessions.push(await fullSession(session,hz,{outputDir:out,responseProbability:row=>M.probability(row.signal_delay_ms,M.parameters(row.target_numerosity,row.cue_validity,'combined')),generatingModel:{scenario:'combined',gamma:M.gamma,parameter_table:'generating_parameters.csv',source:'Rounded visual reconstruction of user figures'}}));
    console.log('Figure-model virtual full session complete:',session);
  }
  const sources=['config.js','design.js','plugin-enumeration.js','tools/testmonkey.cjs','tools/figure-sat-model.cjs','tools/simulate-figure-models.cjs','tools/analyse-figure-models.R'];
  const hashes=Object.fromEntries(sources.filter(f=>fs.existsSync(path.join(__dirname,'..',f))).map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',f))).digest('hex')]));
  write('validation.json',{synthetic:true,passed:true,started_at:started,finished_at:new Date().toISOString(),experiment_version:C.experimentVersion,participants:45,scenarios:M.scenarios,cohort_rows:total,cohort_trials_per_scenario:72900,reference_cells:reference.length,sessions,source_sha256:hashes,limitations:['Raster-read approximate parameters, not original numeric source','Ideal cohort: no random effects, lapses, or motor-dependent processing','Virtual full-session adapters; no physical timing validation','Model recovery and selection are exploratory, not validated power estimates']});
  console.log('Wrote',total,'synthetic cohort rows to',out);
})().catch(error=>{console.error(error);process.exitCode=1;});
