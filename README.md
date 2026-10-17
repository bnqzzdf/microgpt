# microgpt.js

一个直接在浏览器中运行的微型 GPT 教学沙盒。项目用尽量少的代码展示字符级 GPT 的关键组成，并提供逐 token 前向传播、中间张量检查、真实梯度路径、训练闭环、注意力热力图和自回归采样轨迹。

本项目是 [Andrej Karpathy 的 `microgpt.py`](https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95) 的可视化教学改编。原作的核心观点是：一个无依赖文件即可包含训练和推理 GPT 的完整算法，其余复杂度主要服务于效率。本项目保留这条算法主线，并将关键中间状态做成可交互界面。上游许可说明见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 快速开始

项目没有前端构建依赖。在仓库目录启动静态文件服务器：

```powershell
python -m http.server 8000
```

然后打开 <http://127.0.0.1:8000/>。

### 部署到 Cloudflare Workers

线上地址：<https://microgpt.bnqzzdf.workers.dev/>。

自动部署通过 Cloudflare Workers Builds 连接 `bnqzzdf/microgpt`，生产分支为 `main`。
构建命令为 `npm test && npm run build`，部署命令为 `npx cf deploy --prebuilt`，
根目录为 `/`。推送到 `main` 后，Cloudflare 安装锁定的依赖、运行测试、构建并部署；
测试或构建失败时不会执行部署。构建使用 Node.js 24，生产部署凭据由 Cloudflare 管理，
无需将本机 OAuth 凭据或 API Token 提交到 GitHub。
当前仅启用 `main` 的生产自动部署，其他分支的预览构建未启用。
构建日志和发布状态可在 Cloudflare 的 microgpt 项目“部署”页面查看。

使用 Workers Static Assets 托管，训练和推理仍在浏览器中运行，无需服务端 API 或密钥。

```sh
npm ci
npm test
npm run build
npx cf deploy --dry-run
npm run deploy
```

首次部署前使用 `cf auth login` 登录，或通过环境变量提供具有 Workers 部署权限的
`CLOUDFLARE_API_TOKEN`。环境变量 Token 优先于 OAuth 登录；如果 Token 权限不足，
请在当前终端会话中移除该变量后使用 OAuth，或调整 Token 权限。

本机已有的基础设施 Token 不具备部署权限。使用已授权的 cf OAuth 登录重新部署时：

```powershell
Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
$env:NODE_OPTIONS = '--dns-result-order=ipv4first'
npm run deploy
```

以上设置只作用于当前终端会话，不修改系统保存的 Token。IPv4 优先用于规避本机连接
Cloudflare OAuth 令牌接口时出现的超时。

`cloudflare.config.ts` 管理 Worker 名称、兼容日期和观测设置；`wrangler.config.ts`
是 cf CLI 静态站点构建器生成的构建配置，部署入口仍为 `cf`。
`scripts/prepare-assets.cjs` 将公开网站文件复制到 `.cloudflare/site`，包含源码教学所需的
`generate_weights.py` 和第三方许可说明，不上传 Git 历史、测试或本地缓存。
部署生成文件和 `node_modules` 已加入 `.gitignore`。

> 不建议直接双击 `index.html`；通过本地 HTTP 服务运行更接近正常部署环境。

## 中英文切换

页面顶部的“语言 / Language”可切换中文与 English，覆盖六关课程、题目与反馈、四个自由沙盒、运行时实验说明、图表旁的标签、术语表及无障碍标签。默认中文，选择会保存在当前浏览器、当前站点；刷新恢复语言偏好。无法写入浏览器存储时会提示，但当前页面仍可切换。

切换仅更新文字，不重新计算模型：当前章节、答题记录、训练步数、梯度数值、采样随机数、已生成名字与温度均保留。刷新则仍按课程规则重置实验，不会保存权重。界面语言与 JavaScript/Python 源码对照是两种独立选择；实际源码、公式中的变量名、token、用户输入与模型生成的名字不翻译。

翻译集中在 `js/i18n.js` 的双语文案和动态句子模板中，使用原始文本绑定和本地渲染监听，不调用翻译服务、不改模型计算。添加界面文案时应同时添加两种语言；动态模板只翻译说明文字，数值与模型数据保持原样。实际源码区使用 `data-source` 排除翻译，模型名字使用 `data-no-i18n`。覆盖测试会检查六关内容、公式、静态沙盒文案和各位置的动态说明。

