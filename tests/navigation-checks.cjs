const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function element(dataset = {}) {
  const attrs = new Map();
  const classes = new Set();
  return { dataset, hidden: false, textContent: '',
    classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) },
    setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name), getAttribute: name => attrs.get(name),
  };
}
const names = ['course', 'bridge', 'forward', 'attention', 'train', 'sample'];
const buttons = names.map(tab => element({ tab }));
const modes = ['courses', 'experiments'].map(mode => element({ mode }));
const panels = names.map(name => Object.assign(element(), { id: `tab-${name}` }));
const elements = Object.fromEntries([...panels.map(panel => [panel.id, panel]), ...['course-nav', 'experiment-nav', 'experiment-return', 'course-return', 'model-info'].map(id => [id, element()])]);
let cleared = 0, left = 0;
const document = {
  addEventListener() {}, getElementById: id => elements[id],
  querySelectorAll: selector => ({ '[data-tab]': buttons, '[data-mode]': modes, '.tab-panel': panels }[selector] || []),
};
const context = vm.createContext({ document, clearTimeout: () => cleared++, BridgeCourse: { leave: () => left++ } });
vm.runInContext(read('js/app.js'), context);
const run = code => vm.runInContext(code, context);
run("setCourseReturn('course', '返回基础篇第 4 节：把错误变成 Loss'); setActiveTab('course')");
assert.equal(elements['course-nav'].hidden, false);
assert.equal(elements['experiment-nav'].hidden, true);
assert.equal(modes[0].getAttribute('aria-current'), 'true');
run("setActiveTab('train')");
assert.equal(elements['course-nav'].hidden, true);
assert.equal(elements['experiment-nav'].hidden, false);
assert.equal(elements['experiment-return'].hidden, false);
assert.equal(elements['course-return'].textContent, '返回基础篇第 4 节：把错误变成 Loss');
assert.equal(buttons.filter(button => button.classList.contains('active')).length, 1);
assert.equal(buttons.find(button => button.dataset.tab === 'train').getAttribute('aria-current'), 'page');
assert.equal(modes[1].classList.contains('active'), true);
assert.equal(panels.filter(panel => !panel.hidden).length, 1);
assert.equal(run('lastCourseTab'), 'course');
assert.equal(run('lastExperimentTab'), 'train');
const revision = run('trainingRunRevision');
run("setActiveTab('train')");
assert.equal(run('trainingRunRevision'), revision, 'Reopening the same lab must preserve its run');
run("setActiveTab('course')");
assert.equal(run('trainingRunRevision'), revision + 1, 'Leaving a tab cancels remaining async training steps');
assert.equal(elements['experiment-return'].hidden, true);
run("setActiveTab('bridge'); setCourseReturn('bridge', '返回进阶篇第 2 节'); setActiveTab('sample')");
assert.equal(left, 1, 'Leaving advanced lessons pauses bridge playback');
assert.equal(run('lastCourseTab'), 'bridge');
assert.equal(run('lastExperimentTab'), 'sample');
assert.equal(elements['course-return'].textContent, '返回进阶篇第 2 节');
assert.ok(cleared >= 4);
const html = read('index.html');
assert.ok(!html.includes('learning-path'));
assert.match(html, /class="tab-panel active" id="tab-course"/);
for (const name of names) assert.match(html, new RegExp(`aria-controls="tab-${name}"`));
assert.ok(!read('js/course.js').includes('learning-path'));
console.log('PASS: two-level navigation, independent remembered destinations, contextual course returns, visible/aria state and playback/training exit cancellation');
