// Rounded reconstruction of the user-supplied illustrative parameter plot.
// These values were read from a raster image, not recovered from original code.
const gamma=1/9;
const cues=['valid','neutral','invalid'];
const scenarios=['null','onset_only','rate_only','plateau_only','combined'];
const onset={
  valid:[85,95,105,115,125,135,145,155,165],
  neutral:[100,118,136,154,172,190,208,226,244],
  invalid:[115,141,167,193,219,245,271,297,323]
};
const rate={
  valid:[6.30,5.74,5.22,4.74,4.32,3.94,3.58,3.26,2.97],
  neutral:[6.00,5.24,4.57,3.99,3.48,3.04,2.65,2.31,2.02],
  invalid:[5.70,4.75,3.95,3.28,2.73,2.27,1.89,1.57,1.30]
};
const plateau={
  valid:[.990,.985,.975,.957,.932,.898,.858,.811,.759],
  neutral:[.990,.976,.955,.929,.896,.855,.807,.752,.690],
  invalid:[.990,.967,.938,.900,.856,.806,.748,.684,.613]
};
function parameters(n,cue,scenario='combined') {
  if(!Number.isInteger(n)||n<1||n>9||!cues.includes(cue)||!scenarios.includes(scenario))throw new Error('Invalid SAT condition');
  const i=n-1;
  return {gamma,onset_ms:onset[scenario==='combined'||scenario==='onset_only'?cue:'neutral'][i],
    rate_per_second:rate[scenario==='combined'||scenario==='rate_only'?cue:'neutral'][i],
    plateau:plateau[scenario==='combined'||scenario==='plateau_only'?cue:'neutral'][i]};
}
function probability(timeMs,p) {
  return p.gamma+(p.plateau-p.gamma)*(-Math.expm1(-p.rate_per_second*Math.max(0,timeMs-p.onset_ms)/1000));
}
module.exports={gamma,cues,scenarios,parameters,probability};
