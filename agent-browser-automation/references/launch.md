# 启动共享 Chrome

默认 profile：`$HOME/shared-browser-profile`（用户另指定则用指定路径）。先 `mkdir -p`。

启动后轮询 `http://127.0.0.1:9222/json/version` 直到有 JSON。

## Windows（Git Bash / Cherry Studio 默认 shell）

```bash
PROFILE="$HOME/shared-browser-profile"
mkdir -p "$PROFILE"
CHROME=""
for p in \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
  "$LOCALAPPDATA/Google/Chrome/Application/chrome.exe"
do
  [ -f "$p" ] && CHROME="$p" && break
done
[ -n "$CHROME" ] || { echo "Chrome not found"; exit 1; }

powershell.exe -NoProfile -Command \
  "Start-Process -FilePath '$(cygpath -w "$CHROME")' -ArgumentList '--remote-debugging-port=9222','--user-data-dir=$(cygpath -w "$PROFILE")','--no-first-run','--no-default-browser-check','--start-maximized'"
```

## macOS

```bash
PROFILE="$HOME/shared-browser-profile"
mkdir -p "$PROFILE"
open -na "Google Chrome" --args \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  --start-maximized
```

## Linux

```bash
PROFILE="$HOME/shared-browser-profile"
mkdir -p "$PROFILE"
CHROME=$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser)
[ -n "$CHROME" ] || { echo "Chrome not found"; exit 1; }
"$CHROME" \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  --start-maximized >/dev/null 2>&1 &
```

## 附着

```bash
agent-browser --cdp 9222 tab
agent-browser --cdp 9222 open https://www.baidu.com
```

不要用 `agent-browser connect`。
