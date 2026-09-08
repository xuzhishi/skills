---
name: company-onboarding
description: 公司新员工环境配置向导。当用户提到"入职配置"、"新员工配置"、"onboarding"、"环境搭建"、"配置开发环境"、"初始化工作环境"或需要一键配置公司所需的全套工具（企业微信、腾讯会议、Outline、技能市场）时使用。适用于技术和非技术背景的员工，支持 Mac 和 Windows 系统。
---

# 公司新员工环境配置向导

这是一个完整的自动化配置流程，帮助新员工快速搭建工作所需的全部环境。包括运行时环境、CLI 工具、Cherry Studio 扩展、认证登录和功能验证。

## 设计理念

每次执行都完整运行所有阶段，不跳过任何步骤。这样做是为了确保环境配置的一致性和完整性，避免因增量配置导致的环境差异。

针对非技术背景用户，使用简单易懂的语言，提供详细的操作指引，每个步骤都有清晰的进度提示。

## Phase 0: 预检查和准备

开始配置前，先做好准备工作：

1. **检测操作系统**
   - 使用 `uname -s` (Mac) 或检查 `$OS` 环境变量 (Windows) 确定系统类型
   - 向用户确认检测结果

2. **显示流程概览**
   ```
   📋 配置流程概览（预计 20-30 分钟）
   
   ✓ Phase 0: 预检查（当前）
   □ Phase 1: 浏览器检查
   □ Phase 2: 运行时环境（Node.js, Python）
   □ Phase 3: CLI 工具（wecom-cli, tencentmeeting-cli, agent-browser）
   □ Phase 4: Cherry Studio 扩展（技能 + MCP）
   □ Phase 5: 认证和登录
   □ Phase 6: 功能验证
   □ Phase 7: 完成引导
   
   这是一次性完整配置，确保您的工作环境万无一失。
   ```

3. **确认开始**
   - 询问用户："准备好开始配置了吗？整个过程大约需要 20-30 分钟。"
   - 等待用户确认后继续

## Phase 1: 浏览器检查

Chrome 是后续工具（agent-browser）的必需依赖，必须先确认安装。

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
   - 再次检查，确认成功后继续

3. **已安装**
   - 显示：`✓ Chrome 已安装`

## Phase 2: 运行时环境

安装最新版本的 Node.js 和 Python。不写死版本号，始终获取最新稳定版。

### Mac 系统

使用 Homebrew 作为包管理器：