## 模型规模

- 字符级词表：`a-z` + `<BOS>`，共 27 个 token
- 1 个 Transformer 层
- 16 维 embedding
- 4 个 attention head，每头 4 维
- 上下文长度 16
- 4,192 个参数
- RMSNorm、无 bias、ReLU MLP

`<BOS>` 同时表示一个名字的开始和结束。训练目标是在每个位置根据当前及过去 token 预测下一个字符。

## 交互学习路线

页面默认进入**六关引导课程**，面向懂基础编程、还没有机器学习背景的学习者，建议用时约 15–20 分钟：

1. 用 `emma` 理解 Token ID，以及输入/目标相差一个位置。
2. 查看真实 Logits 与 Softmax 概率，而不是把预测误解为唯一答案。
3. 操作因果注意力矩阵：切换 Head、选择 Query 行与可见 Key；未来位置明确遮挡。
4. 计算每个真实目标的交叉熵及文档平均 Loss。
5. 从固定种子的独立随机权重训练，查看真实梯度分叉及 Adam 更新；这只是单样例过拟合实验。
6. 用预训练模型逐 token 自由生成，比较温度变化、随机抽样和「自己的历史」与训练中的「真实历史」。

每关都包含问题、模型实验、可重试或跳过的理解题、解释和实际源码高亮；JavaScript 是浏览器运行实现，Python 对照来自本地 `generate_weights.py` 教学改编。章节可随时跳转，无答题锁定。可以退出引导进入下面的自由沙盒，再回来继续。

课程只在当前浏览器、当前站点保存章节、答题状态和回顾状态，不保存模型权重、随机轨迹与实验结果。重新加载后明确提示实验重置；“从头学习”清空课程记录并重置课程实验，不改动沙盒。无法使用浏览器存储时仍可完成课程，但不能跨刷新恢复进度。

自由沙盒保留原有四个入口：

1. **Predict**：逐位置回答“下一个 token 是什么”，并查看 Embedding、Q/K/V、Attention、MLP、Logits 和 Softmax 的真实形状与数值。
2. **Learn**：从随机权重执行 Forward → Loss → Backward → Adam；点击一条真实梯度路径，理解链式法则如何从文档损失传到具体参数。
3. **Generate**：查看温度缩放后的概率、实际采样 token、随机数及其落入的累积概率区间。
4. **Attention**：比较四个 head 的完整因果注意力矩阵，理解每个位置为什么只能读取当前和过去 token。

页面刻意区分“测量到的事实”和“解释性比喻”。例如注意力 head 可以学到不同模式，但只有在可视化数据支持时，才应给某个 head 指定“元音检测器”等语义角色。

## 从模型到助手：离线进阶篇

主导航的“从模型到助手”和第六关回顾中的“继续”入口，打开一个独立的三模块进阶篇。无需密钥、后端、模型下载或外发数据；基础六关与四个沙盒保持原样。

1. **拆开一段对话**：对照聊天气泡、角色/内容字段、教学序列和教学 token；排除历史后仍保留气泡，检查本次输入是否包含口令证据。消息与片段可联动高亮；预算超限明确显示，不静默截断。`teaching-chat-v1` 的 Unicode 码点 tokenizer 仅供教学，不是任何真实聊天模型的 tokenizer，也不接入名字模型。
2. **走完一次真实生成**：独立实例加载已有名字模型，逐步查看 BOS + 前缀、prefill、首 token、decode、KV 位置数、真实概率、随机数和停止原因。固定种子，保守上下文预算，运行前后核对参数快照。缓存重算采用独立空缓存作对照，不改变当前运行或消耗采样随机数。自动推进的播放间隔不代表模型耗时。
3. **验证一次解题**：先看预训练/后训练/固定权重执行的能力来源卡，再操作四个预设案例。确定性程序分别核对最终答案、算术等式与题意，覆盖答案正确但步骤错误等情况。不调用语言模型评分，不把教材统计为真实模型准确率或推理提升，也不把公开解答视为完整内部思维。

教材为本项目在 AI 辅助下编写的预设内容，**不是聊天模型运行记录**。每个结果面板显示来源标签。真实大模型聊天、历史消融和求解对照属于第二阶段，当前只有默认关闭、不会发送请求的适配器契约。

