// View/controller for the offline bridge. Rendering never advances inference.
const BridgeCourse = (() => {
  const C = BridgeData.copy, KEY = 'microgpt.bridge.v1';
  const ids = BridgeData.modules.map(module => module.id);
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const raw = value => `<span data-no-i18n>${esc(value)}</span>`;
  const text = value => `<span>${esc(value)}</span>`;
  const badge = value => `<span class="bridge-source">${esc(value)}</span>`;
  let deps, progress, storage = true, restored = false, contentLanguage = 'zh';
  let scene, budget = 256, selected = null, runner, timer = null, runError = '', cacheResult = null;
  let caseIndex = 0, revealed = false, verified = false, trust = null, notice = '';
  function current() { return BridgeData.modules.find(module => module.id === progress.module); }
  function completed(module) { return module.questions.every((question, i) => progress.answers[module.id]?.[i] === question.correct); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, ...progress })); }
    catch { storage = false; }
  }
  function loadScene(language) {
    contentLanguage = language;
    scene = JSON.parse(JSON.stringify(BridgeData.conversations[language]));
    scene.messages.forEach(message => { message.included = true; });
    selected = null; budget = 256; caseIndex = 0; revealed = false; verified = false; trust = null;
  }
  function resetRunner(options = {}) {
    pause();
    const next = BridgeRunner.create({ ...deps, prefix: 'em', ...options });
    runner?.cancel();
    runner = next;
    runError = ''; cacheResult = null;
  }
  function init(dependencies) {
    deps = dependencies;
    let saved = null;
    try { saved = localStorage.getItem(KEY); }
    catch { storage = false; }
    try { restored = JSON.parse(saved)?.version === 1; } catch { restored = false; }
    progress = BridgeCore.restoreProgress(saved, BridgeData.modules);
    loadScene(I18n.language); resetRunner();
  }
  function open() {
    setActiveTab('bridge');
    $('step-info').textContent = C.time;
    render();
  }
  function pause() { if (timer !== null) clearInterval(timer); timer = null; }
  function leave() { pause(); }
  function navigate(id) {
    if (!ids.includes(id)) return;
    pause(); progress.module = id; progress.review = false; save(); render();
    $('bridge-title').focus();
  }
  function progressNotice() { return !storage ? C.storage : restored ? C.restored : C.time; }
  function render() {
    const module = current();
    setCourseReturn('bridge', `返回进阶篇第 ${ids.indexOf(module.id) + 1} 节`);
    $('tab-bridge').innerHTML = `
      <header class="bridge-banner"><div class="course-kicker">${raw('MICROGPT /')} ${text(C.entry)}</div>
        <h2>${esc(C.title)}</h2><p>${esc(C.intro)}</p><p class="course-muted">${esc(progressNotice())}</p>
        <div class="btn-group"><button class="btn" id="bridge-basics">${esc(C.back)}</button>
          <button class="btn" id="bridge-experiment">Open text generation experiment</button><button class="btn" id="bridge-restart">${esc(C.restart)}</button><button class="btn" id="bridge-export">${esc(C.export)}</button></div>
        <p class="course-muted">${esc(C.recording)}</p><p id="bridge-notice" role="status">${esc(notice)}</p>
      </header>
      <details class="bridge-recap"><summary>${esc(C.reviewBasics)}</summary><p>${esc(C.memoryText)}</p></details>
      <nav class="bridge-outline" aria-label="${esc(C.modules)}">${BridgeData.modules.map(item => `
        <button class="btn" data-module="${item.id}" ${item.id === module.id ? 'aria-current="step"' : ''}>${esc(item.title)}<small>${esc(completed(item) ? C.mastered : C.pending)}</small></button>`).join('')}</nav>
      <section class="bridge-card"><h3 id="bridge-title" tabindex="-1">${esc(module.title)}</h3><p><strong>${esc(module.question)}</strong></p></section>
      <div id="bridge-workspace"></div>
      <section class="bridge-card" aria-label="${esc(C.check)}"><h3>${esc(C.check)}</h3><div id="bridge-questions"></div></section>
      <div class="bridge-navigation"><button class="btn" id="bridge-prev" ${ids.indexOf(module.id) === 0 ? 'disabled' : ''}>${esc(C.previous)}</button>
        <button class="btn primary" id="bridge-next">${esc(module.id === 'verification' ? C.review : C.next)}</button></div>
      <section id="bridge-summary" role="status" ${progress.review ? '' : 'hidden'}>${esc(C.summary)}</section>
      <p class="bridge-disabled">${esc(C.unavailable)}</p>`;
    $('bridge-experiment').onclick = () => { tabSample(); document.querySelector('[data-tab="sample"]').focus(); };
    $('bridge-basics').onclick = () => Course.open();
    $('bridge-restart').onclick = () => {
      pause(); progress = BridgeCore.restoreProgress(null, BridgeData.modules); restored = false; notice = '';
      loadScene(I18n.language); resetRunner(); save(); render();
    };
    $('bridge-export').onclick = download;
    document.querySelectorAll('[data-module]').forEach(button => button.onclick = () => navigate(button.dataset.module));
    $('bridge-prev').onclick = () => navigate(ids[ids.indexOf(module.id) - 1]);
    $('bridge-next').onclick = () => {
      const next = ids[ids.indexOf(module.id) + 1];
      if (next) navigate(next);
      else { progress.review = true; save(); $('bridge-summary').hidden = false; }
    };
    renderWorkspace(); renderQuestions(); I18n.apply();
  }
  function renderQuestions() {
    const module = current();
    $('bridge-questions').innerHTML = module.questions.map((question, i) => {
      const answer = progress.answers[module.id]?.[i];
      return `<fieldset class="bridge-question"><legend>${esc(question.prompt)}</legend>
        <div class="course-choices">${question.choices.map((choice, j) => `<button type="button" data-check="${i}" data-choice="${j}" aria-pressed="${answer === j}">${esc(choice)}</button>`).join('')}</div>
        <button class="btn" data-check="${i}" data-choice="-1">${esc(C.skip)}</button>
        <p class="bridge-feedback" role="status">${answer === undefined || answer === null ? '' : `${text(answer === -1 ? C.skipped : answer === question.correct ? C.correct : C.retry)} ${text(question.feedback)}`}</p></fieldset>`;
    }).join('');
    document.querySelectorAll('[data-check]').forEach(button => button.onclick = () => {
      const i = Number(button.dataset.check), j = Number(button.dataset.choice);
      progress.answers[module.id] ||= [];
      progress.answers[module.id][i] = j; save();
      renderQuestions();
      document.querySelector(`[data-check="${i}"][data-choice="${j}"]`).focus();
      document.querySelector(`[data-module="${module.id}"] small`).textContent = completed(module) ? C.mastered : C.pending;
      if (!storage) renderStorage();
      I18n.apply();
    });
  }
  function renderStorage() { $('tab-bridge').querySelector('.bridge-banner .course-muted').textContent = C.storage; }
  function sceneButtons() {
    return `<div class="btn-group"><button class="btn" data-scene="zh">${esc(C.chinese)}</button><button class="btn" data-scene="en">${esc(C.english)}</button></div><p class="course-muted">${esc(C.contentLanguage)}</p>`;
  }
  function renderWorkspace() {
    const focusId = document.activeElement?.id;
    const module = progress.module;
    $('bridge-workspace').innerHTML = module === 'conversation' ? conversationHTML() : module === 'execution' ? executionHTML() : verificationHTML();
    document.querySelectorAll('[data-scene]').forEach(button => button.onclick = () => { loadScene(button.dataset.scene); renderWorkspace(); });
    if (module === 'conversation') bindConversation();
    if (module === 'execution') bindExecution();
    if (module === 'verification') bindVerification();
    I18n.apply();
    if (focusId && $(focusId)) $(focusId).focus({ preventScroll: true });
  }
  function conversationHTML() {
    const rep = BridgeCore.serialize(scene.messages, budget);
    const evidence = BridgeCore.evidence(scene.messages, scene.definitionId, scene.evidenceText);
    return `<section class="bridge-card">${badge(C.sourceStructure)}${sceneButtons()}<p>${esc(C.toyWarning)}</p>
      <p>${esc(C.mapping)}</p><h4>${esc(C.bubbles)}</h4>
      <div class="bridge-messages">${scene.messages.map(message => `<article class="bridge-message ${message.included ? '' : 'excluded'}">
        <label><input id="bridge-include-${message.id}" type="checkbox" data-include="${message.id}" ${message.included ? 'checked' : ''} ${message.required ? 'disabled' : ''}>
          ${text(message.required ? C.required : C.include)} ${raw(message.id)}</label>
        <button class="bridge-message-content" data-select="${message.id}" aria-pressed="${selected === message.id}">
          ${text(C[message.role])}<br><span data-no-i18n lang="${contentLanguage === 'zh' ? 'zh-CN' : 'en'}">${esc(message.content)}</span></button>
        <small>${esc(message.included ? C.include : C.excluded)}</small></article>`).join('')}</div>
      <label for="bridge-budget">${esc(C.budget)}</label> <select id="bridge-budget">${[40, 80, 128, 256].map(value => `<option value="${value}" ${value === budget ? 'selected' : ''}>${value}</option>`).join('')}</select>
      <p>${text(C.count)}: ${raw(rep.tokenCount)} / ${raw(budget)}</p>
      <p role="status" class="${rep.valid ? 'bridge-success' : 'bridge-warning'}">${esc(rep.valid ? C.withinBudget : C.overBudget)}</p>
      <details><summary>${esc(C.messageTable)}</summary><div class="bridge-table-wrap"><table><caption>${esc(C.messageTable)}</caption><thead><tr><th>${esc(C.messageId)}</th><th>${esc(C.role)}</th><th>${esc(C.content)}</th></tr></thead><tbody>
        ${scene.messages.map(message => `<tr><td>${raw(message.id)}</td><td><button class="btn" data-select="${message.id}" data-part="role">${raw(message.role)}</button></td><td><button class="btn bridge-wrap" data-select="${message.id}" data-part="content">${raw(message.content)}</button></td></tr>`).join('')}
      </tbody></table></div></details>
      <h4>${esc(C.serialized)}</h4><pre class="bridge-sequence" data-no-i18n>${rep.spans.map(span => `<span data-span="${esc(span.messageId || 'generation-prompt')}" data-part="${span.part}" class="${selected === span.messageId ? 'bridge-highlight' : ''}">${esc(rep.text.slice(span.start, span.end))}</span>`).join('')}</pre>
      <details><summary>${esc(C.tokenTable)}</summary><div class="bridge-table-wrap"><table><caption>${esc(C.tokenTable)}</caption><thead><tr><th>${esc(C.messageId)}</th><th>${esc(C.field)}</th><th>${esc(C.content)}</th><th>${esc(C.tokenId)}</th><th>${esc(C.offset)}</th></tr></thead><tbody>
        ${rep.tokens.map(token => `<tr data-token-message="${token.messageId || 'generation-prompt'}" data-part="${token.part}"><td>${token.messageId ? raw(token.messageId) : text(C.generationPrompt)}</td><td>${raw(token.part)}</td><td>${raw(JSON.stringify(token.text))}</td><td>${raw(token.id)}</td><td>${raw(`${token.start}–${token.end}`)}</td></tr>`).join('')}
      </tbody></table></div></details>
      <aside class="bridge-evidence" role="status"><h4>${esc(C.evidence)}</h4><p>${esc(evidence.present ? C.found : C.missing)}</p>${evidence.present ? raw(evidence.messageId) : ''}<p>${esc(C.evidenceLimit)}</p></aside>
      <details><summary>${esc(C.memory)}</summary><p>${esc(C.memoryText)}</p></details>
      <p><a href="https://huggingface.co/docs/transformers/chat_templating">${esc(C.sourceChat)}</a></p></section>`;
  }
  function bindConversation() {
    document.querySelectorAll('[data-include]').forEach(input => input.onchange = () => {
      scene.messages.find(message => message.id === input.dataset.include).included = input.checked; renderWorkspace();
    });
    $('bridge-budget').onchange = event => { budget = Number(event.target.value); renderWorkspace(); };
    document.querySelectorAll('[data-select]').forEach(button => button.onclick = () => {
      selected = button.dataset.select;
      document.querySelectorAll('[data-select]').forEach(item => item.setAttribute('aria-pressed', item.dataset.select === selected));
      document.querySelectorAll('[data-span], [data-token-message]').forEach(span => {
        const match = (span.dataset.span || span.dataset.tokenMessage) === selected && (!button.dataset.part || span.dataset.part === button.dataset.part);
        span.classList.toggle('bridge-highlight', match);
      });
    });
  }
  function phaseText(phase) { return C[phase] || C.unknownError; }
  function reasonText(reason) { return ({ 'End marker': C.end, 'Output budget': C.outputBudget, 'Cancelled': C.cancelled, 'Error': C.error })[reason] || ''; }
  function token(value) { return value === undefined ? '—' : value === deps.weights.uchars.length ? '<BOS>' : deps.weights.uchars[value]; }
  function executionHTML() {
    const result = runner.result(), config = result.config;
    const lastSample = result.events.filter(event => event.type === 'decode').at(-1);
    const rank = lastSample?.probs.map((p, id) => ({ p, id })).sort((a, b) => b.p - a.p).slice(0, 5) || [];
    return `<section class="bridge-card">${badge(C.sourceModel)}<p>${esc(C.nameBoundary)}</p>
      <form id="bridge-settings" class="bridge-settings">
        <label>${text(C.prefix)}<select id="bridge-prefix">${['em', '', 'ann'].map(prefix => `<option value="${prefix}" ${config.prefix === prefix ? 'selected' : ''}>${prefix || esc(C.emptyPrefix)}</option>`).join('')}</select></label>
        <label>${text(C.temperature)}<select id="bridge-temperature">${[.3, .5, 1].map(value => `<option value="${value}" ${config.temperature === value ? 'selected' : ''}>${value.toFixed(2)}</option>`).join('')}</select></label>
        <label>${text(C.seed)}<input id="bridge-seed" type="number" min="0" max="4294967295" step="1" value="${config.seed}" required></label>
        <label>${text(C.maxOutput)}<input id="bridge-output-budget" type="number" min="1" max="12" step="1" value="${config.maxNewTokens}" required></label>
        <button class="btn" type="submit">${esc(C.resetRun)}</button></form><p class="course-muted">${esc(C.settingsNote)}</p><p>${esc(C.budgetRule)}</p>
      <div class="btn-group"><button class="btn primary" id="bridge-step" ${result.phase === 'stopped' ? 'disabled' : ''}>${esc(C.step)}</button>
        <button class="btn" id="bridge-auto" ${result.phase === 'stopped' ? 'disabled' : ''}>${esc(timer === null ? C.auto : C.pause)}</button>
        <button class="btn" id="bridge-cancel" ${result.phase === 'stopped' ? 'disabled' : ''}>${esc(C.cancel)}</button>
        <button class="btn" id="bridge-cache" ${result.forwards ? '' : 'disabled'}>${esc(C.cache)}</button></div>
      <p role="status" class="bridge-warning">${esc(runError)}</p>
      <div class="bridge-metrics"><div>${text(C.stage)}<strong>${esc(phaseText(result.phase))}</strong></div>
        <div>${text(C.calls)}<strong data-no-i18n>${result.forwards}</strong></div>
        <div>${text(C.cacheSize)}<strong data-no-i18n>${esc(result.cache.join(' / ') || '0')}</strong></div>
        <div>${text(C.fixed)}<strong>${esc(!result.modelLoaded ? C.notLoaded : result.weightsUnchanged ? C.yes : C.no)}</strong></div></div>
      <p>${text(C.output)}: ${raw(result.text || '—')}</p><p>${text(C.combined)}: ${raw(config.prefix + result.text || '—')}</p>
      ${result.reason ? `<p role="status">${text(C.stop)}: ${text(reasonText(result.reason))}</p>` : ''}
      <p>${esc(C.firstToken)}</p><p class="course-muted">${esc(C.timing)}</p>
      <h4>${esc(C.top)}</h4>${rank.length ? `<ol class="bridge-candidates">${rank.map(item => `<li>${raw(token(item.id))} ${raw((item.p * 100).toFixed(2) + '%')}</li>`).join('')}</ol>` : `<p>${esc(C.noProb)}</p>`}
      ${cacheResult ? `<aside class="bridge-evidence" role="status"><p>${text(C.diff)}: ${raw(cacheResult.maxDifference.toExponential(3))}</p><p>${text(C.replayCalls)}: ${raw(cacheResult.count)}</p><p>${esc(cacheResult.equal ? C.same : C.unknownError)}</p><p>${esc(C.comparisonNote)}</p></aside>` : ''}
      <div class="bridge-table-wrap"><table><caption>${esc(C.eventLog)}</caption><thead><tr>${[C.sequence, C.stage, C.input, C.sampled, C.position, C.cacheSize, C.calls, C.random, C.probability].map(label => `<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>
        ${result.events.map(event => `<tr><td>${raw(event.sequence)}</td><td>${text(event.type === 'decode' && event.first ? C.firstOutput : phaseText(event.type))}</td><td>${raw(token(event.input))}</td><td>${raw(token(event.token))}</td><td>${raw(event.position ?? '—')}</td><td>${raw(event.cache?.join('/') ?? '—')}</td><td>${raw(event.forwards ?? '—')}</td><td>${raw(event.random?.toFixed(6) ?? '—')}</td><td>${raw(event.token === undefined ? '—' : (event.probs[event.token] * 100).toFixed(2) + '%')}</td></tr>`).join('')}
      </tbody></table></div>
      <details><summary>${esc(C.memory)}</summary><p>${esc(C.memoryText)}</p><pre data-no-i18n class="bridge-sequence">${esc(JSON.stringify(config, null, 2))}</pre></details>
      <p><a href="https://huggingface.co/docs/transformers/cache_explanation">${esc(C.sourceCache)}</a></p></section>`;
  }
  function advance() { runner.step(); renderWorkspace(); if (runner.result().phase === 'stopped') { pause(); renderWorkspace(); } }
  function bindExecution() {
    $('bridge-settings').onsubmit = event => {
      event.preventDefault();
      const options = { prefix: $('bridge-prefix').value, temperature: Number($('bridge-temperature').value), seed: Number($('bridge-seed').value), maxNewTokens: Number($('bridge-output-budget').value) };
      try { resetRunner(options); } catch (error) { runError = C[error.message] || error.message; }
      renderWorkspace();
    };
    $('bridge-step').onclick = () => { pause(); advance(); };
    $('bridge-auto').onclick = () => {
      if (timer !== null) pause();
      else timer = setInterval(() => { if (activeTab !== 'bridge' || progress.module !== 'execution') return pause(); advance(); }, 650);
      renderWorkspace();
    };
    $('bridge-cancel').onclick = () => { pause(); runner.cancel(); renderWorkspace(); };
    $('bridge-cache').onclick = () => {
      pause(); try { cacheResult = runner.recompute(); runError = ''; } catch (error) { runError = error.message; }
      renderWorkspace();
    };
  }
  function abilityHTML() {
    const cards = [[C.pretrain, C.pretrainData, C.pretrainObjective, C.yes], [C.posttrain, C.posttrainData, C.posttrainObjective, C.yes], [C.inference, C.inferenceData, C.inferenceObjective, C.no]];
    return `<section class="bridge-card"><h3>${esc(C.abilityTitle)}</h3><p>${esc(C.abilityIntro)}</p><div class="bridge-ability">${cards.map(([title, data, objective, change]) => `<article><h4>${esc(title)}</h4><dl><dt>${esc(C.data)}</dt><dd>${esc(data)}</dd><dt>${esc(C.objective)}</dt><dd>${esc(objective)}</dd><dt>${esc(C.changesWeights)}</dt><dd>${esc(change)}</dd></dl></article>`).join('')}</div>
      <details><summary>${esc(C.papers)}</summary><p>${esc(C.papersText)}</p><p><a href="https://arxiv.org/abs/2203.02155">InstructGPT</a> · <a href="https://arxiv.org/abs/2501.12948">DeepSeek-R1</a></p></details></section>`;
  }
  function equation(step) { return `${step.a} ${{ add: '+', sub: '−', mul: '×' }[step.op]} ${step.b} = ${step.result}`; }
  function solutionText(solution) { return [...(solution.steps || []).map(equation), String(solution.final)].join('\n'); }
  function verificationHTML() {
    const item = BridgeData.cases[caseIndex];
    return `${abilityHTML()}<section class="bridge-card">${badge(C.sourceFixture)}<p>${esc(C.verificationIntro)}</p>${sceneButtons()}
      <label for="bridge-case">${esc(C.case)}</label> <select id="bridge-case">${BridgeData.cases.map((entry, i) => `<option value="${i}" ${i === caseIndex ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
      <h4 data-no-i18n lang="${contentLanguage === 'zh' ? 'zh-CN' : 'en'}">${esc(item.task.prompt[contentLanguage])}</h4>
      <fieldset class="bridge-question"><legend>${esc(C.choose)}</legend><div class="btn-group">${[C.direct, C.worked, C.both, C.neither].map((choice, i) => `<button class="btn" data-trust="${i}" aria-pressed="${trust === i}">${esc(choice)}</button>`).join('')}</div></fieldset>
      <div class="bridge-solutions"><article><h4>${esc(C.direct)}</h4>${raw(item.direct.final)}</article><article><h4>${esc(C.worked)}</h4><button class="btn" id="bridge-reveal" aria-expanded="${revealed}">${esc(C.reveal)}</button>
        ${revealed ? `<pre class="bridge-sequence" data-no-i18n>${esc(solutionText(item.worked))}</pre>` : ''}</article></div>
      <button class="btn primary" id="bridge-verify" ${trust === null ? 'disabled' : ''}>${esc(C.verify)}</button>
      ${verified ? `<h4>${esc(item.title)}</h4><div class="bridge-solutions">${['direct', 'worked'].map(type => {
        const solution = item[type], result = BridgeCore.verify(item.task, solution);
        return `<article><h4>${esc(C[type])}</h4><p>${text(C.validFinal)}: ${text(result.finalCorrect ? C.yes : C.no)}</p>
          <p>${result.hasSteps ? `${text(C.validSteps)}: ${text(result.stepsValid ? C.yes : C.no)}` : text(C.noSteps)}</p>
          <p>${text(C.characters)}: ${raw([...solutionText(solution)].length)}</p><p>${text(C.checkedSteps)}: ${raw(result.checked)}</p>
          ${result.steps.map(step => `<p>${raw(equation(step))}<br>${text(C.arithmetic)}: ${text(step.arithmetic ? C.yes : C.no)} · ${text(C.taskMatch)}: ${text(step.matchesTask ? C.yes : C.no)}</p>`).join('')}</article>`;
      }).join('')}</div>` : ''}
      <p class="bridge-warning">${esc(C.verifyWarning)}</p><p><a href="https://arxiv.org/abs/2305.04388">${esc(C.sourceExplanations)}</a></p></section>`;
  }
  function bindVerification() {
    $('bridge-case').onchange = event => { caseIndex = Number(event.target.value); revealed = false; verified = false; trust = null; renderWorkspace(); };
    $('bridge-reveal').onclick = () => { revealed = !revealed; renderWorkspace(); };
    $('bridge-verify').onclick = () => { verified = true; revealed = true; renderWorkspace(); };
    document.querySelectorAll('[data-trust]').forEach(button => button.onclick = () => { trust = Number(button.dataset.trust); renderWorkspace(); document.querySelector(`[data-trust="${trust}"]`).focus(); });
  }
  function exportRecord() {
    return { version: BridgeCore.version, fixturesVersion: BridgeData.version,
      fixturesFingerprint: BridgeCore.fingerprint({ conversations: BridgeData.conversations, cases: BridgeData.cases }),
      contentLanguage, progress: JSON.parse(JSON.stringify(progress)), conversation: { source: 'teaching-structure',
        messages: JSON.parse(JSON.stringify(scene.messages)), representation: BridgeCore.serialize(scene.messages, budget) },
      nameRun: runner.result(), verification: { source: 'preset-teaching-fixture', caseId: BridgeData.cases[caseIndex].id,
        trust, revealed, verified, ...(verified ? { results: ['direct', 'worked'].map(type => BridgeCore.verify(BridgeData.cases[caseIndex].task, BridgeData.cases[caseIndex][type])) } : {}) },
      limitations: ['No chat model was run', 'Preset examples cannot establish model reasoning gains', 'No latency or billing claims'],
    };
  }
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(exportRecord(), null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'microgpt-bridge-record.json';
      document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      notice = C.downloaded;
    } catch { notice = C.downloadError; }
    $('bridge-notice').textContent = notice; I18n.apply();
  }
  return { init, open, leave, exportRecord };
})();
