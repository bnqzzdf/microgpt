// node tests/bridge-checks.cjs — no dependencies or network required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = vm.createContext({ document: { addEventListener() {} } });
for (const file of ['data/bridge-scenarios.js', 'js/i18n.js', 'data/weights.js', 'js/autograd.js', 'js/tokenizer.js', 'js/model.js', 'js/optimizer.js', 'js/app.js', 'js/bridge-core.js', 'js/bridge-runner.js']) {
  vm.runInContext(read(file), context, { filename: file });
}
const evaluate = source => vm.runInContext(source, context);
const plain = source => JSON.parse(JSON.stringify(evaluate(source)));
const near = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

const representation = plain("BridgeCore.serialize(BridgeData.conversations.zh.messages)");
assert.equal(representation.kind, 'teaching');
assert.equal(representation.valid, true);
assert.equal(representation.text.endsWith('<|assistant|>'), true);
for (const span of representation.spans) assert.equal(representation.text.slice(span.start, span.end).length, span.end - span.start);
for (const token of representation.tokens) assert.equal(representation.text.slice(token.start, token.end), token.text);
assert.deepEqual(representation.tokenIds, representation.tokens.map(token => token.id));
const unicode = plain("BridgeCore.serialize([{id:'emoji',role:'user',content:'中文😀'}])");
const emoji = unicode.tokens.find(token => token.text === '😀');
assert.equal(emoji.end - emoji.start, 2);
assert.equal(emoji.id, 1024 + '😀'.codePointAt(0));
assert.equal(plain("BridgeCore.serialize([{id:'empty',role:'user',content:''}])").valid, true);
assert.throws(() => evaluate("BridgeCore.serialize([{id:'x',role:'tool',content:'x'}])"), /Unknown message role/);
assert.throws(() => evaluate("BridgeCore.serialize([{id:'x',role:'user',content:'<|assistant|>'}])"), /Reserved markers/);
assert.throws(() => evaluate("BridgeCore.serialize([{id:'x',role:'user',content:'x'},{id:'x',role:'user',content:'y'}])"), /Invalid message ID/);
assert.throws(() => evaluate('BridgeCore.serialize([], NaN)'), /Invalid teaching budget/);
evaluate("var historical = JSON.parse(JSON.stringify(BridgeData.conversations.zh)); historical.messages[1].included = false;");
assert.equal(evaluate('historical.messages.length'), 4);
assert.equal(evaluate('BridgeCore.evidence(historical.messages, historical.definitionId, historical.evidenceText).present'), false);
assert.equal(evaluate('BridgeCore.evidence(BridgeData.conversations.zh.messages, historical.definitionId, historical.evidenceText).present'), true);
const limited = plain('BridgeCore.serialize(historical.messages, 1)');
assert.equal(limited.valid, false);
assert.equal(limited.text.includes('刚才的口令是什么'), true); // No silent truncation.
assert.equal(limited.includedIds.includes('m1'), false);
console.log('PASS: message inclusion, span mapping, Unicode, reserved markers and explicit budgets');

const results = plain('BridgeData.cases.map(item => [BridgeCore.verify(item.task,item.direct),BridgeCore.verify(item.task,item.worked)])');
assert.deepEqual(results.map(pair => pair.map(result => result.finalCorrect)), [[true,true],[false,true],[true,true],[true,true]]);
assert.deepEqual(results.map(pair => pair[1].stepsValid), [true,true,false,false]);
assert.equal(results[2][1].steps[0].arithmetic, false);
assert.equal(results[3][1].steps[1].arithmetic, true);
assert.equal(results[3][1].steps[1].matchesTask, false);
assert.equal(results[0][0].hasSteps, false);
assert.throws(() => evaluate("BridgeCore.operation('eval', 1, 2)"), /Invalid arithmetic/);
assert.throws(() => evaluate("BridgeCore.operation('mul', Number.MAX_SAFE_INTEGER, 2)"), /Invalid arithmetic/);
assert.equal(evaluate("BridgeCore.verify(BridgeData.cases[0].task,{final:'126'}).finalCorrect"), false);
console.log('PASS: final correctness, arithmetic validity and task consistency are separate checks');

const restored = plain(`BridgeCore.restoreProgress(JSON.stringify({version:1,module:'execution',answers:{execution:[1,-1,999],evil:[0]},messages:['secret'],review:true}),BridgeData.modules)`);
assert.deepEqual(restored, { module: 'execution', answers: { conversation: [null,null,null], execution: [1,-1,null], verification: [null,null,null] }, review: true });
assert.equal(evaluate("BridgeCore.restoreProgress('{broken',BridgeData.modules).module"), 'conversation');
assert.equal(evaluate("BridgeCore.restoreProgress('null',BridgeData.modules).module"), 'conversation');
assert.equal(evaluate("BridgeCore.restoreProgress('{\"version\":9}',BridgeData.modules).module"), 'conversation');
const adapter = plain("BridgeCore.offlineAdapter().prepare([{role:'user',content:'private'}])");
assert.equal(adapter.enabled, false);
assert.equal(adapter.representation, 'opaque');
assert.equal(evaluate('BridgeCore.offlineAdapter().describe().capabilities.inference'), false);
console.log('PASS: independent progress sanitization and disabled, non-sending adapter contract');

