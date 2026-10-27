const {test} = require('node:test');
const assert = require('node:assert/strict');
const {send} = require('../datapipe.js');

test('sends the exact file through the documented text API', async () => {
  let request;
  const result = await send('my-id', 'file.json', '{"answer":3}', {fetch: async (url, init) => {
    request = {url, init}; return {status: 201, json: async () => ({message:'Success'})};
  }});
  assert.equal(result.status, 'saved');
  assert.equal(request.url, 'https://pipe.jspsych.org/api/data/');
  assert.deepEqual(JSON.parse(request.init.body), {experimentID:'my-id', filename:'file.json', data:'{"answer":3}'});
});

test('distinguishes queued, rejected, missing configuration, and uncertain outcomes', async () => {
  const response = (status, error) => async () => ({status, json: async () => ({error})});
  assert.equal((await send('id','a.csv','data',{fetch:response(202,null)})).status, 'queued');
  assert.deepEqual(await send('id','a.csv','data',{fetch:response(400,'FILE_EXISTS')}), {status:'failed',filename:'a.csv',detail:'FILE_EXISTS'});
  assert.equal((await send('', 'a.csv', 'data', {fetch: () => {throw Error('must not call');}})).status, 'not_configured');
  assert.equal((await send('id','a.csv','data',{fetch:async () => {throw Error('offline');}})).status, 'uncertain');
});

test('compresses large text uploads without changing their contents', async () => {
  const contents = 'x'.repeat(10000001); let sent;
  await send('id', 'large.json', contents, {fetch:async (_url, init) => {sent=init;return {status:201,json:async()=>({})};}});
  assert.equal(sent.headers['Content-Encoding'], 'gzip');
  const decoded = await new Response(sent.body.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  assert.equal(JSON.parse(decoded).data, contents);
});
