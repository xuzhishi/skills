---
name: company-onboarding
description: 公司新员工环境配置向导。当用户提到"入职配置"、"新员工配置"、"onboarding"、"环境搭建"、"配置开发环境"、"初始化工作环境"或需要一键配置公司所需的全套工具（企业微信、腾讯会议、Outline、技能市场）时使用。适用于技术和非技术背景的员工，支持 Mac 和 Windows 系统。全程自动执行，仅在需要用户扫码/登录/授权时暂停等待。
---

# 公司新员工环境配置向导

这是一个完整的自动化配置流程，帮助新员工快速搭建工作所需的全部环境。包括运行时环境、CLI 工具、Cherry Studio 扩展、认证登录和功能验证。

## 设计理念

**完整执行，严格卡住，用户无感。**

1. **完整执行，严格卡住。**
   每次执行都完整运行所有阶段，一个阶段都不跳过。每个阶段、每个步骤都必须**实测通过**才算完成；任何一步卡住、执行失败或存在缺失，**必须停在当前步骤修复**（重装 / 重新授权 / 补齐配置），实测通过后才允许进入下一步。不允许绕过失败继续前进，也不允许把「看起来配置过」当作「成功」。

2. **自动推进，用户无感。**
   每一步完成并实测通过后**自动进入下一步，不询问「是否继续」「准备好开始了吗」**。凡 Agent 能自己判断、自己安装、自己验证的（检查版本、安装 CLI、注册 MCP、安装技能、发验证消息、浏览器自动化自检），一律直接执行，不打扰用户。
   **只有当步骤需要用户动手（扫码、登录、授权、获取 token、以管理员执行命令）或遇到无法自动修复的问题时，才停下等待用户输入。**
   流程中所有命令与工具的使用方法已写死在本文（各 Phase 正文 + 文末「附录 A：CLI 命令速查」），直接照做即可，**禁止在流程中途现场查阅 `--help` 或技能/工具说明文档**。

3. **用户操作批量下发。**
   多个彼此独立的用户操作（如三项认证登录）尽量在一次消息里把链接和指引全部给出，让用户一口气完成，Agent 统一回归验证，减少往返等待。

4. **针对非技术背景用户。**
   与用户交互时使用简单易懂的语言；内部执行细节（探测、配置切换、中间命令）无需向用户展示。

## 全局约定（Agent 必读）

本文档列出的命令都经过本机真实 CLI 校准，优先以本文为准；遇到出入时以本机 `--help` 实际输出为准。

1. **认证与连通一律实测，不信任本地标记**：`auth show` 显示 `authorized` 不代表 token 还能用（真实案例：显示 authorized，实际接口报 `853004 cli token expired`）。每一步验证都必须实际调用一次接口成功，才算通过。
2. **内部值禁止向用户展示**：CLI 返回的 `extra_identity_context`、`userid`、`chat_id`、`media_id`、Bot ID 等内部值，一律不得原样展示或透露给用户。
3. **版本不写死**：安装一律取最新稳定版；文档中出现版本号仅为参考下限。
4. **包名与可执行文件名要分清楚**：
   - 企业微信：npm 包 `@wecom/cli`，可执行文件是 `wecom-cli`（没有 `wecom` 这个命令）。
   - 腾讯会议：npm 包 `@tencentcloud/tmeet`，可执行文件是 `tmeet`（注意：`npm install -g @tencent/meeting-cli` 是错误包名，不存在）。
   - 浏览器自动化：`agent-browser` 用 **vercel-labs 官方**分发渠道。npm 上的 `agent-browser` 包**已经是官方包**（维护者含 `vercel-release-bot` / `zeit-bot`，仓库指向 `github.com/vercel-labs/agent-browser`，官网 agent-browser.dev，已实测核实），安装前用 `npm view agent-browser maintainers repository` 复核维护者即可；若维护者不再是 vercel/zeit 团队，停止安装并向用户说明。
5. **不落盘的临时文件不产生**：授权二维码一律用链接方式给用户（`--noninteractive` 模式下直接取 CLI 输出的链接），不生成 png 文件；避免后续清理负担。
6. **命令与用法以本文为准，禁止现场查阅**：本文已写死各工具在流程中用到的全部命令与参数（见各 Phase 及文末「附录 A：CLI 命令速查」）。执行时直接照抄，**不允许中途 `--help`、搜索或阅读技能/工具说明文档**——装好即用，不再研究怎么用；只有出现本文未覆盖的新命令时才允许查。技能（如 agent-browser-automation）的使用步骤同样已内联在流程正文中，直接执行。

