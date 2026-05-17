# Fragment Isles 功能设计稿 v0.2

## 0. 产品定位

**Fragment Isles** 是一个面向 AI 科研人的桌面端碎片信息管理工具。

它帮助用户完成：

> 快速收集碎片信息 → AI 辅助理解与分类 → 用户可控地整理关系 → 托管时间提醒 → 按需生成 Markdown 研究素材。

核心目标不是做一个普通笔记软件，而是缓解 AI 科研人面对大量论文、博客、工具、deadline、想法时产生的：

```text
信息焦虑：东西太多，不知道怎么整理、怎么使用。
时间焦虑：deadline、会议、任务散落在各处，担心遗漏。
使用焦虑：大模型调用成本不可见，担心偷偷消耗 API。
```

------

# 1. 产品设计原则

## 1.1 所有结构都允许用户修改

Fragment Isles 里的分类、标签、关系、提醒都不是不可变的。

用户可以：

- 修改 fragment 所属分类
- 删除、合并、重命名分类
- 修改、删除、合并标签
- 拒绝 AI 给出的分类或标签
- 手动建立或删除 fragment 之间的关系

## 1.2 AI 可以提出结构，但不能替用户决定一切

AI 的角色是：

```text
建议分类
建议标签
建议关系
建议提醒
建议整理方式
```

用户拥有最终控制权。

## 1.3 涉及 API 消耗的功能必须显性触发

尤其是以下功能不能在用户无感知的情况下调用 API：

- fragment 关系整理
- 相似 fragment 对比
- 周期性总结
- 深度整理
- Markdown 长文生成
- 批量重分类

界面上必须显示：

```text
该操作将调用 AI
预计处理：24 个 fragments
预计消耗：约 8k tokens
[开始整理] [取消]
```

## 1.4 所有导出均为 Markdown

导出格式统一为 Markdown，方便用户后续放入：

- Obsidian
- Notion
- VSCode
- GitHub
- 论文草稿
- 组会文档

------

# 2. 核心数据对象

## 2.1 Fragment 信息块

每个 fragment 是最基础的信息单元。

### 数据字段

```json
{
  "id": "F-000128",
  "title": "string",
  "content": "string",
  "content_type": "text | image | markdown | code | link | mixed",
  "source": {
    "type": "manual | clipboard | image | markdown | webpage | zotero | local_file",
    "url": "string | null",
    "app": "string | null"
  },
  "category_id": "C-001",
  "tags": ["T-001", "T-002"],
  "summary": "string",
  "research_usage": ["motivation", "related_work"],
  "created_at": "datetime",
  "updated_at": "datetime",
  "time_entities": [],
  "reminder_ids": [],
  "relation_ids": [],
  "ai_status": "not_analyzed | analyzed | user_modified | needs_review"
}
```

------

## 2.2 Category 分类

分类不是预设死的，而是由 AI 根据用户已有 fragments 自动生成，用户可以调整。

### 数据字段

```json
{
  "id": "C-001",
  "name": "Agent Memory Evaluation",
  "description": "Fragments about agent memory systems, memory benchmarks, and reasoning evaluation.",
  "examples": ["F-00012", "F-00034"],
  "rules": "Use this category when the fragment discusses memory-augmented agents or memory evaluation.",
  "created_by": "ai | user",
  "updated_by": "ai | user",
  "is_active": true,
  "fragment_count": 23
}
```

### 设计重点

这里的关键不是“有哪些固定分类”，而是：

> AI 负责维护一套可解释、可修改的分类体系。

用户可以直接调整分类体系本身。

------

## 2.3 Tag 标签

标签比分类更细粒度，可以跨分类存在。

### 数据字段

```json
{
  "id": "T-001",
  "name": "retrieval-vs-reasoning",
  "description": "Fragments discussing whether memory improves retrieval or reasoning.",
  "created_by": "ai | user",
  "is_user_locked": false,
  "fragment_count": 18
}
```

### 标签设计规则

- 一个 fragment 只能有一个主分类。
- 一个 fragment 可以有多个标签。
- 标签可以由 AI 新增。
- 标签可以由用户修改、删除、合并。
- 用户手动锁定的标签，AI 不应自动删除或重命名。

------

## 2.4 Relation 关系

关系表示两个或多个 fragments 之间的连接。

### 数据字段

