#!/usr/bin/env node

// src/cli/index.ts
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

// src/shared/version.ts
var VERSION = "0.1.1";

// src/shared/constants.ts
var DEFAULT_BOARD_URL = "https://board.hub.xzs";
var TIMEZONE = "Asia/Shanghai";
var ITEM_TYPES = ["task", "module", "milestone", "risk"];
var ITEM_TYPE_LABELS = {
  task: "待办",
  module: "模块",
  milestone: "里程碑",
  risk: "风险"
};
var ITEM_CODE_FORMAT_HINTS = {
  task: "MMDD-NN（会议日期 + 两位序号，如 0922-01）",
  module: "K + 至少两位数字（如 K01）",
  milestone: "M + 至少两位数字（如 M01）",
  risk: "R + 至少两位数字（如 R01）"
};
var ITEM_STATUSES = ["not_started", "in_progress", "blocked", "to_verify", "done", "paused"];
var STATUS_LABELS = {
  not_started: "未开始",
  in_progress: "进行中",
  blocked: "阻塞",
  to_verify: "待核实",
  done: "已完成",
  paused: "暂停·取消"
};
var DUE_PRECISION_LABELS = {
  day: "日",
  week: "周",
  xun: "旬",
  month: "月",
  fuzzy: "模糊"
};
var VISIBILITY_LABELS = {
  workspace: "全员可见",
  private: "私有"
};
var SYNC_MODE_LABELS = {
  incremental: "增量",
  full: "全量重建"
};
var CHANGE_KIND_LABELS = {
  created: "新增",
  updated: "变更",
  removed: "已移除",
  restored: "恢复",
  renamed: "改编号"
};
var FIELD_LABELS = {
  code: "编号",
  title: "标题",
  description: "描述",
  status: "状态",
  statusNote: "状态备注",
  dueText: "截止（原文）",
  dueStart: "时间窗开始",
  dueEnd: "时间窗结束",
  duePrecision: "日期精度",
  startDate: "开始日期",
  owners: "负责人",
  priority: "优先级",
  parentCode: "父条目",
  relatedCodes: "关联条目",
  sourceDocId: "出处文档",
  sourceDocUrl: "出处链接",
  sourceHeading: "出处标题",
  sourceAnchor: "出处锚点",
  sourceMeeting: "来源会议",
  mirrorOf: "镜像来源"
};
var AUTH_CACHE_TTL_MS = 5 * 60 * 1e3;
var PERMISSION_CACHE_TTL_MS = 5 * 60 * 1e3;
var MAX_REQUEST_BODY_BYTES = 16 * 1024 * 1024;

// src/cli/commands.ts
import { readFile } from "node:fs/promises";