## Phase 0: 预检查和准备

开始配置前，先做好准备工作。**本阶段完成后不询问用户，直接进入 Phase 1。**

1. **检测操作系统**
   - Mac 使用 `uname -s`，Windows 检查 `$OS` 环境变量确定系统类型
   - 本文档主要命令在 macOS 实测；Windows 部分以实际 CLI 输出为准

2. **网络预检（约 30 秒，快速失败）**
   - `curl -sI --max-time 10 https://registry.npmjs.org/` 与 `curl -sI --max-time 10 https://raw.githubusercontent.com/`
   - 若失败：向用户提示网络或代理可能有问题（配置大概率能继续但会多次失败），如实说明后**继续执行**，不阻塞；若后续安装多次因网络失败，再回到这里让用户处理代理
   - 若通过：不做任何展示，直接继续

3. **显示流程概览**（仅展示一次，之后不再逐阶段询问）
   ```
   📋 配置流程概览（预计 15-25 分钟）
   ✓ Phase 0: 预检查（当前）
   □ Phase 1: 浏览器检查
   □ Phase 2: 运行时环境（Node.js, Python）
   □ Phase 3: CLI 工具（wecom-cli, tmeet, agent-browser）
   □ Phase 4: Cherry Studio 扩展（技能 + MCP）
   □ Phase 5: 认证和登录（企业微信 / 腾讯会议 / Outline）
   □ Phase 6: 功能验证
   □ Phase 7: 完成引导
   ```
   说明一句：「我会自动完成所有能自动完成的步骤，只有需要你扫码、登录或授权时才会停下来请你操作。」随后**直接进入 Phase 1**。

## Phase 1: 浏览器检查与根证书信任

Chrome 是后续工具（agent-browser-automation）的必需依赖，必须先确认安装；装好后紧接着信任公司根证书。

1. **检查 Chrome**（任选其一验证，返回版本号即通过）
   - Mac: `[ -d "/Applications/Google Chrome.app" ] && /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --version`
   - Windows（按顺序尝试）:
     - `reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" /v ""` 或
     - 检查常见路径 `C:\Program Files\Google\Chrome\Application\chrome.exe`、`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`，或
     - `where chrome` / `where chrome.exe`
   - 注意：取路径时不要截断，直接用完整路径读版本号

2. **未安装 → 停下等用户**（这是第一个需要用户动手的点）
   ```
   ⚠️ 未检测到 Chrome 浏览器
   Chrome 是必需的工具，请先安装：
   👉 下载地址：https://www.google.com/chrome/
   请下载并安装 Chrome（一路默认即可），完成后回复"已安装"。
   ```
   （Windows 用户默认浏览器是 Edge 的情况，提醒 Chrome 是 Google Chrome，不是 Edge；如遇网络打不开 Google 页面，可帮用户换镜像下载方式。）
   收到用户回复后重新检查，确认成功才继续。

3. **已安装** → 显示 `✓ Chrome 已安装`，接着做第 4 步根证书。

