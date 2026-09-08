---
name: meeting-to-outline
version: 1.0.0
description: "腾讯会议记录归档工作流：把一场腾讯会议（可按会议号、日期、主题定位）的完整记录——基本信息、智能纪要、待办、参会明细、逐字转写——通过 tmeet CLI 拉取，按标准模板整理成结构化文档，写入 Outline 知识库。默认写入以当前用户名命名的个人文档集的「会议纪要」目录（用户也可指定其他文档集）；含环境自检与自动补齐（tmeet 安装/登录、Outline MCP 连通性）。当用户要「把会议记录到 Outline」「归档会议纪要」「导入腾讯会议」「整理某场会议」、或给出会议号/日期让 Agent 拉取会议记录时，务必使用本技能，即使用户没有明确提到 Outline 或腾讯会议。"
metadata:
  requires:
    bins: ["tmeet", "node", "npm"]
---

# 会议记录归档（腾讯会议 → Outline）

## 概述

本 skill 把"将一场腾讯会议的记录整理并写入 Outline"的完整流程标准化：

1. **环境自检（强依赖）**：tmeet CLI、tmeet-skill、tmeet 登录、Outline MCP、Outline token——五项全部就绪才继续，缺哪项就必须先补齐哪项
2. **拉取数据**：会议基本信息、智能纪要、待办、参会明细、逐字转写
3. **组装文档**：按 `references/template.md` 的结构与格式规范生成
4. **写入 Outline**：定位目标文档集（用户指定或默认个人文档集），创建目录与文档

每个环节的数据（会议号、用户名、文档集、token）都是运行时动态获取的，本 skill 不内置任何固定的值。

## 一、环境自检（强依赖，全部就绪才继续）

以下五项是本工作流的**硬性前置条件**：缺了它们既拿不到会议数据，也没地方写文档。任何一项不满足，流程就停在这一步，先把环境补齐，补齐后从头继续。

### 1. tmeet CLI（强依赖）

- 检查：`command -v tmeet`
- **`command -v tmeet` 找不到、但用户说已装过**：tmeet 可能装在 nvm/fnm 等 Node 版本管理器下（PATH 未覆盖）。先查 `ls ~/.nvm/versions/node/*/bin/tmeet ~/.fnm/*/installation/bin/tmeet 2>/dev/null`，找到后用其**绝对路径**调用，无需重装
- 未安装：执行 `npm install -g @tencentcloud/tmeet@latest`（若被环境策略拦截全局安装，改走 Cherry 托管 CLI：`cli_search` 搜不到 tmeet 时，用 `cli_install` 装 `npm:@tencentcloud/tmeet`）
- 若 node/npm 也不存在：告知用户先安装 Node.js LTS（nodejs.org），装好后再继续
- 安装失败：把报错原文展示给用户，检查网络或 npm 源后重试

### 2. tmeet-skill（强依赖）

- 检查：当前会话的可用 skills 列表里是否有 `tmeet-skill`（腾讯会议 CLI 技能）
- 没有：通过技能市场搜索「腾讯会议」并安装（`install_skill`），先征得用户同意再执行
- 原因：tmeet-skill 的 `references/` 里有全部 tmeet 命令的完整参数、路由规则与错误码，是本 skill 拉取会议数据的操作手册，必须存在

### 3. tmeet 登录（强依赖）

- 检查：`tmeet auth status`
- 未登录（提示 `user config is empty`）：必须引导用户完成 `tmeet auth login` OAuth 授权，**登录成功后才能继续**
  - 这是阻塞命令：输出授权 URL 后等待用户在浏览器完成 OAuth（最长约 5 分钟）
  - 必须前台运行，不要加 `&` 后台执行，否则回调无法写入凭证
- 登录成功后记住 `UserName`——后面定位"默认个人文档集"要用

### 4. Outline MCP（强依赖）