1. **检查 Homebrew**
   - 运行 `which brew`
   - 如果未安装，运行：`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

2. **安装 Node.js**
   - 运行：`brew install node`
   - 显示安装进度提示："正在安装 Node.js（这可能需要几分钟）..."
   - 验证：`node --version && npm --version`

3. **安装 Python**
   - 运行：`brew install python`
   - 显示安装进度提示："正在安装 Python（这可能需要几分钟）..."
   - 验证：`python3 --version && pip3 --version`

### Windows 系统

使用 Scoop 作为包管理器：

1. **检查 Scoop**
   - 运行：`scoop --version`
   - 如果未安装，向用户提供详细安装指引

2. **Scoop 安装指引（针对非技术用户）**
   ```
   ⚠️  需要安装 Scoop 包管理器
   
   请按照以下步骤操作：
   
   1. 点击开始菜单，搜索"PowerShell"
   2. 右键点击"Windows PowerShell"，选择"以管理员身份运行"
   3. 在打开的蓝色窗口中，复制粘贴以下命令并按回车：
      
      Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
      
   4. 如果询问是否确认，输入 Y 并按回车
   5. 继续复制粘贴以下命令并按回车：
      
      irm get.scoop.sh | iex
      
   6. 等待安装完成（可能需要几分钟）
   7. 完成后回复"已安装"
   ```
   - 等待用户确认
   - 验证：`scoop --version`

3. **安装 Node.js**
   - 运行：`scoop install nodejs`
   - 显示："正在安装 Node.js（这可能需要几分钟）..."
   - 验证：`node --version && npm --version`

4. **安装 Python**
   - 运行：`scoop install python`
   - 显示："正在安装 Python（这可能需要几分钟）..."
   - 验证：`python --version && pip --version`

### 安装完成

显示安装的版本信息：
```
✓ Node.js: v{version}
✓ Python: v{version}
```

## Phase 3: CLI 工具安装

安装三个命令行工具，每个安装后立即验证。

### 1. wecom-cli

企业微信命令行工具。

- 安装：`npm install -g @wecom/cli`
- 显示："正在安装 wecom-cli..."
- 验证：`wecom --version`
- 成功：`✓ wecom-cli 已安装`

### 2. tencentmeeting-cli

腾讯会议命令行工具。

- 安装：`npm install -g @tencent/meeting-cli`
- 显示："正在安装 tencentmeeting-cli..."
- 验证：`tmeet --version`
- 成功：`✓ tencentmeeting-cli 已安装`

### 3. agent-browser

浏览器自动化工具（依赖 Chrome）。

- 安装：`npm install -g agent-browser`
- 显示："正在安装 agent-browser..."
- 验证：运行简单的启动测试
- 成功：`✓ agent-browser 已安装`

## Phase 4: Cherry Studio 扩展

安装技能和配置 MCP 服务器。

### 1. 获取技能列表

从 GitHub 仓库动态获取技能列表：

```bash
# 获取 xuzhishi/skills 仓库的技能列表
curl -s https://api.github.com/repos/xuzhishi/skills/contents | jq -r '.[] | select(.type=="dir") | .name'
```

如果 API 失败，fallback 到克隆仓库：
```bash
git clone --depth=1 https://github.com/xuzhishi/skills.git /tmp/xuzhishi-skills
ls -1 /tmp/xuzhishi-skills
```

### 2. 安装技能

显示："正在安装技能（共 {count} 个）..."

对于每个技能：
- 使用 `mcp__skills__install_skill` 工具安装
- 或者使用 Cherry Studio 的技能安装命令
- 显示进度：`安装中 ({current}/{total}): {skill-name}`

额外安装两个内置技能：
- `tmeet-skill`
- `wecom-unified`

安装完成后显示：`✓ 已安装 {total_count} 个技能`

### 3. 配置 Outline MCP

Outline 是公司的知识库平台。MCP 服务器地址已经配置好，只需要用户提供 token（在 Phase 5 获取）。

此阶段只需确认 MCP 配置存在即可，token 在下一阶段填入。

## Phase 5: 认证和登录

依次完成三个服务的认证。

### 1. wecom-cli 登录

引导用户完成企业微信登录并绑定机器人：

```
📱 企业微信登录
------------------
现在需要登录企业微信。请按照提示操作：

1. 运行登录命令后，会显示一个二维码
2. 使用企业微信扫描二维码完成登录
3. 登录成功后，系统会询问您选择机器人
4. ⚠️  重要：请选择"绑定现有机器人"
5. 从列表中选择名为"bot"的机器人

准备好了吗？
```

- 等待用户确认
- 运行：`wecom login`
- 在绑定机器人环节，明确提示：
  ```
  ⚠️  请选择：
  → 绑定现有机器人
  → 选择"bot"机器人
  ```
- 验证登录状态：`wecom whoami`
- 成功：`✓ 企业微信已登录（bot 机器人）`

### 2. tencentmeeting-cli 登录

引导用户完成腾讯会议登录：

```
🎥 腾讯会议登录
------------------
现在需要登录腾讯会议。请按照提示操作：

1. 运行登录命令后，会显示一个二维码或登录链接
2. 使用腾讯会议 App 或微信扫描完成登录