// src/cli/core.ts
import { parseArgs } from "node:util";
var EXIT = {
  ok: 0,
  /** The board service answered with an error (4xx/5xx, or an unreadable response). */
  api: 1,
  /** Bad command line, missing token, unreadable/invalid input file. */
  usage: 2,
  /** Could not reach the service (network, TLS certificate, timeout). */
  network: 3
};
var CliError = class extends Error {
  constructor(message, code, exitCode, extra = {}) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
    this.extra = extra;
  }
  code;
  exitCode;
  extra;
  name = "CliError";
};
function usageError(message, usage) {
  return new CliError(message, "usage_error", EXIT.usage, usage ? { usage } : {});
}
var TOKEN_ENV_VARS = ["BOARD_TOKEN", "OUTLINE_API_KEY", "OUTLINE_TOKEN"];
function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
function resolveConfig(flags, env) {
  const rawUrl = nonEmpty(flags.url) ?? nonEmpty(env.BOARD_URL) ?? DEFAULT_BOARD_URL;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw usageError(`看板服务地址无效：${rawUrl}（通过 --url 或环境变量 BOARD_URL 设置）`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw usageError(`看板服务地址必须是 http(s) 地址：${rawUrl}`);
  }
  const baseUrl = rawUrl.replace(/\/+$/, "");
  const flagToken = nonEmpty(flags.token);
  if (flagToken) return { baseUrl, token: flagToken, tokenSource: "--token" };
  for (const name of TOKEN_ENV_VARS) {
    const token = nonEmpty(env[name]);
    if (token) return { baseUrl, token, tokenSource: name };
  }
  return { baseUrl, token: void 0, tokenSource: void 0 };
}
function usesSystemCa(execArgv, env) {
  return execArgv.includes("--use-system-ca") || /(?:^|\s)--use-system-ca(?:\s|$)/.test(env.NODE_OPTIONS ?? "");
}
var GLOBAL_OPTIONS = {
  url: { type: "string", value: "<地址>", help: `看板服务地址，默认取环境变量 BOARD_URL，再默认 ${DEFAULT_BOARD_URL}` },
  token: {
    type: "string",
    value: "<token>",
    help: "本人的 Outline API token（优先于环境变量；建议用环境变量，避免留在命令历史里）"
  },
  pretty: { type: "boolean", help: "输出人类可读的格式（默认输出 JSON）" },
  help: { type: "boolean", short: "h", help: "查看帮助" }
};
var GLOBAL_VALUE_FLAGS = /* @__PURE__ */ new Set(["--url", "--token"]);
function splitCommand(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") break;
    if (GLOBAL_VALUE_FLAGS.has(arg)) {
      i++;
      continue;
    }
    if (arg.startsWith("-")) continue;
    return { name: arg, rest: [...argv.slice(0, i), ...argv.slice(i + 1)] };
  }
  return { name: void 0, rest: [...argv] };
}
function optionFromMessage(message) {
  return /'(-{1,2}[^' ,]+)/.exec(message)?.[1] ?? "";
}
function parseCommandArgs(args, options, usage) {
  const specs = {};
  for (const [name, spec] of Object.entries({ ...GLOBAL_OPTIONS, ...options })) {
    specs[name] = spec.short ? { type: spec.type, short: spec.short } : { type: spec.type };
  }
  try {
    const { values, positionals } = parseArgs({ args: [...args], options: specs, allowPositionals: true, strict: true });
    return { positionals, flags: values };
  } catch (err) {
    const code = err.code;
    const message = err instanceof Error ? err.message : String(err);
    const option = optionFromMessage(message);
    if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") throw usageError(`未知参数：${option || message}`, usage);
    if (code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
      if (message.includes("argument missing")) throw usageError(`参数 ${option} 需要一个值`, usage);
      if (message.includes("ambiguous")) throw usageError(`参数 ${option} 的值以 - 开头，请写成 ${option}=<值>`, usage);
      throw usageError(`参数 ${option} 不接受值`, usage);
    }
    throw usageError(`参数解析失败：${message}`, usage);
  }
}
function stringFlag(flags, name) {
  const v = flags[name];
  return typeof v === "string" ? v : void 0;
}
function intFlag(flags, name, usage) {
  const v = stringFlag(flags, name);
  if (v === void 0) return void 0;
  if (!/^\d+$/.test(v.trim())) throw usageError(`参数 --${name} 应为正整数：${v}`, usage);
  return Number(v.trim());
}
var TRUE_WORDS = /* @__PURE__ */ new Set(["true", "1", "yes", "y", "on", "是"]);
var FALSE_WORDS = /* @__PURE__ */ new Set(["false", "0", "no", "n", "off", "否"]);
function boolFlag(flags, name, usage) {
  const v = stringFlag(flags, name);
  if (v === void 0) return void 0;
  const word = v.trim().toLowerCase();
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  throw usageError(`参数 --${name} 应为 true 或 false：${v}`, usage);
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/cli/format.ts
var WIDE = /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]|[\u{1f300}-\u{1faff}]/u;
function displayWidth(text) {
  let width = 0;
  for (const ch of text) width += WIDE.test(ch) ? 2 : 1;
  return width;
}
function truncate(text, maxWidth) {
  if (displayWidth(text) <= maxWidth) return text;
  let out = "";
  let width = 0;
  for (const ch of text) {
    const w = WIDE.test(ch) ? 2 : 1;
    if (width + w > maxWidth - 1) break;
    out += ch;
    width += w;
  }
  return `${out}…`;
}
function pad(text, width) {
  return text + " ".repeat(Math.max(0, width - displayWidth(text)));
}
function renderTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(displayWidth(h), ...rows.map((r) => displayWidth(r[i] ?? ""))));
  const line = (cells) => cells.map((c, i) => i === cells.length - 1 ? c : pad(c, widths[i])).join("  ").trimEnd();
  return [line(headers), line(widths.map((w) => "─".repeat(w))), ...rows.map(line)].join("\n");
}
var timeFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});
function formatTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = Object.fromEntries(timeFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
var label = (labels, key) => key ? labels[key] ?? key : "—";
function formatDue(due) {
  if (!due) return "—";
  const window = due.start || due.end ? `${due.start ?? "?"}~${due.end ?? "?"}${due.precision ? ` ${label(DUE_PRECISION_LABELS, due.precision)}` : ""}` : "";
  if (due.text && window) return `${due.text}（${window}）`;
  return due.text ?? (window || "—");
}
function formatOwners(owners) {
  if (!owners?.length) return "—";
  return owners.map((o) => o.role ? `${o.name}（${o.role}）` : o.name).join("、");
}
function formatSyncLine(sync) {
  if (!sync) return "从未同步";
  const parts = [sync.by ? `@${sync.by.name} ${formatTime(sync.at)}` : formatTime(sync.at)];
  if (sync.meeting) parts.push(sync.meeting.label);
  parts.push(label(SYNC_MODE_LABELS, sync.mode));
  const s = sync.summary;
  parts.push(`新增 ${s.created} · 更新 ${s.updated} · 移除 ${s.removed} · 恢复 ${s.restored}`);
  return parts.join(" · ");
}
function fieldList(fields) {
  return fields.map((f) => label(FIELD_LABELS, f)).join("、");
}
function prettyVersion(v) {
  return [
    `CLI 版本：${v.clientVersion}`,
    `服务端版本：${v.version}（要求 CLI ≥ ${v.minClientVersion}）`,
    v.upToDate ? "版本检查：通过" : "版本检查：CLI 过旧，请更新技能 outline-board-sync"
  ].join("\n");
}
function prettyMe(me) {
  return `${me.name}（${me.role}）
用户 ID：${me.id}`;
}
function prettyProject(p) {
  return [
    `项目：${p.name}`,
    `项目 ID：${p.id}`,
    `文档集：${p.collectionName ?? "—"}（${p.collectionId}）${p.rootDocumentId ? ` · 根文档：${p.rootDocumentId}` : " · 整个文档集"}`,
    `可见性：${label(VISIBILITY_LABELS, p.visibility)} · 总看板：${p.inOverview ? "已加入" : "未加入"}`,
    `看板页面：${p.boardUrl}`,
    `「看板」文档：${p.boardDocId ?? "未创建"}`,
    `最近同步：${formatSyncLine(p.lastSync)}`
  ].join("\n");
}
function prettyProjects(projects) {
  if (projects.length === 0) return "（没有你能查看的已登记项目）";
  const rows = projects.map((p) => [
    p.name,
    p.id,
    p.collectionName ?? "—",
    label(VISIBILITY_LABELS, p.visibility),
    p.inOverview ? "是" : "否",
    p.lastSync ? formatTime(p.lastSync.at) : "从未同步",
    p.boardUrl
  ]);
  return `${renderTable(["项目", "项目 ID", "文档集", "可见性", "总看板", "最近同步", "看板页面"], rows)}
共 ${projects.length} 个项目`;
}
function prettyRegister(r) {
  return `${r.created ? "已登记新项目" : "项目已登记过（未修改名称）"}
${prettyProject(r)}`;
}
function prettyBoardDoc(r) {
  return `${r.created ? "已创建「看板」文档" : "「看板」文档已存在"}：${r.url}
文档 ID：${r.documentId}
注意：不要编辑这篇文档（会破坏嵌入）。`;
}
function prettyItems(items) {
  if (items.length === 0) return "（没有条目）";
  const rows = items.map((i) => [
    i.code,
    label(ITEM_TYPE_LABELS, i.type),
    `${label(STATUS_LABELS, i.status)}${i.removed ? "（已移除）" : ""}${i.mirrorOf ? "（镜像）" : ""}`,
    truncate(i.title, 40),
    truncate(formatOwners(i.owners), 20),
    truncate(formatDue(i.due), 36)
  ]);
  return `${renderTable(["编号", "类型", "状态", "标题", "负责人", "截止"], rows)}
共 ${items.length} 条`;
}
function prettyItem(i) {
  const lines = [
    `[${i.code}] ${label(ITEM_TYPE_LABELS, i.type)} · ${i.title}${i.removed ? "（已移除）" : ""}`,
    `状态：${label(STATUS_LABELS, i.status)}${i.statusNote ? `（${i.statusNote}）` : ""}`,
    `截止：${formatDue(i.due)}`,
    `负责人：${formatOwners(i.owners)}`
  ];
  if (i.priority) lines.push(`优先级：${i.priority}`);
  if (i.parentCode) lines.push(`父条目：${i.parentCode}`);
  if (i.relatedCodes.length) lines.push(`关联：${i.relatedCodes.join("、")}`);
  if (i.mirrorOf) lines.push(`镜像自：项目 ${i.mirrorOf.projectId} · ${i.mirrorOf.code}`);
  if (i.source?.url) lines.push(`出处：${i.source.url}`);
  if (i.description) lines.push(`描述：${i.description}`);
  lines.push(`更新时间：${formatTime(i.updatedAt)}`);
  return lines.join("\n");
}
function prettyNextCode(r) {
  return `下一个可用${label(ITEM_TYPE_LABELS, r.type)}编号：${r.code}`;
}
function prettySync(r) {
  const codes = (list) => list.length ? `：${list.join("、")}` : "";
  const lines = [
    r.dryRun ? "预演完成（dryRun，未写入）" : `同步完成（同步 ID：${r.syncId ?? "—"}）`,
    `新增 ${r.created.length}${codes(r.created)}`,
    `更新 ${r.updated.length}${r.updated.length ? `：${r.updated.map((u) => `${u.code}（${fieldList(u.fields)}）`).join("、")}` : ""}`,
    `移除 ${r.removed.length}${codes(r.removed)}`,
    `恢复 ${r.restored.length}${codes(r.restored)}`,
    `未变 ${r.unchanged}`
  ];
  if (r.warnings.length) lines.push("警告：", ...r.warnings.map((w) => `  - ${w}`));
  lines.push(`看板页面：${r.boardUrl}`);
  return lines.join("\n");
}
function changeValue(value) {
  return value === null ? "（空）" : truncate(value.replace(/\s+/g, " "), 60);
}
function prettyChanges(r) {
  const lines = [];
  if (r.sync) lines.push(`同步：${formatSyncLine(r.sync)}`);
  if (r.changes.length === 0) {
    lines.push("（没有变更记录）");
    return lines.join("\n");
  }
  for (const c of r.changes) {
    const what = c.kind === "updated" && c.field ? `${label(FIELD_LABELS, c.field)}：${changeValue(c.oldValue)} → ${changeValue(c.newValue)}` : c.kind === "renamed" ? `${c.oldValue ?? "?"} → ${c.newValue ?? "?"}` : "";
    const by = c.by ? ` · ${c.by.name}` : "";
    const origin = c.syncId ? "" : " · 手工修正";
    lines.push(`${formatTime(c.at)} · ${c.code} · ${label(CHANGE_KIND_LABELS, c.kind)}${what ? ` · ${what}` : ""}${by}${origin}`);
  }
  lines.push(`共 ${r.changes.length} 条`);
  return lines.join("\n");
}
function prettyInitOverview(r) {
  return `${r.created ? "已创建「总看板」文档集" : "「总看板」文档集已存在"}：${r.url ?? r.collectionId}
文档集 ID：${r.collectionId}`;
}
function errorJson(err) {
  const { status, details, hint, usage } = err.extra;
  return JSON.stringify({
    error: {
      code: err.code,
      message: err.message,
      ...status !== void 0 ? { status } : {},
      ...details !== void 0 ? { details } : {},
      ...hint ? { hint } : {},
      ...usage ? { usage } : {}
    }
  });
}
function errorText(err) {
  const { status, details, hint, usage } = err.extra;
  const lines = [`错误：${err.message}（${err.code}${status ? `，HTTP ${status}` : ""}）`];
  const issues = details?.issues;
  if (Array.isArray(issues)) {
    for (const issue of issues.slice(0, 20)) lines.push(`  - ${issue.path ? `${issue.path}：` : ""}${issue.message ?? ""}`);
    if (issues.length > 20) lines.push(`  …另有 ${issues.length - 20} 处`);
  }
  if (hint) lines.push(`提示：${hint}`);
  if (usage) lines.push(`用法：${usage}`);
  return lines.join("\n");
}

// src/shared/semver.ts
function compareVersions(a, b) {
  const pa = a.split("-")[0].split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split("-")[0].split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// src/cli/http.ts
var UNTRUSTED_CA_CODES = /* @__PURE__ */ new Set([
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_GET_ISSUER_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_UNTRUSTED"
]);
var NETWORK_CODES = /* @__PURE__ */ new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT"
]);
function errorCodes(err, seen = /* @__PURE__ */ new Set()) {
  if (!err || typeof err !== "object" || seen.has(err)) return [];
  seen.add(err);
  const e = err;
  const codes = typeof e.code === "string" ? [e.code] : [];
  codes.push(...errorCodes(e.cause, seen));
  if (Array.isArray(e.errors)) for (const inner of e.errors) codes.push(...errorCodes(inner, seen));
  return codes;
}
function innermostMessage(err) {
  let current = err;
  for (let depth = 0; depth < 5; depth++) {
    const cause = current?.cause;
    if (!(cause instanceof Error)) break;
    current = cause;
  }
  return current instanceof Error ? current.message : String(current);
}
function describeFetchError(err, ctx, timeoutMs) {
  const origin = (() => {
    try {
      return new URL(ctx.baseUrl).origin;
    } catch {
      return ctx.baseUrl;
    }
  })();
  const name = err?.name;
  if (name === "TimeoutError" || name === "AbortError") {
    return new CliError(`请求看板服务超时（${Math.round(timeoutMs / 1e3)} 秒）：${origin}`, "timeout", EXIT.network, {
      hint: "请稍后重试；若持续超时，请检查网络和看板服务状态。"
    });
  }
  const codes = errorCodes(err);
  const caCode = codes.find((c) => UNTRUSTED_CA_CODES.has(c));
  if (caCode) {
    const configured = ctx.tls.systemCa || ctx.tls.extraCaCerts;
    return new CliError(`无法验证看板服务 ${origin} 的 HTTPS 证书（${caCode}）：Node 默认不信任内部根 CA。`, "tls_error", EXIT.network, {
      hint: configured ? `已启用${ctx.tls.systemCa ? " --use-system-ca" : ""}${ctx.tls.extraCaCerts ? ` NODE_EXTRA_CA_CERTS=${ctx.tls.extraCaCerts}` : ""}，但仍找不到内部根 CA：请把内部根证书（rootCA.crt）安装到系统证书库，或让 NODE_EXTRA_CA_CERTS 指向它。` : "请用 node --use-system-ca scripts/board.mjs <命令> … 运行（或设置环境变量 NODE_EXTRA_CA_CERTS=<内部根证书 rootCA.crt 的路径>）。"
    });
  }
  const tlsCode = codes.find((c) => c.startsWith("CERT_") || c.startsWith("ERR_TLS_") || c.startsWith("ERR_SSL_"));
  if (tlsCode) {
    return new CliError(`看板服务 ${origin} 的 HTTPS 证书校验失败（${tlsCode}）`, "tls_error", EXIT.network, {
      hint: `请确认看板服务地址是否正确（当前 ${ctx.baseUrl}，可用 BOARD_URL 或 --url 修改）。`
    });
  }
  const netCode = codes.find((c) => NETWORK_CODES.has(c));
  const detail = netCode ?? codes[0] ?? innermostMessage(err);
  return new CliError(`无法连接看板服务 ${origin}（${detail}）`, "network_error", EXIT.network, {
    hint: `请检查网络、看板服务地址（当前 ${ctx.baseUrl}，可用 BOARD_URL 或 --url 修改）以及服务是否在运行。`
  });
}
function isErrorBody(value) {
  return isPlainObject(value) && isPlainObject(value.error) && typeof value.error.code === "string" && typeof value.error.message === "string";
}
function missingTokenError() {
  return new CliError("未找到 Outline API token", "missing_token", EXIT.usage, {
    hint: "请设置环境变量 BOARD_TOKEN（或 OUTLINE_API_KEY / OUTLINE_TOKEN），或加 --token <token>；token 为你本人的 Outline API token。"
  });
}
function isUsableToken(token) {
  return /^[\x21-\x7e]+$/.test(token);
}
function invalidTokenError(source) {
  return new CliError(
    `${source ? `${source} 中的` : ""}token 含有无效字符（如全角字符、空格或换行），不是有效的 Outline API token`,
    "invalid_token",
    EXIT.usage,
    { hint: "请重新复制你本人的 Outline API token（只含英文字母、数字和符号），通过环境变量 BOARD_TOKEN（或 OUTLINE_API_KEY / OUTLINE_TOKEN）或 --token 提供。" }
  );
}
var TOKEN_HINT = "请确认使用的是你本人有效的 Outline API token（--token 或环境变量 BOARD_TOKEN / OUTLINE_API_KEY / OUTLINE_TOKEN）。";
function hintForStatus(status, code) {
  if (status === 401) return TOKEN_HINT;
  if (code === "rate_limited") return "短时间内身份验证失败次数过多，请确认 token 正确后稍等片刻再试。";
  if (code === "outline_rate_limited") return "Outline 暂时限流，请稍等片刻再试。";
  if (code === "payload_too_large") return "请求体超过 16 MB：请分批同步（每批最多 1000 条）。";
  if (code === "forbidden") return "看板服务按 Outline 权限判断：你需要对该项目的文档（或文档集）有编辑权限。";
  if (code === "admin_required") return "只有 Outline 管理员可以执行该操作。";
  return void 0;
}
async function apiRequest(ctx, method, path, opts = {}) {
  const url = new URL(`${ctx.baseUrl}/api${path}`);
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== void 0) url.searchParams.set(key, String(value));
  }
  const headers = { Accept: "application/json", "User-Agent": `board-cli/${VERSION}` };
  if (opts.auth !== false) {
    if (!ctx.token) throw missingTokenError();
    if (!isUsableToken(ctx.token)) throw invalidTokenError();
    headers.Authorization = `Bearer ${ctx.token}`;
  }
  let body;
  if (opts.body !== void 0) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const timeoutMs = opts.timeoutMs ?? ctx.timeoutMs;
  let res;
  let text;
  try {
    res = await ctx.fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
    text = await res.text();
  } catch (err) {
    throw describeFetchError(err, ctx, timeoutMs);
  }
  let data;
  let parsed = true;
  try {
    data = text.trim() === "" ? null : JSON.parse(text);
  } catch {
    parsed = false;
  }
  if (!res.ok) {
    if (parsed && isErrorBody(data)) {
      const { code, message, details } = data.error;
      const hint = hintForStatus(res.status, code);
      throw new CliError(message, code, EXIT.api, {
        status: res.status,
        ...details !== void 0 ? { details } : {},
        ...hint ? { hint } : {}
      });
    }
    throw new CliError(`看板服务返回 HTTP ${res.status}`, "http_error", EXIT.api, {
      status: res.status,
      hint: res.status === 401 ? TOKEN_HINT : `响应不是看板服务的错误格式，请确认看板服务地址是否正确（当前 ${ctx.baseUrl}）。`
    });
  }
  if (!parsed) {
    throw new CliError("看板服务返回了无法解析的响应（不是 JSON）", "bad_response", EXIT.api, {
      status: res.status,
      hint: `请确认看板服务地址是否正确（当前 ${ctx.baseUrl}）。`
    });
  }
  return data;
}
function outdatedMessage(minClientVersion) {
  return `警告：当前 board.mjs 版本 ${VERSION} 低于看板服务要求的最低版本 ${minClientVersion}，请更新技能 outline-board-sync（含 scripts/board.mjs）后再使用。`;
}
function isOutdated(info) {
  return typeof info?.minClientVersion === "string" && compareVersions(VERSION, info.minClientVersion) < 0;
}
async function fetchVersion(ctx, timeoutMs) {
  const data = await apiRequest(ctx, "GET", "/version", { auth: false, ...timeoutMs ? { timeoutMs } : {} });
  if (!isPlainObject(data) || typeof data.version !== "string" || typeof data.minClientVersion !== "string") {
    throw new CliError("看板服务的版本信息格式不正确", "bad_response", EXIT.api, {
      hint: `请确认看板服务地址是否正确（当前 ${ctx.baseUrl}）。`
    });
  }
  return { version: data.version, minClientVersion: data.minClientVersion };
}
async function checkClientVersion(ctx) {
  try {
    const info = await fetchVersion(ctx, Math.min(ctx.timeoutMs, 1e4));
    return isOutdated(info) ? outdatedMessage(info.minClientVersion) : null;
  } catch {
    return null;
  }
}