- 检查：调用 Outline MCP 的 `list_collections`（不带参数）
- **工具不存在**（调用即报工具不可用）→ Outline MCP 未安装或未启用，必须装上：
  1. 向用户说明缺少什么
  2. 请用户提供：Outline 服务地址（如 `https://outline.公司域名`）+ 个人访问 token（Outline 里「设置 → API → 创建 token」）
  3. 引导用户在 Cherry Studio「设置 → MCP」添加 Outline MCP server；在支持注册工具的环境里，征求用户同意后帮其注册
- **工具存在但调用报错**：
  - 401 / 认证类错误 → token 无效或过期，必须让用户更新 token 后才能继续
  - 连接超时 / 拒绝 → 服务地址不可达，检查地址与网络，恢复后才能继续

### 5. Outline token（强依赖）

- 无 token 或 token 无效时（表现为 401），向用户说明获取方式：Outline「设置 → API → 创建个人访问 token」
- 校验通过标志：`list_collections` 成功返回——至此环境自检全部通过，进入拉取数据阶段

## 二、拉取会议数据

### 定位会议

| 用户提供的信息 | 使用命令 |
| --- | --- |
| 会议号（如 `123 456 789`） | `tmeet meeting get --meeting-code "123456789"`（去掉空格与横线，纯数字） |
| 主题 / 关键词 | `tmeet meeting search --query "关键词" --query-field subject` |
| 只有日期 | `tmeet meeting list-ended --start "YYYY-MM-DDT00:00:00+08:00" --end "YYYY-MM-DDT23:59:59+08:00"` |

- 返回多场候选 → 用表格列出（会议号、主题、时间）让用户确认，不要擅自替用户选
- `meeting get` 成功后获得：主题、起止时间、会议号、会议类型、主持人、入会链接、录制列表（含 `permission_status`）、子会议列表（周期性会议）
- **⚠️ Rooms 会议室会议 / 个人会议号会议（特殊场景）**：`meeting get --meeting-code` 会返回「个人会议号会议」的固定条目（subject 常为「XXX的个人会议室」、status 常为「待开始」、无录制无纪要），**这不是实际会议**。此时改走 `record search --meeting-code` 定位实际录制（拿到实际 `meeting_id`、`record_file_id`、录制起止、`has_smart_minutes`/`has_transcript_content`）；真实会议主题取智能纪要的「会议主题」字段；`report participants` 对 Rooms 会议通常 9042 无权限，参会明细标注「未获取」

### 拉取内容（三类数据都要拉）

1. **智能纪要**：`tmeet record smart-minutes --record-file-id <record_file_id>`
   - 前置条件：该录制的 `permission_status = can_view`（用主录制，通常时长最长）
   - 无权限或无录制 → 降级 `tmeet minute get --meeting-code <code>` 取元宝纪要，并在最终文档与汇报里明确标注"内容来自元宝纪要、非逐字稿"
2. **完整转写**：`tmeet record transcript-get --record-file-id <record_file_id>`
   - 输出可能是 100KB 级 JSON（含 paragraphs），**用 node/python 脚本解析**成"发言人 + 文本"再使用，不要手工抄录
3. **参会明细**：`tmeet report participants --meeting-id <meeting_id> --sub-meeting-id <首场子会议id>`
   - 周期性会议必须带上子会议 ID（`meeting get` 返回的 `sub_meetings[0].sub_meeting_id`）
   - 得到：总人次（含重复入会）、去重后的参会名单、入离会时间

### 参数与细节

- 拉取数据时按需查阅 `tmeet-skill` 的 `references/`（环境自检已保证其存在），里面是各命令的完整参数、路由规则与错误码说明
- 时间参数一律 ISO 8601 带时区，如 `2026-09-07T11:00:00+08:00`
- **会议号对外展示永远用 `meeting_code`；`meeting_id` 只作命令参数，严禁出现在任何面向用户的输出里**

## 三、组装文档