4. **信任公司根证书（Chrome 就绪后必做，自动执行）**

   公司内网服务（如 Outline `https://outline.hub.xzs/`）使用公司自签证书（CN=`xzs`，O=XZS，自签 CA，有效期至 2036-04-05），浏览器与命令行工具默认不信任，会报「连接不是私密连接」。装上公司根证书后警告消失，后续 Outline 相关步骤才能顺畅进行。

   **证书文件来源（按顺序）**：
   1. 本 skill 目录下的 `rootCA.crt`（与 SKILL.md 同目录；用文件搜索工具定位 `rootCA.crt`）
   2. 找不到时：把文末「附录 B：公司根证书」的内容原样保存为 `rootCA.crt` 再继续

   **Mac**：
   - 首选自动执行（可能弹出系统密码框，让用户输一次登录密码）：
     `security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain-db "<crt路径>"`
     （`-r trustRoot` 即 GUI 里的「始终信任」。若命令报授权失败 / `errSecAuthFailed`——无 GUI 弹框上下文，直接走下一步 sudo 方案）
   - 失败则交用户在其终端执行一次（系统级信任，需 sudo 密码）：
     `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "<crt路径>"`
   - 再失败给手动指引：Finder 双击 rootCA.crt → 打开「钥匙串访问」→ 找到证书「xzs」→ 双击 → 展开「信任」→ 选择「始终信任」
   - **实测验证**：`/usr/bin/curl -sI --max-time 10 https://outline.hub.xzs/` 返回 200 即通过。**必须用系统自带的 `/usr/bin/curl`**（SecureTransport 后端，读钥匙串信任）；Homebrew 等 OpenSSL 后端的 curl 不读钥匙串，会误报失败。辅助验证：`security find-certificate -a -c xzs ~/Library/Keychains/login.keychain-db`（或 `/Library/Keychains/System.keychain`）能看到证书条目

   **Windows**：
   - 直接自动执行（当前用户 Root 存储，无需管理员；Chrome 官方确认会消费当前用户的「受信任的根证书颁发机构」存储）：
     `certutil -addstore -user Root "<crt路径>"`
   - 失败则改用管理员 PowerShell 执行 `certutil -addstore Root "<crt路径>"`（机器级 Root 存储）
   - **实测验证（以 certutil 为准）**：`certutil -user -store Root xzs` 能列出证书条目即已入库；`curl -sI --max-time 10 https://outline.hub.xzs/` 返回 200 即通过。注意：Windows 自带 curl.exe（schannel）读证书库，可作验证；但 Git 等 OpenSSL 版 curl 不读 Windows 证书库会误报，故以 certutil 结果为准

   - 验证通过：`✓ 公司根证书已信任`，自动进入 Phase 2；验证失败按上述回退路径逐级处理，直到实测通过。若 Chrome 在装证书前已打开，个别情况需重启 Chrome 才认新根证书，验证失败时可让用户重启 Chrome 再试。这一步对用户一句话带过即可（「已帮你配置好公司网络信任证书」），无感优先。

## Phase 2: 运行时环境

目标：Node.js 和 Python 可用且版本验证通过。**本机可能已装好**——已装也要实际执行版本验证；验证失败一律视为缺失，走安装修复，直到验证通过。全部通过后自动进入 Phase 3，不问用户。

### Mac 系统