```json
{
  "id": "R-001",
  "source_fragment_id": "F-001",
  "target_fragment_id": "F-002",
  "relation_type": "supports | contradicts | extends | same_topic | evidence_for | limitation_of | method_for | dataset_for | duplicate_or_similar",
  "reason": "F-001 supports F-002 by providing evidence that current memory benchmarks mainly evaluate retrieval rather than reasoning.",
  "created_by": "ai | user",
  "confidence": 0.86,
  "created_at": "datetime"
}
```

------

## 2.5 Reminder 提醒

提醒由 fragment 中识别出的时间信息生成。

### 数据字段

```json
{
  "id": "REM-001",
  "fragment_id": "F-023",
  "title": "AAAI 2026 submission deadline",
  "event_time": "2026-08-15 23:59",
  "remind_at": ["2026-08-08 09:00", "2026-08-14 09:00"],
  "status": "active | completed | dismissed | expired",
  "source_text": "submission deadline: August 15, 2026",
  "created_by": "user_confirmed"
}
```

------

# 3. 主功能模块设计

------

# Module A. Fragment 快速收集

## A1. 功能目标

用户可以快速把碎片信息放入 Fragment Isles。

支持：

- 纯文本
- Markdown
- 代码片段
- 图片
- 截图
- 网页段落
- 用户自己的想法

------

## A2. 主界面入口

### 按钮

```text
[+ New Fragment]
[Paste from Clipboard]
[Import Markdown]
[Import Image]
[Quick Capture]
```

桌面端可支持快捷键：

```text
Ctrl / Cmd + Shift + F：打开快速收集窗口
```

------

## A3. 新增 fragment 流程

### Step 1：用户粘贴内容

界面显示：

```text
New Fragment

[输入框 / 粘贴区域]

Content Type: Auto-detected
[Save Only] [Save & Analyze with AI]
```

### Step 2：用户点击保存

#### 按钮 1：Save Only

不调用 API，只保存原始内容。

反馈：

```text
Saved as Fragment F-000128.
AI analysis has not been run.
[Analyze Now] [Later]
```

#### 按钮 2：Save & Analyze with AI

调用 AI 生成：

- 标题
- 摘要
- 分类建议
- 标签建议
- 时间信息识别
- 科研用途标签

反馈：

```text
AI analysis completed.

Suggested Category:
Agent Memory Evaluation

Suggested Tags:
#memory-benchmark #reasoning-evaluation #retrieval-vs-reasoning

Detected Time Info:
None

[Accept All] [Edit] [Re-analyze]
```

------

## A4. Fragment 详情页

### 页面结构

```text
Fragment F-000128

Title:
[可编辑标题]

Content:
[原始内容区域]

Summary:
[AI 摘要，可编辑]

Category:
[下拉选择分类] [Ask AI to Reclassify]

Tags:
[#tag1] [#tag2] [+ Add Tag] [Manage Tags]

Time Info:
[No time info detected]
or
[Detected: 2026-08-15 Deadline] [Set Reminder]

Relations:
[View Relations] [Find Related Fragments]

Actions:
[Edit] [Duplicate] [Delete] [Export Markdown]
```

------

# Module B. AI 分类系统

## B1. 功能目标

分类不是人工预设，而是 AI 根据用户保存的内容逐步形成的结构。

分类系统需要支持：

- AI 自动建议分类
- 用户修改 fragment 所属分类
- 用户删除、合并、重命名分类
- 用户要求 AI 重新组织分类体系

------

## B2. 分类管理页面

### 入口按钮

```text
[Manage Categories]
```

### 页面结构

```text
Categories

[+ Add Category]
[AI Reorganize Categories]
[Merge Categories]
[Delete Empty Categories]

Category List:
- Agent Memory Evaluation       23 fragments
- Multimodal RAG                15 fragments
- Research Tools                11 fragments
- Writing Materials              8 fragments
- Uncategorized                  5 fragments
```

------

## B3. 单个分类操作

点击某个分类后显示：

```text
Category: Agent Memory Evaluation

Name:
[Agent Memory Evaluation]

Description:
[Fragments about memory-augmented agents and memory reasoning benchmarks.]

Rules:
[Use this category when...]

Example Fragments:
[F-001] [F-014] [F-029]

Actions:
[Rename]
[Edit Description]
[Merge with...]
[Delete Category]
[Reclassify Fragments in this Category]
```

------

## B4. 用户修改 fragment 分类

在 fragment 详情页中：

```text
Category:
[Agent Memory Evaluation ▼]
```

