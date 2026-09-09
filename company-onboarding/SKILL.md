---
name: company-onboarding
description: 公司新员工环境配置向导。当用户提到"入职配置"、"新员工配置"、"onboarding"、"环境搭建"、"配置开发环境"、"初始化工作环境"或需要一键配置公司所需的全套工具（企业微信、腾讯会议、Outline、技能市场）时使用。适用于技术和非技术背景的员工，支持 Mac 和 Windows 系统。
---

# 公司新员工环境配置向导

这是一个完整的自动化配置流程，帮助新员工快速搭建工作所需的全部环境。包括运行时环境、CLI 工具、Cherry Studio 扩展、认证登录和功能验证。

## 设计理念

**完整执行，严格卡住。**

- 每次执行都完整运行所有阶段，一个阶段都不跳过，确保环境配置的一致性与完整性。
- 每个阶段、每个步骤都必须**实测通过**才算完成。任何一步卡住、执行失败或存在缺失，**必须停在当前步骤修复**（重装 / 重新授权 / 补齐配置），实测通过后才允许进入下一步。不允许绕过失败继续前进，也不允许把「看起来配置过」当作「成功」。
- 针对非技术背景用户，使用简单易懂的语言，提供详细的操作指引，每个步骤都有清晰的进度提示。

## 全局约定（Agent 必读）

本文档列出的命令都经过本机真实 CLI 校准，优先以本文为准；遇到出入时以本机 `--help` 实际输出为准。

1. **认证与连通一律实测，不信任本地标记**：`auth show` 显示 `authorized` 不代表 token 还能用（真实案例：显示 authorized，实际接口报 `853004 cli token expired`）。每一步验证都必须实际调用一次接口成功，才算通过。
2. **内部值禁止向用户展示**：CLI 返回的 `extra_identity_context`、`userid`、`chat_id`、`media_id`、Bot ID 等内部值，一律不得原样展示或透露给用户。
3. **版本不写死**：安装一律取最新稳定版；文档中出现版本号仅为参考下限。
4. **包名与可执行文件名要分清楚**：
   - 企业微信：npm 包 `@wecom/cli`，可执行文件是 `wecom-cli`（没有 `wecom` 这个命令）。
   - 腾讯会议：npm 包 `@tencentcloud/tmeet`，可执行文件是 `tmeet`（注意：`npm install -g @tencent/meeting-cli` 是错误包名，不存在）。
   - 浏览器自动化：`agent-browser` 用 **vercel-labs 官方**分发渠道（Homebrew 的 `agent-browser`，官网 agent-browser.dev）；**npm 上同名的 `agent-browser` 是第三方包，禁止安装**。

## Phase 0: 预检查和准备

开始配置前，先做好准备工作：

1. **检测操作系统**
   - 使用 `uname -s` (Mac) 或检查 `$OS` 环境变量 (Windows) 确定系统类型
   - 向用户确认检测结果
   - 本文档主要命令在 macOS 实测；Windows 部分以实际 CLI 输出为准

2. **显示流程概览**
   ```
   📋 配置流程概览（预计 20-30 分钟）

   ✓ Phase 0: 预检查（当前）
   □ Phase 1: 浏览器检查
   □ Phase 2: 运行时环境（Node.js, Python）
   □ Phase 3: CLI 工具（wecom-cli, tmeet, agent-browser）
   □ Phase 4: Cherry Studio 扩展（技能 + MCP）
   □ Phase 5: 认证和登录
   □ Phase 6: 功能验证
   □ Phase 7: 完成引导

   这是一次性完整配置，每一步都会实测验证，确保您的工作环境万无一失。
   ```

3. **确认开始**
   - 询问用户："准备好开始配置了吗？整个过程大约需要 20-30 分钟。"
   - 等待用户确认后继续

## Phase 1: 浏览器检查

Chrome 是后续工具（agent-browser-automation）的必需依赖，必须先确认安装。

1. **检查 Chrome**
   - Mac: 检查 `/Applications/Google Chrome.app` 是否存在
   - Windows: 检查注册表或常见安装路径
   - 也可以尝试运行 `google-chrome --version` 或 `chrome --version`

2. **如果未安装**
   - 显示：
     ```
     ⚠️  未检测到 Chrome 浏览器

     Chrome 是必需的工具，请先安装：
     👉 下载地址：https://www.google.com/chrome/

     请下载并安装 Chrome，完成后回复"已安装"继续。
     ```
   - 等待用户确认安装完成
   - 再次检查，确认成功后才继续（未确认视为卡住，停留修复）