1. **检查 Homebrew**：`which brew`
   - 未安装：Agent 直接执行安装（无需用户操作）：
     `NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
   - 装完 `which brew` 验证；若 PATH 未生效，用 `eval "$(/opt/homebrew/bin/brew shellenv)"` 刷新后继续

2. **Node.js**：先 `node --version && npm --version`
   - 验证通过 → ✓ 跳过安装
   - 缺失或失败 → Agent 直接 `brew install node`（无需询问用户），装完重新验证直到通过

3. **Python**：先 `python3 --version && pip3 --version`
   - 验证通过 → ✓ 跳过安装
   - 缺失或失败 → Agent 直接 `brew install python`，装完重新验证直到通过

### Windows 系统

1. **检查 Scoop**：`scoop --version`
   - 未安装 → **停下等用户**（需要管理员 PowerShell，用户动手一次）：
     ```
     1. 按 Win 键输入 PowerShell，右键「以管理员身份运行」
     2. 依次执行下面两行：
        Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
        irm get.scoop.sh | iex
     完成后回复"装好了"。
     ```
   - 用户完成后验证：**用全新的 shell 会话执行 `scoop --version`**（安装刚完成时当前会话 PATH 未刷新是正常现象，不要在当前会话反复刷新；或用 `$env:USERPROFILE\scoop\shims\scoop.exe --version` 直接验证）

2. **Node.js**：`node --version` 验证
   - 缺失或失败 → Agent 直接 `scoop install nodejs`（用 shims 绝对路径调用），装完重新验证直到通过

3. **Python**：`python --version` 验证
   - 缺失或失败 → Agent 直接 `scoop install python`，装完重新验证直到通过

### 完成条件（Mac/Windows 一致）

```
✓ Node.js: v{version}（验证通过）
✓ Python: v{version}（验证通过）
```

任一验证失败即停留修复，通过后才进入 Phase 3。

## Phase 3: CLI 工具安装

安装三个命令行工具，**每个安装后立即验证，验证通过才装下一个**；失败必须修复重装，不允许跳过。安装与验证全部由 Agent 执行，用户全程无感。

> 安装方式说明：Cherry Studio 环境禁用全局 npm 安装（`npm install -g` 会被拦截）。优先使用环境的 CLI 安装器（`cli_search` 查找、`cli_install` 安装，装进 Cherry 隔离环境）；安装器不可用时，回退到系统级安装命令。若所有自动方式都不通，把命令给用户手动执行并等待确认。

### 0. 安装后端预检（防止低下载量拦截，Mac 必做）

Cherry 隔离环境的默认安装后端（aube）会拦截**周下载量低于 1000** 的 npm 包。`@tencentcloud/tmeet` 周下载量约 778，**每次都会被拦截**。为了一次装成功，在安装任何 npm 包之前先切换安装后端：

- 执行 `mise settings npm.package_manager=npm`（官方合法值，切换后无下载量门槛）
- 若该命令不可用，参考当前环境 mise 版本对应的配置方式写入（键名 `npm.package_manager`，值 `npm`），再继续
- 切换完成后直接继续安装，无需向用户解释（若装 wecom-cli 时未切换也成功了，则 tmeet 前必须已切换）

### 1. wecom-cli（企业微信）

| 项 | 值 |
|---|---|
| npm 包 | `@wecom/cli` |
| 可执行文件 | `wecom-cli`（不是 `wecom`） |
| 安装器 recipe | `npm:@wecom/cli` |

- 优先：`cli_install`（name=`wecom-cli`，tool=`npm:@wecom/cli`）
- 回退：系统级 `npm install -g @wecom/cli`（在用户系统 shell 中执行；若被环境拦截，交用户手动执行并确认）
- 验证：`wecom-cli --version`
- 成功：`✓ wecom-cli 已安装`

### 2. tmeet（腾讯会议）

| 项 | 值 |
|---|---|
| npm 包 | `@tencentcloud/tmeet`（腾讯云官方；`@tencent/meeting-cli` 这个包不存在，不要用） |
| 可执行文件 | `tmeet` |
| 安装器 recipe | `npm:@tencentcloud/tmeet` |

- 前置：确认已完成「0. 安装后端预检」（后端已切为 npm）
- 优先：`cli_install`（name=`tmeet`，tool=`npm:@tencentcloud/tmeet`）
- 若仍报低下载量拦截：回到预检步骤确认切换已生效，再重试
- 回退：系统级 `npm install -g @tencentcloud/tmeet`
- 验证：`tmeet --version`
- 成功：`✓ tencentmeeting-cli (tmeet) 已安装`

### 3. agent-browser（浏览器自动化，依赖 Chrome）

| 项 | 值 |
|---|---|
| 官方来源 | vercel-labs（官网 agent-browser.dev、npm 官方包、Homebrew 同名 formula） |
| 核实 | 安装前 `npm view agent-browser maintainers` 应含 vercel/zeit 团队；否则停止并向用户说明 |

**按平台走已实测的渠道（Cherry 隔离安装器不支持 brew 后端，mise 注册表无此包）：**

- **Mac**：Agent 直接执行 `brew install agent-browser`（不询问用户）；若 brew 命令因权限或环境失败，再交用户在其终端手动执行并确认
- **Windows**：Agent 在系统 shell 中执行 `npm install -g agent-browser`（npm 官方包，全平台支持；Homebrew 在 Windows 不可用）
- 验证：`agent-browser --version`
- ⚠️ 本机已装 Google Chrome 时，**不要**再运行 `agent-browser install`（那是下载 Chrome for Testing，与共享浏览器流程无关）
- 成功：`✓ agent-browser 已安装（vercel-labs 官方）`

## Phase 4: Cherry Studio 扩展

安装技能 + 注册 MCP 服务器。全部由 Agent 自动完成，用户无感；只有全部 6 个技能安装成功且 Outline MCP 注册并启用，才算通过。

### 1. 安装技能（共 6 个，每个都装成功才算过）

**统一安装方式：GitHub blob URL 写死为唯一首选源**（全部 6 个 URL 已实测可达 200）。技能市场收录不全且不稳定（实测 skills.sh 上搜不到本仓库部分技能、clawhub 有死链），市场源仅作 URL 失效时的备选，禁止现场探索。

| 技能 | 首选源：GitHub blob URL（写死，直接解析） | 备选市场源 |
| --- | --- | --- |
| company-onboarding | `https://github.com/xuzhishi/skills/blob/main/company-onboarding/SKILL.md` | `skills.sh:xuzhishi/skills/company-onboarding` |
| agent-browser-automation | `https://github.com/xuzhishi/skills/blob/main/agent-browser-automation/SKILL.md` | `skills.sh:xuzhishi/skills/agent-browser-automation` |
| meeting-to-outline | `https://github.com/xuzhishi/skills/blob/main/meeting-to-outline/SKILL.md` | `skills.sh:xuzhishi/skills/meeting-to-outline` |
| outline-promeeting-update | `https://github.com/xuzhishi/skills/blob/main/outline-promeeting-update/SKILL.md` | `skills.sh:xuzhishi/skills/outline-promeeting-update` |
| tmeet-skill | `https://github.com/TencentCloud/tencentmeeting-cli/blob/main/skills/tmeet-skill/SKILL.md` | `clawhub:wemeeting/tmeet-skill` |
| wecom-unified | `https://github.com/WecomTeam/wecom-unified/blob/main/skills/wecom-unified/SKILL.md` | `skills.sh:wecomteam/wecom-unified/wecom-unified` |

