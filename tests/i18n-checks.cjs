// Run: node tests/i18n-checks.cjs (no extra dependencies).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = vm.createContext({ document: { addEventListener() {} } });
vm.runInContext(read('data/bridge-scenarios.js'), context);
vm.runInContext(read('js/i18n.js'), context);
// Expose curriculum metadata only inside this test VM, without changing production code.
vm.runInContext(read('js/course.js').replace('return { init, open };', 'return { init, open, lessons, formula };'), context);
const t = (value, lang) => {
  context.input = value;
  context.targetLanguage = lang;
  return vm.runInContext('I18n.translate(input, targetLanguage)', context);
};
const lessons = vm.runInContext('Course.lessons', context);
for (const [index, lesson] of lessons.entries()) {
  for (const field of ['title', 'question', 'intro', 'action', 'quiz', 'feedback', 'take']) {
    const translated = t(lesson[field], 'en');
    assert.ok(!/[\u4e00-\u9fff]/.test(translated), `Missing lesson ${index + 1} / ${field}: ${translated}`);
  }
  for (const choice of lesson.choices) assert.ok(!/[\u4e00-\u9fff]/.test(t(choice, 'en')), choice);
  context.lessonIndex = index;
  const formula = vm.runInContext('Course.formula(lessonIndex)', context);
  assert.ok(!/[\u4e00-\u9fff]/.test(t(formula, 'en')), formula);
  for (const prefix of ['理解正确。 ', '再想一下，也可以跳过继续。 ', '已跳过，可随时回来重试。 ']) {
    assert.ok(!/[\u4e00-\u9fff]/.test(t(prefix + lesson.feedback, 'en')), prefix + lesson.feedback);
  }
}
console.log('PASS: all six lessons, choices, feedback and formulas have English translations');

const decode = value => value.replaceAll('&lt;', '<').replaceAll('&gt;', '>')
  .replaceAll('&amp;', '&').replaceAll('&nbsp;', ' ').replaceAll('&mdash;', '—').replaceAll('&quot;', '"');
const technical = new Set([
  'microgpt.js', 'microgpt.py', '<BOS>', '语言 / Language', 'English', 'Q / K / V',
  'tokens → GPT → logits → softmax → probabilities', 'loss = mean(−log p(correct next token))',
  'parameter ← parameter − learning_rate × adjusted_gradient', 'ln(27) ≈ 3.296',
]);
const html = read('index.html').split('<body>')[1].split('<script')[0];
for (const match of html.matchAll(/>([^<>]+)</g)) {
  const text = decode(match[1]).replace(/\s+/g, ' ').trim();
  if (!/[A-Za-z]/.test(text) || technical.has(text)) continue;
  assert.notEqual(t(text, 'zh'), text, `Missing static Chinese translation: ${text}`);
}
console.log('PASS: static sandbox, glossary and accessibility text coverage');

const examples = [
  ['开始学习 · 第 1 节', 'Start learning · lesson 1'],
  ['继续学习 · 第 4 节', 'Continue learning · lesson 4'],
  ['返回基础篇第 3 节：信息从哪里来', 'Return to basics lesson 3: Where information comes from'],
  ['返回进阶篇第 2 节', 'Return to advanced lesson 2'],
  ['词表=27 · 嵌入维数=16 · 头数=4 · 层数=1 · 上下文=16 · 参数=4192', 'vocab=27 · embed=16 · heads=4 · layers=1 · block=16 · params=4192'],
  ['第 11 步 · Loss 0.120 → 0.088', 'Step 11 · Loss 0.120 → 0.088'],
  ['位置 2 的 Query 只能读取位置 0–2。本行权重之和 = 1.000000。', 'Query at position 2 can read only positions 0–2. This row sums to 1.000000.'],
  ['最高概率 n；实际选择 b。', 'Top token n; sampled token b.'],
  ['六关学习回顾 · 已掌握 5/6', 'Six-lesson review · understood 5/6'],
  ['1. 文字变成数字 · 已掌握', '1. Turning text into numbers · Understood'],
  ['Head 3：位置 2 的 m 对位置 0 的 <BOS> 分配 27.4% 权重。未来位置没有 Key/Value 可读。', 'Head 3: m at position 2 assigns 27.4% weight to <BOS> at position 0. Future Keys/Values cannot be read.'],
];
for (const [zh, en] of examples) {
  assert.equal(t(zh, 'en'), en);
  assert.equal(t(en, 'zh'), zh);
}
for (const value of ['emma', '<BOS>', 'js/model.js', '0.088', '∂L/∂weight[j] += (∂L/∂logit) × hidden[j]']) {
  assert.equal(t(value, 'en'), value);
  assert.equal(t(value, 'zh'), value);
}
assert.equal(t('  理解正确。 输入和目标相差一个位置：<BOS> 预测 e，e 预测 m，最后的 a 预测结束标记 <BOS>。目标来自数据中的下一个字符。\n', 'en').startsWith('  Correct.'), true);
assert.equal(t('temperature T=0.50 · probabilities = softmax(logits / T) · result = past', 'zh'), '温度 T=0.50 · 概率 = softmax(logits / T) · 结果 = past');
assert.equal(t('Generated: current · adjust temperature and continue.', 'zh'), '已生成：current · 调整温度，然后继续下一步。');
console.log('PASS: dynamic slots, reversible translation and unchanged model data');