- 读取 `references/template.md`，按模板结构和格式规范生成文档
- 数据来源映射：
  | 区块 | 数据来源 |
  | --- | --- |
  | 基本信息（主题/时间/会议号/类型/主持人/入会链接/录制） | `meeting get` |
  | 会议摘要、会议内容、待办事项 | 智能纪要（`smart-minutes`） |
  | 关键风险点 | 从纪要内容归纳风险项（检测风险、时间紧迫项、未决事项） |
  | 下次会议 | `meeting get` 子会议列表的下一场 |
  | 参会统计、参会名单 | `report participants` |
  | 完整转写 | `transcript-get` |
- 两个容易用错字段的取数规则：
  - **会议时间**：写**实际**会议时间，不要用 `meeting get` 返回的预定 `start_time`/`end_time`。实际时间从录制推断：主录制的 `media_start_time` + `duration`（无录制时退回 `report participants` 的最早入会/最晚离会）。格式示例：`2025年10月15日 10:05-10:40`
  - **会议类型**：周期性会议写清循环规则——星期几 + 起止时间 + 循环结束日期。从 `recurring_rule`（`recurring_type`、`until_date`）+ 子会议列表推算（子会议日期间隔 7 天，按日期算出星期几）。格式示例：`周期性会议（每周一 11:00-12:00，循环至 2026-12-31）`
- 拉不到的数据如实标注「未获取」，不要编造
- 重点高亮（`==文字==`）只用于：风险、时间节点、关键决策，不要整段全亮

## 四、写入 Outline

### 确定目标位置（按优先级）

1. **用户指定了文档集** → 用指定的（按名字匹配 collection，找不到就按名字新建）
2. **用户没指定** → 默认个人文档集：
   - 在 `list_collections` 里找「名字 == tmeet 的 `UserName`」的 collection
   - 没有 → `create_collection` 创建（`name` = UserName）
   - Outline 新建 collection 默认只有创建者可见，天然满足个人权限隔离，**不要**额外打开分享或添加成员
3. 目录结构（三级：会议纪要 → 日期 → 会议记录）：
   a. 定位「会议纪要」父文档：用列集合文档树的工具（`list_collection_documents`）找标题为「会议纪要」的文档；没有 → `create_document` 创建（title = 会议纪要，collectionId = 目标 collection）
   b. 定位「日期」目录：在「会议纪要」下找标题 = 会议日期（`YYYY-MM-DD`）的文档；没有 → `create_document` 创建（title = 日期，parentDocumentId = 会议纪要文档）
   c. 新文档命名：`HH:MM-HH:MM 会议主题`（时间 + 会议名）
      - 时间 = 会议**实际**起止时间（24 小时制，来自录制起止，不是预定的 start_time/end_time）
      - 主题 = `meeting get` 的 `subject`（会议名字，如「三类证申报」），不要用智能纪要的主题名（纪要是会议内容的标题，不是会议的名字）
      - 拿不到 `subject` 时向用户询问
      - 去掉「周期性会议」「周会纪要」等冗长前后缀
      - 挂到日期目录下（parentDocumentId = 日期文档）
4. 文档头部的「会议主题」字段：只写智能纪要给出的主题名（不要拼接 `subject` 前缀）

### 创建文档

- `create_document`：
  - `title` = 上述命名
  - `parentDocumentId` = 「会议纪要」文档 ID（新文档作为其子文档）
  - `text` = 组装好的 markdown，`format` = markdown
- 完成后把文档链接和位置（如 `产品研发 › 会议纪要`）汇报给用户

## 五、规范与安全

- 严禁向用户展示 `meeting_id`，一律用 `meeting_code`（会议号）
- 严禁输出 AccessToken / RefreshToken / Outline token
- 破坏性写操作前先向用户确认：取消/修改会议、删除/移动 Outline 文档、修改文档集成员
- tmeet 通讯录查询仅限"会议邀请 / 呼叫入会"的前置场景
- 转写内容可能含敏感信息，写入前提醒用户确认目标文档集的可见范围