// src/cli/commands.ts
var PROGRAM = "node --use-system-ca board.mjs";
var enc = encodeURIComponent;
function usageOf(name) {
  const command = COMMANDS.find((c) => c.name === name);
  return command ? `${PROGRAM} ${command.usage}` : PROGRAM;
}
function takePositionals(args, command, names, optional = []) {
  const { positionals } = args;
  if (positionals.length < names.length) {
    throw usageError(`缺少参数 <${names[positionals.length]}>`, usageOf(command));
  }
  const max = names.length + optional.length;
  if (positionals.length > max) {
    throw usageError(`多余的参数：${positionals.slice(max).join(" ")}`, usageOf(command));
  }
  return positionals;
}
function requireFlag(args, command, flag) {
  const value = stringFlag(args.flags, flag);
  if (value === void 0 || value.trim() === "") throw usageError(`缺少参数 --${flag}`, usageOf(command));
  return value;
}
async function readJsonSource(ctx, source, what) {
  let text;
  if (source === "-") {
    text = await ctx.io.readStdin();
  } else {
    try {
      text = await readFile(source, "utf8");
    } catch (err) {
      const code = err.code;
      throw new CliError(
        code === "ENOENT" ? `文件不存在：${source}` : `无法读取文件 ${source}（${code ?? String(err)}）`,
        "file_error",
        EXIT.usage
      );
    }
  }
  return parseJsonText(text.replace(/^\uFEFF/, ""), source === "-" ? `标准输入中的${what}` : `${what}（${source}）`);
}
function parseJsonText(text, what) {
  if (text.trim() === "") throw new CliError(`${what}为空`, "invalid_json", EXIT.usage);
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new CliError(`${what}不是有效的 JSON：${err instanceof Error ? err.message : String(err)}`, "invalid_json", EXIT.usage);
  }
}
function takePathKeys(body, keys, given, command) {
  const rest = { ...body };
  const path = { ...given };
  for (const key of keys) {
    if (!(key in rest)) continue;
    const value = rest[key];
    delete rest[key];
    if (typeof value !== "string") throw usageError(`JSON 中的 ${key} 应为字符串`, usageOf(command));
    if (path[key] !== void 0 && path[key] !== value) {
      throw usageError(`命令行的${key === "projectId" ? "项目ID" : "编号"}（${path[key]}）与 JSON 中的 ${key}（${value}）不一致`, usageOf(command));
    }
    path[key] = value;
  }
  return { body: rest, path };
}
var typeOption = (help) => ({ type: "string", value: ITEM_TYPES.join("|"), help });
var COMMANDS = [
  {
    name: "version",
    summary: "查看 CLI 与服务端版本，检查 CLI 是否需要更新",
    usage: "version",
    details: [
      "输出 {version, minClientVersion}（同 MCP 工具 board_version）外加 clientVersion（本 CLI 版本）和 upToDate；CLI 过旧时在 stderr 提示更新技能。",
      "不需要 token。可用来检查看板服务是否可达（证书、网络）。只看本地 CLI 版本用 --version。"
    ],
    mcpTool: "board_version",
    endpoint: "GET /api/version",
    requiresToken: false,
    options: {},
    run: async (ctx, args) => {
      takePositionals(args, "version", []);
      const info = await fetchVersion(ctx);
      const upToDate = !isOutdated(info);
      if (!upToDate) ctx.io.stderr(outdatedMessage(info.minClientVersion));
      return { version: info.version, minClientVersion: info.minClientVersion, clientVersion: VERSION, upToDate };
    },
    pretty: prettyVersion
  },
  {
    name: "whoami",
    summary: "查看当前 token 对应的 Outline 用户",
    usage: "whoami",
    mcpTool: "board_whoami",
    endpoint: "GET /api/me",
    requiresToken: true,
    options: {},
    run: async (ctx, args) => {
      takePositionals(args, "whoami", []);
      return apiRequest(ctx, "GET", "/me");
    },
    pretty: (r) => prettyMe(r)
  },
  {
    name: "projects",
    summary: "列出你能读取的已登记项目（含项目 ID、看板链接、最近同步）",
    usage: "projects",
    mcpTool: "board_list_projects",
    endpoint: "GET /api/projects",
    requiresToken: true,
    options: {},
    run: async (ctx, args) => {
      takePositionals(args, "projects", []);
      return apiRequest(ctx, "GET", "/projects");
    },
    pretty: (r) => prettyProjects(r)
  },
  {
    name: "register",
    summary: "登记项目（按 文档集 + 根文档 幂等）",
    usage: "register --collection <文档集ID> [--root-doc <文档ID>] --name <项目名>",
    details: [
      "项目 = 直接包含「进度与待办」的那一层（还没迁移的项目是直接包含「进度追踪」「待办事项」的那一层，迁移后不变）：是一篇文档时同时给 --collection 和 --root-doc，是整个文档集时只给 --collection。",
      "已登记过则返回现有项目（created=false，不改名；改名用 project-set）。需要该文档/文档集的编辑权限。"
    ],
    examples: ["register --collection exampleC01 --root-doc exampleD01 --name 示例项目"],
    mcpTool: "board_register_project",
    endpoint: "POST /api/projects",
    requiresToken: true,
    options: {
      collection: { type: "string", value: "<文档集ID>", help: "Outline 文档集 id（uuid 或 urlId）" },
      "root-doc": { type: "string", value: "<文档ID>", help: "项目根文档 id（uuid 或 urlId）；项目即整个文档集时省略" },
      name: { type: "string", value: "<项目名>", help: "项目名，如「示例项目」" }
    },
    run: async (ctx, args) => {
      takePositionals(args, "register", []);
      const body = {
        collectionId: requireFlag(args, "register", "collection"),
        name: requireFlag(args, "register", "name")
      };
      const rootDoc = stringFlag(args.flags, "root-doc");
      if (rootDoc) body.rootDocumentId = rootDoc;
      return apiRequest(ctx, "POST", "/projects", { body });
    },
    pretty: (r) => prettyRegister(r)
  },
  {
    name: "project-set",
    summary: "修改项目名称，或设置是否加入总看板",
    usage: "project-set <项目ID> [--name <项目名>] [--in-overview true|false]",
    details: ["加入总看板前须征得用户同意（默认不加入）。需要编辑权限。"],
    examples: ["project-set <项目ID> --in-overview true"],
    mcpTool: "board_update_project",
    endpoint: "PATCH /api/projects/:id",
    requiresToken: true,
    options: {
      name: { type: "string", value: "<项目名>", help: "新的项目名" },
      "in-overview": { type: "string", value: "true|false", help: "是否在总看板中显示" }
    },
    run: async (ctx, args) => {
      const [projectId] = takePositionals(args, "project-set", ["项目ID"]);
      const body = {};
      const name = stringFlag(args.flags, "name");
      if (name !== void 0) body.name = name;
      const inOverview = boolFlag(args.flags, "in-overview", usageOf("project-set"));
      if (inOverview !== void 0) body.inOverview = inOverview;
      if (Object.keys(body).length === 0) throw usageError("至少提供 --name 或 --in-overview", usageOf("project-set"));
      return apiRequest(ctx, "PATCH", `/projects/${enc(projectId)}`, { body });
    },
    pretty: (r) => prettyProject(r)
  },
  {
    name: "board-doc",
    summary: "在 Outline 中创建项目的「看板」文档（已存在则返回现有的）",
    usage: "board-doc <项目ID> [--title 看板] [--height 800]",
    details: [
      "文档与「进度与待办」同级、排在第一个，正文只有一个看板嵌入。首次创建前须征得用户同意。",
      "创建后永远不要编辑这篇文档：用 Outline MCP 修改会把嵌入变成普通链接。"
    ],
    mcpTool: "board_create_board_doc",
    endpoint: "POST /api/projects/:id/board-doc",
    requiresToken: true,
    options: {
      title: { type: "string", value: "<标题>", help: "文档标题，默认「看板」" },
      height: { type: "string", value: "<像素>", help: "嵌入高度，默认 800" }
    },
    run: async (ctx, args) => {
      const [projectId] = takePositionals(args, "board-doc", ["项目ID"]);
      const body = {};
      const title = stringFlag(args.flags, "title");
      if (title !== void 0) body.title = title;
      const height = intFlag(args.flags, "height", usageOf("board-doc"));
      if (height !== void 0) body.height = height;
      return apiRequest(ctx, "POST", `/projects/${enc(projectId)}/board-doc`, { body });
    },
    pretty: (r) => prettyBoardDoc(r)
  },
  {
    name: "items",
    summary: "列出项目条目（默认不含已移除的）",
    usage: "items <项目ID> [--type task|module|milestone|risk] [--include-removed]",
    mcpTool: "board_list_items",
    endpoint: "GET /api/projects/:id/items",
    requiresToken: true,
    options: {
      type: typeOption("只看某一类：task 待办 / module 模块 / milestone 里程碑 / risk 风险"),
      "include-removed": { type: "boolean", help: "包含已移除的条目" }
    },
    run: async (ctx, args) => {
      const [projectId] = takePositionals(args, "items", ["项目ID"]);
      return apiRequest(ctx, "GET", `/projects/${enc(projectId)}/items`, {
        query: {
          type: stringFlag(args.flags, "type"),
          includeRemoved: args.flags["include-removed"] === true ? "1" : void 0
        }
      });
    },
    pretty: (r) => prettyItems(r)
  },
  {
    name: "next-code",
    summary: "查询下一个可用编号",
    usage: "next-code <项目ID> --type module|milestone|risk | --type task --meeting-date YYYY-MM-DD",
    details: [
      ...ITEM_TYPES.map((t) => `${ITEM_TYPE_LABELS[t]}（${t}）：${ITEM_CODE_FORMAT_HINTS[t]}`),
      "已移除条目占用的编号也算在内。本命令不占号：一次要编多个新号时，从返回值起依次递增即可。"
    ],
    examples: ["next-code <项目ID> --type module", "next-code <项目ID> --type task --meeting-date 2026-09-29"],
    mcpTool: "board_next_code",
    endpoint: "GET /api/projects/:id/next-code",
    requiresToken: true,
    options: {
      type: typeOption("条目类型"),
      "meeting-date": { type: "string", value: "YYYY-MM-DD", help: "会议日期（--type task 时必填）" }
    },
    run: async (ctx, args) => {
      const [projectId] = takePositionals(args, "next-code", ["项目ID"]);
      return apiRequest(ctx, "GET", `/projects/${enc(projectId)}/next-code`, {
        query: { type: requireFlag(args, "next-code", "type"), meetingDate: stringFlag(args.flags, "meeting-date") }
      });
    },
    pretty: (r) => prettyNextCode(r)
  },
  {
    name: "sync",
    summary: "批量同步条目（JSON 文件，或 - 表示标准输入）",
    usage: "sync <项目ID> --file <JSON 文件>|- [--dry-run] [--mode incremental|full]",
    details: [
      "JSON 内容与 MCP 工具 board_sync 的参数相同：{mode?, meeting?, dryRun?, items: [...], removals?}；也可以直接带 projectId（此时可省略命令行的 <项目ID>）。",
      "每个 item 是条目的完整快照（省略的可选字段会被清空）：code、type、title、status 必填；可选 description、statusNote、due{text,start,end,precision}、owners[{name,userId?,role?}]、priority、parentCode、relatedCodes、source{docUrl,docId,heading}、sourceMeeting{label,date?,url?}、mirrorOf{projectId,code}。",
      `状态：${ITEM_STATUSES.map((s) => `${s} ${STATUS_LABELS[s]}`).join(" / ")}；原文放 statusNote。`,
      "mode 默认 incremental；full = 全量重建，本次未出现的条目都会被标记为已移除——只在用户要求重建时使用，先 --dry-run 并把将被移除的条目给用户确认。",
      "建议先 --dry-run 自查（不写入），再正式同步。--dry-run / --mode 会覆盖 JSON 中的同名字段。"
    ],
    examples: ["sync <项目ID> --file items.json --dry-run", "sync <项目ID> --file - < items.json"],
    mcpTool: "board_sync",
    endpoint: "POST /api/projects/:id/sync",
    requiresToken: true,
    options: {
      file: { type: "string", value: "<JSON 文件>|-", help: "同步数据文件；- 表示从标准输入读取" },
      "dry-run": { type: "boolean", help: "只计算差异，不写入" },
      mode: { type: "string", value: "incremental|full", help: "同步模式（覆盖 JSON 中的 mode）" }
    },
    run: async (ctx, args) => {
      const [positional] = takePositionals(args, "sync", [], ["项目ID"]);
      const input = await readJsonSource(ctx, requireFlag(args, "sync", "file"), "同步数据");
      if (!isPlainObject(input)) {
        throw usageError("同步数据应为 JSON 对象 {mode?, meeting?, dryRun?, items, removals?}", usageOf("sync"));
      }
      const { body, path } = takePathKeys(input, ["projectId"], positional ? { projectId: positional } : {}, "sync");
      if (!path.projectId) throw usageError("缺少参数 <项目ID>", usageOf("sync"));
      if (args.flags["dry-run"] === true) body.dryRun = true;
      const mode = stringFlag(args.flags, "mode");
      if (mode !== void 0) body.mode = mode;
      return apiRequest(ctx, "POST", `/projects/${enc(path.projectId)}/sync`, { body });
    },
    pretty: (r) => prettySync(r)
  },
  {
    name: "item-set",
    summary: "手工修正条目的部分字段",
    usage: "item-set <项目ID> <编号> [--status <状态>] [--status-note <备注>] [--title <标题>] [--description <描述>] [--priority <优先级>] [--json '<JSON>' | --file <JSON 文件>|-]",
    details: [
      "只改给出的字段；JSON 中 null 表示清空，due/source 整体替换；不能改编号和类型（改编号用 item-rename）。",
      "命令行参数会覆盖 JSON 中的同名字段。常规情况应先改 Outline 再 sync，本命令只用于纠错。",
      `状态：${ITEM_STATUSES.join(" / ")}`
    ],
    examples: [
      "item-set <项目ID> K02 --status done --status-note 已验收",
      `item-set <项目ID> 0922-03 --json '{"due":{"text":"10月底","start":"2026-10-21","end":"2026-10-31","precision":"xun"}}'`
    ],
    mcpTool: "board_update_item",
    endpoint: "PATCH /api/projects/:id/items/:code",
    requiresToken: true,
    options: {
      status: { type: "string", value: "<状态>", help: `新状态：${ITEM_STATUSES.join("|")}` },
      "status-note": { type: "string", value: "<备注>", help: "原文状态描述" },
      title: { type: "string", value: "<标题>", help: "标题" },
      description: { type: "string", value: "<描述>", help: "描述" },
      priority: { type: "string", value: "<优先级>", help: "优先级，如 P0" },
      json: { type: "string", value: "'<JSON>'", help: "要修改的字段（JSON 对象，同 MCP 工具 board_update_item）" },
      file: { type: "string", value: "<JSON 文件>|-", help: "从文件或标准输入读取要修改的字段" }
    },
    run: async (ctx, args) => {
      const given = takePositionals(args, "item-set", ["项目ID", "编号"]);
      const json = stringFlag(args.flags, "json");
      const file = stringFlag(args.flags, "file");
      if (json !== void 0 && file !== void 0) throw usageError("--json 与 --file 只能二选一", usageOf("item-set"));
      let patch = {};
      if (json !== void 0) patch = parseJsonText(json, "--json 参数");
      if (file !== void 0) patch = await readJsonSource(ctx, file, "修改内容");
      if (!isPlainObject(patch)) throw usageError("修改内容应为 JSON 对象", usageOf("item-set"));
      const { body } = takePathKeys(patch, ["projectId", "code"], { projectId: given[0], code: given[1] }, "item-set");
      const flagFields = [
        ["status", "status"],
        ["status-note", "statusNote"],
        ["title", "title"],
        ["description", "description"],
        ["priority", "priority"]
      ];
      for (const [flag, field] of flagFields) {
        const value = stringFlag(args.flags, flag);
        if (value !== void 0) body[field] = value;
      }
      if (Object.keys(body).length === 0) throw usageError("至少提供一个要修改的字段", usageOf("item-set"));
      return apiRequest(ctx, "PATCH", `/projects/${enc(given[0])}/items/${enc(given[1])}`, { body });
    },
    pretty: (r) => prettyItem(r)
  },
  {
    name: "item-rename",
    summary: "修改条目编号（保留历史）",
    usage: "item-rename <项目ID> <旧编号> <新编号>",
    details: [
      "新编号须符合该条目类型的格式且未被占用；引用它的 parentCode/relatedCodes 和其他项目的镜像引用会一并更新。",
      "改完记得用 Outline MCP 的 patch 模式同步修改 Outline 中的编号。"
    ],
    mcpTool: "board_rename_item",
    endpoint: "POST /api/projects/:id/items/:code/rename",
    requiresToken: true,
    options: {},
    run: async (ctx, args) => {
      const [projectId, code, newCode] = takePositionals(args, "item-rename", ["项目ID", "旧编号", "新编号"]);
      return apiRequest(ctx, "POST", `/projects/${enc(projectId)}/items/${enc(code)}/rename`, { body: { newCode } });
    },
    pretty: (r) => prettyItem(r)
  },
  {
    name: "item-rm",
    summary: "将条目标记为已移除（不物理删除，幂等）",
    usage: "item-rm <项目ID> <编号>",
    details: ["之后的同步若再次包含该编号会自动恢复。批量移除请用 sync 的 removals。"],
    mcpTool: "board_remove_item",
    endpoint: "DELETE /api/projects/:id/items/:code",
    requiresToken: true,
    options: {},
    run: async (ctx, args) => {
      const [projectId, code] = takePositionals(args, "item-rm", ["项目ID", "编号"]);
      return apiRequest(ctx, "DELETE", `/projects/${enc(projectId)}/items/${enc(code)}`);
    },
    pretty: (r) => prettyItem(r)
  },
  {
    name: "changes",
    summary: "查看变更记录（--sync-id latest 为最近一次同步）",
    usage: "changes <项目ID> [--sync-id latest|<同步ID>] [--code <编号>] [--limit <条数>]",
    details: [
      "--sync-id latest：最近一次同步的变化（即「最近一次会后的变化」）；给具体同步 ID 查那一次；省略则按时间倒序列出最近的全部变更（含手工修正）。"
    ],
    examples: ["changes <项目ID> --sync-id latest --pretty"],
    mcpTool: "board_list_changes",
    endpoint: "GET /api/projects/:id/changes",
    requiresToken: true,
    options: {
      "sync-id": { type: "string", value: "latest|<同步ID>", help: "只看某次同步的变更" },
      code: { type: "string", value: "<编号>", help: "只看该编号条目的变更" },
      limit: { type: "string", value: "<条数>", help: "最多返回条数，默认 200" }
    },
    run: async (ctx, args) => {
      const [projectId] = takePositionals(args, "changes", ["项目ID"]);
      return apiRequest(ctx, "GET", `/projects/${enc(projectId)}/changes`, {
        query: {
          syncId: stringFlag(args.flags, "sync-id"),
          code: stringFlag(args.flags, "code"),
          limit: intFlag(args.flags, "limit", usageOf("changes"))
        }
      });
    },
    pretty: (r) => prettyChanges(r)
  },
  {
    name: "init-overview",
    summary: "（管理员）创建置顶、全员只读的「总看板」文档集，幂等",
    usage: "init-overview [--height 900]",
    details: ["仅 Outline 管理员可执行。项目需用 project-set --in-overview true 选择加入。"],
    mcpTool: "board_init_overview",
    endpoint: "POST /api/overview/init",
    requiresToken: true,
    options: {
      height: { type: "string", value: "<像素>", help: "嵌入高度，默认 900" }
    },
    run: async (ctx, args) => {
      takePositionals(args, "init-overview", []);
      const height = intFlag(args.flags, "height", usageOf("init-overview"));
      return apiRequest(ctx, "POST", "/overview/init", { body: height !== void 0 ? { height } : {} });
    },
    pretty: (r) => prettyInitOverview(r)
  }
];
function findCommand(name) {
  return COMMANDS.find((c) => c.name === name);
}
function optionLines(options) {
  const entries = Object.entries(options).map(([name, spec]) => [
    `--${name}${spec.short ? `, -${spec.short}` : ""}${spec.value ? ` ${spec.value}` : ""}`,
    spec.help
  ]);
  const width = Math.max(0, ...entries.map(([left]) => displayWidth(left)));
  return entries.map(([left, help]) => `  ${left}${" ".repeat(width - displayWidth(left))}  ${help}`);
}
function helpText() {
  const width = Math.max(...COMMANDS.map((c) => c.name.length));
  return [
    `board ${VERSION} — Outline 看板服务命令行（命令与看板 MCP 工具一一对应）`,
    "",
    `用法：${PROGRAM} <命令> [参数] [--pretty] [--url <地址>] [--token <token>]`,
    `      ${PROGRAM} <命令> --help    查看某个命令的详细说明`,
    "",
    "命令：",
    ...COMMANDS.map((c) => `  ${c.name.padEnd(width)}  ${c.summary}`),
    "",
    "配置：",
    `  看板地址  --url，其次环境变量 BOARD_URL，默认 ${DEFAULT_BOARD_URL}`,
    "  token     依次取 --token、BOARD_TOKEN、OUTLINE_API_KEY、OUTLINE_TOKEN（本人的 Outline API token）",
    "",
    '输出：stdout 默认输出 JSON；--pretty 输出人类可读格式。出错时 stderr 输出 {"error":{"code","message","hint"?}}。',
    "退出码：0 成功；1 看板服务返回错误；2 用法错误、缺少 token 或输入文件有误；3 无法连接（网络、证书、超时）。",
    "证书：必须用 node --use-system-ca 运行，否则 Node 不信任内部 CA（也可设置 NODE_EXTRA_CA_CERTS=<rootCA.crt 路径>）。",
    "",
    "规则速查：",
    "  编号：待办 MMDD-NN（如 0922-01）、模块 K01、里程碑 M01、风险 R01，项目内唯一；已有编号沿用，新号用 next-code 查询",
    `  状态：${ITEM_STATUSES.map((s) => `${s} ${STATUS_LABELS[s]}`).join(" / ")}`,
    "  sync 默认增量；full 模式会把本次未出现的条目标记为已移除，只在重建时使用，先 --dry-run",
    "  「看板」文档由服务端创建，永远不要编辑它"
  ].join("\n");
}
function commandHelp(command) {
  const lines = [`${command.name} — ${command.summary}`, "", `用法：${PROGRAM} ${command.usage}`];
  if (Object.keys(command.options).length) lines.push("", "参数：", ...optionLines(command.options));
  lines.push("", "通用参数：", ...optionLines(GLOBAL_OPTIONS));
  if (command.details?.length) lines.push("", "说明：", ...command.details.map((d) => `  ${d}`));
  if (command.examples?.length) lines.push("", "示例：", ...command.examples.map((e) => `  ${PROGRAM} ${e}`));
  lines.push("", `对应：MCP 工具 ${command.mcpTool} · ${command.endpoint}${command.requiresToken ? "" : "（不需要 token）"}`);
  return lines.join("\n");
}

