// Local, reviewed bilingual messages. No network translation or model-state changes.
// Text/attribute bindings keep their original values so switching is reversible.
const I18n = (() => {
  const KEY = 'microgpt.language';
  const messages = [
    ['Learning mode', '学习模式'], ['Course learning', '课程学习'], ['Free experiments', '自由实验'],
    ['Courses', '课程'], ['Basics: understand a small GPT', '基础篇：理解一个小 GPT'],
    ['Advanced: from model to assistant', '进阶篇：从模型到助手'],
    ['Prediction process', '预测过程'], ['Attention observation', '注意力观察'],
    ['Training process', '训练过程'], ['Text generation', '文本生成'],
    ['Return to your course lesson', '返回原课程章节'],
    ['Open text generation experiment', '打开文本生成实验'],
    ['Loss: mean next-token cross-entropy on the current training example, using this lab’s independent weights.', 'Loss：使用本实验的独立权重，对当前训练样例计算各位置下一个 token 的平均交叉熵。'],
    ...(typeof BeginnerData === 'undefined' ? [] : BeginnerData.messages),
    ...(typeof BridgeData === 'undefined' ? [] : BridgeData.messages),
    ['microgpt.js — GPT Teaching Sandbox', 'microgpt.js — GPT 教学沙盒'],
    ["A visual companion to Karpathy's microgpt", 'Karpathy microgpt 的可视化教学项目'],
    ['Guided course · 6 lessons', '引导课程 · 6 关'],
    ['1 · Predict', '1 · 预测'], ['2 · Learn', '2 · 学习'],
    ['3 · Generate', '3 · 生成'], ['4 · Attention', '4 · 注意力'],
    ['Predict', '预测'], ['Learn', '学习'], ['Generate', '生成'], ['Inspect', '检查'],
    ['How one token becomes next-token probabilities.', '一个 token 如何变成下一个 token 的概率。'],
    ['How loss, gradients, and Adam change the weights.', '损失、梯度与 Adam 如何改变权重。'],
    ['How predictions are fed back into the model.', '预测结果如何再次送回模型。'],
    ['How attention moves information through context.', '注意力如何在上下文中传递信息。'],
    ['Learning path', '学习路线'],
    ['How a Token Flows Through the GPT', '一个 token 如何流经 GPT'],
    ['A GPT answers one question repeatedly: “what token comes next?”', 'GPT 不断回答同一个问题：“下一个 token 是什么？”'],
    ['Everything below exists to produce that probability distribution.', '下面所有计算都是为了得到这个概率分布。'],
    ['Input token →', '输入 token →'], ['Embedding', '嵌入（Embedding）'],
    ['RMSNorm', '均方根归一化（RMSNorm）'], ['Attention', '注意力（Attention）'],
    ['(looks at past tokens) →', '（读取过去的 token）→'], ['Residual Add', '残差相加'],
    ['MLP', '多层感知机（MLP）'], ['(thinks per position) →', '（逐位置变换特征）→'],
    ['Logits', '原始分数（Logits）'], ['Softmax', '概率归一化（Softmax）'],
    ['Probability over 27 tokens', '27 个 token 的概率'],
    ['Step through a name token by token. At each position, the model predicts what character comes next. The attention heatmaps show', '逐 token 遍历一个名字。每个位置都预测下一个字符。注意力热力图显示'],
    ['which past tokens', '哪些过去的 token'],
    ['the model considers most relevant for the current prediction.', '被模型认为与当前预测更相关。'],
    ['Input Name', '输入名字'], ['a-z only · maximum 15 characters', '仅限 a-z · 最多 15 个字符'],
    ['Type a name...', '输入一个名字…'], ['current', '当前'], ['past', '过去'], ['future', '未来'],
    ['Token Sequence', 'Token 序列'], ['Step Through', '逐步查看'], ['Pos:', '位置：'],
    ['Step Forward →', '前进一步 →'], ['Auto Play', '自动播放'], ['Reset', '重置'],
    ['Current State', '当前状态'], ['Token', '词元（Token）'],
    ['Next Token (target)', '下一个 Token（目标）'], ['Model assigns target', '模型给目标分配的概率'],
    ['Top 5 Predictions', '概率最高的 5 个预测'], ['Logits (raw scores for each token)', 'Logits（每个 token 的原始分数）'],
    ['Probability Distribution', '概率分布'], ['Attention Weights (per head — one query row × key columns)', '注意力权重（每个 head：一行 Query × 多列 Key）'],
    ['Ready', '就绪'], ['Press', '点击'], ['Step Forward', '前进一步'],
    ['to walk through the name token by token. Each step reveals what the model "sees" and what it predicts next.', '逐 token 查看名字。每一步都会展示模型“看到了什么”以及预测什么。'],
    ['to walk through the name token by token.', '逐 token 查看这个名字。'],
    ['Inspect the tensors inside this prediction', '查看本次预测中的张量'],
    ['The Missing Half: How a GPT Learns', '另一半原理：GPT 如何学习'],
    ["Karpathy's original program is one continuous loop: predict every next token, measure how wrong the predictions are, send that error backward through every operation, and update the parameters that influenced the example.", 'Karpathy 的原程序是一条连续循环：预测每个下一个 token，衡量预测误差，让误差信号反向穿过各个运算，并更新影响本样例的参数。'],
    ['This lab uses', '本实验使用'], ['fresh random weights', '全新的随机权重'],
    [', separate from the pretrained model in the other tabs. Repeating one name intentionally overfits it so the learning mechanism is easy to see.', '，与其他页的预训练模型独立。重复一个名字会刻意过拟合，以便看清学习机制。'],
    ['Training Example', '训练样例'], ['The model learns every adjacent input → target pair.', '模型学习每一组相邻的输入 → 目标。'],
    ['Run 1 training step', '训练 1 步'], ['Run 10 steps', '训练 10 步'], ['Reset random weights', '重置随机权重'],
    ['What the document teaches', '文档提供的学习目标'], ['Training Progress', '训练进度'],
    ['STEP', '步数'], ['LOSS BEFORE', '更新前损失'], ['LOSS AFTER', '更新后损失'],
    ['One complete optimization step', '一次完整的优化步骤'],
    ['01 · FORWARD', '01 · 前向传播'], ['02 · LOSS', '02 · 损失'], ['03 · BACKWARD', '03 · 反向传播'],
    ['04 · ADAM', '04 · Adam 更新'], ['Predict each next token', '预测每个下一个 token'],
    ['Press “Run 1 training step” to build a computation graph.', '点击“训练 1 步”来建立计算图。'],
    ['Turn wrongness into one number', '把误差变成一个数'],
    ["The correct token's probability becomes cross-entropy loss.", '正确 token 的概率被转换成交叉熵损失。'],
    ['Apply the chain rule', '应用链式法则'], ['Autograd will calculate ∂loss/∂parameter for every weight.', '自动微分将为每个权重计算 ∂loss/∂parameter。'],
    ['loss.backward() → 4,192 gradient slots (some can be zero)', 'loss.backward() → 4,192 个参数梯度（其中部分可为零）'],
    ["Update the model's memory", '更新模型参数'], ['Adam combines the gradient with momentum and adaptive scaling.', 'Adam 将梯度、动量和自适应缩放结合起来。'],
    ['What should you notice?', '应该注意什么？'], ['Random guessing among 27 tokens starts near', '在 27 个 token 中均匀随机猜测的损失为'],
    ['loss. As training repeats, the loss should usually fall: the parameters are storing statistical patterns from the example.', '。随着训练重复，损失通常会下降：参数正在记录样例中的统计模式。'],
    ['One real gradient path', '一条真实的梯度路径'],
    ['The full scalar graph contains thousands of nodes. This view follows one measured branch from the document loss to an output weight. Click a node to inspect its forward value and gradient.', '完整的标量计算图包含数千个节点。这里展示从文档损失到一个输出权重的实测分支。点击节点查看前向值与梯度。'],
    ['Run a training step to reveal the path.', '执行一次训练来显示路径。'],
    ['Gradients answer: “if this number increased slightly, how would the final loss change?”', '梯度回答：“如果这个数微小增加，最终损失会怎样变化？”'],
    ['Autoregressive Generation — How GPT Creates New Text', '自回归生成：GPT 如何创造新文本'],
    ['The model generates names', '模型生成名字时'], ['one token at a time', '一次只生成一个 token'],
    ['. It starts with', '。从'], [', predicts the next token, feeds it back as input, and repeats until it predicts', '开始，预测下一个 token，将其送回输入并重复，直到再次预测出'],
    ['again (end of name). This is called', '（名字结束）。这称为'], ['autoregressive generation', '自回归生成'],
    ['— the same process ChatGPT uses to write responses.', '——大型 GPT 生成文本也采用这种基本过程。'],
    ['Temperature', '温度（Temperature）'],
    ['controls randomness: low (0.1) = sharper, more repetitive; high (1.5) = flatter, more random. Positive temperatures still use random sampling. T=0 greedy decoding needs separate handling; this interface uses T≥0.1.', '控制随机性：低温（0.1）让分布更集中、输出更重复；高温（1.5）让分布更平坦、输出更随机。正温度仍使用随机采样。T=0 的贪心解码需单独处理；此界面使用 T≥0.1。'],
    ['Generate New Names', '生成新名字'], ['Lower = sharper/more repetitive. Higher = flatter/more random.', '低温：更集中、更重复。高温：更平坦、更随机。'],
    ['Generate 20 Names', '生成 20 个名字'], ['Click Generate to see names...', '点击生成来查看名字…'], ['Generating...', '正在生成…'],
    ['Token-by-token sampling trace', '逐 token 采样轨迹'],
    ["Pick a generated name above. Each row shows the model's top choice, the token actually sampled, and the random draw used to select it after temperature scaling.", '选择上方生成的一个名字。每行显示模型的首选、实际采样的 token，以及温度缩放后用于抽样的随机数。'],
    ['Generate names to inspect a sampling path...', '先生成名字，再查看采样路径…'],
    ['How Attention Works — Q, K, V & Multi-Head', '注意力如何工作：Q、K、V 与多头机制'],
    ['Each token projects itself into three vectors:', '每个 token 被投影成三个向量：'],
    ['Query', '查询（Query）'], ['Key', '键（Key）'], ['Value', '值（Value）'],
    ['("what am I looking for?"),', '（“我在寻找什么？”）、'], ['("what do I contain?"), and', '（“我包含什么？”）和'],
    ['("what do I offer if selected?"). Query–Key dot products are scaled and normalized with softmax into attention weights; these weights then blend the Values.', '（“被选择时我能提供什么？”）。Query 与 Key 的点积经缩放和 Softmax 归一化成为注意力权重，再用这些权重混合 Value。'],
    ['4 heads', '4 个注意力头（head）'],
    ['can learn different patterns. The colors show measured attention weights; do not assign a meaning such as “vowel head” unless the examples actually support it. The matrix shows', '可以学到不同模式。颜色展示实测注意力权重；除非样例提供证据，不应直接赋予“元音头”等语义。矩阵展示'],
    ['causal attention', '因果注意力'],
    ['— each row only sees itself and previous rows (no looking into the future). Blue = low attention, red = high.', '——每行只能看自己和之前的行，不能偷看未来。蓝色表示低权重，红色表示高权重。'],
    ['Multi-Head Attention Visualization', '多头注意力可视化'],
    ['Glossary — Key Concepts Explained', '术语表：关键概念说明'],
    ['Beginning of Sequence — a special token that marks the start and end of a document. The model learns that BOS means "start a new name" and another BOS means "the name is complete."', '序列起点：本模型用同一个特殊 token 标记文档的开始与结束。第一个 BOS 表示“开始一个新名字”，末尾的 BOS 表示“名字完成”。'],
    ['Tokenizer', '分词器（Tokenizer）'],
    ['Converts text ↔ integers. This model uses a character-level tokenizer: each letter a-z gets a unique ID (0-25), and BOS = 26. Production models use subword tokenizers (BPE) with ~100K tokens.', '在文本与整数之间转换。本模型按字符切分：a-z 对应 ID 0-25，BOS = 26。大型模型通常使用子词分词器（如 BPE），词表规模因模型而异。'],
    ['A lookup table that maps each token ID to a learned 16-dimensional vector. Training changes these coordinates whenever that token contributes to an error; the vector is learned internal state, not a human-readable definition.', '查表把 token ID 映射到可学习的 16 维向量。当该 token 对误差产生影响时，训练会调整这些坐标；这是模型学习的内部状态，不是人类可读的词义定义。'],
    ['Position Embedding', '位置嵌入（Position Embedding）'],
    ["Adds a learned vector based on the token's position in the sequence (0, 1, 2...). This tells the model where each token is, since attention alone has no notion of order.", '根据 token 在序列中的位置（0、1、2…）添加可学习向量。单独的注意力不包含顺序信息，位置嵌入告诉模型 token 在哪里。'],
    ['Root Mean Square Normalization — rescales the vector so its values have unit RMS. This stabilizes training by preventing activations from growing or shrinking as they flow through layers.', '均方根归一化：把向量缩放到约单位 RMS（包含稳定用的 epsilon）。有助于控制激活值的尺度，让训练更稳定。'],
    ['Attention (Q, K, V)', '注意力（Q、K、V）'],
    ['Query "what am I looking for?", Key "what do I contain?", Value "what do I offer?" — scaled Q–Key dot products pass through softmax to become attention weights, which blend the Values. This is where positions exchange information.', 'Query：“我寻找什么？”Key：“我包含什么？”Value：“我提供什么？”Q 与 Key 的点积经缩放和 Softmax 变成权重，再混合 Value。各位置通过这一步交换信息。'],
    ['Multi-Head Attention', '多头注意力（Multi-Head Attention）'],
    ['Runs 4 attention operations in parallel, each on a 4-dimensional slice. Heads can learn different patterns, but a semantic role such as “vowel detector” must be demonstrated from measurements rather than assumed.', '并行运行 4 组注意力，每组使用 4 维切片。各 head 可以学习不同模式，但“元音检测器”等语义角色需要实测证据，不能直接假定。'],
    ['KV Cache', '键值缓存（KV Cache）'],
    ["Stores Keys and Values from all previous positions so they don't need to be recomputed. The new query attends to all cached keys. Size grows by one at each step.", '缓存已处理位置的 Key 与 Value，避免重复计算。新的 Query 读取这些缓存的 Key；每处理一个新位置，缓存增长一项。'],
    ['Multi-Layer Perceptron — a per-token "thinking" step: project from 16→64 dimensions, apply ReLU, project back to 16. Unlike attention, MLP processes each position independently.', '多层感知机：逐 token 变换特征，从 16 维投影到 64 维，经过 ReLU，再投影回 16 维。与注意力不同，MLP 独立处理各个位置。'],
    ['Residual Connection', '残差连接（Residual Connection）'],
    ["Adds the block's input to its output (x = block(x) + x). This lets gradients flow directly through the network, making deeper models trainable. Both attention and MLP blocks use this.", '把模块输入加到输出上：x = block(x) + x。梯度可以沿这条直接路径传播，有助于训练深层模型。注意力与 MLP 模块都使用残差连接。'],
    ['Converts a vector of raw scores (logits, ranging -∞ to +∞) into a probability distribution that sums to 1. The highest logit gets the most probability, but not 100% — other choices remain possible.', '把任意实数分数（logits）转换成总和为 1 的概率分布。最高分数通常得到最高概率，但并非一定为 100%，其他选择仍可能被采样。'],
    ['The raw output scores from the model, one per vocabulary token. Higher logit = the model thinks that token is more likely. Softmax converts these to probabilities.', '模型输出的原始分数，每个词表 token 对应一个。Logit 越高，模型越偏好该 token；Softmax 再将分数转换成概率。'],
    ['Cross-Entropy Loss', '交叉熵损失（Cross-Entropy Loss）'],
    ['Measures "how surprised" the model is by the actual next token: -log(predicted_prob_of_correct_token). Loss = 0 means perfect prediction; loss = 3.3 ≈ random guessing among 27 tokens.', '衡量模型对真实下一个 token 的“意外程度”：−log(正确 token 的预测概率)。Loss = 0 表示正确目标概率为 1；在 27 个 token 中均匀猜测时，Loss 约为 3.296。'],
    ['Divides logits by T before softmax. Low positive T sharpens the distribution but does not guarantee the top token. High T flattens it. T=0 greedy decoding requires a separate argmax branch, not division by zero.', 'Softmax 前先将 logits 除以 T。较低的正温度使分布集中，但不保证每次选第一名；高温使分布平坦。T=0 的贪心解码需要独立的 argmax 分支，不能除以零。'],
    ['Autoregressive', '自回归（Autoregressive）'],
    ['The model feeds its own output token back as the next input. Like writing a letter: each new word depends on everything written so far. This is how all GPT models generate text.', '模型把自己的输出 token 送回作为下一步输入。类似写信：每个新词都依赖此前写出的内容。这就是 GPT 生成文本的基本方式。'],
    ['Autograd / Backprop', '自动微分 / 反向传播（Autograd / Backprop）'],
    ['Automatic differentiation via the chain rule. The Value class tracks every operation, building a graph. backward() walks the graph in reverse, computing how each parameter affects the loss.', '通过链式法则进行自动微分。Value 类记录各个运算并建立计算图，backward() 反向遍历图，计算每个参数对损失的影响。'],
    ['Adam Optimizer', 'Adam 优化器（Adam Optimizer）'],
    ["Adam maintains per-parameter momentum (smooths gradient direction) and adaptive learning rates (scales down frequently-updated parameters). It's the standard optimizer for training neural networks.", 'Adam 维护每个参数梯度的一阶与二阶移动平均，并做偏差校正，结合动量和自适应缩放来更新权重。'],
    ['Ready. Type a name and step through the forward pass.', '已就绪。输入名字，逐步查看前向传播。'],
    ['Visual adaptation of', '可视化改编自'], ['by Andrej Karpathy · MIT', '作者 Andrej Karpathy · MIT 许可'],
    // Sandbox descriptions and runtime labels.
    ['Training lab: fresh random weights · forward → loss → backward → Adam.', '训练实验：随机权重 · 前向传播 → 损失 → 反向传播 → Adam。'],
    ['Generation: sample one token, feed it back, and repeat until <BOS>.', '生成：采样一个 token，送回输入，重复直到 <BOS>。'],
    ['Attention: each row is a query; causal masking allows only current and past keys.', '注意力：每行是一个 Query；因果约束只允许读取当前与过去的 Key。'],
    ['Unsupported characters were removed.', '已移除不支持的字符。'],
    ['Token + position embedding, then RMSNorm', 'Token 与位置嵌入相加，再做 RMSNorm'],
    ['The current token ID selects one learned row, its position selects another, and the two 16-number vectors are added. This is the model state before the Transformer block.', '当前 token ID 选择一行学习到的向量，位置选择另一行，两组 16 维向量相加。这是进入 Transformer 模块之前的模型状态。'],
    ['Three learned views of the same state', '同一状态的三种学习到的投影'],
    ['The chart shows Q. Separate 16×16 matrices produce Q (what this position seeks), K (how it can be matched), and V (what information it offers). Each vector is split across four heads.', '图中展示 Q。三个独立的 16×16 矩阵产生 Q（此位置寻找什么）、K（如何被匹配）和 V（提供什么信息）。每个向量分成四个 head。'],
    ['A probability distribution over visible positions', '可见位置上的概率分布'],
    ['Per-position feature transformation', '逐位置特征变换'],
    ['The chart shows the 64 values after ReLU. Attention mixes information between positions; the MLP then transforms features independently at the current position before the residual add.', '图中展示 ReLU 后的 64 个值。注意力在位置之间混合信息，MLP 则独立变换当前位置的特征，然后进行残差相加。'],
    ['One unrestricted score per vocabulary token', '每个词表 token 对应一个任意实数分数'],
    ['The language-model head maps the final 16-number state to 27 logits. A higher logit means stronger preference, but logits are scores—not probabilities and they do not sum to 1.', '语言模型输出层把最终的 16 维状态映射成 27 个 logits。分数越高，偏好越强；但 logits 不是概率，总和也不是 1。'],
    ['Next-token probability distribution', '下一个 token 的概率分布'],
    ['Softmax exponentiates and normalizes all 27 logits. Training reads the probability assigned to the correct next token; generation samples one token from this distribution.', 'Softmax 对 27 个 logits 取指数并归一化。训练读取正确下一个 token 的概率；生成则从这个分布中采样一个 token。'],
    ['pos', '位置'], ['input', '输入'], ['target', '目标'], ['context', '上下文'], ['top choice', '最高概率'],
    ['sampled', '实际采样'], ['random draw and interval', '随机数与区间'], ['action', '操作'],
    ['continue', '继续'], ['stop: <BOS>', '停止：<BOS>'], ['stop: max length', '停止：达到长度上限'],
    ['(empty)', '（空）'],
    ['Document loss', '文档损失'], ['Forward value:', '前向值：'],
    ['· total gradient ∂loss/∂node:', '· 总梯度 ∂loss/∂node：'],
    ['Contribution from this target-logit branch:', '这个目标 logit 分支的贡献：'],
    ['The loss decreases when the correct-token probability rises, so this node normally has a negative gradient.', '正确 token 概率上升会使损失下降，因此这个节点的梯度通常为负。'],
    ['Softmax couples every logit. Raising the correct logit usually lowers loss; competing logits receive gradients in the opposite direction.', 'Softmax 将所有 logits 关联起来。提高正确 logit 通常会降低损失，竞争候选的 logits 则得到相反方向的梯度。'],
    ['This is a learned scalar parameter. Its displayed gradient accumulates every path in the document that used this shared weight, not only the highlighted token.', '这是一个可学习的标量参数。显示的梯度累积了文档中所有使用该共享权重的路径，而不只是高亮的 token。'],
    ['Start: From Nothing to First Letter', '开始：从起点到第一个字母'], ['End: Knowing When to Stop', '结束：预测停止标记'],
    ['The model sees', '模型看到了'],
    ['— the special marker that means "a new document begins." With no prior context, attention only has one token to look at (itself).', '——表示“新文档开始”的特殊标记。此时没有此前的上下文，注意力只可读取当前位置本身。'],
    ['The model assigns', '模型分配了'], ['probability to the correct first letter', '的概率给正确的首字母'],
    [', loss fell from', '步后，损失下降：从'], [', loss rose from', '步后，损失上升：从'],
    ['. Its top guess is', '。它的首选是'], ['The model has seen', '模型已经读取了'],
    ['tokens and must decide if the name is complete. The target is', '个 token，需要判断名字是否完成。正确目标是'],
    ['(end-of-name marker).', '（名字结束标记）。'], ['It gives', '模型给出了'],
    ['to the <BOS> token. Sampling this token would end generation; its being top-ranked alone does not force a stop.', '的概率给 <BOS>。采样到它会结束生成；仅仅概率排名第一，并不意味着一定停止。'],
    ['tokens so far:', '个 token：'], ['. Now it must predict the next character after', '。现在需要预测以下字符之后的下一个字符：'],
    ['Correct:', '正确目标：'], ['. Top guess:', '。最高概率：'], ['Head 0 focuses most on', 'Head 0 的最高关注权重分配给'],
    // Guided lesson content. These exact pairs also translate saved question feedback.
    ['Turning text into numbers', '文字变成数字'], ['Prediction', '预测'], ['Learning', '学习'], ['Generation', '生成'],
    ['What does a model actually receive when it reads a name?', '模型读到一个名字时，究竟拿到了什么？'],
    ['Computations operate on numbers. A tokenizer assigns each letter an ID: an address in a lookup table, not a numerical relationship between letters. This model uses characters; larger models often use subwords.', '计算只能处理数字。Tokenizer 给每个字母分配一个 ID；ID 是查表的地址，不表示字母之间的大小关系。本模型按字符切分，实际大型模型也常使用子词。'],
    ['Encode emma', '将 emma 编码'],
    ['When the input is the first e, which token is the training target?', '当输入位置是第一个 e 时，训练目标是哪一个 token？'],
    ['e itself', 'e 本身'], ['The following m', '紧接着的 m'], ['The whole name emma', '整个名字 emma'],
    ['Input and target are offset by one position: <BOS> predicts e, e predicts m, and the final a predicts the ending <BOS>. Targets come from the next character in the data.', '输入和目标相差一个位置：<BOS> 预测 e，e 预测 m，最后的 a 预测结束标记 <BOS>。目标来自数据中的下一个字符。'],
    ['One document supplies several “prefix → next token” training examples.', '一个文档提供多个「前缀 → 下一个 token」的训练例子。'],
    ['Predicting the next character', '预测下一个字符'],
    ['Guess first: after e, how much probability will the model assign to m?', '先猜一猜：读到 e 后，模型会把多少概率给 m？'],
    ['We know that m follows e in emma, but the model has seen only <BOS> and e. Embeddings turn IDs into 16-dimensional states. Attention and the MLP transform them into 27 scores; softmax converts the scores to probabilities that sum to 1.', '我们知道 emma 的下一个字母是 m，但模型只看到了 <BOS> 和 e。Embedding 把 ID 变成 16 维状态，Attention 和 MLP 变换状态，最后输出 27 个分数。Softmax 将分数变成总和为 1 的概率。'],
    ['Inspect the prediction after e', '查看 e → 下一个字符的预测'], ['What is the output of this GPT prediction?', '这一次 GPT 的直接输出是什么？'],
    ['A complete name', '一个完整名字'], ['A probability distribution over 27 candidate tokens', '27 个候选 token 的概率分布'],
    ['The one correct character m', '唯一正确的字符 m'],
    ['The model produces a distribution. Its most probable character may differ from the data target; training uses this mismatch to improve parameters.', '模型输出的是分布。最高概率的字符也可能不是数据里的正确答案；训练就是用这种偏差来改进参数。'],
    ['Logits are unrestricted real-valued scores. Softmax normalizes them into probabilities; do not confuse the two.', 'Logits 是任意实数分数，概率经过 Softmax 归一化；两者不要混淆。'],
    ['Where information comes from', '信息从哪里来'], ['When predicting the second m, can the model peek at the later a?', '正在预测第二个 m 时，模型能不能偷看后面的 a？'],
    ['Each position produces a Query, Key and Value. Matching scores between the Query and visible Keys pass through softmax into weights, which mix Values. Both training and generation must obey the causal rule: only current and past positions are visible.', '每个位置生成 Query、Key、Value。Query 与可见 Key 的匹配分数经过 Softmax 成为权重，再用这些权重混合 Value。训练和生成都必须遵守「只能看当前与过去」的因果约束。'],
    ['Inspect the attention matrix', '查看注意力矩阵'], ['Which positions can m at position 2 read to predict the next character?', '位置 2 的 m 为了预测下一字符，可以读取哪些位置？'],
    ['Only the current m', '只有当前位置的 m'], ['<BOS>, e and the current m', '<BOS>、e、当前位置的 m'],
    ['All of emma, including later characters', '整个 emma，包括后面的字符'],
    ['Positions 0, 1 and 2 are accessible; positions 3 and 4 are masked. Future positions cannot be read, rather than just receiving small attention weights.', '允许读取位置 0、1、2，位置 3、4 被遮挡。未来位置是不可访问的，不只是「得到很小的关注权重」。'],
    ['Attention moves information between positions. Any specific semantic role of a head must be supported by measurements.', '注意力是在位置之间搬运信息；四个 head 的具体语义要根据测量判断。'],
    ['Turning error into loss', '把错误变成 Loss'], ['If the correct character has only 5% probability, how bad is the prediction?', '正确字符只有 5% 的概率，这次预测有多差？'],
    ['Cross-entropy takes the probability p of the correct next token and computes −ln(p). Lower probability means greater loss. Document loss is the mean over positions. During training, inputs use the true prefixes from the data.', '交叉熵损失读取正确下一个 token 的概率 p，计算 −ln(p)。概率越低，损失越大。一个文档的损失是各位置损失的平均值。模型在训练中会看到数据里的真实前缀。'],
    ['Compute loss at each position of emma', '计算 emma 每个位置的损失'],
    ['If the correct-token probability rises from 0.1 to 0.5, what happens to loss?', '正确 token 的概率从 0.1 提高到 0.5，Loss 会怎样？'],
    ['It decreases', '下降'], ['It increases', '上升'], ["It stays unchanged because the top-ranked token didn't change", '不变，因为最高概率 token 没变'],
    ['−ln(0.1) ≈ 2.303, while −ln(0.5) ≈ 0.693. Loss depends directly on the probability of the correct token, not just whether the top choice is right.', '−ln(0.1) ≈ 2.303，−ln(0.5) ≈ 0.693。损失直接取决于正确 token 的概率，不只取决于有没有猜中第一名。'],
    ['Uniform guessing over 27 tokens gives Loss = ln(27) ≈ 3.296. This is a reference, not a mandatory starting loss.', '均匀猜测 27 个 token 时，Loss = ln(27) ≈ 3.296；它是参照值，不是硬性起点。'],
    ['How the model learns', '模型如何学习'], ['How can one loss value tell 4,192 parameters how to change?', 'Loss 是一个数，它怎么告诉 4,192 个参数该怎么改？'],
    ['Each addition and multiplication records its inputs and local derivatives. Backward applies the chain rule through the graph and accumulates parameter gradients. Adam updates weights using gradients and past momentum. This lesson uses separate, seeded random weights and repeats one name: that is overfitting, not evidence that the model can generate many names.', '每次加法、乘法都记录自己的输入和局部导数。Backward 沿计算图反向应用链式法则，给参数累积梯度。Adam 再根据梯度和历史动量更新权重。课程用独立、固定种子的随机权重，重复一个名字来观察学习；这会过拟合，不能证明模型已经会生成各种名字。'],
    ['Run 1 training update', '执行 1 次训练更新'], ['How does backward propagate through weight × hidden?', '乘法 weight × hidden 的反向传播关系是什么？'],
    ['It updates hidden first, then follows an arrow to weight', '先更新 hidden，再沿箭头更新 weight'],
    ['Gradients branch to weight and hidden; shared parameters accumulate contributions from multiple paths', '梯度分别流向 weight 和 hidden；共享参数累积多条路径'],
    ['It changes only the final weight of the correct character', '只改变正确字符的最后一个权重'],
    ['The two values are parallel multiplication inputs. The weight branch receives upstream gradient × hidden, and the hidden branch receives upstream gradient × weight. Summing all contributions gives the total gradient.', '两个数是乘法的并列输入。到 weight 的分支贡献 = 上游梯度 × hidden，到 hidden 的贡献 = 上游梯度 × weight；所有贡献相加才是总梯度。'],
    ['A gradient is a local rate of change. Adam uses past state, so one update does not guarantee a lower loss.', '梯度是局部变化率。Adam 使用历史状态，单次更新后的 Loss 不保证一定下降。'],
    ['From prediction to generation', '从预测到生成'], ['If the model most prefers a, why might it still generate another character?', '模型最偏爱 a，为什么仍然可能生成别的字符？'],
    ['Generation computes sampling probabilities from logits / T, then draws a random number to choose a token. The chosen token becomes the next input. A low temperature sharpens the distribution, but positive-temperature random sampling does not guarantee choosing the top token.', '生成时先用 logits / T 计算采样概率，再抽一个随机数选 token。选中的 token 作为下一步输入。低温让分布更集中，但只要温度大于零、仍使用随机采样，就不保证总选第一名。'],
    ['Generate the next token', '生成下一个 token'], ['How do training and generation differ in their input history?', '训练与生成在输入上下文上有什么区别？'],
    ['Training uses true history; generation uses its own chosen characters', '训练用真实历史字符；生成用自己刚选出的字符'],
    ['Both receive the complete correct answer in advance', '训练和生成都先拿到完整正确答案'],
    ['Generation retrains parameters for every character', '生成时参数每个字符都会重新训练'],
    ['During training, targets and input history come from the data. During generation, the future is unknown and the model receives its own sampled output. Generation here performs only forward computation, without updating weights.', '训练时目标来自数据，历史输入也来自数据；生成时未来未知，模型接收自己采样出的输出。在这里生成只做前向计算，不更新权重。'],
    ['Autoregression: predict → sample → feed the output back as input, until <BOS> or the length limit.', '自回归：预测 → 采样 → 把输出送回输入，直到 <BOS> 或长度上限。'],
    // Course chrome, experiment hints, formulas and accessibility labels.
    ['GPT guided course', 'GPT 引导课程'], ['MICROGPT / Understand GPT through one name', 'MICROGPT / 从一个名字理解 GPT'],
    ['Follow a real model through prediction, learning and generation', '跟着真实模型，走完预测、学习与生成'],
    ['About 15–20 minutes · Basic programming is enough; no ML background required · Progress is saved in this browser.', '约 15–20 分钟 · 需要基础编程知识，不需要机器学习背景 · 进度保存在本浏览器。'],
    ['Chapter and answer records restored. Training weights, sampling history and experiment results were reset; rerun the experiments.', '已恢复章节与答题记录。训练权重、采样轨迹与实验结果已重置；请重新操作实验。'],
    ['This browser cannot save course progress. All lessons still work in this page.', '本浏览器无法保存课程进度；当前页面仍可完成所有课程。'],
    ['Exit guide · Free exploration', '退出引导 · 自由探索'], ['Start over', '从头学习'], ['Course chapters', '课程章节'],
    ['Skipped', '已跳过'], ['To explore', '待理解'], ['Understood', '已掌握'], ['Try again', '可重试'],
    ['Hands-on experiment', '亲手试一次'], ['Lesson model experiment', '本关模型实验'],
    ['Run the experiment, then select a row, head or visible cell. Striped cells cannot be read.', '先运行实验，再点选行、head 或可见格子。斜纹格表示禁止读取。'],
    ['Train a separate model without changing the pretrained weights in the sandbox.', '训练独立模型，不会改变自由探索页的预训练权重。'],
    ['Generate freely using the pretrained model, not targeting emma. A fixed random seed makes reset comparisons reproducible.', '用预训练模型自由生成，不以 emma 为目标。固定随机种子方便重置后比较。'],
    ['Fixed example emma: think first, then verify with the experiment below.', '固定样例 emma；先思考，再用下面的操作验证。'],
    ['Temperature:', '温度 Temperature：'], ['Train 10 more steps', '再训练 10 步'], ['Reset generation', '重置生成'],
    ['Experiment results appear here. Questions and navigation are always available.', '实验结果会显示在这里。答题和导航随时可用。'],
    ['Check your understanding', '检查一下理解'], ['Understanding check', '理解检查'], ['Skip this question', '跳过本题'],
    ['← Previous', '← 上一步'], ['Next →', '下一步 →'], ['Review your learning', '查看学习回顾'],
    ['Remember this', '记住这一点'], ['Explore in the sandbox', '去沙盒自由实验'],
    ['Corresponding implementation', '对应的运行代码'],
    ['Blue lines highlight this concept. JavaScript is the implementation that runs in the browser.', '蓝色行对应本关概念；JavaScript 是浏览器实际运行的实现。'],
    ['Code comparison:', '代码对照：'], ['Python teaching adaptation', 'Python 教学改编'],
    ['Actual lesson source', '本关实际源码'], ['Loading local source…', '正在读取本地源码…'],
    ['Expand formulas and source notes', '展开公式与源码说明'],
    ["The Python comparison comes from this project's generate_weights.py, a local adaptation of Karpathy's algorithm, not a live download of upstream source.", 'Python 对照取自本项目的 generate_weights.py，是 Karpathy 算法的本地改编；不是实时下载的上游源码。'],
    ['View the original', '查看原作'], ['Random weights reset. Training step count is 0.', '随机权重已重置。训练步数为 0。'],
    ['Generation history cleared and the fixed random seed restored.', '已清空生成历史并恢复固定随机种子。'],
    ['Local source could not be loaded. Open this page through an HTTP static server; model experiments can still run.', '本地源码读取失败。请通过 HTTP 静态服务器打开页面；模型实验仍可继续。'],
    ['Training did not complete. Reset the experiment and try again.', '本次训练未完成，请重置实验后重试。'],
    ['tokens = [BOS] + encode(name) + [BOS]; input[t] corresponds to target[t+1]. The same BOS marks both start and end here.', 'tokens = [BOS] + encode(name) + [BOS]；input[t] 对应 target[t+1]。同一个 BOS 在这里兼作起点和终点。'],
    ['p_i = exp(z_i − max(z)) / Σ exp(z_j − max(z)). Subtracting the maximum leaves probabilities unchanged and reduces the risk of exponent overflow.', 'p_i = exp(z_i − max(z)) / Σ exp(z_j − max(z))。减去最大值保持概率不变，并降低指数溢出的风险。'],
    ['attention = softmax(Q·K / √head_dim), output = Σ attention_t · V_t. Caching only current and past positions enforces causality.', 'attention = softmax(Q·K / √head_dim)，output = Σ attention_t · V_t。这里只缓存已经处理的当前位置与过去位置，实现因果约束。'],
    ['L = (1/N) Σ −ln p(target_t | true prefix). Use the natural logarithm; 0 < p ≤ 1.', 'L = (1/N) Σ −ln p(target_t | true prefix)。取自然对数；0 < p ≤ 1。'],
    ['For y = w × h: ∂L/∂w += (∂L/∂y)h, ∂L/∂h += (∂L/∂y)w. Contributions to shared parameters are summed across all paths.', '对于 y = w × h：∂L/∂w += (∂L/∂y)h，∂L/∂h += (∂L/∂y)w。共享参数的贡献在所有路径上相加。'],
    ['p(T) = softmax(logits / T). Select the token whose cumulative interval contains random u. T=0 greedy decoding needs separate handling; never divide by zero.', 'p(T) = softmax(logits / T)。随机数 u 落入哪个累积概率区间，就选择哪个 token。T=0 的贪心需要另行处理，不能直接除以零。'],
    ['Position', '位置'], ['Current input', '当前输入'], ['Correct next token', '正确下一个 token'],
    ['Current context: ', '当前上下文：'], ['. The data target is', '。数据里的目标是'],
    ['.', '。'],
    ['logit score', 'logit 原始分数'], ['softmax probability', 'softmax 概率'],
    ['Input → target', '输入 → 目标'], ['Correct-target probability', '正确目标概率'],
    ['These are pretrained weights. The next lesson starts from fresh random weights, so its initial loss will differ.', '这里评估的是预训练权重。下一关会从新的随机权重出发学习，因此初始 Loss 不同。'],
    ['Select Head:', '选择 Head：'], ['Rows are Queries, columns are Keys; future cells are masked', '行是 Query，列是 Key；未来格子被遮挡'],
    ['Masked', '遮挡'],
    ['This shows one target-logit branch in the backward direction. Hidden and Weight are parallel inputs; a branch contribution is not the total gradient. Values are from before this update.', '下面按反向传播方向展示一个目标 logit 的分支。Hidden 和 Weight 是并列输入；分支贡献不等于总梯度。节点值来自本次更新前。'],
    ['Click a node for actual values and formulas.', '点击节点查看真实数值和公式。'],
    ['View Backward code', '查看 Backward 代码'], ['View Adam update', '查看 Adam 更新'],
    ['Training: true history', '训练：真实历史'], ['Generation: its own history', '生成：自己的历史'],
    ['Input comes from data; each target is the next true character.', '输入来自数据；每步目标是下一个真实字符。'],
    ['The five most probable candidates. If the sampled token is outside the top five, it is also listed.', '五个最可能的候选；实际选中的 token 若不在前五，也会单独列出。'],
    ['Candidate token', '候选 token'], ['Original probability T=1', '原始概率 T=1'], ['← Sampled', '← 实际选择'],
    ['A fixed seed enables comparisons after reset. Temperature changes affect the next draw; the table uses the temperature of the displayed step.', '固定随机种子便于重置后比较；更改温度影响下一步抽样。表格显示刚刚这一步的温度。'],
    ['GPT predicts a distribution from a prefix. Training uses the true next token for loss, then gradients and Adam update parameters. Generation samples and feeds its own output back as input.', 'GPT 根据前缀预测分布；训练用真实下一个 token 计算 Loss，梯度和 Adam 更新参数；生成采样后将自己的输出送回输入。'],
    ['Opening the review does not mean every concept is mastered. Revisit any concept or explore in the sandbox.', '打开回顾不等于全部掌握。未掌握的概念可点击回顾，也可进入沙盒自由实验。'],
    ['Language preference could not be saved; switching still works in this page.', '无法保存语言偏好；当前页面仍可切换语言。'],
  ];

  // Slots carry numbers/tokens, never HTML. Captured prose is translated recursively.
  const templates = [
    ['vocab={vocab} · embed={embed} · heads={heads} · layers={layers} · block={block} · params={params}', '词表={vocab} · 嵌入维数={embed} · 头数={heads} · 层数={layers} · 上下文={block} · 参数={params}'],
    ['Start learning · lesson {n}', '开始学习 · 第 {n} 节'],
    ['Continue learning · lesson {n}', '继续学习 · 第 {n} 节'],
    ['Return to basics lesson {n}: {title}', '返回基础篇第 {n} 节：{title}'],
    ['Return to advanced lesson {n}', '返回进阶篇第 {n} 节'],
    ['vocab={vocab} · embed={embed} · heads={heads} · layers={layers} · block={block} · params={params} · loss={loss}', '词表={vocab} · 嵌入维数={embed} · 头数={heads} · 层数={layers} · 上下文={block} · 参数={params} · 损失={loss}'],
    ['shape {shape}', '形状 {shape}'], ['[4 heads × {keys} keys]', '[4 个 head × {keys} 个 Key]'],
    ['Q, K, V: [16] = 4 heads × 4', 'Q、K、V：[16] = 4 个 head × 4 维'], ['[27], sum = 1', '[27]，总和 = 1'],
    ['Head {head}', '注意力头 {head}'],
    ['{n}/{max} characters · a-z only', '{n}/{max} 个字符 · 仅限 a-z'],
    ['Input was limited to {max} characters.', '输入已限制为 {max} 个字符。'],
    ['Unsupported characters were removed. Input was limited to {max} characters.', '已移除不支持的字符。输入已限制为 {max} 个字符。'],
    ['Position {pos}: {input} → {target} (target) · KV cache size: {size}', '位置 {pos}：{input} → {target}（目标）· KV 缓存大小：{size}'],
    ['The chart shows head 0 at this position. Its {n} weights sum to 1. Causal attention exposes only the current token and earlier tokens, never the future.', '图中展示当前位置的 head 0，它的 {n} 个权重之和为 1。因果注意力只读取当前及过去的 token，不读取未来。'],
    ['Rows are queries; columns are keys. Sequence: {sequence}', '行是 Query，列是 Key。序列：{sequence}'],
    ['{n} positions were evaluated for “{name}”. Each prediction built more of the scalar computation graph.', '已计算“{name}”的 {n} 个位置。每次预测都建立更多标量计算图节点。'],
    ['Average loss was {loss}. Hardest pair: {input} → {target}, p={p}%, loss={tokenLoss}.', '平均损失为 {loss}。最难的预测：{input} → {target}，p={p}%，损失={tokenLoss}。'],
    ['{n} / {total} parameters received a non-zero gradient. Gradient RMS={rms}, max={max}.', '{n} / {total} 个参数得到非零梯度。梯度 RMS={rms}，最大绝对值={max}。'],
    ['Example weight wte[<BOS>][0]: {before} → {after} (raw gradient {grad}).', '示例权重 wte[<BOS>][0]：{before} → {after}（原始梯度 {grad}）。'],
    ['After step', '第'], ['{n}, loss fell from', '{n} 步后，损失从'], ['{n}, loss rose from', '{n} 步后，损失从'],
    ['to', '变为'], ['. One update is noisy; the important idea is that the error signal reaches every parameter that influenced this example through the chain rule.', '。单次更新有波动；关键是误差信号通过链式法则传到所有影响本样例的参数。'],
    ['temperature T={t} · probabilities = softmax(logits / T) · result = {name}', '温度 T={t} · 概率 = softmax(logits / T) · 结果 = {name}'],
    ['Token loss ({pair})', 'Token 损失（{pair}）'], ['value {n}', '前向值 {n}'], ['total grad {n}', '总梯度 {n}'], ['this branch {n}', '本分支贡献 {n}'],
    ['This single scalar summarizes all {n} next-token mistakes. Backpropagation begins by setting its gradient to 1.', '这个标量汇总了 {n} 个位置的下一个 token 预测误差。反向传播从将它的梯度设为 1 开始。'],
    ['This was the hardest prediction in the document. Because the document loss is a mean, its gradient is divided across {n} token losses.', '这是文档中损失最高的预测。文档损失取平均，因此其梯度分配给 {n} 个 token 损失。'],
    ['Coordinate {dim} made the largest absolute contribution to this target logit. Its gradient continues backward through the MLP, attention, and embeddings.', '第 {dim} 个坐标对目标 logit 的前向贡献绝对值最大。它的梯度继续经过 MLP、注意力和嵌入层反向传播。'],
    ['{explanation} Increasing this node would increase the loss.', '{explanation} 若该节点数值微小增加，损失会局部增加。'],
    ['{explanation} Increasing this node would decrease the loss.', '{explanation} 若该节点数值微小增加，损失会局部下降。'],
    ['{explanation} This node has no first-order effect on the current loss.', '{explanation} 该节点对当前损失没有一阶影响。'],
    ['logit = Σ weight[j] × hidden[j] · two parallel multiplication inputs receive gradients', 'logit = Σ weight[j] × hidden[j] · 两个乘法输入，各自接收梯度'],
    ['. The total also accumulates {scope}.', '. 总梯度还累积了{scope}。'],
    ['all candidate-logit contributions at this position', '同一位置全部候选 logit 的分支贡献'],
    ['all paths using this shared parameter in the document', '文档中所有使用这个共享参数的路径贡献'],
    ['Building Context (position {pos} of {last})', '建立上下文（位置 {pos} / {last}）'],
    ['Attention ({n} context)', '注意力（{n} 个历史位置）'], ['(position {pos}).', '（位置 {pos}）。'],
    ['({p}%). Top guess:', '（{p}%）。最高概率：'],
    ['({p}%). Head 0 focuses most on', '（{p}%）。Head 0 的最高关注权重分配给'],
    ['({p}%).', '（{p}%）。'],
    ['{explanation} Head 0 focuses most on', '{explanation} Head 0 的最高关注权重分配给'],
    ['Understood {n} / 6', '已掌握 {n} / 6'], ['Lesson {n} / 6', '第 {n} / 6 关'],
    ['{n}. Token', '{n}. Token'], ['{n}. Prediction', '{n}. 预测'], ['{n}. Attention', '{n}. 注意力'],
    ['{n}. Loss', '{n}. 损失'], ['{n}. Learning', '{n}. 学习'], ['{n}. Generation', '{n}. 生成'],
    ['Correct. {feedback}', '理解正确。 {feedback}'],
    ['Think again, or skip and continue. {feedback}', '再想一下，也可以跳过继续。 {feedback}'],
    ['Skipped; you can come back and retry. {feedback}', '已跳过，可随时回来重试。 {feedback}'],
    ['Encoded {n} tokens, with {positions} prediction targets. The ending marker has no successor to predict.', '编码得到 {n} 个 token，其中 {positions} 个位置提供预测目标。结束标记不再预测后继。'],
    ['ID {id} · pos {pos}', 'ID {id} · 位置 {pos}'],
    ['p(m) = {p}% · sum of all probabilities = {sum}', 'p(m) = {p}% · 全部概率之和 = {sum}'],
    ['Actual computation: {emb}D Embedding → Attention → {mlp}D MLP → {vocab} Logits → probabilities.', '真实计算：{emb} 维 Embedding → Attention → {mlp} 维 MLP → {vocab} 个 Logits → 概率。'],
    ['Document mean Loss = {loss}', '文档平均 Loss = {loss}'],
    ['Row {pos}: {token}', '行 {pos}：{token}'], ['Query {q} attends to Key {k}', 'Query {q} 关注 Key {k}'],
    ['Query at position {pos} can read only positions 0–{last}. This row sums to {sum}.', '位置 {pos} 的 Query 只能读取位置 0–{last}。本行权重之和 = {sum}。'],
    ['Head {head}: {token} at position {row} assigns {p}% weight to {keyToken} at position {col}. Future Keys/Values cannot be read.', 'Head {head}：位置 {row} 的 {token} 对位置 {col} 的 {keyToken} 分配 {p}% 权重。未来位置没有 Key/Value 可读。'],
    ['Step {step} · Loss {before} → {after}', '第 {step} 步 · Loss {before} → {after}'],
    ['Forward value {value} · total gradient {grad}', '前向值 {value} · 总梯度 {grad}'],
    ['Contribution from this target logit {grad}', '这个目标 logit 的分支贡献 {grad}'],
    ['A slight increase in this value locally lowers Loss. {scope}', '该数值微小增加，会使当前 Loss 局部下降。 {scope}'],
    ['A slight increase in this value locally raises or leaves Loss unchanged. {scope}', '该数值微小增加，会使当前 Loss 局部增加或不变。 {scope}'],
    ['The total gradient accumulates {scope}.', '总梯度累积了{scope}。'],
    ['Current output {token} becomes the next input. Inference does not update parameters.', '当前输出 {token} 会成为下一步输入。 推理不更新参数。'],
    ['Current output {token} ends this generation and will not be fed into another step. Inference does not update parameters.', '当前输出 {token} 使本次生成停止，不再输入下一步。 推理不更新参数。'],
    ['Sampling probability T={t}', '采样概率 T={t}'],
    ['Top token {top}; sampled token {sampled}.', '最高概率 {top}；实际选择 {sampled}。'],
    ['Random u={u} ∈ [{lower}, {upper}).', '随机数 u={u} ∈ [{lower}, {upper})。'],
    ['Generated: {name} · end marker predicted; stopped.', '已生成：{name} · 预测到结束标记，停止。'],
    ['Generated: {name} · context limit reached; stopped.', '已生成：{name} · 达到上下文上限，停止。'],
    ['Generated: {name} · adjust temperature and continue.', '已生成：{name} · 调整温度，然后继续下一步。'],
    ['Six-lesson review · understood {n}/6', '六关学习回顾 · 已掌握 {n}/6'],
    ['{n}. {title} · {status}', '{n}. {title} · {status}'],
    ['Guided course: fixed example emma · Course and sandbox experiments are independent.', '引导课程：固定样例 emma · 模型实验与沙盒各自独立。'],
  ];

  const normalize = value => String(value).replace(/\s+/g, ' ').trim();
  const exact = new Map();
  for (const [en, zh] of messages) {
    exact.set(normalize(en), { en, zh });
    exact.set(normalize(zh), { en, zh });
  }
  const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function compile(source) {
    const slots = [];
    const parts = normalize(source).split(/(\{\w+\})/);
    const pattern = parts.map(part => {
      if (/^\{\w+\}$/.test(part)) { slots.push(part.slice(1, -1)); return part === '{head}' ? '(\\d+)' : '(.+?)'; }
      return escapeRegex(part);
    }).join('');
    return { regex: new RegExp(`^${pattern}$`), slots, specificity: normalize(source).replace(/\{\w+\}/g, '').length };
  }
  const patterns = templates.flatMap(([en, zh]) => [
    { ...compile(en), en, zh }, { ...compile(zh), en, zh },
  ]).sort((a, b) => b.specificity - a.specificity);
  let language = 'zh';
  let observer;
  let initialized = false;
  const proseSlots = new Set(['feedback', 'explanation', 'scope', 'title', 'status', 'shape']);
  const translationCache = new Map();
  const textBindings = new WeakMap();
  const attrBindings = new WeakMap();
  const attrs = ['placeholder', 'title', 'aria-label'];
  const skip = 'script, style, pre[data-source], [data-no-i18n]';

  function translate(value, target = language, depth = 0) {
    const original = String(value);
    const cacheKey = `${target}:${original}`;
    if (depth === 0 && translationCache.has(cacheKey)) return translationCache.get(cacheKey);
    const input = normalize(original);
    const pair = exact.get(input);
    let translated = pair?.[target];
    if (translated === undefined && depth < 5) {
      for (const pattern of patterns) {
        const match = input.match(pattern.regex);
        if (!match) continue;
        const values = Object.fromEntries(pattern.slots.map((slot, i) => [slot,
          proseSlots.has(slot) ? translate(match[i + 1], target, depth + 1) : match[i + 1],
        ]));
        translated = pattern[target].replace(/\{(\w+)\}/g, (_, slot) => values[slot]);
        break;
      }
    }
    const before = original.match(/^\s*/)[0], after = original.match(/\s*$/)[0];
    const result = translated === undefined ? original : before + translated + after;
    if (depth === 0) {
      if (translationCache.size >= 2000) translationCache.clear();
      translationCache.set(cacheKey, result);
    }
    return result;
  }

  function updateText(node) {
    if (node.parentElement?.closest(skip)) return;
    let binding = textBindings.get(node);
    if (!binding || node.data !== binding.rendered) binding = { source: node.data };
    binding.rendered = translate(binding.source);
    textBindings.set(node, binding);
    if (node.data !== binding.rendered) node.data = binding.rendered;
  }

  function updateAttributes(element) {
    if (element.closest('[data-no-i18n]')) return;
    let bindings = attrBindings.get(element);
    if (!bindings) { bindings = new Map(); attrBindings.set(element, bindings); }
    for (const attr of attrs) {
      if (!element.hasAttribute(attr)) continue;
      const value = element.getAttribute(attr);
      let binding = bindings.get(attr);
      if (!binding || value !== binding.rendered) binding = { source: value };
      binding.rendered = translate(binding.source);
      bindings.set(attr, binding);
      if (value !== binding.rendered) element.setAttribute(attr, binding.rendered);
    }
  }

  function observe() {
    observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attrs });
  }

  function apply() {
    if (!initialized) return;
    // Do not observe our own writes; later app updates still create fresh bindings.
    observer.disconnect();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) updateText(walker.currentNode);
    document.querySelectorAll('[placeholder], [title], [aria-label]').forEach(updateAttributes);
    document.title = translate('microgpt.js — GPT Teaching Sandbox');
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    const course = document.getElementById('tab-course');
    if (course) course.lang = document.documentElement.lang;
    observe();
  }

  function setLanguage(next) {
    if (!['zh', 'en'].includes(next)) return;
    language = next;
    const selector = document.getElementById('interface-language');
    if (selector) selector.value = language;
    try { localStorage.setItem(KEY, language); }
    catch {
      const notice = document.getElementById('language-status');
      if (notice) notice.textContent = '无法保存语言偏好；当前页面仍可切换语言。';
    }
    if (typeof Course !== 'undefined') Course.refreshLanguage();
    apply();
  }

  function init() {
    if (initialized) return;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'zh' || saved === 'en') language = saved;
    } catch { /* Keep the usable default when storage is unavailable. */ }
    initialized = true;
    document.getElementById('interface-language').value = language;
    document.getElementById('interface-language').addEventListener('change', event => setLanguage(event.target.value));
    observer = new MutationObserver(apply);
    apply();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { init, apply, setLanguage, translate, get language() { return language; } };
})();
