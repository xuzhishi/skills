---
name: agent-browser-automation
version: 1.0.0
description: "人与 Agent 共用一个可见的真实 Chrome：独立 profile 持久登录、窗口始终显示、用户可随时上手干预。仅在用户明确要求共享浏览器、持久登录、我来登录你接着操作、看着窗口一起做时使用。不要用于无头抓取、一次性打开网页、截图、填表、通用浏览器自动化——那些用内置浏览器工具或官方 vercel-labs/agent-browser。首次使用检测 Chrome（缺失则请用户自行安装）和 agent-browser（可代装），启动后打开 baidu.com 让用户确认看到页面。"
metadata:
  requires:
    bins: ["agent-browser"]
---

# 人机共用浏览器（可见 Chrome + 持久登录）

## 何时使用（严格）

**同时**满足下面两条才用本 skill：

1. 用户要自己看见浏览器窗口，并能随时接手（扫码、验证码、点确认、改输入）
2. 登录态要落盘，关掉窗口或重启 Agent 后还在

典型说法：「我来登录，你接着操作」「共用一个浏览器」「登录别丢」「我要看着你点」

## 何时不要用

下面这些**不要**引到本 skill，改用环境里已有的浏览器 / 抓取工具，或官方 `vercel-labs/agent-browser`：

- 一次性打开某个 URL、读页面、截图、点几下就结束
- 无头抓取、批量采集、后台跑脚本
- 不需要登录、不需要人看窗口
- 用户只是说「打开网站」「自动化浏览器」但没有共享窗口 / 持久登录的意图

本 skill **不是**通用浏览器自动化入口，也 **不是**反检测 / 隐身方案。它只做一件事：给人和 Agent 一台看得见、登得住的真 Chrome。

## 工作原理（先读这一段）

- 启动**用户本机的 Google Chrome**（不是 Electron 内置浏览器，不是 Chrome for Testing）
- 指定独立 `--user-data-dir`（默认 `$HOME/shared-browser-profile`），Cookie / localStorage 写在这里
- 带 `--remote-debugging-port=9222`，Agent 用 `agent-browser --cdp 9222 <命令>` 附着
- 窗口最大化、可见。登录一律用户亲手做，Agent 不填登录表单
- Chrome 136+ 起，调试端口**必须**配非默认 `--user-data-dir`，否则端口不生效。本 skill 的独立目录正好满足这一点

默认 profile 路径可被用户覆盖。一旦约定，整场会话都用同一个目录，不要换。

---

## 一、环境自检（每次会话先做）

按顺序检查。缺 Chrome 就停，等用户装好再继续。缺 agent-browser 可以代装。

### 1. Google Chrome（强依赖，不代装）

按平台找可执行文件：

| 平台 | 查找 |
| --- | --- |
| Windows | `"$PROGRAMFILES/Google/Chrome/Application/chrome.exe"`，其次 `"${PROGRAMFILES(X86)}/Google/Chrome/Application/chrome.exe"`、`"$LOCALAPPDATA/Google/Chrome/Application/chrome.exe"` |
| macOS | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| Linux | `command -v google-chrome` / `google-chrome-stable` / `chromium` / `chromium-browser` |

找不到 → **停下来**，请用户自己安装 Google Chrome（https://www.google.com/chrome/），装好后告诉 Agent 再继续。不要用 `agent-browser install` 去下 Chrome for Testing 顶替——那不是用户日常的 Chrome，也看不到同一套窗口。

### 2. agent-browser CLI

检查：`command -v agent-browser`

未安装时，**先征得用户同意**再装。优先顺序：

1. 当前环境若提供 CLI 安装器（例如 Cherry Studio 的 `cli_install`），用官方文档对应的 recipe：`npm install -g agent-browser` → `npm:agent-browser`
2. 否则：`npm install -g agent-browser`（需 Node.js；没有 Node 就请用户先装 Node LTS）
3. 安装失败：把报错原文给用户，并给出手动安装：`npm install -g agent-browser`

**不要**在已有 Google Chrome 时再跑 `agent-browser install`。那条命令下载的是 Chrome for Testing，本 skill 不需要。

装好后确认：`agent-browser --version` 有输出。

### 3. 调试端口空闲

`curl -s --max-time 2 http://127.0.0.1:9222/json/version`

- 无响应：端口空闲，进入启动
- 有响应且 `Browser` 字段像 Chrome：可能已有共享实例在跑。先 `agent-browser --cdp 9222 tab` 看 tab，能用就复用，不要再起第二个
- 有响应但明显不是 Chrome（未知服务）：告诉用户 9222 被占用，协商换端口或关掉占用方

