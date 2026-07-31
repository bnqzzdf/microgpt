// Main application controller for microgpt.js teaching sandbox

let gpt, tokenizer, activeTab;

// --- initialization ---

function initApp() {
  const data = MICROGPT_WEIGHTS;

  tokenizer = new Tokenizer(data.uchars);

  gpt = new GPT({
    vocab_size: data.vocab_size,
    n_embd: data.n_embd,
    n_head: data.n_head,
    n_layer: data.n_layer,
    block_size: data.block_size,
    head_dim: data.head_dim,
  });
  gpt.loadWeights(data);

  document.getElementById('model-info').textContent =
    `vocab=${data.vocab_size} · embed=${data.n_embd} · heads=${data.n_head} · layers=${data.n_layer} · block=${data.block_size} · params=${gpt.params.length} · loss=${data.final_loss.toFixed(3)}`;

  // Register event handlers BEFORE calling tabForwardPass (so errors there don't break tabs)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'forward') tabForwardPass();
      else if (tab === 'sample') tabSample();
      else if (tab === 'attention') tabAttention();
    });
  });

  document.getElementById('btn-step-fwd').addEventListener('click', stepForward);
  document.getElementById('btn-reset-fwd').addEventListener('click', resetForward);
  document.getElementById('btn-generate').addEventListener('click', generateSamples);
  document.getElementById('btn-auto').addEventListener('click', autoStep);
  document.getElementById('pos-slider').addEventListener('input', jumpToPosition);

  document.getElementById('temp-slider').addEventListener('input', (e) => {
    document.getElementById('temp-value').textContent = parseFloat(e.target.value).toFixed(2);
  });

  document.getElementById('fwd-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') resetForward();
  });

  // Initialize forward pass (after handlers registered)
  tabForwardPass();
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

function tabSample() {
  setActiveTab('sample');
}

function tabAttention() {
  setActiveTab('attention');
  updateAttentionTab();
}

// --- forward pass sandbox ---

let fwdInput, fwdTokens, fwdKVKeys, fwdKVValues, fwdTraces;
let currentPos = 0;

function resetForward() {
  const name = document.getElementById('fwd-input').value.trim().toLowerCase() || 'emma';
  // Filter to valid chars
  const valid = name.split('').filter(ch => ch in tokenizer._charToId).join('');
  document.getElementById('fwd-input').value = valid;

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
    return `<span class="token ${cls}" data-idx="${i}">${tokenizer.tokenToDisplay(t)}</span>`;
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

  const labels = fwdTokens.slice(1, fwdTraces.length + 1).map(t => tokenizer.tokenToDisplay(t));

  for (let h = 0; h < gpt.nHead; h++) {
    const canvas = document.getElementById(`attn-tab-h${h}`);
    if (canvas && heads[h].length > 0) {
      Viz.drawAttention(canvas, heads[h], labels, labels);
    }
  }
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
  const inputToken = tokenizer.tokenToDisplay(tokenId);
  const targetToken = tokenizer.tokenToDisplay(targetId);
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
    const maxLabel = tokenizer.tokenToDisplay(fwdTokens[maxIdx]);
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
      <span class="highlight">${top1.token}</span> (${top1Tie.toFixed(1)}%).
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
    const pastList = fwdTokens.slice(0, pos + 1).map(t => tokenizer.tokenToDisplay(t)).join(' ');
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
      Top guess: <span class="highlight">${top1.token}</span> (${top1Tie.toFixed(1)}%).
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