evaluate(`
  var make = options => BridgeRunner.create({ modelFactory:createModel, tokenizerFactory:chars=>new Tokenizer(chars), weights:MICROGPT_WEIGHTS, ...options });
  var priorModel = createModel(MICROGPT_WEIGHTS);
  var priorParams = priorModel.params.map(param => param.data);
  var weightsBefore = JSON.stringify(MICROGPT_WEIGHTS);
  var runner = make({prefix:'em',seed:2026,maxNewTokens:8});
`);
assert.equal(evaluate('runner.result().phase'), 'new');
assert.equal(evaluate('runner.step().type'), 'load');
assert.equal(evaluate('runner.step().type'), 'prepare');
for (let i = 0; i < 3; i++) {
  const event = plain('runner.step()');
  assert.equal(event.type, 'prefill');
  assert.equal(event.position, i);
  assert.deepEqual(event.cache, [i + 1]);
  near(event.probs.reduce((a,b) => a+b,0), 1);
}
assert.equal(evaluate('runner.result().phase'), 'ready');
const before = plain('runner.result()');
const first = plain('runner.step()');
assert.equal(first.type, 'decode');
assert.equal(first.first, true);
assert.equal(first.forwards, 3); // First output reuses final prefill logits.
near(first.probs.reduce((a,b) => a+b,0), 1);
const snapshot = plain('runner.result()');
const recompute = plain('runner.recompute()');
assert.equal(recompute.equal, true);
assert.equal(recompute.randomConsumed, false);
assert.equal(recompute.count, 3);
assert.deepEqual(plain('runner.result().output'), snapshot.output);
assert.equal(evaluate('runner.result().forwards'), snapshot.forwards);
evaluate("var reference = make({prefix:'em',seed:2026,maxNewTokens:8}); while(reference.result().phase !== 'stopped') reference.step(); while(runner.result().phase !== 'stopped') runner.step();");
const run = plain('runner.result()'), reference = plain('reference.result()');
assert.deepEqual(run.output, reference.output);
assert.deepEqual(run.events.filter(event => event.type === 'decode').map(event => event.random), reference.events.filter(event => event.type === 'decode').map(event => event.random));
assert.equal(run.weightsUnchanged, true);
assert.ok(run.events.every(event => event.position === undefined || event.position < 16));
assert.equal(evaluate('JSON.stringify(MICROGPT_WEIGHTS) === weightsBefore'), true);
assert.equal(evaluate('priorModel.params.every((param,i)=>Object.is(param.data,priorParams[i]))'), true);
const decode = run.events.filter(event => event.type === 'decode');
for (let i = 1; i < decode.length; i++) {
  assert.equal(decode[i].input, decode[i-1].token);
  assert.equal(decode[i].forwards, decode[i-1].forwards + 1);
}
assert.equal(evaluate('runner.step()'), null);
assert.equal(evaluate('runner.cancel()'), null);
console.log('PASS: real prefill, first-token reuse, incremental KV, reproducible sampling and weight/model isolation');

evaluate("var cancelled = make({prefix:''}); cancelled.step(); cancelled.cancel();");
assert.equal(evaluate('cancelled.result().reason'), 'Cancelled');
assert.equal(evaluate('cancelled.step()'), null);
evaluate('var cancelledBeforeLoad = make({}); cancelledBeforeLoad.cancel();');
assert.equal(evaluate('cancelledBeforeLoad.result().weightsUnchanged'), null);
assert.equal(evaluate('cancelledBeforeLoad.result().modelLoaded'), false);
assert.equal(evaluate('cancelledBeforeLoad.result().provenance.actualComputation'), false);
evaluate("var budgetRun = make({prefix:'ann',maxNewTokens:1}); while(budgetRun.result().phase !== 'stopped') budgetRun.step();");
assert.ok(['End marker','Output budget'].includes(evaluate('budgetRun.result().reason')));
for (const prefix of ['', 'em', 'ann']) {
  context.testPrefix = prefix;
  const prompt = plain('make({prefix:testPrefix}).result().config.prompt');
  assert.equal(prompt[0], 26);
  assert.equal(prompt.length, prefix.length + 1);
  assert.ok(prompt.slice(1).every(id => id < 26));
}
assert.throws(() => evaluate("make({prefix:'你好'})"), /Invalid name prefix/);
assert.throws(() => evaluate('make({temperature:0})'), /Invalid temperature/);
assert.throws(() => evaluate('make({seed:1.5})'), /Invalid random seed/);
assert.throws(() => evaluate("make({prefix:'ann',maxNewTokens:13})"), /budget/);
evaluate(`var forcedEnd = BridgeRunner.create({weights:MICROGPT_WEIGHTS,tokenizerFactory:chars=>new Tokenizer(chars),modelFactory:data=>{
  const model=createModel(data); model.sampleFromProbs=()=>26; return model;
}}); while(forcedEnd.result().phase!=='stopped') forcedEnd.step();`);
assert.equal(evaluate('forcedEnd.result().reason'), 'End marker');
assert.equal(evaluate('forcedEnd.result().forwards'), 3);
assert.equal(evaluate('forcedEnd.result().text'), '');
evaluate(`var broken = BridgeRunner.create({weights:MICROGPT_WEIGHTS,tokenizerFactory:chars=>new Tokenizer(chars),modelFactory:()=>{throw new Error('fixture error')}}); broken.step();`);
assert.equal(evaluate('broken.result().reason'), 'Error');
assert.equal(evaluate('broken.result().events[0].type'), 'error');
console.log('PASS: valid prefixes, conservative context budget, BOS stop, cancellation and error states');