（注意：clawhub 的 wecom-unified 链接已实测 404，任何情况下不要用。）

操作方式（每个技能固定两步，零探索）：

1. 用技能搜索工具直接吃上表的 blob URL，解析出该技能的 `install_source`（一次调用；搜索工具支持直接解析 GitHub SKILL.md URL，无需浏览仓库页面）
2. 用技能安装工具安装
3. 安装返回成功才算完成；瞬时失败（分类器临时错误等）自动重试一次；连续失败按「错误处理」章节处理
4. blob URL 解析失败时，才用该技能的备选市场源搜索一次
5. **无需向用户逐项汇报搜索与安装过程**，全部完成后一次性展示：
   `✓ 已安装 {total_count} 个技能`（必须是全部 6 个，缺一个都不能进入下一小节）

### 2. 注册 Outline MCP 服务器（Agent 直接做，不引导用户手动添加）

Outline 是公司的知识库平台（MCP 服务器名 `@xzs/outline`，地址 `https://outline.hub.xzs/mcp`，类型 streamableHttp）。

1. 用 `mcp_status` 检查该服务器是否已配置且启用。已启用 → ✓ 跳过
2. 未配置 → Agent 直接探测并注册：
   - 探测端点：`https://outline.hub.xzs/mcp` 返回「Use POST for MCP requests」或 405 Allow: POST 即确认为 streamableHttp 类型（内网自签名证书属正常现象，探测时忽略证书校验）
   - 用 MCP 服务器注册工具直接注册：name=`@xzs/outline`、type=`streamableHttp`、baseUrl=`https://outline.hub.xzs/mcp`，并启用
   - 此时**不填 token**，token 在 Phase 5 获取并填入
3. 若注册工具不可用，才退化为引导用户在 Cherry Studio 设置 → MCP 服务器中手动添加入口

## Phase 5: 认证和登录

依次完成三个服务的认证。**每项认证后必须实测一次接口，实测成功才算通过。**

### 0. 批量下发原则（一次给全，减少往返）

三项认证彼此独立，**一次消息把三个操作全部下发给用户**，让用户一口气完成，Agent 统一回归验证：

```
🔐 认证登录（三项，顺序任意，可以一起做）

1️⃣ 企业微信：用企业微信 App 扫这个链接里的二维码（电脑浏览器打开）：
   <wecom 授权链接>
2️⃣ 腾讯会议：电脑浏览器打开，登录后点「授权」直到页面显示授权成功：
   <tmeet 授权链接>
3️⃣ Outline token：登录 https://outline.hub.xzs/ 后，
   头像 → Settings → API Tokens → Create a token，复制那串 token 发给我

全部完成后回复「都好了」（或直接回复 token 也算），我会逐项实测验证。
```

实现方式：

- 同时后台启动 `wecom-cli auth init --noninteractive` 与 `tmeet auth login`，两个命令各自拿到链接后一并展示给用户
- 用户回复后逐项验证；若某项目前还没完成（如 CLI 仍在等待授权），如实告知该项还需哪一步操作，其余项先验证
- 若用户明显是新手（主动要求逐步来），可退化为一次只给一项；默认一律批量下发

### 1. 企业微信登录（重新授权 / 首次授权同一流程）

真实 CLI 没有 `wecom login` 命令，授权统一走 `wecom-cli auth init`（扫码获取 Bot 与 Secret）：

- 非交互环境执行：`wecom-cli auth init --noninteractive`，把 CLI 输出的**二维码链接**展示给用户扫码（**不要用 `--output-qrcode` 生成 png 文件**），后台等待命令完成
- 交互环境直接：`wecom-cli auth init` 按提示操作
- 管理员提供 Bot ID 与 Secret 的场景：`wecom-cli auth init --manual` 手动输入
- **验证（两步）**：
  1. `wecom-cli auth show --status` → 期望 `authorized`
  2. **实测调用**：`wecom-cli identity whoami` → 必须正常返回授权人信息（**该接口不需要「通讯录」权限，作为核心实测项**）
