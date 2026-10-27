const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../tools/figure-sat-model.cjs');

test('figure SAT curves remain at the specified floor before onset and approach their plateau',()=>{
  for(const scenario of M.scenarios)for(let n=1;n<=9;n++)for(const cue of M.cues) {
    const p=M.parameters(n,cue,scenario);
    assert.equal(M.probability(p.onset_ms,p),1/9);
    assert.equal(M.probability(p.onset_ms-20,p),1/9);
    assert.ok(Math.abs(M.probability(100000,p)-p.plateau)<1e-12);
    const values=[0,100,150,225,350,600,1000,1600,2500,3500].map(t=>M.probability(t,p));
    assert.ok(values.every((x,i)=>x>=p.gamma&&x<=p.plateau&&(i===0||x>=values[i-1])));
  }
});

test('single-component scenarios change only the named component and retain a valid null control',()=>{
  for(let n=1;n<=9;n++)for(const cue of M.cues) {
    const neutral=M.parameters(n,'neutral','combined'),combined=M.parameters(n,cue,'combined');
    for(const [scenario,component] of [['onset_only','onset_ms'],['rate_only','rate_per_second'],['plateau_only','plateau']]) {
      const isolated=M.parameters(n,cue,scenario);
      for(const key of ['onset_ms','rate_per_second','plateau'])assert.equal(isolated[key],key===component?combined[key]:neutral[key]);
    }
    assert.deepEqual(M.parameters(n,cue,'null'),neutral);
  }
});

test('combined parameters preserve the cue and numerosity order in the supplied figure',()=>{
  for(let n=1;n<=9;n++) {
    const [v,z,i]=M.cues.map(cue=>M.parameters(n,cue));
    assert.ok(v.onset_ms<z.onset_ms&&z.onset_ms<i.onset_ms);
    assert.ok(v.rate_per_second>z.rate_per_second&&z.rate_per_second>i.rate_per_second);
    assert.ok(v.plateau>=z.plateau&&z.plateau>=i.plateau);
    if(n>1)for(const cue of M.cues) {
      const previous=M.parameters(n-1,cue),current=M.parameters(n,cue);
      assert.ok(current.onset_ms>previous.onset_ms&&current.rate_per_second<previous.rate_per_second&&current.plateau<previous.plateau);
    }
  }
  assert.throws(()=>M.parameters(0,'valid'));
  assert.throws(()=>M.parameters(3,'unknown'));
});