本篇学习进度独立保存在 `microgpt.bridge.v1`，只包含模块、理解题和回顾状态；刷新清空消息选择、模型状态与实验结果。重学本篇不会重置基础课、沙盒或界面语言。界面中英切换不改已有实验内容；“载入中文/英文样例”是明确的新场景操作。可主动将当前输入、真实生成轨迹和判题结果下载为本地 JSON，不上传。

方案见 [`docs/model-to-assistant-plan.md`](docs/model-to-assistant-plan.md)，实施范围与验证记录见 [`docs/bridge-implementation.md`](docs/bridge-implementation.md)。五位目标读者试用及实际屏幕阅读器走查尚需人工安排，不把自动化通过等同于完整发布验收。

## 代码导读

建议按下面的顺序阅读：

1. `js/tokenizer.js`：字符与 token ID 的相互转换。
2. `js/autograd.js`：标量计算图与反向传播，是整个训练原理的最小基础。
3. `js/model.js`：embedding、RMSNorm、因果多头注意力、MLP、softmax 和自回归采样。
4. `js/optimizer.js`：Adam 参数更新。
5. `generate_weights.py`：把数据、模型、loss、反向传播和训练循环串起来，并导出权重。
6. `js/app.js` 与 `js/visualize.js`：预测阶段检查器、梯度路径、单步训练、采样轨迹和 Canvas 可视化。
7. `js/course.js` 与 `css/course.css`：六关课程、进度恢复、源码对照和窄屏布局；复用沙盒的模型和梯度计算。
8. `js/i18n.js`：统一语言切换、偏好保存、双语文案与动态文字绑定。
9. `data/bridge-scenarios.js`、`js/bridge-core.js`、`js/bridge-runner.js`、`js/bridge-course.js`：双语进阶教材、纯函数变换/判题、独立真实推断与页面控制。

核心数据流：

```text
字符 → token ID → token embedding + position embedding
     → RMSNorm → causal self-attention + residual
     → RMSNorm → MLP + residual
     → logits → softmax → 下一个字符的概率
```

训练时，对正确的下一个字符计算交叉熵损失 `-log(p_target)`，再通过自动微分求出每个参数的梯度，由 Adam 更新参数。生成时，将采样得到的字符重新送回模型，直到再次生成 `<BOS>` 或达到最大长度。

## 文件说明

- `index.html`：页面结构和样式
- `css/course.css`：课程界面、键盘焦点和梯度分叉样式
- `js/*.js`：浏览器端模型、计算和交互代码
- `input.txt`：名字训练集
- `generate_weights.py`：训练与权重导出脚本
- `weights.json`：Python 导出的原始权重
- `data/weights.js`：浏览器可直接加载的权重

## 验证

无需安装额外测试依赖，有 Node.js 时执行：

```powershell
node tests/model-checks.cjs
node tests/i18n-checks.cjs
node tests/bridge-checks.cjs
```

检查 Token 对齐、概率归一化、因果注意力、平均 Loss、共享梯度累积、梯度与有限差分一致性、Adam 更新、课程模型隔离、采样区间边界、自回归输入以及所有课程源码锚点。

语言测试覆盖六关题目/选项/反馈/公式、静态沙盒与术语表、动态句子插值、模型数据不翻译、初始/中间/最终预测位置、原文绑定往返切换和语言偏好保存。界面回归时还应在有实验结果的情况下切换两种语言，确认数值与源码完全不变；分别检查两种语言的窄屏布局与键盘操作。

进阶篇测试还覆盖消息筛选/Unicode 偏移/保留标记、显式预算、独立进度与禁用适配器、prefill 首输出复用、KV 重算、固定种子轨迹、权重隔离、BOS/预算/取消/错误停止、分离的答案/步骤/题意判定，以及全部双语文案和九道理解题。

界面手动回归：依次完成六关实验，测试答错重试/跳过、源码语言切换、训练重置、温度控制与生成停止、沙盒退出/返回、刷新后的进度恢复和实验清空；另检查 390px 窄屏与键盘导航。梯度图沿反向传播方向展示，并把 Hidden/Weight 画为乘法的并列输入，明确区分单分支贡献与总梯度。

## 当前定位

这是原理演示项目，不是高性能训练框架。标量级自动微分很直观，但速度和内存效率远低于 PyTorch/JAX 等张量框架；这种取舍正适合逐行理解 GPT 的核心机制。