用户点击下拉框，可以：

```text
- 选择已有分类
- 新建分类
- 设为 Uncategorized
- Ask AI to Reclassify
```

### 用户选择已有分类

反馈：

```text
Category updated.
Fragment moved from "Research Tools" to "Agent Memory Evaluation".
```

### 用户点击 Ask AI to Reclassify

弹出输入框：

```text
Tell AI what is wrong with the current category:

[这不是工具类信息，更像是 benchmark 构造思路。]

[Reclassify with AI] [Cancel]
```

AI 返回：

```text
AI suggests:

New Category:
Benchmark Design

Reason:
This fragment discusses how to construct evaluation tasks rather than a specific research tool.

[Accept] [Edit] [Reject]
```

------

## B5. 删除分类流程

用户点击：

```text
[Delete Category]
```

弹窗：

```text
This category contains 23 fragments.
What should happen to these fragments?

[Move to Uncategorized]
[Move to another category]
[Ask AI to Reclassify]  Estimated: 6k tokens
[Cancel]
```

### 反馈

```text
Category deleted.
23 fragments moved to Uncategorized.
```

或：

```text
AI reclassification completed.
23 fragments have been reassigned to 4 categories.
[Review Changes]
```

------

## B6. AI 重新组织分类体系

入口：

```text
[AI Reorganize Categories]
```

弹窗：

```text
AI will analyze your current categories and selected fragments to suggest a cleaner category structure.

Scope:
[All fragments]
[Current category only]
[Selected fragments only]

Estimated usage:
Fragments: 128
Estimated tokens: 35k

[Start Reorganization] [Cancel]
```

AI 输出：

```text
Suggested Category Changes:

1. Merge:
"Agent Memory" + "Memory Benchmark" → "Agent Memory Evaluation"

2. Rename:
"Useful Writing" → "Writing Materials"

3. New Category:
"Deadline / Event"

4. Move:
12 fragments from "Uncategorized" to suggested categories

[Apply All]
[Review One by One]
[Reject]
```

------

# Module C. 标签系统

## C1. 功能目标

标签用于细粒度标记 fragment。标签既可以由 AI 自动生成，也可以由用户手动修改。

------

## C2. 新 fragment 的标签生成

用户点击：

```text
[Save & Analyze with AI]
```

AI 返回：

```text
Suggested Tags:
#memory-benchmark
#reasoning-evaluation
#graph-memory
#retrieval-vs-reasoning

New Tags Created:
#retrieval-vs-reasoning

[Accept All] [Edit Tags] [Reject New Tags]
```

------

## C3. 用户修改标签

在 fragment 详情页：

```text
Tags:
[#memory-benchmark] [#reasoning-evaluation] [+ Add Tag]
```

点击标签可：

```text
[Rename Tag]
[Remove from this Fragment]
[View All Fragments with this Tag]
[Lock Tag]
```

------

## C4. 标签管理页面

入口：

```text
[Manage Tags]
```

页面：

```text
Tags

[+ Add Tag]
[Merge Tags]
[Delete Unused Tags]

#memory-benchmark          18 fragments
#graph-memory              12 fragments
#retrieval-vs-reasoning     9 fragments
#paper-writing              6 fragments
```

------

## C5. 合并标签流程

用户选择两个标签：

```text
#memory-eval
#memory-benchmark
```

点击：

```text
[Merge Tags]
```

弹窗：

```text
Merge selected tags into:

[ memory-benchmark ]

Affected fragments: 21

[Merge] [Cancel]
```

反馈：

```text
Tags merged.
21 fragments updated.
```

------

# Module D. 时间信息识别与提醒

## D1. 功能目标

当 fragment 中包含时间、deadline、会议、任务节点时，系统提示用户是否需要设置提醒，帮助用户缓解时间焦虑。

------

## D2. 时间信息识别方式

为了节省 API，时间识别可以分为两层：

### 本地轻量识别

优先使用本地规则识别：

```text
日期：2026-08-15
中文时间：下周五、明天上午、三天后
英文时间：August 15, next Friday
关键词：deadline, due, submission, meeting, seminar, before
```

### AI 深度识别

当本地规则不确定时，显示：

```text
Possible time-related information detected.
Use AI to understand it?

[Analyze Time Info with AI] [Ignore]
```

------

## D3. 新增 fragment 后的提醒提示

如果识别到时间信息，保存后弹出：