3. **已安装**
   - 显示：`✓ Chrome 已安装`

## Phase 2: 运行时环境

目标：Node.js 和 Python 可用且版本验证通过。**本机可能已装好**——已装也要实际执行版本验证；验证失败一律视为缺失，走安装修复，直到验证通过。

### Mac 系统

使用 Homebrew 作为包管理器：

1. **检查 Homebrew**：运行 `which brew`
   - 未安装：运行 `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`，装完再 `which brew` 验证
2. **Node.js**：先 `node --version && npm --version`
   - 验证通过 → ✓ 跳过安装
   - 缺失或失败 → `brew install node`（显示"正在安装 Node.js（这可能需要几分钟）..."），装完重新验证直到通过
3. **Python**：先 `python3 --version && pip3 --version`
   - 验证通过 → ✓ 跳过安装
   - 缺失或失败 → `brew install python`，装完重新验证直到通过

### Windows 系统

使用 Scoop 作为包管理器：

1. **检查 Scoop**：`scoop --version`；未安装时引导用户在管理员 PowerShell 中执行：
   ```
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   irm get.scoop.sh | iex
   ```
   等待用户确认后 `scoop --version` 验证
2. **Node.js**：`node --version` 验证；缺失则 `scoop install nodejs`
3. **Python**：`python --version` 验证；缺失则 `scoop install python`

### 完成条件（Mac/Windows 一致）

```
✓ Node.js: v{version}（验证通过）
✓ Python: v{version}（验证通过）
```
任一验证失败即停留修复，通过后才进入 Phase 3。

## Phase 3: CLI 工具安装

安装三个命令行工具，**每个安装后立即验证，验证通过才装下一个**；失败必须修复重装，不允许跳过。

> 安装方式说明：Cherry Studio 环境禁用全局 npm 安装（`npm install -g` 会被拦截）。优先使用环境的 CLI 安装器（`cli_search` 查找、`cli_install` 安装，装进 Cherry 隔离环境）；安装器不可用时，回退到系统级安装命令。若所有自动方式都不通，把命令给用户手动执行并等待确认。

### 1. wecom-cli（企业微信）

| 项 | 值 |
|---|---|
| npm 包 | `@wecom/cli` |
| 可执行文件 | `wecom-cli`（不是 `wecom`） |
| 安装器 recipe | `npm:@wecom/cli` |

- 优先：`cli_install`（name=`wecom-cli`，tool=`npm:@wecom/cli`）
- 回退：`npm install -g @wecom/cli`（若被环境拦截，交用户手动执行并确认）
- 验证：`wecom-cli --version`
- 成功：`✓ wecom-cli 已安装`

### 2. tmeet（腾讯会议）

| 项 | 值 |
|---|---|
| npm 包 | `@tencentcloud/tmeet`（腾讯云官方；`@tencent/meeting-cli` 这个包不存在，不要用） |
| 可执行文件 | `tmeet` |
| 安装器 recipe | `npm:@tencentcloud/tmeet` |

- 优先：`cli_install`（name=`tmeet`，tool=`npm:@tencentcloud/tmeet`）
- 回退：`npm install -g @tencentcloud/tmeet`
- 验证：`tmeet --version`
- 成功：`✓ tencentmeeting-cli (tmeet) 已安装`

### 3. agent-browser（浏览器自动化，依赖 Chrome）

| 项 | 值 |
|---|---|
| 官方来源 | vercel-labs（官网 agent-browser.dev、Homebrew 同名 formula） |
| 禁止 | npm 上的同名 `agent-browser` 包（第三方），一律不装 |

- 优先：环境的 CLI 安装器安装 brew 配方（如 `brew:agent-browser`），不可用则 `brew install agent-browser`
- 回退：交用户手动执行 `brew install agent-browser` 并确认
- 验证：`agent-browser --version`
- ⚠️ 本机已装 Google Chrome 时，**不要**再运行 `agent-browser install`（那是下载 Chrome for Testing，与共享浏览器流程无关）
- 成功：`✓ agent-browser 已安装（vercel-labs 官方）`

## Phase 4: Cherry Studio 扩展

安装技能 + 确认 MCP 服务器就绪。技能安装**一律优先 skills.sh 市场**，skills.sh 没有的再按下列顺序找其他源（其他技能市场、GitHub 直连）。

### 1. 安装技能（共 6 个，每个都装成功才算过）