---

## 二、启动共享浏览器

profile 目录不存在就创建。Windows 的 Git Bash 下 `$HOME` 即 `/c/Users/<name>`，对应 `C:\Users\<name>\shared-browser-profile`。

只加下面这些 flag，**不要**再叠伪装、隐身、user-agent 覆盖：

```
--remote-debugging-port=9222
--user-data-dir=<profile 绝对路径>
--no-first-run
--no-default-browser-check
--start-maximized
```

启动后轮询 `http://127.0.0.1:9222/json/version`（最多约 15 秒）直到返回 JSON。`User-Agent` 应是本机真实 Chrome，而不是伪造的 Macintosh / 旧大版本。

**禁止** `agent-browser connect 9222`：会挂死无输出。全程用：

```bash
agent-browser --cdp 9222 <命令>
```

每个命令都带 `--cdp 9222`。不要假设 `connect` 之后可以省略。

各平台启动命令见 `references/launch.md`。

---

## 三、冒烟测试（首次就绪必做）

共享实例起来后，**先**打开百度，让用户用眼睛确认窗口，再做任何业务：

```bash
agent-browser --cdp 9222 open https://www.baidu.com
```

然后问用户：「你现在能看见百度页面吗？」

- 用户确认看见 → 就绪，进入业务
- 用户看不见窗口 → 多半起成了后台 / 找错窗口。核对启动命令是否带 `--start-maximized`、是否附着到了带调试端口的那一个 Chrome（不是用户日常那个 Default profile）。不要用内置 Electron 浏览器顶替
- 页面打不开但窗口在 → 网络或站点问题，换一个用户指定的公开页再验窗口可见性

冒烟测试不要登录、不要操作业务站。

---

## 四、日常操作约定

### 登录

- 需要登录时：Agent 把页面打开，**停住**，请用户在可见窗口里自己完成（扫码 / 密码 / 验证码）
- Agent 不填写登录表单、不提交账号密码、不替用户点「同意协议」
- 用户说「登好了」之后，再 `get url` / `snapshot` 确认已离开登录页，然后继续

登录态写在 profile 目录里。之后重启同一 `--user-data-dir` 的 Chrome，不必重登。

### 操作

常用命令（一律带 `--cdp 9222`）：

| 目的 | 命令 |
| --- | --- |
| 看 tab | `tab` |
| 打开 URL | `open <url>` |
| 可操作元素 | `snapshot` |
| 点击 / 输入 | `click @eN` / `fill @eN "..."` |
| 跑页面 JS | `eval <js>` |
| 截图核对 | `screenshot <path>` |
| 当前 URL | `get url` |

`snapshot` 返回带 `@eN` 的无障碍树，点元素用 ref，不要瞎猜 CSS。

节奏像人：不要高频循环刷新、不要并发开一堆 tab 抓全站。用户要插手时立刻停，把窗口留给用户。

### Tab 卡死

某个 tab 标题停在旧值、URL 已变但页面不走：不要反复刷新。关掉该 tab，再 `open` 一次；或重启整个 Chrome 实例（登录态在磁盘上，重启零成本）。

### 用完收尾

调试端口把完整浏览器控制权暴露在 localhost，本机任何进程都能连。

- 本轮共享操作结束：关掉这个带 `--remote-debugging-port` 的 Chrome（不要关用户日常那个）
- 确认 `http://127.0.0.1:9222/json/version` 无响应
- 用户日常 Chrome（Default profile、无调试端口）不要动

---

## 五、不要做的事

- 不要用内置 Electron / Playwright / Puppeteer 浏览器冒充本 skill 的窗口
- 不要给 Chrome 加反检测、伪造 UA、stealth 插件、隐藏 CDP
- 不要把「打开一下某网页」的需求收进来
- 不要在用户没同意时装 agent-browser
- 不要替用户安装 Chrome
- 不要把 profile 指到用户日常的 Default 目录去抢锁（Windows 上 Default 被占用会启动失败或行为异常）

若某站点在**附着了真 CDP 会话**后把页面弹回 / 打不开，而用户在无调试端口的同一 profile 里可以正常使用：这是站点在识别调试会话，不是网络故障。本 skill 不提供绕过方法。让用户在无调试端口的窗口里自己完成该站操作；Agent 只处理用户贴回来的内容，或改去不对抗的站点。
