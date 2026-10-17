// Six guided lessons backed by the same GPT, Value and Adam as the free sandbox.
// Persist only curriculum progress. Model weights and experiment output stay in memory.
const Course = (() => {
  const KEY = 'microgpt.course.v1';
  const lessons = [
    {
      title: '文字变成数字', short: 'Token', tab: 'forward',
      question: '模型读到一个名字时，究竟拿到了什么？',
      intro: '计算只能处理数字。Tokenizer 给每个字母分配一个 ID；ID 是查表的地址，不表示字母之间的大小关系。本模型按字符切分，实际大型模型也常使用子词。',
      action: '将 emma 编码',
      quiz: '当输入位置是第一个 e 时，训练目标是哪一个 token？',
      choices: ['e 本身', '紧接着的 m', '整个名字 emma'], correct: 1,
      feedback: '输入和目标相差一个位置：<BOS> 预测 e，e 预测 m，最后的 a 预测结束标记 <BOS>。目标来自数据中的下一个字符。',
      take: '一个文档提供多个「前缀 → 下一个 token」的训练例子。',
      code: {
        js: { path: 'js/tokenizer.js', start: '  encode(doc)', count: 9, mark: ['tokens.push', 'const tokens'] },
        py: { path: 'generate_weights.py', start: '    tokens = [BOS]', count: 4, mark: ['tokens ='] },
      },
    },
    {
      title: '预测下一个字符', short: '预测', tab: 'forward',
      question: '先猜一猜：读到 e 后，模型会把多少概率给 m？',
      intro: '我们知道 emma 的下一个字母是 m，但模型只看到了 <BOS> 和 e。Embedding 把 ID 变成 16 维状态，Attention 和 MLP 变换状态，最后输出 27 个分数。Softmax 将分数变成总和为 1 的概率。',
      action: '查看 e → 下一个字符的预测',
      quiz: '这一次 GPT 的直接输出是什么？',
      choices: ['一个完整名字', '27 个候选 token 的概率分布', '唯一正确的字符 m'], correct: 1,
      feedback: '模型输出的是分布。最高概率的字符也可能不是数据里的正确答案；训练就是用这种偏差来改进参数。',
      take: 'Logits 是任意实数分数，概率经过 Softmax 归一化；两者不要混淆。',
      code: {
        js: { path: 'js/model.js', start: '  softmax(logits)', count: 7, mark: ['const exps', 'return exps'] },
        py: { path: 'generate_weights.py', start: 'def softmax(logits)', count: 6, mark: ['exps =', 'return'] },
      },
    },
    {
      title: '信息从哪里来', short: '注意力', tab: 'attention',
      question: '正在预测第二个 m 时，模型能不能偷看后面的 a？',
      intro: '每个位置生成 Query、Key、Value。Query 与可见 Key 的匹配分数经过 Softmax 成为权重，再用这些权重混合 Value。训练和生成都必须遵守「只能看当前与过去」的因果约束。',
      action: '查看注意力矩阵',
      quiz: '位置 2 的 m 为了预测下一字符，可以读取哪些位置？',
      choices: ['只有当前位置的 m', '<BOS>、e、当前位置的 m', '整个 emma，包括后面的字符'], correct: 1,
      feedback: '允许读取位置 0、1、2，位置 3、4 被遮挡。未来位置是不可访问的，不只是「得到很小的关注权重」。',
      take: '注意力是在位置之间搬运信息；四个 head 的具体语义要根据测量判断。',
      code: {
        js: { path: 'js/model.js', start: '      keys[li].push(k)', count: 39, mark: ['keys[li].push', 'values[li].push', 'this.softmax', 'weighted.add'] },
        py: { path: 'generate_weights.py', start: '        keys[li].append(k)', count: 10, mark: ['keys[li].append', 'attn_logits'] },
      },
    },
    {
      title: '把错误变成 Loss', short: '损失', tab: 'train',
      question: '正确字符只有 5% 的概率，这次预测有多差？',
      intro: '交叉熵损失读取正确下一个 token 的概率 p，计算 −ln(p)。概率越低，损失越大。一个文档的损失是各位置损失的平均值。模型在训练中会看到数据里的真实前缀。',
      action: '计算 emma 每个位置的损失',
      quiz: '正确 token 的概率从 0.1 提高到 0.5，Loss 会怎样？',
      choices: ['下降', '上升', '不变，因为最高概率 token 没变'], correct: 0,
      feedback: '−ln(0.1) ≈ 2.303，−ln(0.5) ≈ 0.693。损失直接取决于正确 token 的概率，不只取决于有没有猜中第一名。',
      take: '均匀猜测 27 个 token 时，Loss = ln(27) ≈ 3.296；它是参照值，不是硬性起点。',
      code: {
        js: { path: 'js/model.js', start: '    const loss = probs[targetId]', count: 6, mark: ['const loss'] },
        py: { path: 'generate_weights.py', start: '        losses.append(-probs[target_id].log())', count: 4, mark: ['losses.append', 'loss ='] },
      },
    },
    {
      title: '模型如何学习', short: '学习', tab: 'train',
      question: 'Loss 是一个数，它怎么告诉 4,192 个参数该怎么改？',
      intro: '每次加法、乘法都记录自己的输入和局部导数。Backward 沿计算图反向应用链式法则，给参数累积梯度。Adam 再根据梯度和历史动量更新权重。课程用独立、固定种子的随机权重，重复一个名字来观察学习；这会过拟合，不能证明模型已经会生成各种名字。',
      action: '执行 1 次训练更新',
      quiz: '乘法 weight × hidden 的反向传播关系是什么？',
      choices: ['先更新 hidden，再沿箭头更新 weight', '梯度分别流向 weight 和 hidden；共享参数累积多条路径', '只改变正确字符的最后一个权重'], correct: 1,
      feedback: '两个数是乘法的并列输入。到 weight 的分支贡献 = 上游梯度 × hidden，到 hidden 的贡献 = 上游梯度 × weight；所有贡献相加才是总梯度。',
      take: '梯度是局部变化率。Adam 使用历史状态，单次更新后的 Loss 不保证一定下降。',
      code: {
        js: { path: 'js/autograd.js', start: '    this.grad = 1;', count: 9, mark: ['this.grad = 1', 'grad +='] },
        py: { path: 'generate_weights.py', start: '        self.grad = 1', count: 5, mark: ['child.grad +='] },
      },
    },
    {
      title: '从预测到生成', short: '生成', tab: 'sample',
      question: '模型最偏爱 a，为什么仍然可能生成别的字符？',
      intro: '生成时先用 logits / T 计算采样概率，再抽一个随机数选 token。选中的 token 作为下一步输入。低温让分布更集中，但只要温度大于零、仍使用随机采样，就不保证总选第一名。',
      action: '生成下一个 token',
      quiz: '训练与生成在输入上下文上有什么区别？',
      choices: ['训练用真实历史字符；生成用自己刚选出的字符', '训练和生成都先拿到完整正确答案', '生成时参数每个字符都会重新训练'], correct: 0,
      feedback: '训练时目标来自数据，历史输入也来自数据；生成时未来未知，模型接收自己采样出的输出。在这里生成只做前向计算，不更新权重。',
      take: '自回归：预测 → 采样 → 把输出送回输入，直到 <BOS> 或长度上限。',
      code: {
        js: { path: 'js/course.js', start: '    const pos = sampling.rows.length', count: 12, mark: ['const scaled', 'gpt.sampleFromProbs', 'sampling.next =', 'sampling.ended ='] },
        py: { path: 'generate_weights.py', start: '        token_id = random.choices', count: 5, mark: ['token_id =', 'if token_id =='] },
      },
    },
  ];

  let state = { lesson: 0, answers: {}, finished: false };
  let sourceLanguage = 'js';
  let sourceOverride = null;
  let sourceRevision = 0;
  let recovered = false;
  let storageAvailable = true;
  let experimentDone = new Set();
  let trainingModel, optimizer, trainedSteps = 0, trainingResult = null;
  let trainingBusy = false;
  let traces = [];
  let queryPos = 2, head = 0, attentionCell = null;
  let sampling;
  const sourceCache = new Map();
  const $ = id => document.getElementById(id);
  const fmt = value => Number(value).toFixed(3);

  function restore() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY));
      if (!stored || stored.version !== 1) return;
      if (Number.isInteger(stored.lesson) && stored.lesson >= 0 && stored.lesson < lessons.length) state.lesson = stored.lesson;
      for (let i = 0; i < lessons.length; i++) {
        const answer = stored.answers?.[i];
        if (Number.isInteger(answer) && answer >= -1 && answer < lessons[i].choices.length) state.answers[i] = answer;
      }
      state.finished = stored.finished === true;
      recovered = true;
    } catch (error) {
      // Corrupt saved JSON is not the same as an unavailable storage API.
      if (error.name !== 'SyntaxError') storageAvailable = false;
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, ...state })); }
    catch { storageAvailable = false; }
  }

  function resetTraining() {
    trainingModel = createModel(createRandomWeightData());
    optimizer = new Adam(trainingModel.params, .01, .85, .99, 1e-8);
    trainedSteps = 0;
    trainingResult = null;
  }

  function resetSampling() {
    sampling = {
      keys: Array.from({ length: gpt.nLayer }, () => []),
      values: Array.from({ length: gpt.nLayer }, () => []),
      next: tokenizer.BOS, tokens: [], rows: [], random: seededRandom(2026), ended: false, temperature: .5,
    };
  }

  function init() {
    restore();
    resetTraining();
    resetSampling();
    const tokens = tokenizer.encode('emma');
    const keys = Array.from({ length: gpt.nLayer }, () => []);
    const values = Array.from({ length: gpt.nLayer }, () => []);
    traces = tokens.slice(0, -1).map((token, pos) => gpt.forward(token, pos, keys, values));
    open();
  }

  function open() {
    setActiveTab('course');
    render();
    $('step-info').textContent = '引导课程：固定样例 emma · 模型实验与沙盒各自独立。';
  }

  function navigate(index) {
    state.lesson = Math.max(0, Math.min(lessons.length - 1, index));
    sourceOverride = null;
    save();
    render();
    $('course-title').focus();
  }

  function answerStatus(index) {
    const answer = state.answers[index];
    return answer === -1 ? '已跳过' : answer === undefined ? '待理解' : answer === lessons[index].correct ? '已掌握' : '可重试';
  }

  function render() {
    const index = state.lesson;
    const lesson = lessons[index];
    setCourseReturn('course', `返回基础篇第 ${index + 1} 节：${lesson.title}`);
    const completed = lessons.filter((item, i) => state.answers[i] === item.correct).length;
    const answered = state.answers[index];
    const banner = !storageAvailable ? '本浏览器无法保存课程进度；当前页面仍可完成所有课程。' : recovered
      ? '已恢复章节与答题记录。训练权重、采样轨迹与实验结果已重置；请重新操作实验。'
      : '约 15–20 分钟 · 需要基础编程知识，不需要机器学习背景 · 进度保存在本浏览器。';
    $('tab-course').innerHTML = `
      <div class="course-banner">
        <div class="course-kicker">MICROGPT / 从一个名字理解 GPT</div>
        <h2>跟着真实模型，走完预测、学习与生成</h2>
        <p id="course-storage-note">${banner}</p>
        <div class="course-progress"><label for="course-progress">已掌握 ${completed} / 6</label><progress id="course-progress" max="6" value="${completed}"></progress></div>
        <div class="btn-group"><button class="btn primary" id="course-start">${recovered || index > 0 || Object.keys(state.answers).length ? `继续学习 · 第 ${index + 1} 节` : '开始学习 · 第 1 节'}</button><button class="btn" id="course-exit">退出引导 · 自由探索</button><button class="btn" id="course-restart">从头学习</button></div>
      </div>
      <nav class="course-outline" aria-label="课程章节">${lessons.map((item, i) => `
        <button data-lesson="${i}" ${i === index ? 'aria-current="step"' : ''}>${i + 1}. ${item.short}<small>${answerStatus(i)}</small></button>`).join('')}</nav>
      <div class="course-layout">
        <div>
          <div class="course-card"><div class="course-kicker">第 ${index + 1} / 6 关</div>
            <h3 id="course-title" tabindex="-1">${lesson.title}</h3>
            <p><strong>${escapeHtml(lesson.question)}</strong></p><p>${escapeHtml(lesson.intro)}</p></div>
          <section class="course-card course-experiment" aria-label="本关模型实验">
            <h3>亲手试一次</h3><p class="course-muted">${index === 2 ? '先运行实验，再点选行、head 或可见格子。斜纹格表示禁止读取。' : index === 4 ? '训练独立模型，不会改变自由探索页的预训练权重。' : index === 5 ? '用预训练模型自由生成，不以 emma 为目标。固定随机种子方便重置后比较。' : '固定样例 emma；先思考，再用下面的操作验证。'}</p>
            ${index === 5 ? `<label for="course-temperature">温度 Temperature：<output id="course-temperature-value">${sampling.temperature.toFixed(2)}</output></label><input id="course-temperature" type="range" min="0.1" max="1.5" step="0.05" value="${sampling.temperature}">` : ''}
            <div class="btn-group"><button class="btn primary" id="course-action">${lesson.action}</button>
              ${index === 4 ? '<button class="btn" id="course-ten">再训练 10 步</button><button class="btn" id="course-reset-training">重置随机权重</button>' : ''}
              ${index === 5 ? '<button class="btn" id="course-reset-sampling">重置生成</button>' : ''}
            </div>
            <div class="course-result" id="course-result" aria-live="polite">${experimentDone.has(index) ? '' : '<p>实验结果会显示在这里。答题和导航随时可用。</p>'}</div>
          </section>
          <section class="course-card" aria-label="理解检查">
            <h3>检查一下理解</h3><p>${lesson.quiz}</p>
            <div class="course-choices">${lesson.choices.map((choice, i) => `<button data-answer="${i}" aria-pressed="${answered === i}">${escapeHtml(choice)}</button>`).join('')}</div>
            <button class="btn" id="course-skip">跳过本题</button>
            <div id="course-feedback" role="status"></div>
          </section>
          <div class="course-navigation"><button class="btn" id="course-prev" ${index === 0 ? 'disabled' : ''}>← 上一步</button>
            <button class="btn primary" id="course-next">${index === 5 ? '查看学习回顾' : '下一步 →'}</button></div>
          <div id="course-summary" aria-live="polite"></div>
        </div>
        <aside>
          <div class="course-card"><h3>记住这一点</h3><p>${escapeHtml(lesson.take)}</p><button class="btn" id="course-explore">去沙盒自由实验</button></div>
          <div class="course-card"><h3>对应的运行代码</h3><p class="course-muted">蓝色行对应本关概念；JavaScript 是浏览器实际运行的实现。</p>
            <label for="course-language">代码对照：</label><select id="course-language"><option value="js" ${sourceLanguage === 'js' ? 'selected' : ''}>JavaScript</option><option value="py" ${sourceLanguage === 'py' ? 'selected' : ''}>Python 教学改编</option></select>
            <p class="course-code-path" id="course-code-path"></p><pre class="course-code" id="course-code" tabindex="0" aria-label="本关实际源码">正在读取本地源码…</pre>
            <details><summary>展开公式与源码说明</summary><p>${escapeHtml(formula(index))}</p><p class="course-muted">Python 对照取自本项目的 generate_weights.py，是 Karpathy 算法的本地改编；不是实时下载的上游源码。<a href="https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95">查看原作</a></p></details>
          </div>
        </aside>
      </div>`;

    $('course-start').onclick = () => { $('course-title').focus(); $('course-title').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $('course-exit').onclick = () => exit(lesson.tab);
    $('course-explore').onclick = () => exit(lesson.tab);
    $('course-restart').onclick = () => {
      if (trainingBusy) return;
      state = { lesson: 0, answers: {}, finished: false };
      experimentDone.clear(); resetTraining(); resetSampling(); recovered = false; save(); navigate(0);
    };
    document.querySelectorAll('[data-lesson]').forEach(button => button.onclick = () => navigate(Number(button.dataset.lesson)));
    document.querySelectorAll('[data-answer]').forEach(button => button.onclick = () => {
      state.answers[index] = Number(button.dataset.answer); save(); renderFeedback();
    });
    $('course-skip').onclick = () => { state.answers[index] = -1; save(); renderFeedback(); };
    $('course-prev').onclick = () => navigate(index - 1);
    $('course-next').onclick = () => index < 5 ? navigate(index + 1) : summary();
    $('course-action').onclick = () => runExperiment(index);
    $('course-language').onchange = event => { sourceLanguage = event.target.value; renderCode(); };
    if (index === 4) {
      ['course-action', 'course-ten', 'course-reset-training'].forEach(id => { $(id).disabled = trainingBusy; });
      $('course-ten').onclick = () => train(10);
      $('course-reset-training').onclick = () => { if (trainingBusy) return; resetTraining(); experimentDone.delete(4); $('course-result').textContent = '随机权重已重置。训练步数为 0。'; };
    }
    if (index === 5) {
      $('course-reset-sampling').onclick = () => { resetSampling(); experimentDone.delete(5); $('course-result').textContent = '已清空生成历史并恢复固定随机种子。'; $('course-temperature').value = .5; $('course-temperature-value').textContent = '0.50'; $('course-action').disabled = false; };
      $('course-temperature').oninput = event => { sampling.temperature = Number(event.target.value); $('course-temperature-value').textContent = sampling.temperature.toFixed(2); };
    }
    $('course-restart').disabled = trainingBusy;
    renderFeedback();
    renderCode();
    if (experimentDone.has(index)) showResult(index);
    if (state.finished && index === 5) summary(false);
  }

  function exit(tab) {
    ({ forward: tabForwardPass, train: tabTrain, sample: tabSample, attention: tabAttention })[tab]();
    document.querySelector(`[data-tab="${tab}"]`).focus();
  }

  function renderFeedback() {
    const index = state.lesson, lesson = lessons[index], answer = state.answers[index];
    document.querySelectorAll('[data-answer]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.answer) === answer));
    const feedback = $('course-feedback');
    feedback.className = answer === undefined ? '' : `course-feedback ${answer === lesson.correct ? 'correct' : ''}`;
    feedback.textContent = answer === undefined ? '' : `${answer === -1 ? '已跳过，可随时回来重试。' : answer === lesson.correct ? '理解正确。' : '再想一下，也可以跳过继续。'} ${lesson.feedback}`;
    const count = lessons.filter((item, i) => state.answers[i] === item.correct).length;
    $('course-progress').value = count;
    document.querySelector('[for="course-progress"]').textContent = `已掌握 ${count} / 6`;
    document.querySelectorAll('[data-lesson] small').forEach((small, i) => { small.textContent = answerStatus(i); });
    if (!storageAvailable) $('course-storage-note').textContent = '本浏览器无法保存课程进度；当前页面仍可完成所有课程。';
    if ($('course-summary').children.length) summary(false);
  }

  function formula(index) {
    return [
      'tokens = [BOS] + encode(name) + [BOS]；input[t] 对应 target[t+1]。同一个 BOS 在这里兼作起点和终点。',
      'p_i = exp(z_i − max(z)) / Σ exp(z_j − max(z))。减去最大值保持概率不变，并降低指数溢出的风险。',
      'attention = softmax(Q·K / √head_dim)，output = Σ attention_t · V_t。这里只缓存已经处理的当前位置与过去位置，实现因果约束。',
      'L = (1/N) Σ −ln p(target_t | true prefix)。取自然对数；0 < p ≤ 1。',
      '对于 y = w × h：∂L/∂w += (∂L/∂y)h，∂L/∂h += (∂L/∂y)w。共享参数的贡献在所有路径上相加。',
      'p(T) = softmax(logits / T)。随机数 u 落入哪个累积概率区间，就选择哪个 token。T=0 的贪心需要另行处理，不能直接除以零。',
    ][index];
  }

  async function renderCode() {
    const revision = ++sourceRevision;
    const spec = sourceOverride?.[sourceLanguage] || lessons[state.lesson].code[sourceLanguage];
    $('course-code-path').textContent = spec.path;
    $('course-code').removeAttribute('data-source');
    $('course-code').textContent = '正在读取本地源码…';
    try {
      if (!sourceCache.has(spec.path)) sourceCache.set(spec.path, fetch(spec.path).then(response => {
        if (!response.ok) throw new Error('source unavailable');
        return response.text();
      }));
      const lines = (await sourceCache.get(spec.path)).split(/\r?\n/);
      if (revision !== sourceRevision) return;
      const start = lines.findIndex(line => line.startsWith(spec.start));
      if (start < 0) throw new Error('anchor not found');
      $('course-code').setAttribute('data-source', '');
      $('course-code').innerHTML = lines.slice(start, start + spec.count).map((line, offset) =>
        `<span class="code-line ${spec.mark.some(marker => line.includes(marker)) ? 'highlight' : ''}"><span class="line-number">${start + offset + 1}</span>${escapeHtml(line)}</span>`).join('');
    } catch {
      if (revision === sourceRevision) $('course-code').textContent = '本地源码读取失败。请通过 HTTP 静态服务器打开页面；模型实验仍可继续。';
    }
  }

  function runExperiment(index) {
    if (index === 4) { train(1); return; }
    if (index === 5) nextSample();
    experimentDone.add(index);
    showResult(index);
  }

  function table(headers, rows) {
    return `<div class="course-table-wrap"><table class="course-table"><thead><tr>${headers.map(header => `<th scope="col">${header}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function showResult(index) {
    const target = $('course-result');
    const tokens = tokenizer.encode('emma');
    if (index === 0) {
      target.innerHTML = `<div class="course-tokens">${tokens.map((token, i) => `<span class="course-token ${i === 1 ? 'selected' : ''}">${tokenToHtml(token)}<small>ID ${token} · pos ${i}</small></span>`).join('')}</div>
        ${table(['位置', '当前输入', '正确下一个 token'], tokens.slice(0, -1).map((token, i) => [i, tokenToHtml(token), tokenToHtml(tokens[i + 1])]))}
        <p>编码得到 ${tokens.length} 个 token，其中 ${tokens.length - 1} 个位置提供预测目标。结束标记不再预测后继。</p>`;
    } else if (index === 1) {
      const trace = traces[1];
      const sorted = trace.probs.map((p, token) => ({ p, token })).sort((a, b) => b.p - a.p).slice(0, 5);
      target.innerHTML = `<p>当前上下文：<code>&lt;BOS&gt; e</code>。数据里的目标是 <strong>m</strong>。</p>
        ${table(['token', 'logit 原始分数', 'softmax 概率'], sorted.map(item => [tokenToHtml(item.token), fmt(trace.logits[item.token]), `${(item.p * 100).toFixed(1)}%`]))}
        <div class="equation">p(m) = ${(trace.probs[tokens[2]] * 100).toFixed(1)}% · 全部概率之和 = ${trace.probs.reduce((a, b) => a + b, 0).toFixed(6)}</div>
        <p>真实计算：${gpt.nEmbd} 维 Embedding → Attention → ${gpt.nEmbd * 4} 维 MLP → ${gpt.vocabSize} 个 Logits → 概率。</p>`;
    } else if (index === 2) renderAttention();
    else if (index === 3) {
      const losses = traces.map((trace, i) => -Math.log(trace.probs[tokens[i + 1]]));
      target.innerHTML = table(['输入 → 目标', '正确目标概率', '−ln(p)'], losses.map((loss, i) => [
        `${tokenToHtml(tokens[i])} → ${tokenToHtml(tokens[i + 1])}`, `${(traces[i].probs[tokens[i + 1]] * 100).toFixed(1)}%`, fmt(loss),
      ])) + `<div class="equation">文档平均 Loss = ${fmt(losses.reduce((a, b) => a + b, 0) / losses.length)}</div>
        <p>这里评估的是预训练权重。下一关会从新的随机权重出发学习，因此初始 Loss 不同。</p>`;
    } else if (index === 4) renderTraining();
    else if (index === 5) renderSampling();
  }

  function renderAttention() {
    const tokens = tokenizer.encode('emma').slice(0, -1);
    $('course-result').innerHTML = `<label for="course-head">选择 Head：</label><select id="course-head">${Array.from({ length: gpt.nHead }, (_, i) => `<option value="${i}" ${i === head ? 'selected' : ''}>Head ${i}</option>`).join('')}</select>
      <div class="btn-group">${tokens.map((token, pos) => `<button class="btn" data-query-pos="${pos}" aria-pressed="${pos === queryPos}">行 ${pos}：${tokenToHtml(token)}</button>`).join('')}</div>
      <div class="course-table-wrap"><table class="course-table"><caption>行是 Query，列是 Key；未来格子被遮挡</caption><thead><tr><th>位置</th>${tokens.map((token, i) => `<th>${i}: ${tokenToHtml(token)}</th>`).join('')}</tr></thead><tbody>${tokens.map((token, row) => `<tr><th>${row}: ${tokenToHtml(token)}</th>${tokens.map((_, col) => col > row ? '<td class="masked">遮挡</td>' : `<td><button data-attn-cell="${row},${col}" aria-pressed="${attentionCell === `${row},${col}`}" aria-label="Query ${row} 关注 Key ${col}">${traces[row].layers[0].attnWeights[head][col].toFixed(2)}</button></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="course-feedback" id="course-attention-detail">位置 ${queryPos} 的 Query 只能读取位置 0–${queryPos}。本行权重之和 = ${traces[queryPos].layers[0].attnWeights[head].reduce((a, b) => a + b, 0).toFixed(6)}。</div>`;
    $('course-head').onchange = event => { head = Number(event.target.value); attentionCell = null; renderAttention(); $('course-head').focus(); };
    document.querySelectorAll('[data-query-pos]').forEach(button => button.onclick = () => {
      queryPos = Number(button.dataset.queryPos); attentionCell = null; renderAttention();
      document.querySelector(`[data-query-pos="${queryPos}"]`).focus({ preventScroll: true });
    });
    document.querySelectorAll('[data-attn-cell]').forEach(button => button.onclick = () => {
      attentionCell = button.dataset.attnCell;
      const [row, col] = attentionCell.split(',').map(Number);
      document.querySelectorAll('[data-attn-cell]').forEach(cell => cell.setAttribute('aria-pressed', cell === button));
      $('course-attention-detail').textContent = `Head ${head}：位置 ${row} 的 ${tokenizer.tokenToDisplay(tokens[row])} 对位置 ${col} 的 ${tokenizer.tokenToDisplay(tokens[col])} 分配 ${(traces[row].layers[0].attnWeights[head][col] * 100).toFixed(1)}% 权重。未来位置没有 Key/Value 可读。`;
    });
  }

  async function train(count) {
    if (trainingBusy) return;
    trainingBusy = true;
    const buttons = ['course-action', 'course-ten', 'course-reset-training'].map($);
    buttons.forEach(button => { button.disabled = true; });
    $('course-restart').disabled = true;
    const input = tokenizer.encode('emma');
    try {
      const revision = trainingRunRevision;
      for (let i = 0; i < count; i++) {
        if (revision !== trainingRunRevision || activeTab !== 'course') break;
        trainingModel.zeroGrad();
        const before = documentLoss(trainingModel, input, true);
        before.loss.backward();
        const nodes = buildGradientPath(before.loss, before.rows, trainingModel);
        optimizer.step();
        trainingResult = { before: before.loss.data, after: documentLoss(trainingModel, input).loss.data, nodes };
        trainedSteps++;
        experimentDone.add(4);
        if (state.lesson === 4 && activeTab === 'course') renderTraining();
        if (count > 1) await sleep(0);
      }
    } catch {
      if (state.lesson === 4) $('course-result').textContent = '本次训练未完成，请重置实验后重试。';
    } finally {
      trainingBusy = false;
      ['course-action', 'course-ten', 'course-reset-training', 'course-restart'].forEach(id => {
        const button = $(id);
        if (button && (id === 'course-restart' || state.lesson === 4)) button.disabled = false;
      });
    }
  }

  function renderTraining() {
    if (!trainingResult) return;
    const nodes = trainingResult.nodes;
    $('course-result').innerHTML = `<div class="equation">第 ${trainedSteps} 步 · Loss ${fmt(trainingResult.before)} → ${fmt(trainingResult.after)}</div>
      <p>下面按反向传播方向展示一个目标 logit 的分支。Hidden 和 Weight 是并列输入；分支贡献不等于总梯度。节点值来自本次更新前。</p>
      <div class="gradient-path" id="course-gradient">${gradientDiagramHtml(nodes)}</div>
      <div class="course-feedback" id="course-gradient-detail">点击节点查看真实数值和公式。</div>
      <div class="btn-group"><button class="btn" id="course-backward-code">查看 Backward 代码</button><button class="btn" id="course-adam-code">查看 Adam 更新</button></div>`;
    document.querySelectorAll('#course-gradient [data-gradient-index]').forEach(button => button.onclick = () => {
      const node = nodes[Number(button.dataset.gradientIndex)];
      document.querySelectorAll('#course-gradient .gradient-node').forEach(item => item.classList.toggle('active', item === button));
      $('course-gradient-detail').innerHTML = `<strong>${escapeHtml(node.name)}</strong><br>前向值 ${node.value.toFixed(6)} · 总梯度 ${node.grad.toExponential(4)}
        ${node.contribution === undefined ? '' : `<br>这个目标 logit 的分支贡献 ${node.contribution.toExponential(4)}<br><code>${escapeHtml(node.localRule)}</code>`}
        <p>${node.grad < 0 ? '该数值微小增加，会使当前 Loss 局部下降。' : '该数值微小增加，会使当前 Loss 局部增加或不变。'} ${node.gradientScope ? `总梯度累积了${node.gradientScope}。` : ''}</p>`;
    });
    $('course-backward-code').onclick = () => { sourceOverride = null; renderCode(); };
    $('course-adam-code').onclick = () => {
      sourceOverride = {
        js: { path: 'js/optimizer.js', start: '      const mHat', count: 4, mark: ['p.data -='] },
        py: { path: 'generate_weights.py', start: '        m_hat =', count: 5, mark: ['p.data -='] },
      }; renderCode();
    };
  }

  function nextSample() {
    if (sampling.ended) return;
    const pos = sampling.rows.length, temperature = Number($('course-temperature').value);
    const trace = gpt.forward(sampling.next, pos, sampling.keys, sampling.values);
    const scaled = trace.logits.map(logit => logit / temperature);
    const max = Math.max(...scaled), exps = scaled.map(value => Math.exp(value - max));
    const total = exps.reduce((a, b) => a + b, 0), probs = exps.map(value => value / total);
    const random = sampling.random(), token = gpt.sampleFromProbs(probs, random);
    sampling.rows.push({ pos, temperature, trace, probs, random, token, context: [...sampling.tokens] });
    sampling.next = token;
    if (token !== tokenizer.BOS) sampling.tokens.push(token);
    sampling.ended = token === tokenizer.BOS || sampling.rows.length >= gpt.blockSize;
  }

  function renderSampling() {
    const row = sampling.rows.at(-1);
    if (!row) return;
    const lower = row.probs.slice(0, row.token).reduce((a, b) => a + b, 0), upper = lower + row.probs[row.token];
    const top = row.probs.indexOf(Math.max(...row.probs));
    const contextHtml = `&lt;BOS&gt; ${tokenizer.decode(row.context).split('').join(' ')}`;
    const rank = row.probs.map((p, token) => ({ p, token })).sort((a, b) => b.p - a.p).slice(0, 5);
    if (!rank.some(item => item.token === row.token)) rank.push({ p: row.probs[row.token], token: row.token });
    $('course-result').innerHTML = `<div class="course-comparison">
        <div><strong>训练：真实历史</strong><code>&lt;BOS&gt; e m m a</code><p>输入来自数据；每步目标是下一个真实字符。</p></div>
        <div><strong>生成：自己的历史</strong><code>${contextHtml}</code><p>当前输出 ${tokenToHtml(row.token)} ${sampling.ended ? '使本次生成停止，不再输入下一步。' : '会成为下一步输入。'} 推理不更新参数。</p></div>
      </div>
      <p class="course-muted">五个最可能的候选；实际选中的 token 若不在前五，也会单独列出。</p>
      ${table(['候选 token', '原始概率 T=1', `采样概率 T=${row.temperature.toFixed(2)}`], rank.map(item => [tokenToHtml(item.token) + (item.token === row.token ? ' <span class="course-highlight">← 实际选择</span>' : ''), `${(row.trace.probs[item.token] * 100).toFixed(1)}%`, `${(item.p * 100).toFixed(1)}%`]))}
      <div class="course-feedback">最高概率 ${tokenToHtml(top)}；实际选择 ${tokenToHtml(row.token)}。<br>
        随机数 u=${row.random.toFixed(6)} ∈ [${lower.toFixed(6)}, ${upper.toFixed(6)})。<br>
        已生成：${escapeHtml(tokenizer.decode(sampling.tokens) || '（空）')} · ${sampling.ended ? row.token === tokenizer.BOS ? '预测到结束标记，停止。' : '达到上下文上限，停止。' : '调整温度，然后继续下一步。'}</div>
      <p class="course-muted">固定随机种子便于重置后比较；更改温度影响下一步抽样。表格显示刚刚这一步的温度。</p>`;
    $('course-action').disabled = sampling.ended;
  }

  function summary(persist = true) {
    if (persist) { state.finished = true; save(); }
    const correct = lessons.filter((lesson, i) => state.answers[i] === lesson.correct).length;
    $('course-summary').innerHTML = `<section class="course-card"><h3>六关学习回顾 · 已掌握 ${correct}/6</h3>
      <p>GPT 根据前缀预测分布；训练用真实下一个 token 计算 Loss，梯度和 Adam 更新参数；生成采样后将自己的输出送回输入。</p>
      <div class="course-choices">${lessons.map((lesson, i) => `<button data-review="${i}">${i + 1}. ${lesson.title} · ${answerStatus(i)}</button>`).join('')}</div>
      <p>打开回顾不等于全部掌握。未掌握的概念可点击回顾，也可进入沙盒自由实验。</p></section>`;
    $('course-summary').insertAdjacentHTML('beforeend', '<button class="btn primary" id="course-bridge">Continue: from model to assistant</button>');
    $('course-bridge').onclick = () => BridgeCourse.open();
    document.querySelectorAll('[data-review]').forEach(button => button.onclick = () => navigate(Number(button.dataset.review)));
    if (persist) $('course-summary').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  return { init, open };
})();
