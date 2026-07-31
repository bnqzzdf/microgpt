// GPT model architecture — the complete forward pass
// Follows GPT-2 structure with simplifications (RMSNorm, no bias, ReLU)

class GPT {
  constructor(config) {
    this.vocabSize = config.vocab_size;
    this.nEmbd = config.n_embd;
    this.nHead = config.n_head;
    this.nLayer = config.n_layer;
    this.blockSize = config.block_size;
    this.headDim = config.n_embd / config.n_head;
    this.stateDict = {};
    this.params = [];
  }

  loadWeights(weightsJson) {
    for (const [name, mat] of Object.entries(weightsJson.weights)) {
      this.stateDict[name] = mat.map(row =>
        row.map(v => new Value(v))
      );
    }
    this._flattenParams();
  }

  _flattenParams() {
    this.params = [];
    for (const mat of Object.values(this.stateDict)) {
      for (const row of mat) {
        for (const p of row) {
          this.params.push(p);
        }
      }
    }
  }

  zeroGrad() {
    for (const p of this.params) p.grad = 0;
  }

  // --- forward-pass building blocks ---

  linear(x, w) {
    return w.map(wo => {
      let sum = new Value(0);
      for (let i = 0; i < x.length; i++) {
        sum = sum.add(wo[i].mul(x[i]));
      }
      return sum;
    });
  }

  softmax(logits) {
    const maxVal = Math.max(...logits.map(v => v.data));
    const exps = logits.map(v => v.sub(maxVal).exp());
    const total = exps.reduce((a, b) => a.add(b));
    return exps.map(e => e.div(total));
  }

  rmsnorm(x) {
    let ms = new Value(0);
    for (const xi of x) ms = ms.add(xi.mul(xi));
    ms = ms.div(x.length);
    const scale = ms.add(1e-5).pow(-0.5);
    return x.map(xi => xi.mul(scale));
  }

  // --- full forward pass ---
  // keys, values: external KV-cache arrays (modified in-place)
  // Returns: { logits, probs, trace }
  forward(tokenId, posId, keys, values) {
    const trace = {};

    const tokEmb = this.stateDict.wte[tokenId];
    const posEmb = this.stateDict.wpe[posId];
    let x = tokEmb.map((t, i) => t.add(posEmb[i]));
    x = this.rmsnorm(x);

    trace.tokEmb = tokEmb.map(v => v.data);
    trace.posEmb = posEmb.map(v => v.data);
    trace.xAfterEmb = x.map(v => v.data);

    trace.layers = [];

    for (let li = 0; li < this.nLayer; li++) {
      const lt = {};

      // --- Multi-head attention ---
      const xResidual = x;
      x = this.rmsnorm(x);

      const q = this.linear(x, this.stateDict[`layer${li}.attn_wq`]);
      const k = this.linear(x, this.stateDict[`layer${li}.attn_wk`]);
      const v = this.linear(x, this.stateDict[`layer${li}.attn_wv`]);

      keys[li].push(k);
      values[li].push(v);

      lt.q = q.map(v => v.data);
      lt.k = k.map(v => v.data);
      lt.v = v.map(v => v.data);

      const xAttn = [];
      lt.attnWeights = [];
      lt.attnLogits = [];

      for (let h = 0; h < this.nHead; h++) {
        const hs = h * this.headDim;
        const qH = q.slice(hs, hs + this.headDim);
        const kH = keys[li].map(ki => ki.slice(hs, hs + this.headDim));
        const vH = values[li].map(vi => vi.slice(hs, hs + this.headDim));

        const attnLogits = kH.map(ki => {
          let dot = new Value(0);
          for (let j = 0; j < this.headDim; j++) {
            dot = dot.add(qH[j].mul(ki[j]));
          }
          return dot.div(Math.sqrt(this.headDim));
        });

        const attnWeights = this.softmax(attnLogits);
        lt.attnWeights.push(attnWeights.map(v => v.data));
        lt.attnLogits.push(attnLogits.map(v => v.data));

        const headOut = [];
        for (let j = 0; j < this.headDim; j++) {
          let weighted = new Value(0);
          for (let t = 0; t < vH.length; t++) {
            weighted = weighted.add(attnWeights[t].mul(vH[t][j]));
          }
          headOut.push(weighted);
        }
        xAttn.push(...headOut);
      }

      x = this.linear(xAttn, this.stateDict[`layer${li}.attn_wo`]);
      x = x.map((a, i) => a.add(xResidual[i]));

      lt.xAfterAttn = x.map(v => v.data);

      // --- MLP block ---
      const xResidual2 = x;
      x = this.rmsnorm(x);
      x = this.linear(x, this.stateDict[`layer${li}.mlp_fc1`]);
      const mlpPreAct = x.map(v => v.data);
      x = x.map(xi => xi.relu());
      const mlpPostAct = x.map(v => v.data);
      x = this.linear(x, this.stateDict[`layer${li}.mlp_fc2`]);
      x = x.map((a, i) => a.add(xResidual2[i]));

      lt.xAfterMlp = x.map(v => v.data);
      lt.mlpPreAct = mlpPreAct;
      lt.mlpPostAct = mlpPostAct;

      trace.layers.push(lt);
    }

    const logits = this.linear(x, this.stateDict.lm_head);
    const probs = this.softmax(logits);

    trace.logits = logits.map(v => v.data);
    trace.probs = probs.map(v => v.data);

    return trace;
  }

