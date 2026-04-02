---
id: "53c57684ae2482f5fa5edfc8c0ffebfd"
title: "新强化学习框架RAGEN及相关研究成果介绍"
type: "AI链接笔记"
tags: ["AI链接笔记", "强化学习框架", "RAGEN", "VAGEN"]
domain: "AI 核心技术与模型"
date: "2025-04-25"
connections:
  - noteId: "de4c34cf76b69fc3d65bea86e9cbeebd"
    score: 0.7885228131936757
    type: "semantic"
  - noteId: "405b0564ac2c09cda3c5068a5d2f8b17"
    score: 0.7883844044859253
    type: "semantic"
  - noteId: "6a67131e8960e89ac1496ab7e9ce8d8c"
    score: 0.788284125004944
    type: "semantic"
  - noteId: "56a24815277616a8fddfad280b81694a"
    score: 0.7868044826184528
    type: "semantic"
  - noteId: "d83512838d44fe0dccb1153c2c819a49"
    score: 0.7855735758032966
    type: "semantic"
  - noteId: "b56d83980ff592e244b55edccba12ab7"
    score: 0.7834172432098502
    type: "semantic"
  - noteId: "620b134d1e4b520fc0253c2f9f16e533"
    score: 0.7755198976697861
    type: "semantic"
  - noteId: "b6f2ebbdcb7036c0dbfcf3a27c03b0d2"
    score: 0.7735218713214616
    type: "semantic"
x: 0.54119930446071
y: 0.48822131649402234
---

原文： 新强化学习框架RAGEN及相关研究成果介绍 🌟 框架介绍 - 新强化学习框架RAGEN由DeepSeek前员工Zihan Wang、斯坦福李飞飞团队等参与创作，可训练Agent在行动中深度思考。论文一作Zihan Wang曾在DeepSeek参与相关工作，现于美国西北大学读博。 - RAGEN探讨了多轮强化学习训练Agent的问题及解决办法。 😫 训练难点 - Echo Trap（回声陷阱） ：多轮强化学习中，模型过度依赖局部收益推理，使行为单一、探索能力衰退，影响长期收益。 - 数据质量 ：Agent生成的交互数据影响强化学习效果，合理数据需有多样性、适度交互粒度和实时性，如单个任务多试几次，每轮限制5 - 6个动作，保持rollout频繁更新。 - 缺乏推理动机 ：若无精心设计的奖励函数，Agent难学会多轮任务持续推理能力，可能出现匹配固定模式的假象，关键是建立更细粒度、面向解释的奖励机制。 🔧 系统组成 - MDP Formulation ：将Agent与环境的交互表述为马尔可夫决策过程 (MDP)，状态和动作是token序列，允许在环境动态上推理。 - StarPO ：通用强化学习框架，用于优化Agent的多轮交互轨迹，在Rollout阶段生成多条轨迹，接收轨迹历史记录生成推理引导动作，环境返回反馈；在Update阶段用重要性采样优化整个轨迹，支持PPO、GRPO等多种优化策略。 📈 主要发现 - 发现1 ：多轮训练引入新的不稳定模式，单轮强化学习方法的adaptations在Agent任务中常崩溃，PPO中的“批评者”无法阻止推理能力下降。 - 发现2 ：Agent强化学习中的模型崩溃体现为“回声陷阱”，训练后模型收敛到固定措辞，强化表面模式而非一般推理。 - 发现3 ：崩溃遵循类似动态，奖励的标准差和熵在性能下降前波动，梯度范数峰值标志不可逆崩溃临界点。 - 发现4 ：基于不确定性的过滤提高训练稳定性和效率，基于奖励方差过滤训练数据可对抗“回声陷阱”。 - 发现5 ：任务多样性、行动预算和推出频率影响数据质量，多样化任务实例、合适行动预算和及时rollouts很重要。 - 发现6 ：若无精心奖励设计，推理行为无法产生，奖励信号仅关注最终结果会使推理能力在训练中衰退。 🎯 相关项目 - 同团队的VAGEN项目使用多轮强化学习训练多模态Agent，引入回合感知推理交互链优化 (TRICO) 算法，通过选择性token屏蔽和跨轮credit分配扩展传统RICO方法，更适合多模态Agent。 📝 开源信息 - RAGEN、VAGEN代码均已开源，论文链接为 https://github.com/RAGEN-AI/RAGEN/blob/main/RAGEN.pdf ，代码链接分别为 https://github.com/RAGEN-AI/RAGEN 和 https://github.com/RAGEN-AI/VAGEN 。