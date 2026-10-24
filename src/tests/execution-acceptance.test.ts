import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { z } from "zod";
import { Repo } from "../store/db";
import { orchestrator } from "../agents/orchestrator";
import { createApproval } from "../execution/validate-approval";
import { loadPlanHandoff } from "../execution/load-plan";
import { toolRegistry } from "../execution/execute-action";
import { ToolError } from "../execution/retry-policy";
import { tickAds } from "../simulator/ads";
import * as store from "../store/repos";
import { PlanHandoff, ActionExecution, ActionOutcome } from "../contracts";

const owner = "merchant_owner_01";
const mode = process.argv[2];
async function child(arg: string) {
  return new Promise<string>((resolve,reject)=>{
    const p = spawn(process.execPath,["--import","tsx",path.resolve("src/tests/execution-acceptance.test.ts"),arg],{env:process.env});
    let output="",error="";p.stdout.on("data",b=>output+=b);p.stderr.on("data",b=>error+=b);
    p.on("error",reject);p.on("close",code=>code===0?resolve(output.trim()):reject(new Error(error||output)));
  });
}
async function run() {
  if (mode === "claim") {
    const repo = new Repo("claim_probe",z.object({winner:z.string()}));
    console.log(await repo.claim("same",{winner:String(process.pid)}));return;
  }
  if (mode === "restart") {
    const snap=await orchestrator.snapshot("plan_001");
    assert.equal(snap.executions.length,3);assert(snap.executions.every(e=>e.status==="succeeded"));
    assert.equal(snap.emailSends.length,2);assert.equal(snap.outcomes.length,3);
    assert.equal((await store.campaigns.findOne("campaign_A")).dailyBudgetMinor,3000);
    assert((await store.storefront.findOne("banner_ship_001")).active);
    console.log("restart verified");return;
  }
  (process.env as Record<string,string>).NODE_ENV="test";process.env.NORMAL_STORE="csv";process.env.EMAIL_PROVIDER="memory";
  process.env.EXECUTION_STEP_DELAY_MS="0";delete process.env.INTELLIGENCE_API_URL;delete process.env.MUBIT_API_KEY;delete process.env.EMAIL_TEST_RECIPIENT;
  process.env.NORMAL_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),"normal-acceptance-"));
  const h=PlanHandoff.parse(await loadPlanHandoff("plan_001"));
  const before=(await tickAds(new Date().toISOString(),false))[0];
  assert.equal(before.payload.spendMinor,52);
  const approved=await createApproval(h,{planVersion:1,decision:"approved",approvedActionIds:h.plan.actions.map(a=>a.actionId)},owner);
  const jobs:(()=>Promise<void>)[]=[];
  const starts=await Promise.all(Array.from({length:3},()=>orchestrator.start("plan_001",approved.approval.approvalId,undefined,owner,w=>jobs.push(w))));
  assert(starts.some(s=>s.executions.some(e=>e.status==="queued")));
  await Promise.all(jobs.map(w=>w()));
  const snap=await orchestrator.snapshot("plan_001");
  assert(snap.executions.every(e=>e.status==="succeeded"&&e.attempts===1));
  snap.executions.forEach(e=>ActionExecution.parse(e));snap.outcomes.forEach(o=>ActionOutcome.parse(o));
  assert.equal(snap.emailSends.length,2);
  const after=(await tickAds(new Date().toISOString(),false))[0];
  assert.equal(after.payload.spendMinor,31);assert.equal(after.payload.dailyBudgetMinor,3000);
  console.log("✓ concurrent requests: one execution per action, two test messages; future ticks spend 52 → 31 minor units");
  assert.equal(await child("restart"),"restart verified");
  console.log("✓ all results survive a fresh Node process reading CSV");
  const winners=await Promise.all(Array.from({length:8},()=>child("claim")));
  assert.equal(winners.filter(w=>w==="true").length,1);
  console.log("✓ cross-process CSV claims: exactly one winner");

  async function fixture(id:string) {const copy=structuredClone(h);copy.plan.planId=id;copy.plan.status="awaiting_approval";return copy;}
  const chain=await fixture("ordered");chain.plan.actions=chain.plan.actions.filter(a=>a.actionType!=="customer.send_delay_notice");
  chain.plan.actions[1].dependsOnActionIds=[chain.plan.actions[0].actionId];
  await orchestrator.saveHandoff(chain);
  const a=await createApproval(chain,{planVersion:1,decision:"approved",approvedActionIds:chain.plan.actions.map(a=>a.actionId)},owner);
  const pending:(()=>Promise<void>)[]=[];await orchestrator.start("ordered",a.approval.approvalId,undefined,owner,w=>pending.push(w));await pending[0]();
  const ordered=await orchestrator.snapshot("ordered"),ads=ordered.executions.find(e=>e.toolName==="ads.set_daily_budget"),banner=ordered.executions.find(e=>e.toolName==="storefront.publish_banner");
  assert(Date.parse(banner.startedAt)>=Date.parse(ads.finishedAt));
  console.log("✓ dependencies run only after prerequisite success");

  const retry=await fixture("retry");retry.plan.actions=retry.plan.actions.filter(a=>a.actionType==="ads.set_daily_budget");await orchestrator.saveHandoff(retry);
  const ra=await createApproval(retry,{planVersion:1,decision:"approved",approvedActionIds:[retry.plan.actions[0].actionId]},owner);
  const binding=toolRegistry["ads.set_daily_budget"],original=binding.tool;let calls=0;
  binding.tool=async p=>{if(++calls<3)throw new ToolError("TRANSIENT","temporary",true);return original(p);};
  try {const work:(()=>Promise<void>)[]=[];await orchestrator.start("retry",ra.approval.approvalId,undefined,owner,w=>work.push(w));await work[0]();assert.equal((await orchestrator.snapshot("retry")).executions[0].attempts,3);}finally{binding.tool=original;}
  console.log("✓ transient idempotent tool retries are bounded to three attempts");

  const bad=await fixture("bad_readback");bad.plan.actions=bad.plan.actions.filter(a=>a.actionType==="ads.set_daily_budget");await orchestrator.saveHandoff(bad);
  const ba=await createApproval(bad,{planVersion:1,decision:"approved",approvedActionIds:[bad.plan.actions[0].actionId]},owner),verify=binding.verify;
  binding.verify=async()=>{throw new ToolError("VERIFICATION_FAILED","read-back mismatch");};
  try {const work:(()=>Promise<void>)[]=[];await orchestrator.start("bad_readback",ba.approval.approvalId,undefined,owner,w=>work.push(w));await work[0]();const failed=await orchestrator.snapshot("bad_readback");assert.equal(failed.executions[0].status,"failed");assert.equal(failed.outcomes[0].status,"not_verified");}finally{binding.verify=verify;}
  console.log("✓ an unverified write is never marked successful");

  const supersede=await fixture("superseded");await orchestrator.saveHandoff(supersede);
  const first=await createApproval(supersede,{planVersion:1,decision:"approved",approvedActionIds:supersede.plan.actions.map(a=>a.actionId)},owner);
  await createApproval(supersede,{planVersion:1,decision:"partially_approved",approvedActionIds:[supersede.plan.actions[0].actionId]},owner);
  await assert.rejects(()=>orchestrator.start("superseded",first.approval.approvalId,undefined,owner),e=>(e as ToolError).code==="APPROVAL_SUPERSEDED");
  console.log("✓ superseded approval cannot execute");
  console.log(`CSV acceptance tests passed. Isolated records: ${process.env.NORMAL_DATA_DIR}`);
}
run().catch(e=>{console.error(e);process.exitCode=1;});
