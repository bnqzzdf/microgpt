// Main application controller for microgpt.js teaching sandbox

let gpt, tokenizer, activeTab;
let trainGpt, trainOptimizer;
let trainingStepCount = 0;
let trainingLossHistory = [];

// --- initialization ---

function initApp() {
  const data = MICROGPT_WEIGHTS;

  tokenizer = new Tokenizer(data.uchars);
  gpt = createModel(data);

  document.getElementById('model-info').textContent =
    `vocab=${data.vocab_size} · embed=${data.n_embd} · heads=${data.n_head} · layers=${data.n_layer} · block=${data.block_size} · params=${gpt.params.length} · loss=${data.final_loss.toFixed(3)}`;

  // Register event handlers BEFORE calling tabForwardPass (so errors there don't break tabs)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'forward') tabForwardPass();
      else if (tab === 'train') tabTrain();
      else if (tab === 'sample') tabSample();
      else if (tab === 'attention') tabAttention();
    });
  });

  document.getElementById('btn-step-fwd').addEventListener('click', stepForward);
  document.getElementById('btn-reset-fwd').addEventListener('click', resetForward);
  document.getElementById('btn-generate').addEventListener('click', generateSamples);
  document.getElementById('btn-auto').addEventListener('click', autoStep);
  document.getElementById('pos-slider').addEventListener('input', jumpToPosition);
  document.getElementById('btn-train-one').addEventListener('click', () => runTrainingSteps(1));
  document.getElementById('btn-train-ten').addEventListener('click', () => runTrainingSteps(10));
  document.getElementById('btn-train-reset').addEventListener('click', resetTrainingLab);
  document.getElementById('train-input').addEventListener('change', resetTrainingLab);
  document.getElementById('train-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') resetTrainingLab();
  });

  document.getElementById('temp-slider').addEventListener('input', (e) => {
    document.getElementById('temp-value').textContent = parseFloat(e.target.value).toFixed(2);
  });

  document.getElementById('fwd-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') resetForward();
  });

  resetTrainingLab();

  // Initialize forward pass (after handlers registered)
  tabForwardPass();
}

function createModel(data) {
  const model = new GPT({
    vocab_size: data.vocab_size,
    n_embd: data.n_embd,
    n_head: data.n_head,
    n_layer: data.n_layer,
    block_size: data.block_size,
    head_dim: data.head_dim,
  });
  model.loadWeights(data);
  return model;
}

// --- tab switching ---

function setActiveTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
}

function tabForwardPass() {
  setActiveTab('forward');
  resetForward();
}

function tabTrain() {
  setActiveTab('train');
  updateTrainingTokenPairs();
  document.getElementById('step-info').textContent =
    'Training lab: fresh random weights · forward → loss → backward → Adam.';
}

function tabSample() {
  setActiveTab('sample');
  document.getElementById('step-info').textContent =
    'Generation: sample one token, feed it back, and repeat until <BOS>.';
}

function tabAttention() {
  setActiveTab('attention');
  // The matrix is only meaningful after all positions have been evaluated.
  if (fwdTokens && fwdTokens.length > 1) {
    stepToPosition(fwdTokens.length - 2);
  }
  updateAttentionTab();
  document.getElementById('step-info').textContent =
    'Attention: each row is a query; causal masking allows only current and past keys.';
}

// --- forward pass sandbox ---

let fwdInput, fwdTokens, fwdKVKeys, fwdKVValues, fwdTraces;
let currentPos = 0;

