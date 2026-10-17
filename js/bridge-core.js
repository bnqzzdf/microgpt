// Pure teaching transformations. These tokens never enter the name GPT.
const BridgeCore = (() => {
  const roles = ['system', 'user', 'assistant'];
  const markers = ['<|system|>', '<|user|>', '<|assistant|>', '<|end|>'];
  const version = 'bridge-v1';
  function fail(code) { const error = new Error(code); error.code = code; throw error; }
  function serialize(messages, budget = 256) {
    if (!Number.isInteger(budget) || budget < 1 || budget > 10000) fail('Invalid teaching budget');
    if (!Array.isArray(messages) || !messages.length) fail('Invalid messages');
    const ids = new Set(), spans = [], tokens = [];
    let text = '';
    function append(value, messageId, part, reserved = false) {
      const start = text.length;
      text += value;
      const span = { messageId, part, start, end: text.length };
      spans.push(span);
      if (reserved) tokens.push({ id: markers.indexOf(value) + 1, text: value, ...span });
      else {
        let offset = start;
        for (const point of value) {
          tokens.push({ id: 1024 + point.codePointAt(0), text: point, messageId, part, start: offset, end: offset + point.length });
          offset += point.length;
        }
      }
    }
    for (const message of messages) {
      if (!message || typeof message.id !== 'string' || !message.id || ids.has(message.id)) fail('Invalid message ID');
      ids.add(message.id);
      if (!roles.includes(message.role)) fail('Unknown message role');
      if (typeof message.content !== 'string' || message.content.length > 6000) fail('Invalid message content');
      if (/<\|[^<>]*\|>/.test(message.content)) fail('Reserved markers are not allowed in content');
      if (message.included === false) continue;
      append(`<|${message.role}|>`, message.id, 'role', true);
      append(message.content, message.id, 'content');
      append('<|end|>', message.id, 'end', true);
      append('\n', message.id, 'separator');
    }
    append('<|assistant|>', null, 'generation-prompt', true);
    return {
      kind: 'teaching', templateId: 'teaching-chat-v1', tokenizerId: 'unicode-codepoint-v1',
      revision: version, text, spans, tokens, tokenIds: tokens.map(token => token.id),
      tokenCount: tokens.length, countSource: 'teaching', budget, valid: tokens.length <= budget,
      includedIds: messages.filter(message => message.included !== false).map(message => message.id),
    };
  }
  function evidence(messages, definitionId, expectedText) {
    const message = messages.find(item => item.id === definitionId && item.included !== false);
    return { present: Boolean(message && message.content.includes(expectedText)), messageId: message?.id ?? null };
  }
  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  }
  // Versioned, non-cryptographic fingerprint; not a security checksum.
  function fingerprint(value) {
    let hash = 2166136261;
    for (const ch of JSON.stringify(value)) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }
  function operation(op, a, b) {
    if (![a, b].every(Number.isSafeInteger)) fail('Invalid arithmetic input');
    const result = op === 'add' ? a + b : op === 'sub' ? a - b : op === 'mul' ? a * b : NaN;
    if (!Number.isSafeInteger(result)) fail('Invalid arithmetic input');
    return result;
  }
  function answer(task) {
    if (task.kind === 'multiply') return operation('mul', task.a, task.b);
    if (task.kind === 'state') return task.changes.reduce((value, change) => operation('add', value, change), task.initial);
    return fail('Unsupported task');
  }
  function verify(task, solution) {
    const expected = answer(task);
    const method = task.methods[solution.method];
    const steps = (solution.steps || []).map((step, index) => {
      const required = method?.[index];
      const arithmetic = operation(step.op, step.a, step.b) === step.result;
      const matchesTask = Boolean(required && required.op === step.op && required.a === step.a && required.b === step.b);
      return { ...step, arithmetic, matchesTask, valid: arithmetic && matchesTask };
    });
    const complete = Boolean(method && steps.length === method.length);
    return { expected, finalCorrect: Number.isSafeInteger(solution.final) && solution.final === expected,
      steps, stepsValid: complete && steps.every(step => step.valid), checked: steps.length,
      hasSteps: steps.length > 0, complete };
  }
  function restoreProgress(raw, modules) {
    const initial = { module: modules[0].id, answers: {}, review: false };
    try {
      const saved = JSON.parse(raw);
      if (saved?.version !== 1) return initial;
      if (modules.some(module => module.id === saved.module)) initial.module = saved.module;
      for (const module of modules) {
        const answers = saved.answers?.[module.id];
        initial.answers[module.id] = module.questions.map((question, i) =>
          Number.isInteger(answers?.[i]) && answers[i] >= -1 && answers[i] < question.choices.length ? answers[i] : null);
      }
      initial.review = saved.review === true;
    } catch { /* Corrupt records do not prevent learning. */ }
    return initial;
  }
  // Reserved contract for a future explicitly configured backend. Never sends data.
  function offlineAdapter() {
    return {
      describe: () => ({ identity: 'not-configured', locality: 'offline', limits: null,
        privacyNotice: 'Offline only; no requests sent',
        capabilities: { inference: false, exactTokens: false, seed: false, tokenUsage: false, streaming: false, phaseTiming: false, cancellation: false } }),
      prepare: messages => ({ requestPreview: JSON.parse(JSON.stringify(messages)), representation: 'opaque', budgetCheck: 'unavailable', enabled: false }),
      async *run() { fail('Real model is not configured'); },
    };
  }
  return { version, serialize, evidence, seededRandom, fingerprint, operation, answer, verify, restoreProgress, offlineAdapter };
})();
