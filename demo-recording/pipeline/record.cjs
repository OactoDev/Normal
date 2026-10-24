#!/usr/bin/env node
// Capture actual local app interactions. Never mocks, rewrites, or replays verdicts.
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
function playwright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright',
    path.join(process.env.HOME, '.npm/_npx/2334a3ea0ef73d73/node_modules/playwright')].filter(Boolean);
  for (const candidate of candidates) { try { return require(candidate); } catch {} }
  throw new Error('Playwright unavailable. Set PLAYWRIGHT_MODULE to the installed package directory.');
}
const [configPath, durationsPath, outputDir, mode] = process.argv.slice(2);
if (!outputDir) throw new Error('Usage: node record.cjs scenes.json durations.json work-dir [--dry-run]');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const timings = JSON.parse(fs.readFileSync(durationsPath, 'utf8'));
const dry = mode === '--dry-run';
const work = path.resolve(outputDir);
fs.mkdirSync(work, {recursive:true});
fs.mkdirSync(path.join(work,'screenshots'), {recursive:true});
const escape = x => String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const decor = () => {
  function install() {
    if (!document.body || document.getElementById('demo-cursor')) return;
    const style = document.createElement('style');
    style.textContent = `html{scroll-behavior:smooth}body{cursor:none!important}button,a,input,select{cursor:none!important}nextjs-portal{display:none!important}#demo-cursor{position:fixed;top:28px;left:28px;width:15px;height:15px;border:2px solid #fff;border-radius:50%;background:#fb4b59;box-shadow:0 0 0 5px #fb4b5940,0 4px 12px #0008;pointer-events:none;z-index:2147483647;transform:translate(-50%,-50%);transition:width .12s,height .12s}#demo-cursor.down{width:11px;height:11px}`;
    document.head.appendChild(style);
    const dot=document.createElement('i');dot.id='demo-cursor';document.body.appendChild(dot);
    document.addEventListener('mousemove',e=>{dot.style.left=e.clientX+'px';dot.style.top=e.clientY+'px'});
    document.addEventListener('mousedown',()=>dot.classList.add('down'));
    document.addEventListener('mouseup',()=>dot.classList.remove('down'));
    // Privacy redaction only. Verdicts, evidence counts and probabilities remain untouched.
    const redact=()=>{const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(['SCRIPT','STYLE'].includes(node.parentElement?.tagName))continue;const text=node.nodeValue;const safe=text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email redacted]');if(safe!==text)node.nodeValue=safe}};
    let queued=false;new MutationObserver(()=>{if(!queued){queued=true;setTimeout(()=>{queued=false;redact()},50)}}).observe(document.body,{childList:true,subtree:true,characterData:true});redact();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
};
function card(ending=false) {
  const repo=(config.repo||'').replace(/^https?:\/\//,'');
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;color:#f0f7f7;background:#060d14;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;overflow:hidden}.mesh{position:fixed;inset:0;background:radial-gradient(ellipse at 20% 20%,#104c4555,transparent 58%),radial-gradient(ellipse at 80% 100%,#0e355355,transparent 60%)}.grid{position:fixed;inset:0;background-image:linear-gradient(#ffffff05 1px,transparent 1px),linear-gradient(90deg,#ffffff05 1px,transparent 1px);background-size:48px 48px}.main{position:relative;padding:115px 72px;max-width:1000px}.eyebrow{font-family:monospace;color:#52e0b3;font-size:14px;letter-spacing:3px;text-transform:uppercase}.brand{font-size:68px;letter-spacing:-3px;line-height:1.06;font-weight:700;margin:28px 0 24px}.times{font-weight:300;color:#52e0b3}.subtitle{font-size:28px;color:#bac9d0;line-height:1.35;max-width:760px}.rule{margin:35px 0;height:1px;background:linear-gradient(90deg,#52e0b3aa,transparent);width:650px}.detail{font-family:monospace;color:#6b9097;font-size:16px;line-height:1.6}.chip{display:inline-flex;gap:10px;border:1px solid #265449;background:#0d2520;border-radius:30px;padding:10px 17px;color:#5de8ba;font-family:monospace;font-size:13px}.dot{width:8px;height:8px;border-radius:50%;background:#5de8ba;margin-top:4px;box-shadow:0 0 12px #52e0b388}.aside{position:fixed;right:40px;top:38px;color:#53727a;font-family:monospace;font-size:11px;letter-spacing:2px}</style></head><body><div class="mesh"></div><div class="grid"></div><div class="aside">NIGHT SHIFT / POLICY CHALLENGE</div><main class="main"><div class="eyebrow">${ending?'EVIDENCE BEFORE ACTION':'WHEN AI STARTS SPENDING YOUR MONEY'}</div><h1 class="brand">Normal <span class="times">×</span><br>Banyan Sapling</h1><div class="subtitle">${ending?'Evidence first. Policy checked.<br>A human approves every plan that passes.':escape(config.tagline||'Before agents act, check the evidence.')}</div><div class="rule"></div>${ending?`<div class="detail">${escape(repo)}<br><span style="color:#52e0b3">@MubitLabs · Banyan Sapling</span></div>`:'<div class="chip"><span class="dot"></span>LIVE POLICY CHECKS · REAL EVIDENCE</div>'}</main></body></html>`;
}
(async()=>{
  const {chromium}=playwright();
  const executable=process.env.EXE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser=await chromium.launch({headless:true, executablePath:executable});
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:2,
    ...(dry?{}:{recordVideo:{dir:work,size:{width:1920,height:1200}}})});
  await context.addInitScript(decor);
  const page=await context.newPage();
  const errors=[],consoleErrors=[],responses=[],marks=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  page.on('response',async response=>{
    if(/\/api\/(?:intelligence\/(?:diagnose|generate-plan)|sapling\/stress)$/.test(response.url())) {
      try{responses.push({url:response.url(),status:response.status(),body:await response.json()})}catch{}
    }
  });
  async function scroll(locator, block='center') {
    await locator.waitFor({state:'visible',timeout:20000});
    await locator.evaluate((element, block)=>element.scrollIntoView({behavior:'smooth',block}),block);
    await sleep(dry?150:250);
    await page.evaluate(async()=>{
      let last=window.scrollY,stable=0;
      for(let i=0;i<40;i++){
        await new Promise(resolve=>setTimeout(resolve,60));
        const now=window.scrollY;
        stable=Math.abs(now-last)<1?stable+1:0;
        if(stable>=3)break;
        last=now;
      }
    });
  }
  async function click(locator) {
    await scroll(locator);
    const box=await locator.boundingBox();
    if(box)await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:dry?1:16});
    await locator.click();
  }
  async function intelligence() {
    const button=page.getByRole('button',{name:'Intelligence',exact:true});
    await button.click();
    await page.getByTestId('sapling-scenario-supported').waitFor({state:'visible'});
  }
  async function scenario(severity, expected) {
    await intelligence();
    const preset=page.getByTestId(severity>=.5?'sapling-scenario-supported':'sapling-scenario-blocked');
    const inject=page.waitForResponse(r=>r.url().endsWith('/api/intelligence/scenarios')&&r.request().method()==='POST');
    await click(preset);
    const injected=await inject;
    if(!injected.ok())throw new Error(`Scenario injection failed${injected.status()}`);
    await page.getByRole('button',{name:/Inject Scenario & Simulate Telemetry/}).waitFor({state:'visible'});
    const diagnosis=page.waitForResponse(r=>r.url().endsWith('/api/intelligence/diagnose')&&r.request().method()==='POST',{timeout:45000});
    await click(page.getByRole('button',{name:/Run Mubit AI Diagnosis/}));
    const response=await diagnosis;
    const result=await response.json();
    const check=result.diagnosis?.serverAttribution?.saplingCheck;
    if(!response.ok() || check?.verdict!==expected)throw new Error(`Live scenario expected${expected}, got${check?.verdict||response.status()}`);
    await scroll(page.getByTestId('sapling-policy-gate'),'start');
    await page.getByTestId('sapling-verdict').filter({hasText:expected}).waitFor();
    return check;
  }
  async function action(scene) {
    const a=scene.action;
    if(a.type==='title'||a.type==='end-card') {
      await page.setContent(card(a.type==='end-card'));
      await page.evaluate(decor);
    }else if(a.type==='goto-tab'){
      await page.goto(config.baseUrl||'http://localhost:3100',{waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:a.tab,exact:true}).click();
      await page.getByTestId('sapling-scenario-supported').waitFor();
      if(a.primeScenario!==undefined){
        await scenario(a.primeScenario,'supported');
        await page.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));
      }
    }else if(a.type==='scroll'){
      await scroll(page.getByTestId(a.testId),'start');
    }else if(a.type==='run-scenario'){
      const check=await scenario(a.sev,a.expected);
      if(a.showReview){
        await sleep(dry?150:1200);
        const planResponse=page.waitForResponse(r=>r.url().endsWith('/api/intelligence/generate-plan'),{timeout:45000});
        await click(page.getByTestId('sapling-plan-button'));
        const result=await planResponse;
        if(!result.ok())throw new Error(`Generate plan refused${result.status()}`);
        const approve=page.getByRole('button',{name:'Approve all',exact:true});
        await approve.waitFor({state:'visible',timeout:20000});
        await scroll(approve,'center');
        // Show the merchant's controls without approving or executing anything.
        await approve.hover();
      }else if(a.hoverBlocked){
        const button=page.getByTestId('sapling-plan-button');
        if(!await button.isDisabled())throw new Error('Blocked plan button is unexpectedly enabled');
        await scroll(button,'end');
        await button.hover({force:true});
      }
      return {verdict:check.verdict,probabilities:check.probabilities,latencyMs:check.latencyMs};
    }else if(a.type==='click'){
      await click(a.testId?page.getByTestId(a.testId):page.locator(a.selector));
      if(a.waitForTestId)await page.getByTestId(a.waitForTestId).waitFor({state:'visible',timeout:45000});
      if(a.focusTestId)await scroll(page.getByTestId(a.focusTestId),'center');
      const latest=responses.filter(r=>r.url.endsWith('/api/sapling/stress')).at(-1);
      if(latest && latest.body.results.some(r=>!r.matches))throw new Error('Live stress test has an unexpected verdict; revise the demo honestly before recording.');
    }else throw new Error(`Unsupported action${a.type}`);
  }
  const recordingStart=performance.now();
  let start=recordingStart;
  try {
    for(let i=0;i<config.scenes.length;i++){
      const scene=config.scenes[i], timing=timings.scenes.find(t=>t.id===scene.id);
      const sceneStart=performance.now();
      console.log(`Scene${i+1}: ${scene.id}`);
      const result=await action(scene);
      const elapsed=(performance.now()-sceneStart)/1000;
      marks.push({id:scene.id,startSeconds:(sceneStart-start)/1000,actionSeconds:elapsed,...(result||{})});
      if(elapsed>timing.durationSeconds-0.1 && !dry)throw new Error(`${scene.id} actions took${elapsed.toFixed(2)}s, exceed scene${timing.durationSeconds.toFixed(2)}s. Increase scene hold and regenerate narration.`);
      await page.screenshot({path:path.join(work,'screenshots',`${i}-${scene.id}.png`)});
      if(!dry)await sleep(Math.max(0,(timing.endSeconds-(performance.now()-start)/1000)*1000));
    }
    if(errors.length||consoleErrors.length)throw new Error(`Browser errors: ${[...errors,...consoleErrors].join('; ')}`);
  } finally {
    fs.writeFileSync(path.join(work,dry?'dryrun-marks.json':'marks.json'),JSON.stringify({scenes:marks,pageErrors:errors,consoleErrors,responses},null,2));
    const video=page.video();
    await context.close();
    if(video){const original=await video.path();const dest=path.join(work,'screen_raw.webm');if(original!==dest)fs.renameSync(original,dest);}
    await browser.close();
  }
  console.log(dry?'Dry run complete':'Recording complete');
})().catch(e=>{console.error(e);process.exit(1)});