- **「通讯录」权限（错误码 850002）处理——不影响授权通过**：
  - 授权验证以 `auth show --status` + `identity whoami` 为准，两者通过即判定「企业微信已授权（实测通过）」，**不因 850002 卡住后续流程**
  - 顺手实测一次 `wecom-cli contact users search --keywords "<用户自己的姓名>"`；若报 `850002`，把 CLI 报错中自带的**授权链接原样转发给用户**（形如 `https://work.weixin.qq.com/ai/aiHelper/authorizationList?...`），并说明：「授权已经成功，这个报错只是机器人缺一个『通讯录』权限开关，点链接即可开通，不影响发消息、会议、待办等功能。」用户在后台自行点开即可，**不等用户回复**，记录在案继续下一步
  - 向用户说明时严格区分两件事：**扫码授权（已完成）** 与 **通讯录权限开关（可选补开）**，避免用户误以为「没配置成功」而要求重新扫码
- ⚠️ 若实测报 `853004 cli token expired` 等错误，即使 `auth show` 显示 `authorized` 也不可信，必须重新走 `auth init` 后再验，直到实测通过

### 2. 腾讯会议登录

`tmeet` 没有 `whoami`/`login` 顶层命令，登录与状态都在 `tmeet auth` 子命令下：

- 登录：`tmeet auth login`（后台启动，轮询超时 5 分钟；拿到的授权链接交给用户）
- 状态查询：`tmeet auth status`（输出 Logged in / OpenId / UserName / token 有效期；token 临期或过期时重新 login）
- **指引要点**：明确告诉用户「打开页面后不仅要登录账号，还要点『授权 / 同意』，直到页面显示**授权成功**」（真实案例：用户只登录了账号没点授权，CLI 一直未检测到）
- **实测调用**：`tmeet meeting list` → 必须成功返回（空列表也可，接口通即视为通过）
- 成功：`✓ 腾讯会议已登录（实测通过）`

### 3. Outline Token 配置

token 由用户获取，配置由 Agent 完成：

1. **引导用户获取 token**（随批量消息一起下发，用户回复 token 或回复「已配置」均可）：
   ```
   1. 访问 https://outline.hub.xzs/（浏览器提示「连接不是私密连接」时点「高级 → 继续前往」，内网自签证书属正常）
   2. 用公司邮箱登录（默认密码是公司 wifi "xzs" 的密码，首次登录后建议修改）
   3. 头像 → Settings（设置）→ API Tokens（API 令牌）→ Create a token（创建令牌）
   4. 复制那串 token 发给我，我帮你填进配置（token 属敏感信息，发不发由你决定；不想发就按我下面的说明自己填）
   ```
2. **配置方式（务必按此顺序）**：
   - 用户给了 token → Agent 直接更新 `@xzs/outline` 服务器配置，在**请求头**填入 `Authorization: Bearer <token>`，保存
   - 用户想自己填 → 指引：Cherry Studio 设置 → MCP 服务器 → `@xzs/outline` → 请求头填 `Authorization: Bearer <token>`
   - ⚠️ **不要使用 Cherry Studio 的「连接」按钮 / OAuth 授权流程**：该服务器认证走静态 API token（请求头），Cherry 的 OAuth 流程会超时 300 秒（真实案例）
3. **实测验证（必须）**：
   - 用 Outline MCP 调用列表接口（如 `list_collections`），成功返回 → `✓ Outline 已连接`
   - 失败 → 检查 token 是否填在请求头（而非界面里的 OAuth/其他字段）、是否多复制了空格，修正后重验；实测通过才进入 Phase 6

## Phase 6: 功能验证

按顺序验证每个服务的功能，**全部实测通过**才能进入 Phase 7。本阶段全部由 Agent 自动完成，不再向用户逐项确认。

### 1. 企业微信消息验证

- 第一步：拿授权人 ID 作为 chat_id：`wecom-cli identity whoami`（该值属内部值，禁止向用户展示）
- 第二步：发送欢迎消息（普通文本也必须按 markdown 发送）：
  ```bash
  wecom-cli message aibot send --json '{"chat_id":"<授权人ID>","msg_type":"markdown","markdown":{"content":"🎉 欢迎加入！你的企业微信环境已配置完成。"}}'
  ```