  // Calculate loss for a single forward pass (used in training)
  forwardLoss(tokenId, posId, targetId, keys, values) {
    const trace = {};

    const tokEmb = this.stateDict.wte[tokenId];
    const posEmb = this.stateDict.wpe[posId];
    let x = tokEmb.map((t, i) => t.add(posEmb[i]));
    x = this.rmsnorm(x);

    for (let li = 0; li < this.nLayer; li++) {
      const xResidual = x;
      x = this.rmsnorm(x);

      const q = this.linear(x, this.stateDict[`layer${li}.attn_wq`]);
      const k = this.linear(x, this.stateDict[`layer${li}.attn_wk`]);
      const v = this.linear(x, this.stateDict[`layer${li}.attn_wv`]);

      keys[li].push(k);
      values[li].push(v);

      const xAttn = [];
      for (let h = 0; h < this.nHead; h++) {
        const hs = h * this.headDim;
        const qH = q.slice(hs, hs + this.headDim);
        const kH = keys[li].map(ki => ki.slice(hs, hs + this.headDim));
        const vH = values[li].map(vi => vi.slice(hs, hs + this.headDim));

        const attnLogits = kH.map(ki => {
          let dot = new Value(0);
          for (let j = 0; j < this.headDim; j++) {
            dot = dot.add(qH[j].mul(ki[j]));
          }
          return dot.div(Math.sqrt(this.headDim));
        });

        const attnWeights = this.softmax(attnLogits);
        const headOut = [];
        for (let j = 0; j < this.headDim; j++) {
          let weighted = new Value(0);
          for (let t = 0; t < vH.length; t++) {
            weighted = weighted.add(attnWeights[t].mul(vH[t][j]));
          }
          headOut.push(weighted);
        }
        xAttn.push(...headOut);
      }

      x = this.linear(xAttn, this.stateDict[`layer${li}.attn_wo`]);
      x = x.map((a, i) => a.add(xResidual[i]));

      const xResidual2 = x;
      x = this.rmsnorm(x);
      x = this.linear(x, this.stateDict[`layer${li}.mlp_fc1`]);
      x = x.map(xi => xi.relu());
      x = this.linear(x, this.stateDict[`layer${li}.mlp_fc2`]);
      x = x.map((a, i) => a.add(xResidual2[i]));
    }

    const logits = this.linear(x, this.stateDict.lm_head);
    const probs = this.softmax(logits);
    const loss = probs[targetId].log().neg();

    trace.logits = logits;
    trace.probs = probs;
    trace.loss = loss;

    return trace;
  }

  // --- generation ---
  sampleFromProbs(probs) {
    // probs: array of Value objects or numbers
    const p = probs.map(v => typeof v === 'number' ? v : v.data);
    const r = Math.random();
    let cum = 0;
    for (let i = 0; i < p.length; i++) {
      cum += p[i];
      if (r <= cum) return i;
    }
    return p.length - 1;
  }

  generate(bosToken, maxLen, temperature = 1.0) {
    const keys = Array.from({ length: this.nLayer }, () => []);
    const values = Array.from({ length: this.nLayer }, () => []);

    let tokenId = bosToken;
    const tokens = [];
    const stepTraces = [];

    for (let posId = 0; posId < maxLen; posId++) {
      const trace = this.forward(tokenId, posId, keys, values);
      stepTraces.push(trace);

      const scaledLogits = trace.logits.map(l => l / temperature);
      // Compute scaled probs (as plain numbers for sampling)
      const maxVal = Math.max(...scaledLogits);
      const exps = scaledLogits.map(l => Math.exp(l - maxVal));
      const total = exps.reduce((a, b) => a + b, 0);
      const scaledProbs = exps.map(e => e / total);

      tokenId = this.sampleFromProbs(scaledProbs);
      if (tokenId === bosToken) break;
      tokens.push(tokenId);
    }

    return { tokens, stepTraces };
  }
}
