// Behavioral and numerical regression for the 21-section curriculum.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const storage = new Map([['microgpt.course.v1',JSON.stringify({version:1,lesson:2,answers:{0:1,2:1},finished:true})]]);
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id,{id,innerHTML:'',textContent:'',value:'',hidden:false,open:false,children:[],dataset:{},setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){},classList:{toggle(){}}});
  return elements.get(id);
}
const document = {addEventListener(){},getElementById:element,querySelectorAll:() => [],querySelector:element};
const context = vm.createContext({assert,console,document,clearTimeout(){},localStorage:{getItem:key => storage.get(key)||null,setItem:(key,value) => storage.set(key,value)},fetch:async name => ({ok:true,text:async () => read(name)})});
for (const name of ['data/weights.js','data/beginner-lessons.js','js/i18n.js','js/autograd.js','js/tokenizer.js','js/model.js','js/optimizer.js','js/visualize.js','js/app.js']) vm.runInContext(read(name),context,{filename:name});
const expose = 'return { init, open, refreshLanguage, lessons, formula, migrate, navigate, runExperiment, resetExperiment, sourceAnchors, pythonAnchors, products, temperatureComparison, get state() { return state; }, get toy() { return toy; }, get traces() { return traces; }, get trainingModel() { return trainingModel; }, get gradientResult() { return gradientResult; }, get trainingResult() { return trainingResult; }, get sampling() { return sampling; } };';
vm.runInContext(read('js/course.js').replace('return { init, open, refreshLanguage };',expose),context);
const run = source => vm.runInContext(source,context);
run('tokenizer = new Tokenizer(MICROGPT_WEIGHTS.uchars); gpt = createModel(MICROGPT_WEIGHTS); Course.init();');
assert.equal(run('Course.lessons.length'),21);
assert.equal(run('new Set(Course.lessons.map(l => l.id)).size'),21);
assert.equal(run('new Set(Course.lessons.map(l => l.correct)).size'),3);
assert.equal(run('Course.state.currentLesson'),'C3');
assert.equal(run('Object.keys(Course.state.checks).length'),0);
assert.equal(run('Course.state.legacy.answers[2]'),1);
assert.equal(JSON.parse(storage.get('microgpt.course.v1')).lesson,2);
assert.equal(JSON.parse(storage.get('microgpt.course.v2')).version,2);
assert.equal(storage.has('microgpt.bridge.v1'),false);
for (const [index,id] of ['A1','B3','C3','D1','D2','E1'].entries()) assert.equal(run(`Course.migrate({version:1,lesson:${index},answers:{0:0}}).currentLesson`),id);
console.log('PASS: stable 21-section IDs, five stages, varied answer positions and non-destructive legacy migration');
run(`Course.navigate('B1'); Course.runExperiment(); Course.runExperiment(); Course.runExperiment();`);
assert.match(element('course-result').innerHTML,/1 × 1 = 1/);
assert.equal(run('Course.toy.products'),3);
assert.equal(element('course-action').disabled,true,'No next product is offered after all three are shown');
assert.deepEqual(JSON.parse(run('JSON.stringify(Course.toy.weights.map(w => w.reduce((s,v,i) => s+v*Course.toy.embeddings[0][i],0)))')),[0,2,-2]);
run(`Course.navigate('B3')`);
const initial = element('course-result').innerHTML;
run('Course.runExperiment()');
assert.notEqual(element('course-result').innerHTML,initial,'Main operation reveals additional computation');
assert.match(element('course-result').innerHTML,/86\.68%/);
run('Course.resetExperiment()');
assert.ok(!element('course-result').innerHTML.includes('86.68%'),'Reset restores the unrevealed experiment');
assert.equal(element('course-action').disabled,false,'Reset makes the reveal action available again');
for (const id of ['A1','A4','B2','C2']) { run(`Course.navigate('${id}')`); const before = element('course-result').innerHTML; run('Course.runExperiment()'); assert.notEqual(element('course-result').innerHTML,before,`${id} main action must reveal new output`); }
element('course-mix').oninput({target:{value:'0.75'}});
assert.match(element('course-result').innerHTML,/2 × 0.75 \+ 6 × 0.25 = 3/);
run('Course.resetExperiment()');
assert.equal(run('Course.toy.mix'), .25);
assert.ok(!element('course-result').innerHTML.includes('class="equation"'));
console.log('PASS: hand-calculable products and three-candidate Softmax, real reveal/reset interactions');
run(`const referenceWeights = gpt.params.map(p => p.data); const freeModel = createModel(createRandomWeightData()); const freeWeights = freeModel.params.map(p => p.data);`);
run(`
for (const trace of Course.traces) {
  assert.equal(trace.finalHidden.length,16);
  assert.equal(trace.probs.length,27);
  assert.ok(Math.abs(trace.probs.reduce((a,b) => a+b,0)-1)<1e-12);
  for (let i=0;i<27;i++) {
    const score = trace.finalHidden.reduce((sum,value,j) => sum + value*gpt.stateDict.lm_head[i][j].data,0);
    assert.ok(Math.abs(score-trace.logits[i])<1e-12);
  }
  for (const layer of trace.layers) {
    for (let j=0;j<16;j++) {
      assert.ok(Math.abs(layer.attnResidual[j]+layer.attnProjection[j]-layer.xAfterAttn[j])<1e-12);
      assert.ok(Math.abs(layer.xAfterAttn[j]+layer.mlpProjection[j]-layer.xAfterMlp[j])<1e-12);
    }
    assert.equal(layer.mlpPreAct.length,64);
    layer.mlpPreAct.forEach((value,i) => assert.equal(layer.mlpPostAct[i],Math.max(0,value)));
  }
}
Course.navigate('D2'); Course.runExperiment();
assert.ok(Math.abs(Course.gradientResult.slope-Course.gradientResult.gradient)<1e-5);
assert.equal(Course.trainingModel.stateDict.lm_head[tokenizer.encode('m')[1]][0].data,Course.gradientResult.original);
Course.navigate('D3'); Course.runExperiment();
assert.notEqual(Course.trainingResult.original,Course.trainingResult.updated);
assert.deepEqual(gpt.params.map(p => p.data),referenceWeights);
assert.deepEqual(freeModel.params.map(p => p.data),freeWeights);
`);
console.log('PASS: all real score products, complete 27-way probabilities, residuals, ReLU, actual gradients/Adam and model isolation');
// Every section actually renders and performs its operation, in both languages.
for (const language of ['en','zh']) {
  run(`I18n.setLanguage('${language}')`);
  for (const id of run('Course.lessons.map(l => l.id)')) {
    run(`Course.navigate('${id}'); Course.runExperiment();`);
    assert.ok(element('course-result').innerHTML.length>100,`${language} ${id} contains actual output`);
    if (language === 'en') assert.ok(!/[\u4e00-\u9fff]/.test(element('tab-course').innerHTML+element('course-result').innerHTML),`English ${id} must not contain untranslated Chinese`);
  }
}
run(`Course.navigate('E2'); const sampleCount = Course.sampling.rows.length; const sampleRows = JSON.stringify(Course.sampling.rows); const samplingState = JSON.stringify(Course.sampling.tokens);`);
element('course-temperature').oninput({target:{value:'1.25'}});
run(`assert.equal(Course.sampling.rows.length,sampleCount); assert.equal(JSON.stringify(Course.sampling.rows),sampleRows); assert.equal(JSON.stringify(Course.sampling.tokens),samplingState);`);
assert.match(element('course-result').innerHTML,/0.37/);
run(`const sampleSnapshot = JSON.stringify(Course.sampling.rows); I18n.setLanguage('en'); I18n.setLanguage('zh'); Course.open(); assert.equal(JSON.stringify(Course.sampling.rows),sampleSnapshot);`);
assert.equal(run('Course.state.currentLesson'),'E2');
assert.equal(run('Object.keys(Course.state.checks).length'),0,'Operations, visits and review never claim mastery');
console.log('PASS: all sections bilingual, unchanged sampling on language/return, controlled-temperature comparison without generation');
const anchors = run('Course.sourceAnchors'), python = run('Course.pythonAnchors'), lessons = run('Course.lessons');
assert.equal(Object.keys(anchors).length,21);
assert.equal(Object.keys(python).length,21);
for (const lesson of lessons) {
  assert.ok(read(`js/${lesson.source}`).split(/\r?\n/).some(line => line.startsWith(anchors[lesson.type])),`JS anchor ${lesson.id}: ${anchors[lesson.type]}`);
  assert.ok(read('generate_weights.py').split(/\r?\n/).some(line => line.startsWith(python[lesson.type])),`Python anchor ${lesson.id}: ${python[lesson.type]}`);
}
console.log('PASS: non-empty, current JavaScript/Python source anchor coverage for every section');