- ⚠️ 不要用 `wecom-cli message send --msg-type text`：该路径对企业不可用（会报 853006）
- CLI 成功返回即判定 `✓ 企业微信功能正常`（发送成功本身就是实测）；顺带提示用户「留意企业微信是否收到欢迎消息」，**不等待用户确认**
- CLI 返回失败 → 检查上一步实测调用与 chat_id 取值，修复重发

### 2. 腾讯会议 API 验证

- 运行 `tmeet meeting list`（或获取用户信息类接口），必须成功返回
- 成功 → `✓ 腾讯会议 API 连接正常`；失败 → 回到 Phase 5.2 重新登录，直到实测通过

### 3. 会议记录集成验证

- 两个服务均已在前述步骤实测可访问（tmeet + Outline MCP），此处做连接性自检即可，不需要实际创建会议记录
- `✓ 会议记录集成正常`

### 4. 浏览器自动化验证（Agent 自检，无需询问用户）

按 `agent-browser-automation` 技能流程执行（概要）：

1. `command -v agent-browser` 与 `curl -s --max-time 2 http://127.0.0.1:9222/json/version` 确认 CLI 就绪、端口空闲
2. 启动共享 Chrome（macOS 示例）：
   ```bash
   mkdir -p "$HOME/shared-browser-profile" && open -na "Google Chrome" --args --remote-debugging-port=9222 --user-data-dir="$HOME/shared-browser-profile" --no-first-run --no-default-browser-check --start-maximized
   ```
   （Windows 用 `start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\shared-browser-profile" ...`，以实际安装路径为准）
3. 轮询 `http://127.0.0.1:9222/json/version`（最多约 15 秒）直到就绪
4. `agent-browser --cdp 9222 open https://www.baidu.com`
5. **自动验证**：通过 CDP 查询当前页面 title（或 agent-browser 的页面状态查询），确认已加载百度首页即判定 `✓ 浏览器自动化正常`；**不再询问用户「看到窗口了吗」**。若 CDP 查询失败/页面未加载，才停下询问用户屏幕上的实际状态
6. **收尾（每轮必做）**：
   - 关闭这台带调试端口的 Chrome（例如 `pkill -f "remote-debugging-port=9222"`，Windows 用 taskkill 匹配命令行），确认 `http://127.0.0.1:9222/json/version` 无响应；不要动用户日常的 Chrome
   - 本流程不产生临时文件（二维码均为链接），无需清理；如确产生了临时文件，环境禁止 `rm` 时用 move_to_trash 工具移入废纸篓

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

摘要里的各项数字必须来自本轮的实测结果，不得编造；有未完成项时必须回到对应阶段修复，不能展示"全部通过"。（未完成的非阻塞项——如企业微信「通讯录」权限待用户点链接开通——在摘要下方以「待办提醒」单列，不得计入「全部通过」。）

### 引导到知识库

```
📚 下一步
----------
请访问 Outline 知识库了解更多信息：
👉 <动态拼出的链接>
在这里您可以探索其他部门的文档和资源。

💡 提示
如果将来需要重新配置环境，可以随时再次运行这个配置向导。
所有步骤都会重新执行并实测验证，确保环境一致性。
```

- 知识库链接的 `<动态拼出的链接>` **不要写死**：用 Outline MCP 的 `list_collections` 找到名字为「AI」的文档集，取其 `urlId` 拼出链接；找不到时向用户说明并给出知识库首页 `https://outline.hub.xzs/`

## 错误处理

在配置过程中如果遇到错误，遵循**严格卡住**原则：

1. **清晰显示错误信息**
   - 说明哪个步骤失败了（cite 报错码，如 `853004` / `853006` / `850002`）
   - 显示具体错误内容
   - 不使用技术术语，用通俗语言解释

2. **判定错误类型**
   - 瞬时失败（网络抖动、安全分类器临时不可用、SSL 偶发中断）→ 稍等片刻重试，最多重试到命令超时预算；重试成功视为通过
   - 已知稳定失败 → 按本文档对应章节的修复方式处理（如低下载量拦截 → 切安装后端；brew 后端不支持 → 走平台渠道表）
   - 连续重试同一动作 3 次仍失败，停止重复，如实向用户汇报并给出下一步选项