```text
Time information detected:

Event:
AAAI 2026 Submission Deadline

Date:
2026-08-15

Source:
"submission deadline: August 15, 2026"

Would you like to set a reminder?

[1 week before]
[3 days before]
[1 day before]
[Custom]
[Add to Timeline Only]
[Ignore]
```

------

## D4. 自定义提醒

点击：

```text
[Custom]
```

弹窗：

```text
Reminder Settings

Event Title:
[AAAI 2026 Submission Deadline]

Event Time:
[2026-08-15 23:59]

Remind Me:
[ ] 2 weeks before
[ ] 1 week before
[ ] 3 days before
[ ] 1 day before
[ ] 1 hour before
[+ Add Custom Time]

[Save Reminder] [Cancel]
```

反馈：

```text
Reminder created.
You will be reminded on:
2026-08-08 09:00
2026-08-14 09:00
```

------

## D5. 提醒弹窗

到时间后，桌面弹窗：

```text
Fragment Isles Reminder

AAAI 2026 Submission Deadline is approaching.

Source Fragment:
F-000128 AAAI 2026 CFP

Related Context:
3 related fragments available.

[Open Fragment]
[View Timeline]
[Dismiss]
[Mark as Done]
[Snooze]
```

点击 Snooze：

```text
[Remind me in 1 hour]
[Tomorrow morning]
[Next week]
[Custom]
```

------

# Module E. Timeline Inbox 时间收件箱

## E1. 功能目标

Timeline Inbox 是主功能，不再放在备选功能中。

它集中管理所有从 fragments 中识别出的时间信息。

------

## E2. 入口

主导航栏：

```text
Fragments
Timeline
Relations
Settings
```

点击：

```text
Timeline
```

进入时间收件箱。

------

## E3. Timeline 页面结构

```text
Timeline Inbox

Summary:
Next 7 days: 2 items
Next 30 days: 5 items
Unconfirmed time items: 3
Active reminders: 6

Filters:
[All]
[Upcoming]
[Unconfirmed]
[No Reminder]
[Completed]
[Expired]

Timeline List:
------------------------------------------------
2026-05-20
[Meeting] Group Meeting
Source: F-000092
Status: Reminder set
[Open] [Edit Reminder] [Mark Done]

2026-06-10
[Deadline] Dataset Application Deadline
Source: F-000107
Status: No reminder
[Set Reminder] [Ignore]

2026-08-15
[Deadline] AAAI 2026 Submission Deadline
Source: F-000128
Status: Reminder set
[Open] [Edit Reminder] [Mark Done]
```

------

## E4. 未确认时间信息

有些时间信息可能不确定，例如“下周五前发我”。

显示为：

```text
Unconfirmed Time Item

Source Text:
"下周五前发我"

Possible Date:
2026-05-22

Confidence:
Medium

[Confirm Date]
[Edit Date]
[Ignore]
[Analyze with AI]
```

------

# Module F. Fragment 关系整理

## F1. 功能目标

帮助用户在需要时整理 fragments 之间的关系。

这个功能必须是**显性触发**，不能后台自动消耗 API。

------

## F2. 触发入口

提供多个入口，但都需要用户主动点击。

### 入口 1：从 fragment 详情页触发

```text
[Find Related Fragments]
```

### 入口 2：从分类页触发

```text
[Organize Relations in This Category]
```

### 入口 3：从多选 fragments 触发

```text
[Analyze Relations]
```

### 入口 4：从 Relations 页面触发

```text
[New Relation Analysis]
```

------

## F3. 关系整理前确认

用户点击关系整理后，先弹出范围确认：

```text
Relation Analysis

Scope:
[Current fragment]
[Selected fragments: 12]
[Current category: Agent Memory Evaluation, 23 fragments]
[Custom search result]

Analysis Type:
[Find similar fragments]
[Find support / contradiction / extension relations]
[Build relation map]
[Detect duplicates]

Estimated API Usage:
Fragments: 23
Estimated tokens: 12k

[Start Analysis]
[Cancel]
```

------

## F4. 关系分析结果

AI 输出结果后，不直接写入数据库，而是进入 review 页面。