| 技能 | skills.sh 源 | 备选源 |
| --- | --- | --- |
| company-onboarding | `skills.sh:xuzhishi/skills/company-onboarding` | `github:https://github.com/xuzhishi/skills/blob/main/company-onboarding/SKILL.md` |
| agent-browser-automation | `skills.sh:xuzhishi/skills/agent-browser-automation` | `github:https://github.com/xuzhishi/skills/blob/main/agent-browser-automation/SKILL.md` |
| meeting-to-outline | `skills.sh:xuzhishi/skills/meeting-to-outline` | `github:https://github.com/xuzhishi/skills/blob/main/meeting-to-outline/SKILL.md` |
| outline-promeeting-update | `skills.sh:xuzhishi/skills/outline-promeeting-update` | `github:https://github.com/xuzhishi/skills/blob/main/outline-promeeting-update/SKILL.md` |
| tmeet-skill | （skills.sh 暂无） | `clawhub:wemeeting/tmeet-skill` |
| wecom-unified | `skills.sh:wecomteam/wecom-unified/wecom-unified` | — |

操作方式：

1. 用 `skills` 的搜索工具按技能名查找，拿到 marketplace 返回的准确 `install_source`
2. 用技能安装工具逐个安装（先 skills.sh 源；skills.sh 搜不到该技能时按备选源顺序）
3. 显示进度：`安装中 ({current}/{total}): {skill-name}`
4. 安装返回成功才算完成；失败按「错误处理」章节处理（瞬时失败重试，连续失败停下向用户说明）

安装完成后显示：`✓ 已安装 {total_count} 个技能`（必须是全部 6 个，缺一个都不能进入 Phase 5）

### 2. 确认 Outline MCP 配置存在

Outline 是公司的知识库平台（MCP 服务器名 `@xzs/outline`）。

- 用 `mcp_status` 检查该服务器已配置且启用。已启用 → ✓；未配置或未启用 → 引导用户在 Cherry Studio 设置 → MCP 服务器中添加入口（服务器地址 `https://outline.hub.xzs`）
- 此时**不要求 token**，token 在 Phase 5 获取并填入

## Phase 5: 认证和登录

依次完成三个服务的认证。**每项认证后必须实测一次接口，实测成功才算通过。**

### 1. 企业微信登录（重新授权 / 首次授权同一流程）

真实 CLI 没有 `wecom login` 命令，授权统一走 `wecom-cli auth init`（扫码获取 Bot 与 Secret）：

```
📱 企业微信登录
------------------
现在需要登录企业微信。请按照提示操作：

1. 运行授权命令后，会显示一个二维码（或一个二维码链接）
2. 使用企业微信扫描二维码完成授权
3. 授权成功后，CLI 会显示初始化完成 ✅
```

- 非交互环境执行：`wecom-cli auth init --noninteractive --output-qrcode wecom_qr.png`，把二维码/链接展示给用户扫码，等待命令完成
- 交互环境直接：`wecom-cli auth init` 按提示操作
- 管理员提供 Bot ID 与 Secret 的场景：`wecom-cli auth init --manual` 手动输入
- **验证（两步缺一不可）**：
  1. `wecom-cli auth show --status` → 期望 `authorized`
  2. **实测调用**：`wecom-cli contact users search --keywords "<用户自己的姓名>"` → 必须成功返回该成员
- ⚠️ 若实测报 `853004 cli token expired` 等错误，即使第 1 步显示 `authorized` 也不可信，必须**重新走 `auth init`** 后再验，直到实测通过
- 成功：`✓ 企业微信已授权（实测通过）`

### 2. 腾讯会议登录

`tmeet` 没有 `whoami`/`login` 顶层命令，登录与状态都在 `tmeet auth` 子命令下：

```
🎥 腾讯会议登录
------------------
现在需要登录腾讯会议。请按照提示操作：

1. 运行登录命令后，会显示一个二维码或登录链接
2. 使用腾讯会议 App 或微信扫描完成登录
```

- 登录：`tmeet auth login`（按提示扫码）
- 状态查询：`tmeet auth status`（输出 Logged in / OpenId / UserName / token 有效期；token 临期或过期时重新 login）
- **实测调用**：`tmeet meeting list` → 必须成功返回（空列表也可，接口通即视为通过）
- 成功：`✓ 腾讯会议已登录（实测通过）`

### 3. Outline Token 配置

token 由用户获取后手动填入 Cherry Studio 的 MCP 配置（通常写入 `@xzs/outline` 的请求头 Authorization: Bearer 里；若界面提供专用 token 字段则填该字段）。