function resetForward() {
  const valid = sanitizeNameInput('fwd-input', 'fwd-input-hint', 'emma');

  fwdTokens = tokenizer.encode(valid);
  fwdKVKeys = Array.from({ length: gpt.nLayer }, () => []);
  fwdKVValues = Array.from({ length: gpt.nLayer }, () => []);
  fwdTraces = [];
  currentPos = 0;

  // Number of valid prediction positions = N-1 (last BOS has no successor to predict)
  const numPositions = fwdTokens.length - 1;

  // Show only input tokens: position 0 through N-2
  const displayTokens = fwdTokens.slice(0, numPositions);
  const seqEl = document.getElementById('token-sequence');
  seqEl.innerHTML = displayTokens.map((t, i) => {
    const cls = i === 0 ? 'active' : 'pending';
    return `<span class="token ${cls}" data-idx="${i}">${tokenToHtml(t)}</span>`;
  }).join('');

  seqEl.querySelectorAll('.token').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      currentPos = idx;
      stepToPosition(idx);
      updateForwardUI();
    });
  });

  document.getElementById('pos-slider').max = numPositions - 1;
  document.getElementById('pos-slider').value = 0;
  document.getElementById('pos-label').textContent = '0';

  // Step to position 0
  stepToPosition(0);
  updateForwardUI();
}

