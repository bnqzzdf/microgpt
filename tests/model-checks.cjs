// Dependency-free mathematical regression checks. Run: node tests/model-checks.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = vm.createContext({ assert, console, document: { addEventListener() {} } });
for (const file of ['data/weights.js', 'js/autograd.js', 'js/tokenizer.js', 'js/model.js', 'js/optimizer.js', 'js/app.js']) {
  vm.runInContext(read(file), context, { filename: file });
}

vm.runInContext(`
  function near(actual, expected, tolerance = 1e-9) {
    assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' != ' + expected);
  }
  tokenizer = new Tokenizer(MICROGPT_WEIGHTS.uchars);
  gpt = createModel(MICROGPT_WEIGHTS);
  const tokens = tokenizer.encode('emma');
  assert.equal(tokens.length, 6);
  assert.equal(tokens[0], tokenizer.BOS);
  assert.equal(tokens[5], tokenizer.BOS);
  assert.equal(tokenizer.decode(tokens), 'emma');
  assert.equal(gpt.params.length, 4192);
  console.log('PASS: token alignment and model dimensions');

  // The same multiplication sends independent contributions to both inputs.
  const w = new Value(2), h = new Value(3);
  const loss = w.mul(h).add(w.mul(4));
  loss.backward();
  near(h.grad, 2);
  near(w.grad, 3 + 4);
  console.log('PASS: multiplication fork and shared-parameter accumulation');

  const isolated = gpt.forwardLoss(tokenizer.BOS, 0, tokens[1], [[]], [[]]);
  isolated.loss.backward();
  for (let dim = 0; dim < gpt.nEmbd; dim++) {
    const allBranches = isolated.logits.reduce((sum, logit, id) =>
      sum + logit.grad * gpt.stateDict.lm_head[id][dim].data, 0);
    near(isolated.finalHidden[dim].grad, allBranches);
  }
  gpt.zeroGrad();
  console.log('PASS: hidden total gradient equals contributions from all candidate logits');

  const keys = [[]], values = [[]];
  let numericLoss = 0;
  for (let pos = 0; pos < tokens.length - 1; pos++) {
    const trace = gpt.forward(tokens[pos], pos, keys, values);
    assert.equal(trace.logits.length, 27);
    near(trace.probs.reduce((a, b) => a + b, 0), 1);
    assert.ok(trace.probs.every(p => p >= 0 && p <= 1));
    numericLoss -= Math.log(trace.probs[tokens[pos + 1]]);
    for (const weights of trace.layers[0].attnWeights) {
      assert.equal(weights.length, pos + 1); // No future keys, not tiny future weights.
      near(weights.reduce((a, b) => a + b, 0), 1);
    }
  }
  near(documentLoss(gpt, tokens).loss.data, numericLoss / 5);
  console.log('PASS: probability normalization, causal attention and mean loss');

  const model = createModel(createRandomWeightData());
  const again = createModel(createRandomWeightData());
  assert.deepEqual(model.params.map(p => p.data), again.params.map(p => p.data));
  const pretrained = gpt.params.map(p => p.data);
  const before = documentLoss(model, tokens, true);
  before.loss.backward();
  const nodes = buildGradientPath(before.loss, before.rows, model);
  const row = [...before.rows].sort((a, b) => b.loss - a.loss)[0];
  const dim = Number(nodes[4].name.match(/\\d+/)[0]);
  const weight = model.stateDict.lm_head[row.targetId][dim];
  near(nodes[4].contribution, row.logitValue.grad * weight.data);
  near(nodes[5].contribution, row.logitValue.grad * row.finalHidden[dim].data);
  near(nodes[5].grad, weight.grad);
  near(nodes[1].grad, 1 / 5);
  near(nodes[3].grad, (row.probability - 1) / 5);
  const original = weight.data, epsilon = 1e-5;
  weight.data = original + epsilon;
  const plus = documentLoss(model, tokens).loss.data;
  weight.data = original - epsilon;
  const minus = documentLoss(model, tokens).loss.data;
  weight.data = original;
  near(nodes[5].grad, (plus - minus) / (2 * epsilon), 1e-6);
  const optimizer = new Adam(model.params, .01, .85, .99, 1e-8);
  optimizer.step();
  assert.ok(Number.isFinite(documentLoss(model, tokens).loss.data));
  assert.notEqual(weight.data, original);
  assert.deepEqual(gpt.params.map(p => p.data), pretrained);
  console.log('PASS: displayed gradient versus finite differences, Adam and model isolation');

  assert.equal(gpt.sampleFromProbs([0, .25, .75], 0), 1);
  assert.equal(gpt.sampleFromProbs([.25, .75], .25), 1);
  assert.equal(gpt.sampleFromProbs([.25, .75], .249), 0);
  const randomA = seededRandom(2026), randomB = seededRandom(2026);
  for (let i = 0; i < 16; i++) near(randomA(), randomB());
  const generated = gpt.generate(tokenizer.BOS, gpt.blockSize, .5);
  assert.ok(generated.stepTraces.length <= gpt.blockSize);
  for (let i = 0; i < generated.stepTraces.length; i++) {
    const trace = generated.stepTraces[i];
    assert.equal(trace.inputToken, i === 0 ? tokenizer.BOS : generated.stepTraces[i - 1].sampledToken);
    near(trace.scaledProbs.reduce((a, b) => a + b, 0), 1);
  }
  assert.deepEqual(gpt.params.map(p => p.data), pretrained);
  console.log('PASS: sampling interval boundaries, deterministic seed and self-fed generation');
`, context);

// The complete non-empty 21-section source-anchor contract is verified in beginner-checks.cjs.