```text
Relation Suggestions

1. F-001 → F-014
Relation: supports
Reason:
F-001 explains that current benchmarks mainly evaluate retrieval, while F-014 proposes reasoning-oriented memory evaluation.

[Accept] [Edit] [Reject]

2. F-008 → F-021
Relation: duplicate_or_similar
Reason:
Both fragments describe LoCoMo as a long-dialogue memory evaluation dataset.

[Accept] [Merge Fragments] [Reject]

3. F-019 → F-033
Relation: contradicts
Reason:
F-019 claims graph memory improves reasoning, while F-033 suggests the improvement may come from retrieval quality.

[Accept] [Edit] [Reject]
```

底部按钮：

```text
[Accept All High Confidence]
[Review One by One]
[Reject All]
[Save Accepted Relations]
```

------

## F5. 相似内容提醒融入关系功能

你提到备选功能 7 不希望单独存在，以免和关系功能混淆。这里将其合并进关系整理。

也就是说，系统不在用户新增 fragment 时主动提醒：

```text
你之前存过类似内容
```

而是在用户主动整理关系时显示：

```text
Possible Similar / Duplicate Fragments
```

示例：

```text
Similar Fragment Detected

F-001: Existing memory benchmarks mainly test retrieval.
F-027: Memory evaluation often measures retrieval rather than reasoning.

Similarity:
High

Difference:
F-001 is a motivation note.
F-027 includes a possible benchmark design implication.

Suggested Action:
[Link as Similar]
[Merge]
[Keep Separate]
[Reject]
```

这样“相似提醒”就是关系分析的一种结果，不再独立成一个容易混淆的功能。

------

## F6. 关系视图

主导航：

```text
Relations
```

页面：

```text
Relations

Filters:
[All]
[Supports]
[Contradicts]
[Extends]
[Similar]
[Method For]
[Dataset For]
[Limitation Of]

Relation List:
F-001 → F-014
Type: supports
Reason: ...
[Open Source] [Open Target] [Edit Relation] [Delete]

F-008 → F-021
Type: duplicate_or_similar
Reason: ...
[Open Source] [Open Target] [Merge]
```

------

# Module G. 按需整理与 Markdown 生成

## G1. 功能目标

用户需要时，可以选择一批 fragments，让 AI 整理成 Markdown。

这个功能不做自动每周生成，以节省 API。

------

## G2. 触发入口

```text
[Organize Selected Fragments]
```

或在分类页：

```text
[Generate Markdown Summary]
```

------

## G3. 整理前确认

```text
Generate Markdown Summary

Scope:
Selected fragments: 18

Output Type:
[Research Digest]
[Meeting Report]
[Literature Notes]
[Writing Materials]
[Custom]

Estimated API Usage:
18 fragments
Estimated tokens: 15k

[Generate Markdown]
[Cancel]
```

------

## G4. 输出结果

输出为 Markdown 编辑器。

```markdown
# Research Digest: Agent Memory Evaluation

## 1. Main Topics

## 2. Key Fragments

## 3. Emerging Research Questions

## 4. Possible Next Steps

## 5. Source Fragments
- F-001
- F-014
- F-021
```

按钮：

```text
[Copy Markdown]
[Save as Note]
[Export .md]
[Regenerate]
```

------

# Module J. API 使用量与成本统计

## J1. 功能目标

让用户清楚知道什么时候调用了 API，调用了多少，花了多少钱。

------

## J2. API 状态栏

桌面端底部常驻显示：

```text
API Today: 128k tokens | $0.42
Mode: Manual AI
```

点击后进入成本面板。

------

## J3. 成本面板

```text
API Usage

Today:
Calls: 35
Tokens: 128k
Estimated Cost: $0.42

This Week:
Calls: 162
Tokens: 720k
Estimated Cost: $2.31

Usage by Feature:
- Fragment Analysis: 35%
- Relation Analysis: 28%
- Markdown Summary: 20%
- Time Analysis: 5%

[Export Usage Markdown]
[Set Budget Alert]
[API Settings]
```

------

## J4. 调用前确认

所有大批量 AI 操作必须弹出确认：

```text
This action will call AI.

Task:
Analyze relations among 23 fragments

Estimated tokens:
12k

Estimated cost:
$0.04

[Start]
[Cancel]
```

------

## J5. API 模式设置

```text
AI Usage Mode

[ ] Auto analyze new fragments
[ ] Ask before every AI call
[ ] Manual AI only
[ ] Budget-saving mode

Current mode:
Manual AI only
```

建议默认：

```text
Ask before every AI call
```

这样最符合“避免无感 API 消耗”的产品原则。

------

# 4. 备选功能模块