function sanitizeNameInput(inputId, hintId, fallback = 'emma') {
  const input = document.getElementById(inputId);
  const hint = document.getElementById(hintId);
  const raw = input.value.trim().toLowerCase();
  const invalid = [...raw].filter(ch => !(ch in tokenizer._charToId));
  let valid = [...raw].filter(ch => ch in tokenizer._charToId).join('');
  const wasTooLong = valid.length > gpt.blockSize - 1;
  valid = valid.slice(0, gpt.blockSize - 1) || fallback;
  input.value = valid;

  if (invalid.length > 0 || wasTooLong) {
    hint.textContent = `${invalid.length > 0 ? 'Unsupported characters were removed. ' : ''}${wasTooLong ? `Input was limited to ${gpt.blockSize - 1} characters.` : ''}`;
    hint.classList.add('warning');
  } else {
    hint.textContent = `${valid.length}/${gpt.blockSize - 1} characters · a-z only`;
    hint.classList.remove('warning');
  }
  return valid;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function tokenToHtml(tokenId) {
  return escapeHtml(tokenizer.tokenToDisplay(tokenId));
}

function stepForward() {
  if (currentPos >= fwdTokens.length - 2) return;
  currentPos++;
  stepToPosition(currentPos);
  updateForwardUI();
}

function jumpToPosition() {
  currentPos = parseInt(document.getElementById('pos-slider').value);
  stepToPosition(currentPos);
  updateForwardUI();
}

function stepToPosition(pos) {
  // Reset and recompute from scratch to avoid stale Values
  fwdKVKeys = Array.from({ length: gpt.nLayer }, () => []);
  fwdKVValues = Array.from({ length: gpt.nLayer }, () => []);
  fwdTraces = [];
  currentPos = pos;

  for (let p = 0; p <= pos && p < fwdTokens.length - 1; p++) {
    const trace = gpt.forward(fwdTokens[p], p, fwdKVKeys, fwdKVValues);
    fwdTraces.push(trace);
  }

  document.getElementById('pos-slider').value = pos;
  document.getElementById('pos-label').textContent = pos;

  // Update token sequence highlighting
  const tokens = document.querySelectorAll('#token-sequence .token');
  tokens.forEach((el, i) => {
    el.classList.remove('active', 'past');
    if (i === pos) el.classList.add('active');
    else if (i < pos) el.classList.add('past');
  });
}

function autoStep() {
  const maxPos = fwdTokens.length - 2;
  const delay = 400;

  function next(i) {
    if (i > maxPos) return;
    currentPos = i;
    stepToPosition(i);
    updateForwardUI();

    if (i < maxPos) setTimeout(() => next(i + 1), delay);
  }
  next(currentPos);
}

function updateForwardUI() {
  if (fwdTraces.length === 0) return;
  const trace = fwdTraces[currentPos];
  if (!trace) return;

  const targetId = fwdTokens[currentPos + 1];
  const targetChar = tokenizer.tokenToDisplay(targetId);

  // Current token info
  document.getElementById('current-token').textContent =
    tokenizer.tokenToDisplay(fwdTokens[currentPos]);
  document.getElementById('target-token').textContent = targetChar;

  // Logits
  const logitsStr = trace.logits.map((l, i) => {
    const marker = i === targetId ? ' **' : '';
    return `${tokenizer.tokenToDisplay(i)}:${l.toFixed(2)}${marker}`;
  }).join(' | ');
  document.getElementById('output-logits').textContent = logitsStr;

  // Sort probs to show top predictions
  const sorted = trace.probs.map((p, i) => ({ p, token: tokenizer.tokenToDisplay(i) }));
  sorted.sort((a, b) => b.p - a.p);
  const topStr = sorted.slice(0, 5).map(s => `${s.token}:${(s.p * 100).toFixed(1)}%`).join(' · ');
  document.getElementById('top-predictions').textContent = topStr;

  // Correct prob highlight
  const correctProb = (trace.probs[targetId] * 100).toFixed(1);
  document.getElementById('correct-prob').textContent = `${correctProb}%`;

  // Per-head attention heatmaps
  if (trace.layers && trace.layers[0] && trace.layers[0].attnWeights) {
    drawAttentionHeatmaps(trace.layers[0].attnWeights);
  }

  // Probability bar chart
  const probCanvas = document.getElementById('canvas-probs');
  if (probCanvas) {
    Viz.drawProbs(probCanvas, trace.probs, tokenizer.uchars.concat(['BOS']));
  }

  // Step info
  document.getElementById('step-info').textContent =
    `Position ${currentPos}: ${tokenizer.tokenToDisplay(fwdTokens[currentPos])} → ${targetChar} (target) · KV cache size: ${fwdKVKeys[0].length}`;

  // Update teaching text
  updateTeachingText();

  // Also update attention tab if active
  if (activeTab === 'attention') {
    updateAttentionTab();
  }
}

// --- attention visualization ---

function drawAttentionHeatmaps(attnWeightsAll) {
  if (!attnWeightsAll) return;
  for (let h = 0; h < gpt.nHead; h++) {
    const canvas = document.getElementById(`attn-head-${h}`);
    if (!canvas) continue;

    // attnWeightsAll[h] is [seq_len] array of attention weights
    // Each weight array has the same length = number of keys so far
    // We want to show it as a 1-row heatmap (query attends to keys)
    const weights = attnWeightsAll[h];
    if (weights && weights.length > 0) {
      Viz.drawAttention(canvas, [weights], null, null);
    }
  }
}

function updateAttentionTab() {
  if (fwdTraces.length === 0) return;

  // Build causal attention matrix: pad shorter rows so all rows have same length
  const maxLen = fwdTraces.length;
  const heads = [];
  for (let h = 0; h < gpt.nHead; h++) {
    const rows = [];
    for (let p = 0; p < fwdTraces.length; p++) {
      const tr = fwdTraces[p];
      if (tr && tr.layers && tr.layers[0] && tr.layers[0].attnWeights) {
        const raw = tr.layers[0].attnWeights[h];
        // Pad with 0 to maxLen to create square causal matrix
        const padded = [...raw];
        while (padded.length < maxLen) padded.push(0);
        rows.push(padded);
      }
    }
    heads.push(rows);
  }

  const labels = fwdTokens.slice(0, fwdTraces.length).map(t => tokenizer.tokenToDisplay(t));
  const sequenceEl = document.getElementById('attention-sequence');
  if (sequenceEl) {
    sequenceEl.textContent = `Rows are queries; columns are keys. Sequence: ${labels.join(' → ')}`;
  }

  for (let h = 0; h < gpt.nHead; h++) {
    const canvas = document.getElementById(`attn-tab-h${h}`);
    if (canvas && heads[h].length > 0) {
      Viz.drawAttention(canvas, heads[h], labels, labels);
    }
  }
}

// --- training lab ---

function seededRandom(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function gaussianRandom(random, std = 0.08) {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * std;
}

function createRandomWeightData() {
  const random = seededRandom(42);
  const data = MICROGPT_WEIGHTS;
  const weights = {};

  for (const [name, matrix] of Object.entries(data.weights)) {
    weights[name] = matrix.map(row => row.map(() => gaussianRandom(random)));
  }

  return { ...data, weights };
}

function resetTrainingLab() {
  trainGpt = createModel(createRandomWeightData());
  trainOptimizer = new Adam(trainGpt.params, 0.01, 0.85, 0.99, 1e-8);
  trainingStepCount = 0;
  trainingLossHistory = [];

  document.getElementById('train-step').textContent = '0';
  document.getElementById('train-loss-before').textContent = '—';
  document.getElementById('train-loss-after').textContent = '—';
  document.getElementById('train-forward-detail').textContent = 'Press “Run 1 training step” to build a computation graph.';
  document.getElementById('train-loss-detail').textContent = 'The correct token\'s probability becomes cross-entropy loss.';
  document.getElementById('train-backward-detail').textContent = 'Autograd will calculate ∂loss/∂parameter for every weight.';
  document.getElementById('train-update-detail').textContent = 'Adam combines the gradient with momentum and adaptive scaling.';
  document.getElementById('train-explanation').innerHTML =
    'Random guessing among 27 tokens starts near <span class="highlight2">ln(27) ≈ 3.296</span> loss. ' +
    'As training repeats, the loss should usually fall: the parameters are storing statistical patterns from the example.';

  document.querySelectorAll('.training-stage').forEach(stage => stage.classList.remove('active'));
  const canvas = document.getElementById('canvas-train-loss');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  updateTrainingTokenPairs();
}

function getTrainingTokens() {
  const name = sanitizeNameInput('train-input', 'train-input-hint', 'emma');
  return { name, tokens: tokenizer.encode(name) };
}

function updateTrainingTokenPairs() {
  if (!tokenizer) return;
  const { tokens } = getTrainingTokens();
  const rows = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    rows.push(`
      <tr>
        <td>${i}</td>
        <td>${tokenToHtml(tokens[i])}</td>
        <td>→</td>
        <td>${tokenToHtml(tokens[i + 1])}</td>
      </tr>
    `);
  }
  document.getElementById('train-token-pairs').innerHTML = `
    <table class="token-pairs">
      <thead><tr><th>pos</th><th>input</th><th></th><th>target</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;
}

function documentLoss(model, tokens, captureRows = false) {
  const keys = Array.from({ length: model.nLayer }, () => []);
  const values = Array.from({ length: model.nLayer }, () => []);
  const losses = [];
  const rows = [];
  const count = Math.min(model.blockSize, tokens.length - 1);

  for (let pos = 0; pos < count; pos++) {
    const targetId = tokens[pos + 1];
    const trace = model.forwardLoss(tokens[pos], pos, targetId, keys, values);
    losses.push(trace.loss);
    if (captureRows) {
      rows.push({
        input: tokenizer.tokenToDisplay(tokens[pos]),
        target: tokenizer.tokenToDisplay(targetId),
        probability: trace.probs[targetId].data,
        loss: trace.loss.data,
      });
    }
  }

  const total = losses.reduce((sum, loss) => sum.add(loss), new Value(0)).div(count);
  return { loss: total, rows };
}

function parameterGradientStats(params) {
  let sumSquares = 0;
  let maxAbs = 0;
  let nonZero = 0;
  for (const param of params) {
    const abs = Math.abs(param.grad);
    sumSquares += param.grad * param.grad;
    maxAbs = Math.max(maxAbs, abs);
    if (abs > 1e-12) nonZero++;
  }
  return { rms: Math.sqrt(sumSquares / params.length), maxAbs, nonZero };
}

async function runTrainingSteps(count) {
  const buttons = ['btn-train-one', 'btn-train-ten', 'btn-train-reset']
    .map(id => document.getElementById(id));
  buttons.forEach(button => { button.disabled = true; });

  try {
    for (let step = 0; step < count; step++) {
      const { name, tokens } = getTrainingTokens();
      trainGpt.zeroGrad();

      const tracked = trainGpt.stateDict.wte[tokenizer.BOS][0];
      const beforeValue = tracked.data;
      const before = documentLoss(trainGpt, tokens, true);
      before.loss.backward();

      const stats = parameterGradientStats(trainGpt.params);
      const trackedGrad = tracked.grad;
      trainOptimizer.step();
      const afterValue = tracked.data;
      const after = documentLoss(trainGpt, tokens, false).loss.data;

      trainingStepCount++;
      trainingLossHistory.push(after);
      updateTrainingUI({
        name,
        beforeLoss: before.loss.data,
        afterLoss: after,
        rows: before.rows,
        stats,
        beforeValue,
        afterValue,
        trackedGrad,
      });

      if (count > 1) await sleep(0);
    }
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

function updateTrainingUI(result) {
  document.getElementById('train-step').textContent = trainingStepCount;
  document.getElementById('train-loss-before').textContent = result.beforeLoss.toFixed(3);
  document.getElementById('train-loss-after').textContent = result.afterLoss.toFixed(3);
  document.getElementById('train-forward-detail').textContent =
    `${result.rows.length} positions were evaluated for “${result.name}”. Each prediction built more of the scalar computation graph.`;

  const hardest = [...result.rows].sort((a, b) => b.loss - a.loss)[0];
  document.getElementById('train-loss-detail').textContent =
    `Average loss was ${result.beforeLoss.toFixed(3)}. Hardest pair: ${hardest.input} → ${hardest.target}, ` +
    `p=${(hardest.probability * 100).toFixed(1)}%, loss=${hardest.loss.toFixed(3)}.`;
  document.getElementById('train-backward-detail').textContent =
    `${result.stats.nonZero.toLocaleString()} / ${trainGpt.params.length.toLocaleString()} parameters received a non-zero gradient. ` +
    `Gradient RMS=${result.stats.rms.toExponential(2)}, max=${result.stats.maxAbs.toExponential(2)}.`;
  document.getElementById('train-update-detail').textContent =
    `Example weight wte[<BOS>][0]: ${result.beforeValue.toFixed(6)} → ${result.afterValue.toFixed(6)} ` +
    `(raw gradient ${result.trackedGrad.toExponential(2)}).`;

  document.querySelectorAll('.training-stage').forEach(stage => stage.classList.add('active'));
  Viz.drawLossCurve(document.getElementById('canvas-train-loss'), trainingLossHistory);

  const direction = result.afterLoss < result.beforeLoss ? 'fell' : 'rose';
  document.getElementById('train-explanation').innerHTML =
    `After step <span class="highlight">${trainingStepCount}</span>, loss ${direction} from ` +
    `<span class="highlight2">${result.beforeLoss.toFixed(3)}</span> to ` +
    `<span class="highlight2">${result.afterLoss.toFixed(3)}</span>. ` +
    'One update is noisy; the important idea is that the error signal reaches every parameter that influenced this example through the chain rule.';
}

// --- sample / generate ---

async function generateSamples() {
  const temp = parseFloat(document.getElementById('temp-slider').value);
  const output = document.getElementById('sample-output');
  output.innerHTML = '<span style="color:#666">Generating...</span>';

  await sleep(30);

  const results = [];
  for (let i = 0; i < 20; i++) {
    const result = gpt.generate(tokenizer.BOS, gpt.blockSize, temp);
    const name = tokenizer.decode(result.tokens);
    results.push(name);
  }

  output.innerHTML = results.map((name, i) =>
    `<div class="sample-name"><span class="sample-idx">${(i + 1).toString().padStart(2)}</span> ${name}</div>`
  ).join('');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- weight preview ---

function showWeightMatrix(name) {
  const mat = gpt.stateDict[name];
  if (!mat) return;

  const canvas = document.getElementById('canvas-weights');
  const raw = mat.map(row => row.map(v => v.data));

  let rowLabels = null;
  if (name === 'wte' || name === 'lm_head') {
    rowLabels = tokenizer.uchars.concat(['BOS']);
  }

  Viz.drawEmbedding(canvas, raw, rowLabels, null);

  const dims = `${raw.length}×${raw[0].length}`;
  document.getElementById('weight-info').textContent = `${name} [${dims}]`;
}

// --- teaching text ---

function getPositionExplanation(pos, numPos, tokenId, targetId, trace) {
  const inputToken = tokenToHtml(tokenId);
  const targetToken = tokenToHtml(targetId);
  const kcSize = fwdKVKeys[0].length;

  // Top prob info
  const sorted = trace.probs.map((p, i) => ({ p, token: tokenizer.tokenToDisplay(i) }));
  sorted.sort((a, b) => b.p - a.p);
  const top1 = sorted[0];
  const targetProb = trace.probs[targetId] * 100;
  const top1Tie = top1.p * 100;

  // Attention summary: which past token gets highest weight?
  let attnSummary = '';
  if (trace.layers && trace.layers[0] && trace.layers[0].attnWeights) {
    const head0 = trace.layers[0].attnWeights[0];
    const maxIdx = head0.indexOf(Math.max(...head0));
    const maxLabel = tokenToHtml(fwdTokens[maxIdx]);
    attnSummary = `Head 0 focuses most on <span class="highlight">${maxLabel}</span> (position ${maxIdx}).`;
  }

  let label, body;

  if (pos === 0) {
    label = 'Start: From Nothing to First Letter';
    body = `
      The model sees <span class="highlight">${inputToken}</span> &mdash; the special marker that means "a new document begins."
      With no prior context, attention only has one token to look at (itself).
      <div class="flow-row">
        <span class="flow-step">${inputToken}</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">Embedding</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">Attention</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">MLP</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">Logits</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">Softmax</span>
      </div>
      The model assigns <span class="highlight2">${targetProb.toFixed(1)}%</span> probability to the correct first letter
      <span class="highlight">${targetToken}</span>. Its top guess is
      <span class="highlight">${escapeHtml(top1.token)}</span> (${top1Tie.toFixed(1)}%).
    `;
  } else if (pos === numPos - 1) {
    label = 'End: Knowing When to Stop';
    body = `
      The model has seen <span class="highlight">${kcSize}</span> tokens and must decide if the name is complete.
      The target is <span class="highlight">${targetToken}</span> (end-of-name marker).
      <div class="flow-row">
        <span class="flow-step">${inputToken}</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">Attention (${kcSize-1} context)</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">Predict</span>
      </div>
      It gives <span class="highlight2">${targetProb.toFixed(1)}%</span> to the &lt;BOS&gt; token.
      If this is the highest probability, the model "knows" the name ends here.
      ${attnSummary}
    `;
  } else {
    label = `Building Context (position ${pos} of ${numPos-1})`;
    const pastList = fwdTokens.slice(0, pos + 1).map(tokenToHtml).join(' ');
    body = `
      The model has seen <span class="highlight">${kcSize}</span> tokens so far:
      <span class="highlight">${pastList}</span>.
      Now it must predict the next character after <span class="highlight">${inputToken}</span>.
      <div class="flow-row">
        <span class="flow-step">${inputToken}</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">Attention (${kcSize-1} context)</span>
        <span class="flow-arrow">→</span>
        <span class="flow-step">Predict</span>
      </div>
      Correct: <span class="highlight2">${targetToken}</span> (${targetProb.toFixed(1)}%).
      Top guess: <span class="highlight">${escapeHtml(top1.token)}</span> (${top1Tie.toFixed(1)}%).
      ${attnSummary}
    `;
  }

  return { label, body };
}

function updateTeachingText() {
  const labelEl = document.getElementById('context-step-label');
  const bodyEl = document.getElementById('context-body');
  if (!labelEl || !bodyEl) return;

  if (!fwdTokens || fwdTraces.length === 0) {
    labelEl.textContent = 'Ready';
    bodyEl.innerHTML = 'Press <span class="highlight">Step Forward</span> to walk through the name token by token.';
    return;
  }

  const trace = fwdTraces[currentPos];
  if (!trace) return;

  const tokenId = fwdTokens[currentPos];
  const targetId = fwdTokens[currentPos + 1];
  const numPos = fwdTokens.length - 1;

  const ex = getPositionExplanation(currentPos, numPos, tokenId, targetId, trace);
  labelEl.textContent = ex.label;
  bodyEl.innerHTML = ex.body;
}

document.addEventListener('DOMContentLoaded', initApp);