3. **卡住即停，但只卡真正需要的**
   - 未修复到实测通过前，**不得进入下一阶段**
   - 修复需要用户参与（扫码、登录、授权、填 token、管理员执行命令）时，明确告知用户做什么、等用户完成后立即回归验证
   - 修复不需要用户参与的，Agent 自动修复、自动重试、自动回归，**不打扰用户**
   - 无法自动修复且暂不需要用户配合（如企业侧能力限制），如实说明限制、记录在案，由用户决定如何处理

4. **记录问题**
   - 记录失败的步骤与错误信息
   - 在最终报告中标注未完成的部分（有未完成项时禁止宣称"全部通过"）

5. **继续或重试**
   - 每个失败步骤都向用户提供：重试当前步骤 / 用户手动完成后回归验证
   - 不存在"跳过非关键步骤"的选项——所有步骤都必须最终通过

## 注意事项

- **始终使用最新版本**：不写死版本号，动态获取最新稳定版。
- **完整执行 + 严格卡住**：每个阶段完整走完，失败必须停下修复，实测通过才推进。
- **用户无感自动推进**：完成即前进，不逐项询问；能自动做的（检查、安装、注册、验证）一律自动做，只有用户动手或真正卡死时才停下等待。
- **用户操作批量下发**：独立操作（三项认证）一次给全，减少往返。
- **实测为准**：认证、连通一律实际调用接口确认，不信任本地状态标记。
- **清晰反馈**：每个阶段完成时给出一行进度反馈，但不需要用户回应。
- **简单语言**：与用户的交互使用易懂的语言和详细指引；内部执行细节不展示。
- **内部值不外露**：`extra_identity_context`、`userid`、`chat_id`、`media_id`、Bot ID 等一律不展示给用户。
- **不落临时文件**：授权二维码用链接；如确需落盘，用完立即清理（环境禁用 `rm` 时走 move_to_trash）。
- **链接不写死**：知识库文档集 urlId 动态查询，避免文档集调整后失效。
- **区分「授权」与「权限」**：企业微信扫码授权 ≠ 机器人通讯录权限开关，向用户说明时永远分开讲。

## 附录 A：CLI 命令速查（流程直接执行，禁止临时查 --help）

流程中使用的全部命令汇总如下，各 Phase 直接引用，执行时照抄即可。**装好即用，不再研究用法。**

### wecom-cli（企业微信）

| 用途 | 命令 |
|---|---|
| 版本 | `wecom-cli --version` |
| 扫码授权 | `wecom-cli auth init --noninteractive`（输出二维码链接；**不要**加 `--output-qrcode`） |
| 授权状态 | `wecom-cli auth show --status` |
| 登出 | `wecom-cli auth logout` |
| 授权人信息（核心实测，无需通讯录权限） | `wecom-cli identity whoami` |
| 通讯录搜索（可选检查，无权限报 850002） | `wecom-cli contact users search --keywords "<姓名>"` |
| 发消息（必须 markdown 类型） | `wecom-cli message aibot send --json '{"chat_id":"<授权人ID>","msg_type":"markdown","markdown":{"content":"..."}}'` |

### tmeet（腾讯会议）

| 用途 | 命令 |
|---|---|
| 版本 | `tmeet --version`（或 `tmeet -V`） |
| 登录 | `tmeet auth login`（自动打开浏览器或输出授权链接；后台等待，轮询超时 5 分钟） |
| 登录状态 | `tmeet auth status` |
| 登出 | `tmeet auth logout` |
| 会议列表（实测验证） | `tmeet meeting list` |

### agent-browser（浏览器自动化）

| 用途 | 命令 |
|---|---|
| 版本 | `agent-browser --version` |
| 打开页面 | `agent-browser --cdp 9222 open <url>` |
| CDP 就绪检查 | `curl -s --max-time 2 http://127.0.0.1:9222/json/version` |

### Outline MCP（`@xzs/outline`）

- 连通性实测：MCP 工具 `list_collections`（成功返回文档集列表即通过）
- 服务器地址：`https://outline.hub.xzs/mcp`（streamableHttp），认证：请求头 `Authorization: Bearer <API token>`

## 附录 B：公司根证书（rootCA.crt 兜底）

当本 skill 目录下找不到 `rootCA.crt` 文件时，将以下内容**原样保存**为 `rootCA.crt`（含首尾两行），再按 Phase 1 第 4 步安装。

证书信息：CN=`xzs`，O=XZS，自签 CA，有效期 2026-04-08 至 2036-04-05。

```pem
-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----
```
