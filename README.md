# microgpt.js

一个直接在浏览器中运行的微型 GPT 教学沙盒。项目用尽量少的代码展示字符级 GPT 的关键组成，并提供逐 token 前向传播、概率分布、注意力热力图和自回归名字生成。

## 快速开始

项目没有前端构建依赖。在仓库目录启动静态文件服务器：

```powershell
python -m http.server 8000
```

然后打开 <http://127.0.0.1:8000/>。

> 不建议直接双击 `index.html`；通过本地 HTTP 服务运行更接近正常部署环境。

## 模型规模

- 字符级词表：`a-z` + `<BOS>`，共 27 个 token
- 1 个 Transformer 层
- 16 维 embedding
- 4 个 attention head，每头 4 维
- 上下文长度 16
- 4,192 个参数
- RMSNorm、无 bias、ReLU MLP

`<BOS>` 同时表示一个名字的开始和结束。训练目标是在每个位置根据当前及过去 token 预测下一个字符。

## 代码导读

建议按下面的顺序阅读：

1. `js/tokenizer.js`：字符与 token ID 的相互转换。
2. `js/autograd.js`：标量计算图与反向传播，是整个训练原理的最小基础。
3. `js/model.js`：embedding、RMSNorm、因果多头注意力、MLP、softmax 和自回归采样。
4. `js/optimizer.js`：Adam 参数更新。
5. `generate_weights.py`：把数据、模型、loss、反向传播和训练循环串起来，并导出权重。
6. `js/app.js` 与 `js/visualize.js`：教学交互和 Canvas 可视化。

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
- `js/*.js`：浏览器端模型、计算和交互代码
- `input.txt`：名字训练集
- `generate_weights.py`：训练与权重导出脚本
- `weights.json`：Python 导出的原始权重
- `data/weights.js`：浏览器可直接加载的权重

## 当前定位

这是原理演示项目，不是高性能训练框架。标量级自动微分很直观，但速度和内存效率远低于 PyTorch/JAX 等张量框架；这种取舍正适合逐行理解 GPT 的核心机制。

