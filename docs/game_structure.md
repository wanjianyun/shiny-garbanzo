# 《智械跳跳屋》文件结构与主要脚本逻辑框架

## 文件与目录结构概览
```text
project-root/
├── assets/
│   ├── audio/                # 音效与背景音乐，含AI导师语音
│   ├── fonts/                # UI字体
│   ├── images/               # 关卡背景、卡牌插画、UI图标
│   └── spine/                # 角色与AI导师骨骼动画
├── config/
│   ├── levels.json           # 关卡配置主表（跳跃节奏、知识点）
│   ├── questions.json        # AI导师问答题库
│   ├── cards.json            # AI知识卡牌定义
│   └── shop_items.json       # 皮肤、服装、卡包等商城内容
├── core/
│   ├── GameApp.ts            # 小游戏入口，初始化引擎与全局单例
│   ├── Router.ts             # 场景切换（主菜单、实验室、关卡）
│   └── EventBus.ts           # 全局事件中心（关卡、UI、数据通信）
├── data/
│   ├── PlayerModel.ts        # 玩家数据（等级、碎片、卡牌、设置）
│   ├── ProgressModel.ts      # 关卡进度与知识图谱状态
│   └── InventoryModel.ts     # 芯片碎片、消耗品、货币等背包数据
├── gameplay/
│   ├── LevelController.ts    # 跳跃关卡主逻辑（节奏、平台生成、胜负判断）
│   ├── JumpSystem.ts         # 玩家跳跃输入、体力、连跳校验
│   ├── KnowledgeTrigger.ts   # 平台触发知识点弹窗、语音播报
│   ├── ChipCollector.ts      # 碎片收集与掉落算法
│   ├── RevivalQuiz.ts        # 复活问答判定，接入题库
│   └── AchievementTracker.ts # 成就与探索等级计算
├── lab/
│   ├── MentorDialog.ts       # AI导师对话系统（预设问答 + LLM接口）
│   ├── PromptPlayground.ts   # 创意实验室，提示词输入与生成结果展示
│   └── CardGallery.ts        # 知识卡牌浏览、合成、收藏
├── ui/
│   ├── HUDLayer.ts           # 关卡内界面（进度条、碎片计数、提示）
│   ├── Popups.ts             # 弹窗合集（知识提示、复活答题、奖励）
│   ├── MentorChatView.ts     # 对话界面UI
│   └── CardAlbumView.ts      # 卡牌图鉴UI
├── utils/
│   ├── Localization.ts       # 多语言支持
│   ├── AudioManager.ts       # 声音管理
│   ├── Storage.ts            # 存档、云存储
│   └── LLMClient.ts          # GPT/通义等接口封装
├── tests/
│   ├── LevelSimulation.test.ts
│   └── MentorDialog.test.ts
└── project.json              # 微信小游戏配置
```

## 主要脚本逻辑框架

### GameApp.ts
- 初始化引擎与资源加载器。
- 创建全局事件总线、数据模型单例（PlayerModel、ProgressModel等）。
- 根据玩家存档选择默认场景：新玩家进入“AI实验室导览”，老玩家恢复上次关卡。

### LevelController.ts
1. **关卡初始化**：读取`levels.json`中的配置，生成平台节奏、知识节点、芯片掉落点。
2. **游戏循环**：
   - 监听`JumpSystem`的跳跃事件，更新玩家高度与进度。
   - 每当触达一个知识节点，调用`KnowledgeTrigger`弹出AI知识提示。
   - 根据失败条件（掉落、时间耗尽）调用`RevivalQuiz`。
3. **结算**：计算关卡评分、掉落碎片、成就进度，触发AI卡牌掉落逻辑。

### JumpSystem.ts
- 处理玩家输入（触屏按压/滑动）→ 转换为跳跃力度。
- 维持体力条，限制连续高跳，加入“节奏 perfect”判定提升得分。

### KnowledgeTrigger.ts
- 管理知识弹窗队列，调用`Popups`展示文本、插图、语音。
- 与`LLMClient`对接，在后期模式下动态生成额外问答提示。

### ChipCollector.ts
- 根据关卡难度设定碎片掉落概率。
- 在碰撞检测到碎片时，更新玩家背包并检查是否凑齐合成条件。

### RevivalQuiz.ts
- 接入`questions.json`题库。
- 支持“广告复活”与“知识问答复活”两种流程，答对题立即复活，答错则进入结算。

### MentorDialog.ts
- 预设阶段：根据关键词匹配答案，返回脚本化回复。
- 进阶阶段：调用`LLMClient`，将玩家输入与上下文 prompt 拼装后请求真实 LLM，支持追问与多轮对话。

### PromptPlayground.ts
- 接受玩家输入的提示词。
- 根据解锁进度决定调用何种生成服务（文本/图像/口号）。
- 展示生成结果，并允许保存到“AI知识图谱”作为收藏。

### CardGallery.ts
- 读取`cards.json`生成卡册。
- 处理卡牌的“查看→播放语音→展示应用案例→收藏标记”流程。

### AchievementTracker.ts
- 监听关卡事件、对话事件、卡牌收集。
- 计算“AI探索等级”，解锁功能（AI绘图实验室、导师换装等）。

## 数据交互流转
1. 玩家进入关卡 → `LevelController`加载配置 → `JumpSystem`控制跳跃 → `KnowledgeTrigger`展示AI知识。
2. 玩家收集碎片 → `ChipCollector`更新`InventoryModel` → `AchievementTracker`检测合成条件 → 触发`CardGallery`新增卡牌。
3. 玩家失败 → `RevivalQuiz`拉取题目 → 答对恢复关卡；答错 → `Router`切换到结算场景。
4. 玩家回到实验室 → 与`MentorDialog`对话、在`PromptPlayground`体验AI生成 → 解锁更多卡牌与关卡。

## 扩展建议
- 使用事件驱动架构，降低模块耦合。
- 在`LLMClient`中预留不同服务的降级策略，保障离线模式可用。
- 通过`Localization`为后续英语、日语版本打基础。
- 在`tests/`中模拟关卡节奏，确保知识节点与跳跃节奏匹配。
