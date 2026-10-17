// Guided curriculum. Only versioned learning progress is persisted, never model state.
const Course = (() => {
  const KEY = 'microgpt.course.v2', LEGACY_KEY = 'microgpt.course.v1';
  const lessons = BeginnerData.lessons;
  const legacyMap = ['A1', 'B3', 'C3', 'D1', 'D2', 'E1'];
  const $ = id => document.getElementById(id);
  const h = (en, zh) => I18n.language === 'en' ? en : zh;
  const tr = value => I18n.translate(value);
  const esc = value => escapeHtml(String(value));
  const fmt = value => Number(value).toFixed(6);
  const simpleNumber = value => String(Number(Number(value).toFixed(4)));
  const rowText = (values, format = fmt) => '[' + values.map(format).join(', ') + ']';
  const span = (en, zh) => `<span>${h(en, zh)}</span>`;
  const softmax = values => { const max = Math.max(...values), exps = values.map(v => Math.exp(v - max)), total = exps.reduce((a,b) => a+b,0); return exps.map(v => v/total); };
  const dot = (x,w) => x.reduce((sum,v,i) => sum + v*w[i],0);
  const toy = { characters: ['a','b','c'], embeddings: [[1,2,-1],[0,1,1],[-1,0,2]], weights: [[1,0,1],[0,1,0],[-1,0,1]], order: [0,1,2], character: 0, candidate: 0, dimensions: 1, products: 0, mix: .25 };
  let state = freshProgress(), storageAvailable = true, restored = false;
  let traces = [], selectedCandidate = 12, selectedComponent = 0, selectedPosition = 1, head = 0, projection = 'q';
  let experiments = new Set(), trainingModel, optimizer, trainingResult, gradientResult, trainedSteps = 0, sampling;
  let sourceLanguage = 'js', sourceOpen = false, sourceRevision = 0, summaryOpen = false;
  const sourceCache = new Map();
  function freshProgress() { return { version: 2, currentLesson: 'A1', visited: [], checks: {}, finished: false }; }
  function migrate(legacy) {
    const progress = freshProgress();
    if (!legacy || legacy.version !== 1) return progress;
    progress.currentLesson = legacyMap[legacy.lesson] || 'A1';
    // Preserve old evidence, but never claim new checks have been mastered.
    progress.legacy = { version: 1, lesson: legacy.lesson, answers: { ...legacy.answers }, finished: legacy.finished === true };
    return progress;
  }
  function restore() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY));
      if (stored?.version === 2) {
        state = freshProgress();
        if (lessons.some(l => l.id === stored.currentLesson)) state.currentLesson = stored.currentLesson;
        state.visited = Array.isArray(stored.visited) ? stored.visited.filter(id => lessons.some(l => l.id === id)) : [];
        for (const lesson of lessons) { const answer = stored.checks?.[lesson.id]; if (Number.isInteger(answer) && answer >= -1 && answer < lesson.choices.length) state.checks[lesson.id] = answer; }
        state.finished = stored.finished === true;
        if (stored.legacy) state.legacy = stored.legacy;
        restored = true;
      } else {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
        if (legacy?.version === 1) { state = migrate(legacy); restored = true; }
      }
    } catch (error) { if (error.name !== 'SyntaxError') storageAvailable = false; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { storageAvailable = false; } }
  function resetTraining() { trainingModel = createModel(createRandomWeightData()); optimizer = new Adam(trainingModel.params,.01,.85,.99,1e-8); trainingResult = null; gradientResult = null; trainedSteps = 0; }
  function resetSampling() { sampling = { keys: Array.from({length:gpt.nLayer},() => []), values:Array.from({length:gpt.nLayer},() => []), next:tokenizer.BOS, tokens:[], rows:[], random:seededRandom(2026), ended:false, temperature:.5 }; }
  function init() {
    restore(); resetTraining(); resetSampling();
    const tokens = tokenizer.encode('emma'), keys = Array.from({length:gpt.nLayer},() => []), values = Array.from({length:gpt.nLayer},() => []);
    traces = tokens.slice(0,-1).map((token,pos) => gpt.forward(token,pos,keys,values));
    selectedComponent = Math.max(0,traces[1].layers[0].mlpPreAct.findIndex(v => v < 0));
    open();
  }
  function current() { return lessons.find(l => l.id === state.currentLesson) || lessons[0]; }
  function open() { setActiveTab('course'); visit(); render(); }
  function visit() { if (!state.visited.includes(state.currentLesson)) state.visited.push(state.currentLesson); save(); }
  function navigate(id) {
    if (!lessons.some(l => l.id === id)) return;
    state.currentLesson = id; sourceOpen = false; visit(); render();
    $('course-title').focus({ preventScroll: true });
    $('course-title').scrollIntoView({ block: 'start' });
  }
  function status(lesson) { const answer = state.checks[lesson.id]; return answer === undefined ? h('Not checked','待理解') : answer === -1 ? h('Skipped','已跳过') : answer === lesson.correct ? h('Understood','已掌握') : h('Try again','可重试'); }
  function table(headers, rows, caption = '') { return `<div class="course-table-wrap"><table class="course-table">${caption ? `<caption>${caption}</caption>` : ''}<thead><tr>${headers.map(s => `<th scope="col">${s}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(s => `<td>${s}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
  function select(id, label, values, selected) { return `<label for="${id}">${label}</label> <select id="${id}">${values.map(([value,name]) => `<option value="${value}" ${String(value) === String(selected) ? 'selected' : ''}>${name}</option>`).join('')}</select>`; }
  function formula(index) { return lessons[index]?.formula || ''; }
  function render() {
    const lesson = current(), index = lessons.indexOf(lesson), mastered = lessons.filter(l => state.checks[l.id] === l.correct).length;
    const root = $('tab-course'); root.setAttribute('data-no-i18n',''); root.lang = I18n.language === 'en' ? 'en' : 'zh-CN';
    root.setAttribute('aria-label', h('GPT guided course', 'GPT 引导课程'));
    setCourseReturn('course', h(`Return to basics ${lesson.id}: ${lesson.title}`,`返回基础篇 ${lesson.id}：${tr(lesson.title)}`));
    $('model-info').hidden = index < 7;
    root.innerHTML = `<div class="course-header">
      <h2>${h('Follow the numbers, one step at a time','沿着数字，一步步理解 GPT')}</h2>
      <div class="course-progress"><label for="course-progress">${h('Understood','已掌握')} ${mastered} / ${lessons.length}</label><progress id="course-progress" max="${lessons.length}" value="${mastered}"></progress></div>
      <details class="course-intro" id="course-intro"><summary>${h('About this course and your progress','课程说明与学习记录')}</summary>
        <p>${h('No programming or machine-learning background required. All lessons and experiments are open; checks never lock navigation.','无需编程或机器学习基础。所有小节与实验随时可进，理解题不锁定导航。')}</p>
        <p id="course-storage-note">${!storageAvailable ? h('Progress cannot be saved in this browser.','当前浏览器无法保存进度。') : restored ? h('Progress restored; model weights and running experiments start fresh after refresh.','已恢复学习进度；刷新后模型权重与运行实验重新开始。') : h('Progress is saved in this browser. Experiment state stays in this page only.','进度保存在本浏览器，实验状态仅保留在当前页面。')}</p>
        ${state.legacy ? `<p>${h('Your old record is preserved; new checks start unanswered. Start at A1 or continue from the suggested lesson.','旧版记录已保留，新增理解题均未作答。可从 A1 开始，或从建议小节继续。')}</p><details><summary>${h('View preserved legacy record','查看保留的旧版记录')}</summary><pre>${esc(JSON.stringify(state.legacy,null,2))}</pre></details>` : ''}
        <div class="btn-group"><button class="btn" id="course-restart">${h('Start at A1','从 A1 开始')}</button><button class="btn" id="course-exit">${h('Open free experiments','进入自由实验')}</button></div>
      </details>
      ${!storageAvailable ? `<p class="course-storage-warning" role="status">${h('Progress cannot be saved in this browser.','当前浏览器无法保存进度。')}</p>` : ''}
    </div>
    <nav class="course-directory" id="course-directory" aria-label="${h('Course navigation','课程导航')}">
      <div class="course-nav-field">${select('course-stage',h('Stage','阶段'),BeginnerData.stages.map(([id,title]) => [id,esc(tr(title))]),lesson.stage)}</div>
      <div class="course-nav-field">${select('course-lesson',h('Lesson','小节'),lessons.filter(l => l.stage === lesson.stage).map(l => [l.id,`${l.id} · ${esc(tr(l.title))} · ${status(l)}`]),lesson.id)}</div>
      <div class="course-nav-actions"><button class="btn" id="course-nav-prev" ${index === 0 ? 'disabled' : ''}>${h('Previous','上一节')}</button><button class="btn" id="course-nav-next">${index === lessons.length-1 ? h('Review','回顾') : h('Next','下一节')}</button></div>
    </nav>
      <div class="course-layout"><main><section class="course-card"><div class="course-kicker">${lesson.id} · ${index+1} / ${lessons.length}</div><h3 id="course-title" tabindex="-1">${esc(tr(lesson.title))}</h3><p><strong>${esc(tr(lesson.question))}</strong></p><p>${esc(tr(lesson.intro))}</p>${index ? `<p>${h('Already know','已经知道')}：<button class="btn" id="course-prerequisite">${lessons[index-1].id} · ${esc(tr(lessons[index-1].title))}</button></p>` : ''}</section>
      <section class="course-card course-experiment" aria-label="${h('Lesson experiment','本节实验')}"><h3>${h('Try it and trace the numbers','亲手操作，追踪数字')}</h3><p class="course-example-label">${lesson.id === 'A1' ? h('Real character tokenizer: a–z plus BOS. IDs are addresses, not trained parameters.','真实字符编码器：a–z 加 BOS；ID 是地址，不是训练的参数。') : index < 7 ? h('Teaching example: 3 numbers, 3 candidates. Parameters are manually chosen, untrained; this is not the full GPT.','教学示例：3 个数、3 个候选；参数人为设置、未训练，不是完整 GPT。') : lesson.type === 'mix' ? h('Teaching operation: manually assigned mixing weights; not real attention weights.','教学运算：人工指定混合权重，不是真实注意力权重。') : lesson.stage === 'D' && lesson.id !== 'D1' ? h('Independent training model: fixed-seed initial parameters, separate from free experiments.','独立训练模型：固定种子初始参数，与自由实验隔离。') : h('Real model: 16 numbers, 27 candidates (a–z and BOS). Stored parameters were trained; current states are computed.','真实模型：16 个数、27 个候选（a–z 与 BOS）。存储的参数已训练，当前状态由计算得到。')}</p>${controls(lesson)}<div class="btn-group"><button class="btn primary" id="course-action">${esc(tr(lesson.action))}</button><button class="btn" id="course-reset">${h('Reset this experiment','重置本节实验')}</button></div><div class="course-result" id="course-result" aria-live="polite"></div></section>
      <section class="course-card"><h3>${h('Check your understanding','检查一下理解')}</h3><p>${esc(tr(lesson.quiz))}</p><div class="course-choices">${lesson.choices.map((choice,i) => `<button data-answer="${i}" aria-pressed="${state.checks[lesson.id] === i}">${esc(tr(choice))}</button>`).join('')}</div><button class="btn" id="course-skip">${h('Skip this check','跳过本题')}</button><div class="course-feedback" id="course-feedback" role="status"></div></section>
      <div class="course-navigation"><button class="btn" id="course-prev" ${index === 0 ? 'disabled' : ''}>${h('Previous','上一节')}</button><button class="btn primary" id="course-next">${index === lessons.length-1 ? h('Review learning','学习回顾') : `${h('Next','下一节')}：${esc(tr(lessons[index+1].question))}`}</button></div><div id="course-summary"></div></main>
      <aside><section class="course-card"><h3>${h('Take this with you','记住这一点')}</h3><p>${esc(tr(lesson.take))}</p><p>${index < 7 ? h('The free lab runs the full model. Parts you have not learned yet will be explained later. Your return link keeps this lesson.','自由实验运行完整模型，尚未学过的部分会在后续解释；返回入口保留本节位置。') : h('Explore this operation in the full model and return to this lesson.','可在完整模型中探索本节操作，再返回这里。')}</p><button class="btn" id="course-explore">${h('Open the related free experiment','打开对应自由实验')}</button></section>
      <details class="course-card" id="course-source" ${sourceOpen ? 'open' : ''}><summary>${h('View formulas and actual code','查看公式与实际代码')}</summary><p class="equation">${esc(lesson.formula)}</p>${select('course-language',h('Code language','代码语言'),[['js','JavaScript'],['py','Python']],sourceLanguage)}<p id="course-code-path"></p><pre class="course-code" id="course-code" data-source tabindex="0" aria-label="${h('Actual local source','实际本地源码')}"></pre><p>${h('JavaScript is the running implementation. Python is the local teaching adaptation, not a live copy of upstream code.','JavaScript 是实际运行实现；Python 是本地教学改编，并非实时上游源码。')}</p></details>${index >= 7 ? `<details class="course-card"><summary>${h('Real model dimensions','真实模型规模')}</summary><p>27 × 16 · ${h('4 heads × 4 components','4 头 × 4 分量')} · MLP 16 → 64 → 16 · ${gpt.params.length} ${h('parameters','参数')}</p></details>` : ''}</aside></div>`;
    $('course-restart').onclick = () => navigate('A1');
    $('course-exit').onclick = $('course-explore').onclick = () => exit(lesson.tab);
    $('course-stage').onchange = event => {
      const first = lessons.find(item => item.stage === event.target.value);
      if (first) navigate(first.id);
    };
    $('course-lesson').onchange = event => navigate(event.target.value);
    $('course-nav-prev').onclick = () => { if (index > 0) navigate(lessons[index-1].id); };
    $('course-nav-next').onclick = () => index < lessons.length-1 ? navigate(lessons[index+1].id) : summary();
    if ($('course-prerequisite')) $('course-prerequisite').onclick = () => navigate(lessons[index-1].id);
    document.querySelectorAll('[data-answer]').forEach(button => button.onclick = () => { state.checks[lesson.id] = Number(button.dataset.answer); save(); feedback(); });
    $('course-skip').onclick = () => { state.checks[lesson.id] = -1; save(); feedback(); };
    $('course-prev').onclick = () => navigate(lessons[index-1].id);
    $('course-next').onclick = () => index < lessons.length-1 ? navigate(lessons[index+1].id) : summary();
    $('course-action').onclick = runExperiment;
    $('course-reset').onclick = resetExperiment;
    $('course-source').ontoggle = () => { sourceOpen = $('course-source').open; if (sourceOpen) renderCode(); };
    $('course-language').onchange = event => { sourceLanguage = event.target.value; renderCode(); };
    bindControls(); feedback(); showResult(); if (sourceOpen) renderCode(); if (summaryOpen && lesson.id === 'E2') summary(false);
    $('step-info').textContent = h('Guided lessons and free experiments keep separate state.','课程与自由实验保持独立状态。');
  }
  function controls(lesson) {
    if (['lookup','one-score','many-scores','softmax','addresses'].includes(lesson.type)) return select('course-character',h('Input character (state row)','输入字符（状态行）'),toy.characters.map((s,i) => [i,s]),toy.character) + (['one-score','many-scores'].includes(lesson.type) ? ' '+select('course-candidate',h('Candidate parameter row','候选参数行'),toy.characters.map((s,i) => [i,s]),toy.candidate) : '') + (lesson.type === 'many-scores' ? `<p><label for="course-weight">${h('Manual adjustment: selected candidate weight[0]','手动调整：所选候选 weight[0]')}</label> <input id="course-weight" type="number" min="-5" max="5" step="0.25" value="${toy.weights[toy.candidate][0]}"></p>` : '');
    if (lesson.type === 'mix') return `<label for="course-mix">${h('Manually assigned first weight','人工指定第一个权重')}</label><input id="course-mix" type="range" min="0" max="1" step="0.05" value="${toy.mix}">`;
    if (['generate','temperature'].includes(lesson.type)) return `<label for="course-temperature">${h('Temperature for the next step','下一步温度')} <output id="course-temperature-value">${sampling.temperature.toFixed(2)}</output></label><input id="course-temperature" type="range" min="0.1" max="1.5" step="0.05" value="${sampling.temperature}">`;
    if (lesson.type === 'position') return select('course-position',h('Input position','输入位置'),tokenizer.encode('emma').slice(0,-1).map((token,i) => [i,`${i}: ${esc(tokenizer.tokenToDisplay(token))}`]),selectedPosition);
    if (lesson.type === 'mlp') return select('course-component',h('Inspect expanded component','检查展开后的分量'),Array.from({length:64},(_,i) => [i,i]),selectedComponent);
    if (['attention','values','pipeline'].includes(lesson.type)) return select('course-head',h('Attention head','注意力头'),Array.from({length:gpt.nHead},(_,i) => [i,i]),head) + (lesson.type === 'attention' ? ' ' + select('course-projection',h('Inspect projection row','检查投影行'),[['q','Query'],['k','Key']],projection) : '');
    return '';
  }
  function bindControls() {
    const on = (id, event, fn) => { if ($(id)) $(id)[event] = fn; };
    on('course-character','onchange',event => { toy.character = Number(event.target.value); toy.products = 0; showResult(); });
    on('course-candidate','onchange',event => { toy.candidate = Number(event.target.value); toy.products = 0; if ($('course-weight')) $('course-weight').value = toy.weights[toy.candidate][0]; showResult(); });
    on('course-weight','oninput',event => { const value = Number(event.target.value); if (!Number.isFinite(value)) return; toy.weights[toy.candidate][0] = Math.max(-5,Math.min(5,value)); showResult(); });
    on('course-mix','oninput',event => { toy.mix = Number(event.target.value); experiments.add('C2'); showResult(); });
    on('course-temperature','oninput',event => { sampling.temperature = Number(event.target.value); $('course-temperature-value').textContent = sampling.temperature.toFixed(2); if (current().type === 'temperature') showResult(); });
    on('course-position','onchange',event => { selectedPosition = Number(event.target.value); showResult(); });
    on('course-component','onchange',event => { selectedComponent = Number(event.target.value); showResult(); });
    on('course-head','onchange',event => { head = Number(event.target.value); showResult(); });
    on('course-projection','onchange',event => { projection = event.target.value; showResult(); });
  }
  function feedback() {
    const lesson = current(), answer = state.checks[lesson.id];
    document.querySelectorAll('[data-answer]').forEach(button => button.setAttribute('aria-pressed',Number(button.dataset.answer) === answer));
    $('course-feedback').textContent = answer === undefined ? h('Answer when ready; simply opening the experiment does not mark understanding.','准备好再作答；打开实验不会自动标记掌握。') : (answer === -1 ? h('Skipped. You can return at any time. ','已跳过，可随时回来。') : answer === lesson.correct ? h('Correct. ','理解正确。') : h('Try again: compare the inputs, parameter row, and operation above. ','再想一下：对照上方的输入、参数行和运算步骤。')) + tr(lesson.take);
    const count = lessons.filter(l => state.checks[l.id] === l.correct).length;
    $('course-progress').value = count;
    document.querySelector('[for="course-progress"]').textContent = `${h('Understood','已掌握')} ${count} / ${lessons.length}`;
    const stageLessons = lessons.filter(item => item.stage === lesson.stage);
    document.querySelectorAll('#course-lesson option').forEach((option,i) => {
      const item = stageLessons[i];
      option.textContent = `${item.id} · ${tr(item.title)} · ${status(item)}`;
    });
  }
  function exit(tab) { ({forward:tabForwardPass,train:tabTrain,sample:tabSample,attention:tabAttention})[tab](); $('model-info').hidden = false; document.querySelector(`[data-tab="${tab}"]`).focus(); }
  function resetExperiment() {
    const type = current().type;
    if (['gradient','train'].includes(type)) { resetTraining(); experiments.delete('D2'); experiments.delete('D3'); }
    else if (['generate','temperature'].includes(type)) { resetSampling(); experiments.delete('E1'); experiments.delete('E2'); if ($('course-temperature')) { $('course-temperature').value = sampling.temperature; $('course-temperature-value').textContent = sampling.temperature.toFixed(2); } }
    else if (current().stage === 'A' || (current().stage === 'B' && current().id !== 'B4')) { toy.embeddings = [[1,2,-1],[0,1,1],[-1,0,2]]; toy.weights = [[1,0,1],[0,1,0],[-1,0,1]]; toy.order = [0,1,2]; toy.character = 0; toy.candidate = 0; toy.dimensions = 1; toy.products = 0; for (const lesson of lessons.filter(l => ['A','B'].includes(l.stage) && l.id !== 'B4')) experiments.delete(lesson.id); render(); return; }
    else {
      experiments.delete(current().id);
      if (type === 'mix') { toy.mix = .25; $('course-mix').value = toy.mix; }
      if (type === 'position') { selectedPosition = 1; $('course-position').value = selectedPosition; }
      if (type === 'mlp') { selectedComponent = 0; $('course-component').value = selectedComponent; }
      if (['attention','values','pipeline'].includes(type)) { head = 0; projection = 'q'; $('course-head').value = head; if ($('course-projection')) $('course-projection').value = projection; }
      if (['real-score','pipeline'].includes(type)) selectedCandidate = 12;
    }
    showResult();
  }
  function runExperiment() {
    const lesson = current();
    if (lesson.type === 'addresses') toy.order.push(toy.order.shift());
    if (lesson.type === 'dimensions') toy.dimensions = Math.min(3,toy.dimensions+1);
    if (lesson.type === 'one-score') toy.products = Math.min(3,toy.products+1);
    if (lesson.type === 'gradient') perturb();
    if (lesson.type === 'train') train();
    if (['generate','temperature'].includes(lesson.type)) nextSample();
    experiments.add(lesson.id); showResult();
  }
  function products(x,w,limit = x.length, format = fmt) {
    let total = 0;
    return table([h('Component','分量'),h('Input state','输入状态'),h('Parameter weight','参数权重'),h('Product','乘积'),h('Running sum','累计和')], x.slice(0,limit).map((value,i) => { const product = value*w[i]; total += product; return [i,format(value),format(w[i]),`${format(value)} × ${format(w[i])} = ${format(product)}`,format(total)]; }));
  }
  function teachingResult(type) {
    const x = toy.embeddings[toy.character], w = toy.weights[toy.candidate], logits = toy.weights.map(row => dot(x,row)), probs = softmax(logits);
    const input = `<p>${h('Current input state','当前输入状态')} x = <code>${rowText(x, simpleNumber)}</code> · ${h('Selected character','所选字符')} ${toy.characters[toy.character]}</p>`;
    if (type === 'tokens') { const tokens = tokenizer.encode('emma'); return table([h('Position','位置'),h('Current character','当前字符'),'Token ID',h('Next target','下一个目标')],tokens.slice(0,-1).map((token,i) => [i,tokenToHtml(token),token,tokenToHtml(tokens[i+1])])); }
    if (type === 'addresses' || type === 'lookup') return input + table([h('Address ID','地址 ID'),h('Character','字符'),h('Stored parameter row','存储的参数行')],toy.order.map((character,address) => [address,`<button data-toy-row="${character}" aria-pressed="${character === toy.character}">${toy.characters[character]}</button>`,rowText(toy.embeddings[character], simpleNumber)])) + `<p>${h('Retrieved by character → its current address → stored row. Reordering changes addresses, not row values.','按字符 → 当前地址 → 存储行取数。重排改变地址，不改变行数值。')}</p>`;
    if (type === 'dimensions') return `<div class="course-tokens">${x.map((value,i) => `<span class="course-token">${i < toy.dimensions ? value : '?'}<small>${h('Component','分量')} ${i+1}</small></span>`).join('')}</div><p>${toy.dimensions} ${h('visible components; three-dimensional means three boxes.','个可见分量；三维就是三格。')}</p>`;
    if (type === 'one-score') return input + `<p>${h('Candidate parameter row','候选参数行')} ${toy.characters[toy.candidate]} = <code>${rowText(w, simpleNumber)}</code></p>` + products(x,w,toy.products,simpleNumber) + `<p>${h('Revealed products','已计算乘积')} ${toy.products}/3 · ${h('Current sum','当前累计和')} = ${simpleNumber(dot(x.slice(0,toy.products),w))}</p>`;
    if (type === 'many-scores') return input + table([h('Candidate','候选'),h('Parameter row','参数行'),h('Products','乘积'),'Logit'],toy.weights.map((row,i) => [toy.characters[i],rowText(row, simpleNumber),rowText(row.map((v,j) => v*x[j]), simpleNumber),simpleNumber(logits[i])])) + `<p>${h('Selected candidate products; the input row above is unchanged. Manual edits change parameters, not automatic learning.','所选候选的乘积如下；上方输入行不随候选改变。手动编辑改变参数，不是自动学习。')}</p>` + products(x,w,x.length,simpleNumber);
    const exps = logits.map(Math.exp), total = exps.reduce((a,b) => a+b,0);
    return input + table([h('Candidate','候选'),'z','exp(z)',h('All-candidate denominator','全部候选分母'),h('Probability','概率')],logits.map((z,i) => [toy.characters[i],simpleNumber(z),fmt(exps[i]),fmt(total),`${fmt(exps[i])} / ${fmt(total)} = ${(probs[i]*100).toFixed(2)}%`])) + `<p>Σ p = ${fmt(probs.reduce((a,b) => a+b,0))} · ${h('The actual implementation subtracts the largest score before exp for numerical stability; probabilities stay the same.','实际实现先减去最大分数再做 exp，防止数值溢出；概率不变。')}</p>`;
  }
  function numericDetails(title, values) { return `<details><summary>${title}</summary><code>${rowText(values)}</code></details>`; }
  function linearDetails(title,x,matrix,output) { return `<details><summary>${title}</summary><p>${h('Input state','输入状态')} <code>${rowText(x)}</code></p>${matrix.map((w,i) => `<details><summary>${h('Output component','输出分量')} ${i} = ${fmt(output[i])}</summary>${products(x,w.map(v => v.data))}</details>`).join('')}</details>`; }
  function scoreResult(trace = traces[1]) {
    const w = gpt.stateDict.lm_head[selectedCandidate].map(v => v.data);
    const exps = trace.logits.map(z => Math.exp(z-Math.max(...trace.logits))), total = exps.reduce((a,b) => a+b,0);
    return `<p>${h('Real context: BOS, e. This final state already includes position and context; C1–C8 explain its source.','真实上下文：BOS、e。这是已结合位置和前文的最终状态，C1–C8 解释来源。')}</p><div class="course-comparison"><div>${h('Teaching state: 3 components / 3 candidates','教学状态：3 分量 / 3 候选')}<code>[1, 2, −1]</code></div><div>${h('Real final state: 16 components / 27 candidates','真实最终状态：16 分量 / 27 候选')}<code>${rowText(trace.finalHidden)}</code></div></div>${select('course-real-candidate',h('Trace candidate','追踪候选'),trace.logits.map((_,i) => [i,esc(tokenizer.tokenToDisplay(i))]),selectedCandidate)}<p>${h('Output scoring table parameter row (separate from embedding)','输出评分表参数行（不同于字符表）')} <code>${rowText(w)}</code></p>${products(trace.finalHidden,w)}<p>logit = ${fmt(dot(trace.finalHidden,w))} · ${h('Actual trace','实际轨迹')} = ${fmt(trace.logits[selectedCandidate])}</p><details open><summary>${h('All 27 scores and probabilities; denominator includes all 27','全部 27 项分数与概率；分母包含全部 27 项')}</summary>${table([h('Candidate','候选'),'logit','exp(z − max)',h('Denominator','分母'),h('Probability','概率')],trace.logits.map((z,i) => [tokenToHtml(i),fmt(z),fmt(exps[i]),fmt(total),`${(trace.probs[i]*100).toFixed(4)}%`]))}<p>Σ p = ${fmt(trace.probs.reduce((a,b) => a+b,0))}</p></details><p>${h('Numbers shown are rounded. All calculations use full precision.','显示数字经过取整，计算使用完整精度。')}</p>`;
  }
  function positionResult() {
    const trace = traces[selectedPosition];
    return table([h('Component','分量'),`wte[${tokenizer.encode('emma')[selectedPosition]}]`, `wpe[${selectedPosition}]`,h('Sum before normalization','调整尺度前之和')],trace.tokEmb.map((v,i) => [i,fmt(v),fmt(trace.posEmb[i]),`${fmt(v)} + ${fmt(trace.posEmb[i])} = ${fmt(trace.embeddingSum[i])}`])) + `<p>${h('Character ID and position ID select different tables. Compare positions 2 and 3: both are m, but their position rows differ.','字符 ID 与位置 ID 选择不同表。比较位置 2 和 3：都是 m，但位置行不同。')}</p>`;
  }
  function normResult(input = traces[1].embeddingSum, output = traces[1].xAfterEmb) {
    const squares = input.map(v => v*v), mean = squares.reduce((a,b) => a+b,0)/input.length, divisor = Math.sqrt(mean+1e-5);
    return table([h('Component','分量'),'x','x × x',h('Shared divisor','统一除数'),'x / divisor'],input.map((v,i) => [i,fmt(v),fmt(squares[i]),fmt(divisor),fmt(output[i])])) + `<p>mean(x²) = ${fmt(mean)}; √(${fmt(mean)} + 0.00001) = ${fmt(divisor)}</p>`;
  }
  function attentionResult(valuesOnly = false) {
    const trace = traces[1], lt = trace.layers[0], offset = head*gpt.headDim;
    const selectedProjection = valuesOnly ? 'v' : projection;
    const matrix = gpt.stateDict[`layer0.attn_w${selectedProjection}`];
    const result = `<p>${h('Query position 1 (e); only positions 0 and 1 are available. Positions 2 onward are masked, not assigned small probabilities.','Query 位置 1（e）；仅位置 0 和 1 可读。位置 2 之后被遮挡，不是概率很小。')}</p>${linearDetails(`${selectedProjection.toUpperCase()} = W × ${h('adjusted state','调整后的状态')}`,lt.attnInput,matrix,lt[selectedProjection])}`;
    const scores = table([h('Visible position','可见位置'),h('Q × K products','Q × K 乘积'),'Σ / √4',h('Attention weight','注意力权重')],traces.slice(0,2).map((t,pos) => {
      const products = lt.q.slice(offset,offset+4).map((q,j) => q*t.layers[0].k[offset+j]);
      return [pos,rowText(products),`${fmt(products.reduce((a,b) => a+b,0))} / 2 = ${fmt(lt.attnLogits[head][pos])}`,fmt(lt.attnWeights[head][pos])];
    }));
    const visibleExps = lt.attnLogits[head].map(score => Math.exp(score-Math.max(...lt.attnLogits[head]))), visibleTotal = visibleExps.reduce((a,b) => a+b,0);
    const normalization = table([h('Visible position','可见位置'),'exp(score − max)',h('Visible-position denominator','可见位置分母'),h('Weight','权重')],visibleExps.map((value,i) => [i,fmt(value),fmt(visibleTotal),`${fmt(value)} / ${fmt(visibleTotal)} = ${fmt(lt.attnWeights[head][i])}`]));
    if (!valuesOnly) return result + scores + normalization + `<p>${h('Apply the same Softmax operation learned in B3 over the visible positions.','对可见位置应用 B3 学过的 Softmax。')} Σ = ${fmt(lt.attnWeights[head].reduce((a,b) => a+b,0))}</p>`;
    return result + scores + table([h('Head component','头内分量'),h('Position 0 contribution','位置 0 贡献'),h('Position 1 contribution','位置 1 贡献'),h('Mixed output','混合输出')],Array.from({length:4},(_,j) => { const parts = traces.slice(0,2).map((t,pos) => lt.attnWeights[head][pos]*t.layers[0].v[offset+j]); return [j,`${fmt(lt.attnWeights[head][0])} × ${fmt(traces[0].layers[0].v[offset+j])} = ${fmt(parts[0])}`,`${fmt(lt.attnWeights[head][1])} × ${fmt(lt.v[offset+j])} = ${fmt(parts[1])}`,fmt(lt.attnConcat[offset+j])]; })) + numericDetails(h('Concatenate four heads: 16 numbers','拼接四个头：16 个数'),lt.attnConcat) + linearDetails(h('Output projection: 16 → 16','输出投影：16 → 16'),lt.attnConcat,gpt.stateDict['layer0.attn_wo'],lt.attnProjection);
  }
  function mlpResult() {
    const lt = traces[1].layers[0];
    return `<p>${h('Selected expanded component','所选展开分量')} ${selectedComponent}: ${fmt(lt.mlpPreAct[selectedComponent])} → ReLU → ${fmt(lt.mlpPostAct[selectedComponent])}</p><details><summary>${h('Trace the selected component: 16 products','追踪所选分量：16 项乘积')}</summary>${products(lt.mlpInput,gpt.stateDict['layer0.mlp_fc1'][selectedComponent].map(v => v.data))}</details>` + linearDetails(h('First projection: 16 → 64; inspect any row','第一次投影：16 → 64；可检查每一行'),lt.mlpInput,gpt.stateDict['layer0.mlp_fc1'],lt.mlpPreAct) + `<details><summary>${h('All 64 ReLU inputs and outputs','全部 64 项 ReLU 输入与输出')}</summary>` + table([h('Component','分量'),h('Before ReLU','ReLU 前'),h('After ReLU: max(0, x)','ReLU 后：max(0, x)')],lt.mlpPreAct.map((v,i) => [i,fmt(v),fmt(lt.mlpPostAct[i])])) + '</details>' + linearDetails(h('Second projection: 64 → 16','第二次投影：64 → 16'),lt.mlpPostAct,gpt.stateDict['layer0.mlp_fc2'],lt.mlpProjection);
  }
  function residualResult() { const lt = traces[1].layers[0]; return table([h('Component','分量'),h('Original branch','原始分支'),h('Processed branch','加工分支'),h('Sum','相加结果')],lt.xAfterAttn.map((v,i) => [i,fmt(v),fmt(lt.mlpProjection[i]),`${fmt(v)} + ${fmt(lt.mlpProjection[i])} = ${fmt(lt.xAfterMlp[i])}`])); }
  function pipelineResult() {
    const t = traces[1], lt = t.layers[0];
    return `<ol class="course-pipeline"><li><details><summary>${h('Character table + position table','字符表 + 位置表')}</summary>${table(['j','wte','wpe','sum'],t.tokEmb.map((v,i) => [i,fmt(v),fmt(t.posEmb[i]),fmt(t.embeddingSum[i])]))}</details></li><li><details><summary>RMSNorm</summary>${normResult()}</details></li><li><details><summary>${h('Attention pre-normalization','注意力前尺度调整')}</summary>${normResult(t.xAfterEmb,lt.attnInput)}</details></li><li><details><summary>${h('Q/K/V and causal multi-head attention','Q/K/V 与因果多头注意力')}</summary>${attentionResult(true)}${linearDetails(h('Query projection','Query 投影'),lt.attnInput,gpt.stateDict['layer0.attn_wq'],lt.q)}${linearDetails(h('Key projection','Key 投影'),lt.attnInput,gpt.stateDict['layer0.attn_wk'],lt.k)}${numericDetails(h('All values','全部 Value'),lt.v)}</details></li><li><details><summary>${h('Attention projection + residual','注意力投影 + 残差')}</summary>${table(['j',h('Original','原始'),h('Projection','投影'),h('Sum','和')],lt.attnResidual.map((v,i) => [i,fmt(v),fmt(lt.attnProjection[i]),fmt(lt.xAfterAttn[i])]))}</details></li><li><details><summary>${h('MLP pre-normalization','MLP 前尺度调整')}</summary>${normResult(lt.xAfterAttn,lt.mlpInput)}</details></li><li><details><summary>${h('Linear → ReLU → linear','线性 → ReLU → 线性')}</summary>${mlpResult()}</details></li><li><details><summary>${h('MLP residual → final state','MLP 残差 → 最终状态')}</summary>${residualResult()}</details></li><li><details open><summary>${h('Output scoring table → all 27 probabilities','输出评分表 → 全部 27 项概率')}</summary>${scoreResult()}</details></li></ol>`;
  }
  function lossResult() { const tokens = tokenizer.encode('emma'), losses = traces.map((t,i) => -Math.log(t.probs[tokens[i+1]])); return table([h('Input → true target','输入 → 真实目标'),h('Target probability','目标概率'),'−ln(p)'],losses.map((loss,i) => [`${tokenToHtml(tokens[i])} → ${tokenToHtml(tokens[i+1])}`,`${(traces[i].probs[tokens[i+1]]*100).toFixed(4)}%`,fmt(loss)])) + `<p>${h('Mean document loss','文档平均损失')} = (${losses.map(fmt).join(' + ')}) / ${losses.length} = ${fmt(losses.reduce((a,b) => a+b,0)/losses.length)}</p><p>−ln(0.1) = 2.302585; −ln(0.5) = 0.693147</p>`; }
  function perturb() {
    const tokens = tokenizer.encode('emma'), parameter = trainingModel.stateDict.lm_head[tokenizer.encode('m')[1]][0], original = parameter.data, epsilon = .001;
    let lower, upper, baseline;
    try { baseline = documentLoss(trainingModel,tokens).loss.data; parameter.data = original-epsilon; lower = documentLoss(trainingModel,tokens).loss.data; parameter.data = original+epsilon; upper = documentLoss(trainingModel,tokens).loss.data; }
    finally { parameter.data = original; }
    trainingModel.zeroGrad(); const graph = documentLoss(trainingModel,tokens,true); graph.loss.backward();
    gradientResult = { original,epsilon,lower,upper,baseline,slope:(upper-lower)/(2*epsilon),gradient:parameter.grad,nodes:buildGradientPath(graph.loss,graph.rows,trainingModel) };
  }
  function gradientHtml(nodes) {
    return `<p>${h('Actual backward graph: parallel hidden/weight branches. Click a node for its value, total gradient and branch contribution.','实际反向计算图：Hidden 与 Weight 是并列分支。点击节点查看数值、总梯度及分支贡献。')}</p><div class="gradient-path" id="course-gradient">${gradientDiagramHtml(nodes).replace('两个乘法输入，各自接收梯度',h('Two multiplication inputs, each receiving its own gradient','两个乘法输入，各自接收梯度')).replaceAll('value ',h('value ','数值 ')).replaceAll('total grad ',h('total grad ','总梯度 ')).replaceAll('this branch ',h('this branch ','本分支 '))}</div><div id="course-gradient-detail" class="course-feedback"></div>`;
  }
  function gradientResultHtml() {
    if (!gradientResult) return `<p>${h('Run the comparison; the same parameter is restored after both evaluations.','执行比较；两次评估后恢复同一参数。')}</p>`;
    const r = gradientResult;
    return `<p>lm_head[m][0] · ${h('Same document, same model state, only one parameter perturbed','相同文档、相同模型状态，仅扰动一个参数')}</p>${table([h('Parameter','参数'),h('Document loss','文档损失')],[[fmt(r.original-r.epsilon),fmt(r.lower)],[fmt(r.original),fmt(r.baseline)],[fmt(r.original+r.epsilon),fmt(r.upper)]])}<p>(${fmt(r.upper)} − ${fmt(r.lower)}) / (2 × ${r.epsilon}) = ${fmt(r.slope)}</p><p>${h('Actual backward gradient','实际反向梯度')} = ${fmt(r.gradient)} · ${h('Parameter restored to','参数已恢复为')} ${fmt(r.original)}</p>${gradientHtml(r.nodes)}`;
  }
  function train() {
    const tokens = tokenizer.encode('emma'), parameter = trainingModel.stateDict.lm_head[tokenizer.encode('m')[1]][0];
    trainingModel.zeroGrad(); const before = documentLoss(trainingModel,tokens,true); before.loss.backward();
    const original = parameter.data, gradient = parameter.grad, nodes = buildGradientPath(before.loss,before.rows,trainingModel);
    optimizer.step(); trainedSteps++;
    trainingResult = { before:before.loss.data,after:documentLoss(trainingModel,tokens).loss.data,original,updated:parameter.data,gradient,nodes };
    // A prior finite-difference result refers to old weights; invalidate it after training.
    gradientResult = null; experiments.delete('D2');
  }
  function trainingResultHtml() {
    if (!trainingResult) return `<p>${h('No updates yet. This model is separate from the pretrained model and every free experiment.','尚未更新。此模型独立于预训练模型和所有自由实验。')}</p>`;
    const r = trainingResult;
    return `<p>${h('Updates','更新次数')} ${trainedSteps} · Loss ${fmt(r.before)} → ${fmt(r.after)}</p>${table([h('Parameter','参数'),h('Before','更新前'),h('Gradient','梯度'),h('After Adam','Adam 更新后')],[['lm_head[m][0]',fmt(r.original),fmt(r.gradient),fmt(r.updated)]])}<p>${h('Simple direction-only illustration','仅说明方向的简单例子')}：${fmt(r.original)} − 0.01 × ${fmt(r.gradient)} = ${fmt(r.original-.01*r.gradient)}<br>${h('This illustration is not the Adam result above. Adam uses moving averages and bias correction; inspect its actual source below.','此简单例子不等于上方 Adam 结果。Adam 使用历史平均及偏差修正，可在下方查看实际源码。')}</p>${gradientHtml(r.nodes)}`;
  }
  function nextSample() {
    if (sampling.ended) return;
    const pos = sampling.rows.length, temperature = sampling.temperature;
    const trace = gpt.forward(sampling.next,pos,sampling.keys,sampling.values), probs = softmax(trace.logits.map(v => v/temperature));
    const random = sampling.random(), token = gpt.sampleFromProbs(probs,random);
    sampling.rows.push({pos,temperature,trace,probs,random,token,context:[...sampling.tokens]}); sampling.next = token;
    if (token !== tokenizer.BOS) sampling.tokens.push(token);
    sampling.ended = token === tokenizer.BOS || sampling.rows.length >= gpt.blockSize;
  }
  function temperatureComparison() {
    const trace = traces[1], u = .37, probabilities = softmax(trace.logits.map(z => z/sampling.temperature));
    const baseToken = gpt.sampleFromProbs(trace.probs,u), chosen = gpt.sampleFromProbs(probabilities,u);
    let cumulative = 0;
    return `<section class="course-feedback"><h4>${h('Controlled temperature comparison','固定条件的温度对照')}</h4><p>${h('Same BOS, e context, same original logits, same random number u=0.37. Moving the slider recalculates this comparison without generating a token or changing any history.','相同 BOS、e 上下文，相同原始分数，相同随机数 u=0.37。移动滑块只重新计算此对照，不生成 token，也不改变历史。')}</p><p>T=1 → ${tokenToHtml(baseToken)}; T=${sampling.temperature.toFixed(2)} → ${tokenToHtml(chosen)}</p>${table([h('Candidate','候选'),'logit','p(T=1)',`p(T=${sampling.temperature.toFixed(2)})`,h('Interval for the same u','同一随机数所处区间')],probabilities.map((p,i) => { const lower = cumulative; cumulative += p; return [tokenToHtml(i),fmt(trace.logits[i]),`${(trace.probs[i]*100).toFixed(4)}%`,`${(p*100).toFixed(4)}%`,`[${fmt(lower)}, ${fmt(cumulative)})${i === chosen ? ' ← u' : ''}`]; }))}<p>${h('The separate generation experiment below keeps its own sampled context and random stream.','下方单独的生成实验保留自己的生成上下文和随机序列。')}</p></section>`;
  }
  function samplingResult() {
    const row = sampling.rows.at(-1);
    if (!row) return `<p>${h('Begin with BOS. Each click calculates and samples one step.','从 BOS 开始，每次点击计算并抽样一步。')}</p>`;
    const lower = row.probs.slice(0,row.token).reduce((a,b) => a+b,0), upper = lower+row.probs[row.token];
    let cumulative = 0;
    return `<div class="course-comparison"><div><strong>${h('Training: true history','训练：真实历史')}</strong><code>BOS e m m a</code></div><div><strong>${h('Generation: sampled history','生成：自己抽出的历史')}</strong><code>BOS ${esc(tokenizer.decode(row.context))}</code></div></div><p>${h('Last step temperature','刚才一步的温度')} = ${row.temperature.toFixed(2)} · u = ${fmt(row.random)} ∈ [${fmt(lower)}, ${fmt(upper)}) → ${tokenToHtml(row.token)}</p><p>${h('Generated so far','已生成')}：${esc(tokenizer.decode(sampling.tokens) || '∅')} · ${sampling.ended ? row.token === tokenizer.BOS ? h('Stopped at BOS','遇到 BOS 停止') : h('Stopped at context limit','达到上下文上限停止') : h('Sampled token becomes the next input. Parameters stay fixed.','抽出的 token 成为下一步输入，参数保持固定。')}</p>${table([h('Candidate','候选'),'logit',h('Original p (T=1)','原始 p（T=1）'),`p (T=${row.temperature.toFixed(2)})`,h('Sampling interval','抽样区间')],row.probs.map((p,i) => { const start = cumulative; cumulative += p; return [tokenToHtml(i)+(i === row.token ? ' ← '+h('sampled','已选') : ''),fmt(row.trace.logits[i]),`${(row.trace.probs[i]*100).toFixed(4)}%`,`${(p*100).toFixed(4)}%`,`[${fmt(start)}, ${fmt(cumulative)})`]; }))}<p>Σ p = ${fmt(cumulative)} · ${h('Temperature changes apply to the next step; reset restores the same random stream for comparison.','温度更改作用于下一步；重置恢复同一随机序列以便比较。')}</p>`;
  }
  function showResult() {
    const lesson = current(), type = lesson.type;
    const target = $('course-result');
    const ready = experiments.has(lesson.id);
    $('course-action').disabled = false;
    // Before the main operation, keep the input visible; detailed traces are revealed by the learner.
    if (!ready && !['tokens','addresses','dimensions','lookup','one-score','many-scores','softmax','mix','generate','temperature','train','gradient'].includes(type)) {
      target.innerHTML = `<p>${h('Input: the real prediction after BOS, e. Run this operation to reveal its numbers.','输入：真实模型读完 BOS、e 的预测。执行本节操作后揭开数字。')}</p>`; return;
    }
    if (!ready && ['tokens','lookup','many-scores','softmax'].includes(type)) {
      if (type === 'tokens') target.innerHTML = `<p>${h('Input name','输入名字')}：<code>emma</code></p><p>${h('Press Encode to locate character IDs and next-character targets.','点击编码，查找字符编号与下一个字符目标。')}</p>`;
      else {
        const x = toy.embeddings[toy.character];
        target.innerHTML = `<p>${h('Selected character','所选字符')}：${toy.characters[toy.character]} · ${type === 'lookup' ? h('Its row is still inside the parameter table. Retrieve it to see the three numbers.','对应行还在参数表中；取出后查看三个数。') : `${h('Input state','输入状态')} x = ${rowText(x, simpleNumber)}`}</p>`;
        if (type === 'softmax') target.innerHTML += table([h('Candidate','候选'),h('Raw score','原始分数')],toy.weights.map((w,i) => [toy.characters[i],fmt(dot(x,w))]));
        if (type === 'many-scores') target.innerHTML += `<p>${h('Candidate parameter rows are ready; compare them to calculate one score for every candidate.','候选参数行已准备好；比较后计算各候选的分数。')}</p>`;
      }
    }
    else if (['tokens','addresses','dimensions','lookup','one-score','many-scores','softmax'].includes(type)) target.innerHTML = teachingResult(type);
    else if (type === 'real-score') target.innerHTML = scoreResult();
    else if (type === 'position') target.innerHTML = positionResult();
    else if (type === 'mix') target.innerHTML = `<p>${h('Teaching values','教学内容数值')}：2, 6 · ${h('Manually assigned weights','人工指定权重')}：${toy.mix.toFixed(2)}, ${(1-toy.mix).toFixed(2)}</p>${ready ? `<div class="equation">2 × ${toy.mix.toFixed(2)} + 6 × ${(1-toy.mix).toFixed(2)} = ${simpleNumber(2*toy.mix+6*(1-toy.mix))}</div><p>${h('The next lesson derives real weights instead of assigning them.','下一节推导真实权重，不再人工指定。')}</p>` : `<p>${h('Predict the mixed value, then calculate it. Moving the slider also calculates the new mixture.','先猜混合后的数，再点击计算。移动滑块也会计算新的混合结果。')}</p>`}`;
    else if (type === 'attention') target.innerHTML = attentionResult();
    else if (type === 'values') target.innerHTML = attentionResult(true);
    else if (type === 'norm') target.innerHTML = normResult();
    else if (type === 'mlp') target.innerHTML = mlpResult();
    else if (type === 'residual') target.innerHTML = residualResult();
    else if (type === 'pipeline') target.innerHTML = pipelineResult();
    else if (type === 'loss') target.innerHTML = lossResult();
    else if (type === 'gradient') target.innerHTML = gradientResultHtml();
    else if (type === 'train') target.innerHTML = trainingResultHtml();
    else target.innerHTML = (type === 'temperature' ? temperatureComparison() : '') + samplingResult();
    if (['tokens','lookup','many-scores','softmax','real-score','position','mix','attention','values','norm','mlp','residual','pipeline','loss'].includes(type)) $('course-action').disabled = ready;
    if (type === 'dimensions') $('course-action').disabled = toy.dimensions === 3;
    if (type === 'one-score') $('course-action').disabled = toy.products === 3;
    if (['generate','temperature'].includes(type)) $('course-action').disabled = sampling.ended;
    if ($('course-real-candidate')) $('course-real-candidate').onchange = event => { selectedCandidate = Number(event.target.value); showResult(); $('course-real-candidate').focus({preventScroll:true}); };
    document.querySelectorAll('[data-toy-row]').forEach(button => button.onclick = () => { toy.character = Number(button.dataset.toyRow); if ($('course-character')) $('course-character').value = toy.character; showResult(); document.querySelector(`[data-toy-row="${toy.character}"]`).focus({preventScroll:true}); });
    const nodes = type === 'gradient' ? gradientResult?.nodes : trainingResult?.nodes;
    document.querySelectorAll('#course-gradient [data-gradient-index]').forEach(button => button.onclick = () => { const node = nodes[Number(button.dataset.gradientIndex)]; $('course-gradient-detail').innerHTML = `<strong>${esc(tr(node.name))}</strong><p>${h('Forward value','前向数值')} ${fmt(node.value)} · ${h('Total gradient','总梯度')} ${node.grad.toExponential(6)}</p>${node.contribution === undefined ? '' : `<p>${h('This branch contribution','本分支贡献')} ${node.contribution.toExponential(6)}<br><code>${esc(node.localRule)}</code></p>`}`; });
  }
  const sourceAnchors = {
    tokens:'  encode(doc)', addresses:'    const tokEmb', dimensions:'  linear(x, w)', lookup:'    const tokEmb',
    'one-score':'  linear(x, w)', 'many-scores':'  linear(x, w)', softmax:'  softmax(logits)', 'real-score':'    trace.finalHidden = x.map',
    position:'    const tokEmb', mix:'        const headOut', attention:'      const q =', values:'        const headOut', norm:'  rmsnorm(x)',
    mlp:'      const xResidual2', residual:'      lt.mlpProjection', pipeline:'  forward(tokenId', loss:'    const loss = probs[targetId]', gradient:'    this.grad = 1;', train:'      const mHat', generate:'  function nextSample()', temperature:'  function temperatureComparison()',
  };
  const pythonAnchors = {
    tokens:'    tokens = [BOS]', addresses:'    tok_emb =', dimensions:'def linear(', lookup:'    tok_emb =',
    'one-score':'def linear(', 'many-scores':'def linear(', softmax:'def softmax(', 'real-score':"    logits = linear(x, state_dict['lm_head'])",
    position:'    tok_emb =', mix:'            head_out =', attention:'        q = linear(', values:'            head_out =', norm:'def rmsnorm(',
    mlp:"        x = linear(x, state_dict[f'layer{li}.mlp_fc1'])", residual:'        x = [a + b for a, b in zip(x, x_residual)]', pipeline:'def gpt(',
    loss:'        losses.append(', gradient:'        self.grad = 1', train:'        m_hat =', generate:'def gpt(', temperature:'def softmax(',
  };
  async function renderCode() {
    const revision = ++sourceRevision, lesson = current(), path = sourceLanguage === 'py' ? 'generate_weights.py' : `js/${lesson.source}`;
    $('course-code-path').textContent = path + (sourceLanguage === 'py' && lesson.stage === 'E' ? h(' · Python shows the forward/Softmax building block; this local weight exporter has no sampling loop. Select JavaScript for the actual course sampling code.',' · Python 展示前向/Softmax 计算部件；本地权重导出脚本不含采样循环。请选择 JavaScript 查看课程实际采样代码。') : '');
    $('course-code').textContent = h('Loading local source…','正在读取本地源码…');
    try {
      if (!sourceCache.has(path)) sourceCache.set(path,fetch(path).then(response => { if (!response.ok) throw new Error('source unavailable'); return response.text(); }));
      const text = await sourceCache.get(path); if (revision !== sourceRevision || !$('course-code')) return;
      const lines = text.split(/\r?\n/), anchor = sourceLanguage === 'py' ? pythonAnchors[lesson.type] : sourceAnchors[lesson.type];
      const start = lines.findIndex(line => line.startsWith(anchor));
      if (start < 0) throw new Error('missing source anchor: ' + anchor);
      $('course-code').innerHTML = lines.slice(start,start+(lesson.type === 'pipeline' ? 105 : 28)).map((line,i) => `<span class="code-line"><span class="line-number">${start+i+1}</span>${esc(line)}</span>`).join('');
    } catch { if (revision === sourceRevision && $('course-code')) $('course-code').textContent = h('Local source unavailable. Open this page through an HTTP static server. Experiments remain usable.','本地源码暂不可读，请通过 HTTP 静态服务器打开。实验仍可继续。'); }
  }
  function summary(persist = true) {
    summaryOpen = true; if (persist) { state.finished = true; save(); }
    $('course-summary').innerHTML = `<section class="course-card"><h3>${h('Review: from an address to generation','学习回顾：从地址到生成')}</h3><p>${h('Opening this review does not mark mastery. Return to any unchecked idea, or continue to the independent advanced course.','打开回顾不代表掌握。可回到未理解的小节，也可进入独立进阶篇。')}</p><div class="course-choices">${lessons.map(l => `<button data-review="${l.id}">${l.id} · ${esc(tr(l.title))} · ${status(l)}</button>`).join('')}</div><button class="btn primary" id="course-bridge">${h('Continue: from model to assistant','继续：从模型到助手')}</button></section>`;
    $('course-bridge').onclick = () => BridgeCourse.open();
    document.querySelectorAll('[data-review]').forEach(button => button.onclick = () => navigate(button.dataset.review));
    if (persist) $('course-summary').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function refreshLanguage() {
    if (activeTab === 'course') {
      const opened = Array.from(document.querySelectorAll('#tab-course details')).map(detail => detail.open);
      const focused = document.activeElement?.id;
      render();
      document.querySelectorAll('#tab-course details').forEach((detail,i) => { if (opened[i] !== undefined) detail.open = opened[i]; });
      if (focused && $(focused)) $(focused).focus({preventScroll:true});
    } else if (courseReturn?.tab === 'course') { const lesson = current(); setCourseReturn('course', h(`Return to basics ${lesson.id}: ${lesson.title}`, `返回基础篇 ${lesson.id}：${tr(lesson.title)}`)); } }
  return { init, open, refreshLanguage };
})();
