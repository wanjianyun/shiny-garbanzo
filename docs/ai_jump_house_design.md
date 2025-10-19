# 《智械跳跳屋》设计文档

## 1. 项目文件结构与主要脚本逻辑

```text
智械跳跳屋 /
├── assets /
│   ├── scenes /
│   │   ├── Lobby.scene                # 实验室大厅，玩家与AI导师互动的主场景
│   │   ├── JumpLevel.scene            # 通用跳跃关卡场景预设
│   │   │   └── modules /
│   │   │       ├── platforms.prefab   # 可重复使用的平台组件
│   │   │       ├── hazards.prefab     # 障碍物（电磁墙、旋转激光等）
│   │   │       └── pickups.prefab     # 掉落的AI芯片碎片
│   │   ├── CardGallery.scene          # AI知识卡展示界面
│   │   └── LabCreative.scene          # 创意实验室（Prompt实验玩法）
│   ├── audio /
│   │   ├── bgm_lobby.mp3
│   │   ├── bgm_level.mp3
│   │   └── mentor_voice /             # AI导师语音文件
│   ├── textures /
│   │   ├── ui /
│   │   ├── cards /
│   │   └── level /
│   └── data /
│       ├── levels.json                # 关卡节奏、平台布局、触发知识点
│       ├── questions.json             # AI问答、复活题库
│       └── cards.json                 # 知识卡牌内容
├── scripts /
│   ├── core /
│   │   ├── GameManager.ts             # 生命周期管理、存档、等级系统
│   │   ├── DataLoader.ts              # 加载 JSON 数据并缓存
│   │   └── AudioController.ts         # 背景音乐与语音播放
│   ├── gameplay /
│   │   ├── PlayerController.ts        # 跳跃、碰撞检测、能力升级
│   │   ├── LevelController.ts         # 关卡生成、知识触发、胜负判断
│   │   ├── ChipCollector.ts           # 芯片收集与奖励逻辑
│   │   └── RevivalQuiz.ts             # 失败后的答题复活
│   ├── ui /
│   │   ├── KnowledgePopup.ts          # 弹出AI小知识
│   │   ├── QuizPanel.ts               # 问答交互
│   │   ├── CardCollectionView.ts      # 卡牌浏览与合成
│   │   └── MentorDialog.ts            # AI导师对话窗口
│   └── services /
│       ├── MentorAIService.ts         # Prompt接口封装（本地/在线LLM）
│       └── CreativeLabService.ts      # 创意实验室内容生成
├── docs /
│   └── ai_jump_house_design.md        # 设计文档（当前文件）
├── project.json                       # Cocos Creator 项目配置
└── README.md
```

### 核心逻辑流程概述

1. **GameManager** 初始化时调用 `DataLoader` 读取 `levels.json`、`questions.json`、`cards.json`，并根据玩家存档确定当前解锁章节、知识卡牌与导师好感度。
2. **LevelController** 根据 `levels.json` 当前关卡配置生成平台序列，注册每个平台的触发事件（知识点弹窗、芯片掉落、导师问答）。
3. **PlayerController** 监听输入（触摸/摇杆），计算跳跃轨迹；与平台、障碍、拾取物的碰撞通过 Cocos 物理系统触发；当玩家掉落时向 `RevivalQuiz` 发送失败事件。
4. **KnowledgePopup** 在关卡内受 LevelController 调度：玩家到达指定高度时弹出一句话知识，同时记录学习进度用于成就系统。
5. **ChipCollector** 收集到芯片后更新本地数据并判断是否达成组合，触发 `CardCollectionView` 解锁新卡。
6. **MentorDialog** 在大厅场景调用 `MentorAIService`，根据玩家输入生成简化回答；在关卡内则以预设问答形式出现。
7. **CreativeLabService** 在创意实验室使用预设模板或云端API生成图像/文本，返回给 `CardCollectionView` 作为学习笔记。

## 2. 第一关关卡脚本设计（示例）

以下脚本以 `levels.json` 中第一关 `chapter_1_level_1` 为例：