for (const file of ['data/weights.js', 'js/autograd.js', 'js/tokenizer.js', 'js/model.js', 'js/optimizer.js', 'js/app.js']) {
  vm.runInContext(read(file), context, { filename: file });
}
vm.runInContext(`
  tokenizer = new Tokenizer(MICROGPT_WEIGHTS.uchars);
  gpt = createModel(MICROGPT_WEIGHTS);
  fwdTokens = tokenizer.encode('emma');
  fwdKVKeys = [[]]; fwdKVValues = [[]];
  fwdTraces = fwdTokens.slice(0, -1).map((token, pos) => gpt.forward(token, pos, fwdKVKeys, fwdKVValues));
`, context);
for (let pos = 0; pos < 5; pos++) {
  context.position = pos;
  const explanation = vm.runInContext('getPositionExplanation(position, 5, fwdTokens[position], fwdTokens[position+1], fwdTraces[position])', context);
  assert.notEqual(t(explanation.label, 'zh'), explanation.label, explanation.label);
  for (const match of (`<div>${explanation.body}</div>`).matchAll(/>([^<>]+)</g)) {
    const text = decode(match[1]).replace(/\s+/g, ' ').trim();
    if (!/[A-Za-z]{3}/.test(text.replaceAll('<BOS>', ''))) continue;
    assert.notEqual(t(text, 'zh'), text, `Missing position ${pos} fragment: ${text}`);
  }
}
console.log('PASS: sandbox teaching fragments at initial, intermediate and final positions');

// A small DOM fixture exercises original-text bindings without browser dependencies.
const store = new Map([['microgpt.language', 'en']]);
let denyStorage = false;
const selector = { value: '', addEventListener() {} };
const notice = { textContent: '' };
const courseRegion = { lang: '' };
const parent = { closest() { return null; } };
const protectedParent = { closest() { return this; } };
const nodes = [
  { data: '文字变成数字', parentElement: parent },
  { data: '第 11 步 · Loss 0.120 → 0.088', parentElement: parent },
  { data: 'const value = "文字变成数字";', parentElement: protectedParent },
  { data: 'past', parentElement: protectedParent },
];
const inputAttrs = new Map([['placeholder', 'Type a name...']]);
const inputElement = {
  closest() { return null; }, hasAttribute: name => inputAttrs.has(name),
  getAttribute: name => inputAttrs.get(name), setAttribute: (name, value) => inputAttrs.set(name, value),
};
const doc = {
  body: {}, documentElement: { lang: '' }, title: '', addEventListener() {},
  getElementById: id => ({ 'interface-language': selector, 'language-status': notice, 'tab-course': courseRegion }[id]),
  querySelectorAll: () => [inputElement],
  createTreeWalker() {
    let index = 0;
    return { currentNode: null, nextNode() { this.currentNode = nodes[index++]; return Boolean(this.currentNode); } };
  },
};
const fixture = vm.createContext({
  document: doc, NodeFilter: { SHOW_TEXT: 4 },
  MutationObserver: class { observe() {} disconnect() {} },
  localStorage: {
    getItem: key => store.get(key) ?? null,
    setItem(key, value) { if (denyStorage) throw new Error('disabled'); store.set(key, value); },
  },
});
vm.runInContext(read('data/bridge-scenarios.js'), fixture);
vm.runInContext(read('js/i18n.js'), fixture);
vm.runInContext('I18n.init()', fixture);
assert.equal(selector.value, 'en');
assert.equal(nodes[0].data, 'Turning text into numbers');
assert.equal(nodes[1].data, 'Step 11 · Loss 0.120 → 0.088');
assert.equal(doc.documentElement.lang, 'en');
assert.equal(courseRegion.lang, 'en');
for (let i = 0; i < 10; i++) {
  vm.runInContext("I18n.setLanguage('zh'); I18n.setLanguage('en')", fixture);
  assert.equal(nodes[1].data, 'Step 11 · Loss 0.120 → 0.088');
}
nodes[0].data = '生成新名字'; // New content from a renderer must replace the old binding.
vm.runInContext('I18n.apply()', fixture);
assert.equal(nodes[0].data, 'Generate New Names');
vm.runInContext("I18n.setLanguage('zh')", fixture);
assert.equal(nodes[0].data, '生成新名字');
assert.equal(inputAttrs.get('placeholder'), '输入一个名字…');
assert.equal(nodes[2].data, 'const value = "文字变成数字";');
assert.equal(nodes[3].data, 'past');
assert.equal(store.get('microgpt.language'), 'zh');
denyStorage = true;
vm.runInContext("I18n.setLanguage('en')", fixture);
assert.equal(nodes[0].data, 'Generate New Names');
assert.equal(notice.textContent, '无法保存语言偏好；当前页面仍可切换语言。');
vm.runInContext("I18n.setLanguage('invalid')", fixture);
assert.equal(selector.value, 'en');
console.log('PASS: DOM bindings, repeated toggles, dynamic updates, protected source/data and storage fallback');