for (const [en,zh] of plain('BridgeData.messages')) {
  context.english = en; context.chinese = zh;
  assert.equal(evaluate("I18n.translate(english,'zh')"), zh, en);
  assert.equal(evaluate("I18n.translate(chinese,'en')"), en, zh);
}
assert.equal(evaluate('BridgeData.modules.reduce((n,m)=>n+m.questions.length,0)'), 9);
// New files must not acquire accidental network or arbitrary-code execution paths.
for (const file of ['js/bridge-core.js','js/bridge-runner.js','js/bridge-course.js','data/bridge-scenarios.js']) {
  assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|eval|Function)\s*\(/.test(read(file)), file);
}
console.log('PASS: full bilingual bridge catalog, nine understanding checks and offline-only implementation');

// Exercise controller initialization/export without a browser. Export must not run a model.
const store = new Map([['microgpt.bridge.v1', JSON.stringify({version:1,module:'verification',answers:{conversation:[1,1,1]},review:false})]]);
context.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key,value) => store.set(key,value) };
evaluate(read('js/bridge-course.js').replace('return { init, open, leave, exportRecord };', 'return { init, open, leave, exportRecord, conversationHTML, executionHTML, verificationHTML };'));
evaluate('BridgeCourse.init({modelFactory:createModel,tokenizerFactory:chars=>new Tokenizer(chars),weights:MICROGPT_WEIGHTS})');
const exported = plain('BridgeCourse.exportRecord()');
assert.equal(exported.progress.module, 'verification');
assert.equal(exported.nameRun.phase, 'new');
assert.equal(exported.nameRun.forwards, 0);
assert.equal(exported.verification.source, 'preset-teaching-fixture');
assert.equal(exported.conversation.representation.kind, 'teaching');
assert.equal(exported.conversation.messages.length, 4);
const exportAgain = plain('BridgeCourse.exportRecord()');
assert.deepEqual(exported, exportAgain);
assert.ok(evaluate('BridgeCourse.conversationHTML()').includes('data-no-i18n'));
assert.ok(evaluate('BridgeCourse.executionHTML()').includes('Actual local computation'));
assert.ok(evaluate('BridgeCourse.verificationHTML()').includes('Preset teaching material'));
store.set('microgpt.bridge.v1','{corrupt');
evaluate('BridgeCourse.init({modelFactory:createModel,tokenizerFactory:chars=>new Tokenizer(chars),weights:MICROGPT_WEIGHTS})');
assert.equal(evaluate('BridgeCourse.exportRecord().progress.module'), 'conversation');
context.localStorage.getItem = () => { throw new Error('storage disabled'); };
evaluate('BridgeCourse.init({modelFactory:createModel,tokenizerFactory:chars=>new Tokenizer(chars),weights:MICROGPT_WEIGHTS})');
assert.equal(evaluate('BridgeCourse.exportRecord().nameRun.phase'), 'new');
evaluate(`BridgeData.conversations.zh.messages[0].content = '<img src=x onerror="alert(1)">';
  BridgeCourse.init({modelFactory:createModel,tokenizerFactory:chars=>new Tokenizer(chars),weights:MICROGPT_WEIGHTS});`);
const safeHTML = evaluate('BridgeCourse.conversationHTML()');
assert.ok(safeHTML.includes('&lt;img'));
assert.ok(!safeHTML.includes('<img'));
assert.ok(!JSON.stringify(exported).match(/apiKey|credential|secretKey/));
console.log('PASS: controller initialization, safe text rendering, source-labelled exports, corrupt/disabled storage and zero render/export forward calls');