**第一步：引导用户获取 token（逐步指引）**

```
📚 Outline 知识库配置
----------------------
Outline 是公司的知识库平台，现在需要配置访问权限。

第一步：登录 Outline
1. 访问：https://outline.hub.xzs/
2. 使用您的公司邮箱登录
3. 默认密码是公司 wifi "xzs" 的密码
   （首次登录后建议修改密码）

第二步：获取 API Token
1. 登录后，点击右上角头像
2. 选择"Settings"（设置）
3. 找到"API Tokens"（API 令牌）
4. 点击"Create a token"（创建令牌）
5. 复制生成的 token（一长串字符）

第三步：配置 Token（回到 Cherry Studio）
1. 打开 Cherry Studio
2. 进入设置 → MCP 服务器
3. 找到 "@xzs/outline"
4. 将复制的 token 填入请求头（Authorization: Bearer <token>）
   或界面提供的 token 字段
5. 保存配置

完成以上步骤后，回复"已配置"。
```

**第二步（可选辅助）：用 agent-browser-automation 帮用户打开页面**

用户愿意的话，按 `agent-browser-automation` 技能启动共享浏览器（Chrome 已在 Phase 1 确认、agent-browser 已在 Phase 3 安装），在可见窗口里：

1. 打开 `https://outline.hub.xzs/`，让用户自己完成登录（Agent 不代填账号密码、不代点确认）
2. 引导用户到 头像 → Settings → API Tokens → Create a token 页面，让用户看到并复制 token
3. 用户拿到 token 后，引导其回到 Cherry Studio 的 MCP 设置手动填入并保存
4. 用完关闭带调试端口的共享 Chrome，并确认 9222 端口已释放

**第三步：实测验证（必须）**

- 等用户回复"已配置"后，用 Outline MCP 调用列表接口（如列出文档集 `list_collections`）
- 成功返回 → `✓ Outline 已连接`
- 失败 → 提示用户检查 token 是否填对位置（请求头/Authorization 字段）、是否多复制了空格，修正后重验；实测通过才进入 Phase 6

## Phase 6: 功能验证

按顺序验证每个服务的功能，**全部实测通过**才能进入 Phase 7。

### 1. 企业微信消息验证

```
🧪 测试企业微信功能
------------------
正在给您发送一条欢迎消息...
```

- 第一步：拿授权人 ID 作为 chat_id：`wecom-cli identity whoami`（返回中的授权人 ID 即 chat_id；该值属内部值，禁止向用户展示）
- 第二步：发送欢迎消息（普通文本也必须按 markdown 发送）：
  ```bash
  wecom-cli message aibot send --json '{"chat_id":"<授权人ID>","msg_type":"markdown","markdown":{"content":"🎉 欢迎加入！你的企业微信环境已配置完成。"}}'
  ```
  - ⚠️ 不要用 `wecom-cli message send --msg-type text`：该路径对企业不可用（会报 853006）
- 发消息给用户自己后，询问："收到企业微信消息了吗？" 等待用户确认
- 用户确认收到 → `✓ 企业微信功能正常`；用户没收到 → 检查上一步实测调用与 chat_id 取值，修复重发

### 2. 腾讯会议 API 验证

```
🧪 测试腾讯会议连接
------------------
正在测试 API 连通性...
```

- 运行 `tmeet meeting list`（或获取用户信息类接口），必须成功返回
- 成功 → `✓ 腾讯会议 API 连接正常`；失败 → 回到 Phase 5.2 重新登录，直到实测通过

### 3. 会议记录集成验证

```
🧪 测试会议记录集成
------------------
正在测试腾讯会议 → Outline 集成...
```

- 两个服务均已在前述步骤实测可访问（tmeet + Outline MCP），此处做连接性自检即可，不需要实际创建会议记录
- `✓ 会议记录集成正常`

### 4. 浏览器自动化验证

```
🧪 测试浏览器自动化
------------------
正在打开浏览器...
```

- 按 `agent-browser-automation` 技能流程执行（概要）：
  1. `command -v agent-browser` 与 `curl -s --max-time 2 http://127.0.0.1:9222/json/version` 确认 CLI 就绪、端口空
  2. 启动共享 Chrome（macOS 示例）：
     ```bash
     mkdir -p "$HOME/shared-browser-profile" && open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/shared-browser-profile" --no-first-run --no-default-browser-check --start-maximized
     ```
  3. 轮询 `http://127.0.0.1:9222/json/version`（最多约 15 秒）直到就绪
  4. `agent-browser --cdp 9222 open https://www.baidu.com`
  5. 询问用户："看到浏览器窗口打开百度首页了吗？请回复'看到了'。"
  6. 等待用户确认