```jsonc
{
  "id": "chapter_1_level_1",
  "name": "初入实验室",
  "scene": "JumpLevel",
  "background": "textures/level/lab_intro.png",
  "gravity": -1400,
  "player": {
    "spawn": { "x": 0, "y": 0 },
    "jumpForce": 480,
    "moveSpeed": 220
  },
  "platforms": [
    { "id": "start", "type": "static", "position": { "x": 0, "y": 0 }, "width": 280 },
    {
      "id": "p1",
      "type": "static",
      "position": { "x": -120, "y": 240 },
      "width": 220,
      "knowledge": {
        "id": "ai_intro_01",
        "text": "AI（人工智能）是让机器拥有解决问题的能力。"
      },
      "chips": [
        { "id": "chip_algo_01", "type": "algorithm", "position": { "x": -110, "y": 280 } }
      ]
    },
    {
      "id": "p2",
      "type": "moving",
      "position": { "x": 140, "y": 520 },
      "path": [ { "x": 140, "y": 520 }, { "x": -40, "y": 520 } ],
      "speed": 60,
      "knowledge": {
        "id": "ml_intro_01",
        "text": "机器学习依靠数据来训练模型，让模型自己找到规律。"
      }
    },
    {
      "id": "p3",
      "type": "static",
      "position": { "x": 60, "y": 820 },
      "width": 200,
      "knowledge": {
        "id": "prompt_intro_01",
        "text": "Prompt 就是给AI的“指令”，写得越清晰结果越好。"
      },
      "mentor": {
        "dialogId": "mentor_quiz_intro",
        "question": "什么是机器学习？",
        "options": [
          { "label": "A", "text": "让机器自动吃饭", "isCorrect": false },
          { "label": "B", "text": "让机器从数据中学习规律", "isCorrect": true },
          { "label": "C", "text": "让机器变成机器人", "isCorrect": false }
        ],
        "correctFeedback": "答对啦！机器学习就是让模型通过数据训练找到规律。",
        "wrongFeedback": "再想想，从数据中找规律才是机器学习的核心。"
      }
    },
    {
      "id": "goal",
      "type": "goal",
      "position": { "x": 0, "y": 1100 },
      "width": 260,
      "knowledge": {
        "id": "ethics_intro_01",
        "text": "AI 也需要遵守伦理，避免误导与偏见。"
      }
    }
  ],
  "hazards": [
    {
      "id": "laser_01",
      "type": "rotating",
      "position": { "x": 20, "y": 650 },
      "radius": 80,
      "speed": 120
    }
  ],
  "revival": {
    "questionId": "revival_ml_basic"
  },
  "rewards": {
    "chips": [ "chip_algo_01" ],
    "cards": [ "card_ai_overview" ],
    "xp": 120
  }
}
```

复活题在 `questions.json` 中示例如下：

```jsonc
{
  "id": "revival_ml_basic",
  "question": "神经网络中的“权重”指的是什么？",
  "options": [
    { "label": "A", "text": "数据集的体重", "isCorrect": false },
    { "label": "B", "text": "连接强度，决定信号影响力", "isCorrect": true },
    { "label": "C", "text": "电脑主机的重量", "isCorrect": false }
  ],
  "correctFeedback": "权重代表连接的强弱，影响输出结果。",
  "wrongFeedback": "再想想，神经网络中的权重和现实世界的重量无关哦。"
}
```

## 3. AI 知识卡牌示例 (`cards.json` 片段)

```jsonc
[
  {
    "id": "card_ai_overview",
    "name": "AI概览",
    "rarity": "common",
    "category": "基础概念",
    "description": "人工智能旨在让机器模拟人类思考与决策。",
    "unlockCondition": "完成章节1-1",
    "content": {
      "definition": "AI 是一组算法集合，通过感知与学习完成指定任务。",
      "applications": ["语音助手", "图像识别", "游戏AI"],
      "funFact": "1956年的达特茅斯会议常被视为AI的诞生标志。"
    },
    "visual": {
      "prompt": "Futuristic lab hologram explaining AI basics, neon light, friendly style",
      "referenceImage": "textures/cards/ai_overview.png"
    }
  },
  {
    "id": "card_prompt_basics",
    "name": "提示词基础",
    "rarity": "uncommon",
    "category": "Prompt",
    "description": "提示词是与AI对话最重要的工具。",
    "unlockCondition": "收集3个Prompt芯片",
    "content": {
      "definition": "Prompt 是给AI的输入说明，指导生成方向。",
      "applications": ["写作辅助", "绘画创作", "代码生成"],
      "tips": [
        "包含角色、任务、输出格式",
        "指明语气与风格",
        "提供上下文例子"
      ]
    },
    "visual": {
      "prompt": "Notebook with glowing prompt words connecting to AI brain, playful",
      "referenceImage": "textures/cards/prompt_basics.png"
    }
  }
]
```

以上设计覆盖了文件结构规划、第一关关卡脚本以及知识卡牌示例，可作为后续开发与内容扩展的基础。