以下功能暂时不作为 MVP 必须完成，但可以保留在后续版本中。

------

## Optional A. 网页链接导入

### 功能

用户粘贴链接后，系统抓取网页内容并保存为 fragment。

### 按钮

```text
[Import from URL]
```

### 流程

```text
URL:
[https://...]

[Fetch Page]
```

反馈：

```text
Page fetched.

Title:
...

Content Preview:
...

[Save Only]
[Save & Analyze with AI]
```

------

## Optional B. Zotero / BibTeX 导入

### 功能

支持导入 Zotero 导出的 BibTeX 或 RIS 文件。

### 按钮

```text
[Import BibTeX]
[Import RIS]
```

### 反馈

```text
32 references detected.

[Import All]
[Select References]
[Cancel]
```

------

## Optional C. 图片 OCR / VLM 理解

### 第一阶段

只做 OCR：

```text
[Extract Text from Image]
```

### 第二阶段

加入 VLM：

```text
[Analyze Image with AI]
```

调用前显示 API 提醒。

------

## Optional D. 本地模型接入

### 功能

允许用户选择本地模型处理部分任务，降低 API 成本。

```text
Local Model Settings

Provider:
[Ollama]
[LM Studio]
[Custom Endpoint]

Model:
[qwen2.5:7b]

[Save]
[Test Connection]
```

------

## Optional E. 日历集成

### 功能

将提醒同步到 Google Calendar / Outlook。

但 MVP 中先做本地提醒，不依赖第三方日历。

```text
[Export Reminder as .ics]
[Sync to Google Calendar]
[Sync to Outlook]
```

------

# 5. MVP 功能范围建议

## 必做功能

第一版建议包含：

```text
1. Fragment 快速收集
2. AI 辅助摘要、分类、标签
3. 用户可编辑的分类系统
4. 用户可编辑的标签系统
5. 时间信息识别与提醒
6. Timeline Inbox
7. 手动触发的关系整理
8. Markdown 按需整理与导出
9. API 使用量与成本统计
```

## 暂缓功能

```text
1. Zotero 深度集成
2. 网页复杂解析
3. 图片 VLM 深度理解
4. 日历同步
5. 本地模型复杂适配
6. 自动周期性周报
7. 自动后台关系分析
```

------

# 6. 主导航设计

建议主导航为：

```text
Fragments
Timeline
Relations
Settings
```

各页面职责：

| 页面      | 作用                            |
| --------- | ------------------------------- |
| Fragments | 查看、搜索、管理所有碎片信息    |
| Timeline  | 管理所有时间信息和提醒          |
| Relations | 查看和整理 fragment 之间的关系  |
| Settings  | API、分类、标签、成本、导出设置 |

------

# 7. 关键交互总结

## 7.1 新增 fragment

```text
用户粘贴内容
→ Save Only / Save & Analyze
→ AI 建议分类、标签、摘要、时间信息
→ 用户接受或修改
```

------

## 7.2 修改分类

```text
用户打开 fragment
→ 点击分类下拉框
→ 选择已有分类 / 新建分类 / Ask AI to Reclassify
→ 保存修改
```

------

## 7.3 整理关系

```text
用户选择 fragments
→ 点击 Analyze Relations
→ 查看 API 预估
→ 用户确认
→ AI 生成关系建议
→ 用户逐条接受、修改或拒绝
→ 保存关系
```

------

## 7.4 设置提醒

```text
系统识别时间信息
→ 弹出提醒建议
→ 用户选择提醒时间
→ 加入 Timeline
→ 到时间弹出提醒
→ 用户打开 fragment 恢复上下文
```

------

## 7.5 生成 Markdown

```text
用户选择 fragments
→ 点击 Generate Markdown Summary
→ 选择输出类型
→ 查看 API 预估
→ 生成 Markdown
→ Copy / Save / Export .md
```

------

# 8. 一句话产品描述

更具体的版本可以写成：

> **Fragment Isles 是一个面向 AI 科研人的桌面端碎片信息工作台。用户可以快速保存文字、图片和 Markdown，AI 会辅助生成可编辑的分类、标签、摘要和时间提醒；用户可在需要时手动触发 fragment 关系整理、科研素材总结和 Markdown 导出，并通过 API 成本面板控制大模型调用。**

更短的版本：

> **Fragment Isles helps AI researchers capture scattered fragments, organize them into editable structures, connect them on demand, and manage research-related time reminders without hidden API costs.**
