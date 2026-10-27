// Optional CLI runner. Browser verification in Codex uses the same public test pages.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
// Use the ordinary Continue/Start buttons as real browser gestures.
async function waitWithMouseControl(page, heading, timeout) {
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline) {
  if(await page.getByRole('heading',{name:heading,exact:true}).isVisible())return;
  const start=page.locator('button[data-mouse-start="true"]');
  if(await start.count()&&await start.first().isVisible())await start.first().click();
  await page.waitForTimeout(100);
 }
 throw new Error('Timed out waiting for '+heading);
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  await page.goto('http://127.0.0.1:8766/tests/flow.html');
  await page.getByRole('button',{name:'Run flow check',exact:true}).click();
  await page.locator('#jspsych-fullscreen-btn').click();
  await waitWithMouseControl(page,'Flow check passed',180000);
  const result=JSON.parse(await page.locator('#result').textContent());assert.equal(result.passed,true);
  await page.goto('http://127.0.0.1:8766/tests/integration.html');
  await page.getByRole('button',{name:'Run checks',exact:true}).click();
  await waitWithMouseControl(page,'18 of 18 checks passed',60000);
  console.log('Mouse full-flow and eighteen trial checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