// src/cli/index.ts
var DEFAULT_TIMEOUT_MS = 12e4;
var processIO = {
  stdout: (t) => void process.stdout.write(t.endsWith("\n") ? t : `${t}
`),
  stderr: (t) => void process.stderr.write(t.endsWith("\n") ? t : `${t}
`),
  readStdin: async () => {
    if (process.stdin.isTTY) {
      throw new CliError("--file - 需要从标准输入读取 JSON，但标准输入是终端", "usage_error", EXIT.usage, {
        hint: "请用管道或重定向提供数据，如 … --file - < items.json，或改用 --file <JSON 文件>。"
      });
    }
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  }
};
function renderPretty(render, result) {
  if (render) {
    try {
      return render(result);
    } catch {
    }
  }
  return JSON.stringify(result, null, 2);
}
function describeStray(arg) {
  return arg.startsWith("-") ? arg.split("=")[0] : "一个参数值";
}
function toCliError(err) {
  if (err instanceof CliError) return err;
  return new CliError(`CLI 内部错误：${err instanceof Error ? err.message : String(err)}`, "cli_error", EXIT.api);
}
async function main(argv = process.argv.slice(2), options = {}) {
  const env = options.env ?? process.env;
  const io = options.io ?? processIO;
  const wantsPretty = argv.includes("--pretty");
  const fail = (err) => {
    const e = toCliError(err);
    io.stderr(wantsPretty ? errorText(e) : errorJson(e));
    return e.exitCode;
  };
  const { name, rest } = splitCommand(argv);
  if (name === void 0) {
    if (rest.includes("--version") || rest.includes("-v")) {
      io.stdout(VERSION);
      return EXIT.ok;
    }
    const stray = rest.find((a) => !["--help", "-h", "--pretty"].includes(a));
    if (stray !== void 0) return fail(usageError(`缺少命令（收到 ${describeStray(stray)}）；运行 --help 查看可用命令`));
    io.stdout(helpText());
    return EXIT.ok;
  }
  if (name === "help") {
    const target = rest.find((a) => !a.startsWith("-"));
    const command2 = target ? findCommand(target) : void 0;
    if (target && !command2) return fail(usageError(`未知命令：${target}；可用命令：${COMMANDS.map((c) => c.name).join("、")}`));
    io.stdout(command2 ? commandHelp(command2) : helpText());
    return EXIT.ok;
  }
  const command = findCommand(name);
  if (!command) {
    return fail(usageError(`未知命令：${name}；可用命令：${COMMANDS.map((c) => c.name).join("、")}（运行 --help 查看说明）`));
  }
  let ctx;
  let args;
  try {
    args = parseCommandArgs(rest, command.options, `${PROGRAM} ${command.usage}`);
    if (args.flags.help === true) {
      io.stdout(commandHelp(command));
      return EXIT.ok;
    }
    const config = resolveConfig({ url: args.flags.url, token: args.flags.token }, env);
    ctx = {
      baseUrl: config.baseUrl,
      token: config.token,
      pretty: args.flags.pretty === true,
      fetch: options.fetch ?? globalThis.fetch,
      io,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      tls: { systemCa: usesSystemCa(options.execArgv ?? process.execArgv, env), extraCaCerts: env.NODE_EXTRA_CA_CERTS || void 0 }
    };
    if (command.requiresToken && !ctx.token) throw missingTokenError();
    if (command.requiresToken && ctx.token && !isUsableToken(ctx.token)) throw invalidTokenError(config.tokenSource);
  } catch (err) {
    return fail(err);
  }
  const versionWarning = command.name !== "version" && options.versionCheck !== false ? checkClientVersion(ctx) : Promise.resolve(null);
  try {
    const result = await command.run(ctx, args);
    io.stdout(ctx.pretty ? renderPretty(command.pretty, result) : JSON.stringify(result));
    return EXIT.ok;
  } catch (err) {
    return fail(err);
  } finally {
    const warning = await versionWarning;
    if (warning) io.stderr(warning);
  }
}
function isEntryPoint() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}
if (isEntryPoint()) {
  main().then((code) => {
    process.exitCode = code;
  });
}
export {
  COMMANDS,
  CliError,
  DEFAULT_TIMEOUT_MS,
  EXIT,
  commandHelp,
  helpText,
  main,
  resolveConfig
};