- **收尾（每轮必做）**：
  - 关闭这台带调试端口的 Chrome（例如 `pkill -f "remote-debugging-port=9222"`），确认 `http://127.0.0.1:9222/json/version` 无响应；不要动用户日常的 Chrome
  - 清理本阶段产生的临时文件（如授权二维码 png）：环境禁止 `rm` 时用 move_to_trash 工具移入废纸篓
- 成功：`✓ 浏览器自动化正常`

## Phase 7: 完成引导

所有配置和验证完成后，显示完整的配置摘要并引导用户到知识库。

### 配置摘要报告

```
🎉 配置完成！
================

✓ Chrome: 已安装
✓ Node.js: v{node_version}
✓ Python: v{python_version}
✓ CLI 工具: wecom-cli, tencentmeeting-cli, agent-browser
✓ 技能: 已安装 {skill_count} 个技能
✓ 认证: 企业微信、腾讯会议、Outline 已连接（全部实测通过）
✓ 功能验证: 全部通过

您的工作环境已经配置完毕！
```

摘要里的各项数字必须来自本轮的实测结果，不得编造；有未完成项时必须回到对应阶段修复，不能展示"全部通过"。

### 引导到知识库

```
📚 下一步
----------
请访问 Outline 知识库了解更多信息：

👉 https://outline.hub.xzs/collection/ai-<urlId>/overview

在这里您可以探索其他部门的文档和资源。

💡 提示
如果将来需要重新配置环境，可以随时再次运行这个配置向导。
所有步骤都会重新执行并实测验证，确保环境一致性。
```

- 知识库链接的 `<urlId>` **不要写死**：用 Outline MCP 的 `list_collections` 找到名字为「AI」的文档集，取其 `urlId` 拼出链接；找不到时向用户说明并给出知识库首页 `https://outline.hub.xzs/`

## 错误处理

在配置过程中如果遇到错误，遵循**严格卡住**原则：

1. **清晰显示错误信息**
   - 说明哪个步骤失败了（cite 报错码，如 `853004` / `853006`）
   - 显示具体错误内容
   - 不使用技术术语，用通俗语言解释

2. **判定错误类型**
   - 瞬时失败（网络抖动、安全分类器临时不可用、SSL 偶发中断）→ 稍等片刻重试，最多重试到命令超时预算；重试成功视为通过
   - 稳定失败（包不存在、接口对企业不可用、token 过期、命令名错误）→ 按本文档对应章节的修复方式处理；连续重试同一动作 3 次仍失败，停止重复，如实向用户汇报并给出下一步选项

3. **卡住即停**
   - 未修复到实测通过前，**不得进入下一阶段**；修复需要用户参与（扫码、填 token）时，明确告知用户做什么、等用户完成后立即回归验证
   - 无法自动修复且暂不需要用户配合（如 853006 类企业侧能力限制）时，如实说明限制、记录在案，由用户决定如何处理

4. **记录问题**
   - 记录失败的步骤与错误信息
   - 在最终报告中标注未完成的部分（有未完成项时禁止宣称"全部通过"）

5. **继续或重试**
   - 每个失败步骤都向用户提供：重试当前步骤 / 用户手动完成后回归验证
   - 不存在"跳过非关键步骤"的选项——所有步骤都必须最终通过

## 注意事项

- **始终使用最新版本**：不写死版本号，动态获取最新稳定版。
- **完整执行 + 严格卡住**：每个阶段完整走完，失败必须停下修复，实测通过才推进。
- **实测为准**：认证、连通一律实际调用接口确认，不信任本地状态标记。
- **清晰反馈**：每个步骤都有清晰的进度提示和状态反馈。
- **等待确认**：涉及用户操作的步骤，等待用户明确确认后继续。
- **简单语言**：针对非技术用户，使用易懂的语言和详细的指引。
- **内部值不外露**：`extra_identity_context`、`userid`、`chat_id`、`media_id`、Bot ID 等一律不展示给用户。
- **临时文件即用即清**：二维码等临时产物用完立即清理（环境禁用 `rm` 时走 move_to_trash）。
- **链接不写死**：知识库文档集 urlId 动态查询，避免文档集调整后失效。