准备好了吗？
```

- 等待用户确认
- 运行：`tmeet login`
- 验证登录状态：`tmeet whoami`
- 成功：`✓ 腾讯会议已登录`

### 3. Outline Token 配置

引导用户获取 Outline API Token 并配置：

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

第三步：配置 Token
1. 打开 Cherry Studio
2. 进入设置 → MCP Servers
3. 找到"@xzs/outline"
4. 将复制的 token 粘贴到 token 字段
5. 保存配置

完成以上步骤后，回复"已配置"。
```

- 等待用户确认配置完成
- 验证连通性：使用 Outline MCP 调用一个简单的 API（如列出文档集）
- 成功：`✓ Outline 已连接`

如果验证失败，提示用户检查 token 是否正确填写。

## Phase 6: 功能验证

按顺序验证每个服务的功能。

### 1. wecom-unified 验证

使用配置好的 bot 机器人给用户发送欢迎消息：

```
🧪 测试企业微信功能
------------------
正在给您发送一条欢迎消息...
```

- 使用 `wecom-unified` 技能
- 发送消息给用户自己：
  > 🎉 欢迎加入！你的企业微信环境已配置完成。

- 询问用户："收到企业微信消息了吗？"
- 等待确认
- 成功：`✓ 企业微信功能正常`

### 2. tencentmeeting-cli 验证

测试腾讯会议 API 连通性：

```
🧪 测试腾讯会议连接
------------------
正在测试 API 连通性...
```

- 运行简单的 API 调用（如获取用户信息或会议列表）
- 显示连接状态
- 成功：`✓ 腾讯会议 API 连接正常`

### 3. meeting-to-outline 验证

测试腾讯会议和 Outline 的集成：

```
🧪 测试会议记录集成
------------------
正在测试腾讯会议 → Outline 集成...
```

- 使用 `meeting-to-outline` 技能
- 运行连通性测试（不需要实际创建会议记录）
- 验证两个服务都可以访问
- 成功：`✓ 会议记录集成正常`

### 4. agent-browser-automation 验证

测试浏览器自动化：

```
🧪 测试浏览器自动化
------------------
正在打开浏览器...
```

- 使用 `agent-browser-automation` 技能
- 打开 https://baidu.com
- 提示用户："看到浏览器窗口打开百度首页了吗？请回复'看到了'。"
- 等待用户确认
- 关闭浏览器
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
✓ 认证: 企业微信（bot）、腾讯会议、Outline 已连接
✓ 功能验证: 全部通过

您的工作环境已经配置完毕！
```

### 引导到知识库

```
📚 下一步
----------
请访问 Outline 知识库了解更多信息：

👉 https://outline.hub.xzs/collection/ai-Pyx0culOUv/overview

在这里您可以探索其他部门的文档和资源。

💡 提示
如果将来需要重新配置环境，可以随时再次运行这个配置向导。
所有步骤都会重新执行，确保环境一致性。
```

## 错误处理

在配置过程中如果遇到错误：

1. **清晰显示错误信息**
   - 说明哪个步骤失败了
   - 显示具体的错误内容
   - 不使用技术术语，用通俗语言解释

2. **提供解决建议**
   - 给出可能的原因
   - 提供具体的解决步骤
   - 如果需要手动操作，给出详细指引

3. **记录问题**
   - 记录失败的步骤和错误信息
   - 在最终报告中标注未完成的部分

4. **继续或重试**
   - 询问用户是否重试当前步骤
   - 或者跳过继续后续配置（仅在非关键步骤）

## 注意事项

- **始终使用最新版本**：不写死版本号，动态获取最新稳定版
- **完整执行**：每次运行都完整执行所有阶段，不跳过
- **清晰反馈**：每个步骤都有清晰的进度提示和状态反馈
- **等待确认**：涉及用户操作的步骤，等待用户明确确认后继续
- **简单语言**：针对非技术用户，使用易懂的语言和详细的指引
- **必须通过**：所有验证步骤都必须通过，不提供跳过选项
