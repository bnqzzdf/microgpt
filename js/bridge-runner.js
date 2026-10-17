// Independent, real name-model inference. No training and no network calls.
const BridgeRunner = (() => {
  let nextId = 0;
  function create({ modelFactory, tokenizerFactory, weights, prefix = 'em', temperature = .5, seed = 2026, maxNewTokens = 8 }) {
    if (typeof prefix !== 'string' || !/^[a-z]*$/.test(prefix)) throw new Error('Invalid name prefix');
    if (!Number.isFinite(temperature) || temperature <= 0 || temperature > 2) throw new Error('Invalid temperature');
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error('Invalid random seed');
    const tokenizer = tokenizerFactory(weights.uchars), prompt = tokenizer.encode(prefix).slice(0, -1);
    if (!Number.isInteger(maxNewTokens) || maxNewTokens < 1 || prompt.length + maxNewTokens > weights.block_size) throw new Error('Name-model budget exceeded');
    const config = Object.freeze({ mode: 'name-model', version: BridgeCore.version, prefix, temperature, seed, maxNewTokens,
      prompt: Object.freeze([...prompt]), checkpoint: 'bundled-microgpt', weightsFingerprint: BridgeCore.fingerprint(weights.weights),
      fingerprintKind: 'FNV-1a 32-bit, non-cryptographic', randomAlgorithm: 'lcg32-v1', blockSize: weights.block_size });
    const runId = `bridge-${++nextId}`, events = [], output = [], processed = [];
    const random = BridgeCore.seededRandom(seed);
    let model, snapshot, keys, values, trace, phase = 'new', forwards = 0, last, reason = null;
    function emit(type, details = {}) {
      const event = { runId, sequence: events.length, source: 'local-name-model', type, ...details };
      events.push(event);
      return event;
    }
    function unchanged() { return !model || model.params.every((param, i) => Object.is(param.data, snapshot[i])); }
    function finish(stopReason) {
      reason = stopReason; phase = 'stopped';
      return emit('stop', { reason, weightsUnchanged: model ? unchanged() : null, forwards });
    }
    function forward(token) {
      const pos = processed.length;
      if (pos >= model.blockSize) throw new Error('Name-model budget exceeded');
      trace = model.forward(token, pos, keys, values);
      processed.push(token); forwards++;
    }
    function step() {
      if (phase === 'stopped') return null;
      try {
        if (phase === 'new') {
          model = modelFactory(weights); snapshot = model.params.map(param => param.data);
          keys = Array.from({ length: model.nLayer }, () => []); values = Array.from({ length: model.nLayer }, () => []);
          phase = 'loaded';
          return emit('load', { params: model.params.length, checkpoint: config.checkpoint });
        }
        if (phase === 'loaded') { phase = 'prefill'; return emit('prepare', { prompt: [...prompt] }); }
        if (phase === 'prefill') {
          const token = prompt[processed.length]; forward(token);
          if (processed.length === prompt.length) phase = 'ready';
          return emit('prefill', { input: token, position: processed.length - 1, cache: keys.map(layer => layer.length), forwards,
            probs: [...trace.probs] });
        }
        const input = phase === 'ready' ? processed[processed.length - 1] : last;
        if (phase !== 'ready') forward(last);
        const logits = trace.logits.map(value => value / temperature), max = Math.max(...logits);
        const exps = logits.map(value => Math.exp(value - max)), sum = exps.reduce((a, b) => a + b, 0);
        const probs = exps.map(value => value / sum), u = random();
        last = model.sampleFromProbs(probs, u);
        const event = emit('decode', { input, token: last, random: u, probs, position: processed.length - 1,
          cache: keys.map(layer => layer.length), forwards, first: phase === 'ready' });
        output.push(last); phase = 'decode';
        if (last === tokenizer.BOS) finish('End marker');
        else if (output.length >= maxNewTokens) finish('Output budget');
        return event;
      } catch (error) { emit('error', { message: error.message }); finish('Error'); return events.at(-1); }
    }
    function recompute() {
      if (!trace) throw new Error('Run prefill first');
      const fresh = modelFactory(weights), k = Array.from({ length: fresh.nLayer }, () => []), v = Array.from({ length: fresh.nLayer }, () => []);
      let replay;
      processed.forEach((token, pos) => { replay = fresh.forward(token, pos, k, v); });
      const maxDifference = Math.max(...trace.probs.map((prob, i) => Math.abs(prob - replay.probs[i])));
      return emit('recompute', { count: processed.length, cachedDecodeCalls: output.length > 1 ? 1 : 0,
        maxDifference, equal: maxDifference < 1e-10, randomConsumed: false, weightsUnchanged: unchanged() });
    }
    function result() {
      return JSON.parse(JSON.stringify({ runId, config, phase, reason, events, output,
        text: tokenizer.decode(output), promptText: prefix, forwards, cache: keys?.map(layer => layer.length) || [],
        modelLoaded: Boolean(model), weightsUnchanged: model ? unchanged() : null,
        provenance: { source: 'local-name-model', actualComputation: forwards > 0 },
        limitations: ['Name model only; not a chat model', 'No measured LLM latency or hidden reasoning'] }));
    }
    return { step, recompute, result, cancel: () => phase === 'stopped' ? null : finish('Cancelled') };
  }
  return { create };
})();
