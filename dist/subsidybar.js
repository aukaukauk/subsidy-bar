#!/usr/bin/env node

// src/subsidybar.ts
import { spawnSync } from "node:child_process";
import { chmodSync, closeSync, existsSync as existsSync2, lstatSync, mkdirSync as mkdirSync2, openSync, readFileSync, readSync, readdirSync as readdirSync2, unlinkSync, writeFileSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname, join as join2 } from "node:path";
import { createInterface } from "node:readline/promises";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";

// src/codex-session-source.ts
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
function codexHome() {
  const configured = process.env.CODEX_HOME?.trim();
  return configured ? configured : join(homedir(), ".codex");
}
function codexSessionRoots(home = codexHome()) {
  return [join(home, "sessions"), join(home, "archived_sessions")];
}
function findJsonlFiles(root) {
  if (!existsSync(root)) return [];
  const found = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        found.push(path);
      }
    }
  }
  return found;
}
function createCcusageCodexHome() {
  const selected = /* @__PURE__ */ new Map();
  for (const root of codexSessionRoots()) {
    for (const file of findJsonlFiles(root)) {
      let size = 0;
      try {
        size = statSync(file).size;
      } catch {
        continue;
      }
      const key = sessionKeyFromPath(file);
      const current = selected.get(key);
      if (!current || size > current.size) {
        selected.set(key, { path: file, size });
      }
    }
  }
  if (selected.size === 0) return null;
  const tempRoot = mkdtempSync(join(tmpdir(), "subsidybar-"));
  try {
    const tempSessions = join(tempRoot, "sessions");
    mkdirSync(tempSessions, { recursive: true });
    let index = 0;
    for (const [key, file] of selected) {
      const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "_");
      const target = join(tempSessions, `${String(index).padStart(5, "0")}-${safeKey}.jsonl`);
      symlinkSync(file.path, target);
      index += 1;
    }
    return {
      path: tempRoot,
      cleanup: () => rmSync(tempRoot, { recursive: true, force: true })
    };
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}
function sessionKeyFromPath(path) {
  const match = basename(path).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match ? match[1].toLowerCase() : basename(path).replace(/\.jsonl$/i, "");
}

// src/subsidybar.ts
var usageKeys = [
  "inputTokens",
  "cachedInputTokens",
  "outputTokens",
  "reasoningOutputTokens",
  "totalTokens"
];
var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var cliUsage = "usage: subsidybar [status|details|swiftbar|config|setup]";
var setupUsage = "usage: subsidybar setup [--dir <plugin-dir>] [--force] [--no-setup]";
var configUsage = "usage: subsidybar config [set <key> <value>|prompt subscription]";
var configSetUsage = "usage: subsidybar config set <period|subscription|reset|timezone> <value>";
var weekMs = 7 * 24 * 60 * 60 * 1e3;
var weeklyResetCache;
var configCache;
function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}
function timezone() {
  const candidates = [process.env.SUBSIDYBAR_TIMEZONE, loadConfig().timezone, "America/Los_Angeles"];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && isValidTimezone(trimmed)) return trimmed;
  }
  return "America/Los_Angeles";
}
function period() {
  const configured = process.env.SUBSIDYBAR_PERIOD || loadConfig().period || "quota";
  if (configured === "week" || configured === "month" || configured === "quota") {
    return configured;
  }
  return "quota";
}
function usage() {
  console.error(cliUsage);
  process.exit(2);
}
function modeFromArg(arg) {
  if (!arg || arg === "status") return "status";
  if (arg === "-h" || arg === "--help" || arg === "help") {
    console.log(cliUsage);
    process.exit(0);
  }
  if (arg === "details") return "details";
  if (arg === "swiftbar") return "swiftbar";
  if (arg === "config") return "config";
  if (arg === "setup") return "setup";
  usage();
}
function configBaseDir() {
  return process.env.XDG_CONFIG_HOME || join2(homedir2(), ".config");
}
function configPath() {
  const configured = process.env.SUBSIDYBAR_CONFIG;
  if (configured) return configured;
  return join2(configBaseDir(), "subsidybar", "config.json");
}
function loadConfig() {
  if (configCache !== void 0) return configCache;
  const path = configPath();
  if (!existsSync2(path)) {
    configCache = {};
    return configCache;
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    configCache = sanitizeConfig(raw);
  } catch {
    configCache = {};
  }
  return configCache;
}
function sanitizeConfig(raw) {
  const config = {};
  if (raw?.period === "quota" || raw?.period === "week" || raw?.period === "month") config.period = raw.period;
  const subscription = parseSubscriptionUsd(raw?.subscriptionUsd);
  if (subscription !== null) config.subscriptionUsd = subscription;
  if (isWeekday(raw?.quotaResetWeekday)) config.quotaResetWeekday = raw.quotaResetWeekday;
  if (typeof raw?.quotaResetTime === "string" && parseTime(raw.quotaResetTime)) config.quotaResetTime = normalizeTime(raw.quotaResetTime);
  if (typeof raw?.timezone === "string" && isValidTimezone(raw.timezone.trim())) config.timezone = raw.timezone.trim();
  return config;
}
function parseSubscriptionUsd(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function isValidTimezone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(/* @__PURE__ */ new Date());
    return true;
  } catch {
    return false;
  }
}
function isWeekday(value) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6;
}
function saveConfig(config) {
  const path = configPath();
  mkdirSync2(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}
`, "utf8");
  configCache = config;
}
function todayInTimezone() {
  return dateOnlyFromDate(/* @__PURE__ */ new Date(), timezone());
}
function dateOnlyFromDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day") };
}
function dateKey(date) {
  return date.year * 1e4 + date.month * 100 + date.day;
}
function addDays(date, days) {
  const utc = Date.UTC(date.year, date.month - 1, date.day + days);
  const shifted = new Date(utc);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}
function weekdayMondayZero(date) {
  const day = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return (day + 6) % 7;
}
function weekdaySundayZero(date) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}
function isoDate(date) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}
function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}
function compactDate(date) {
  return `${monthNames[date.month - 1]} ${date.day}`;
}
function compactRange(value) {
  if (!value) return void 0;
  const [startText, endText] = value.split("..", 2);
  const start = parseIsoDate(startText || "");
  const end = parseIsoDate(endText || "");
  if (!start || !end) return value;
  return `${compactDate(start)} - ${compactDate(end)}`;
}
function parseCcusageDate(value) {
  const match = /^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = monthNames.indexOf(match[1]) + 1;
  if (month < 1) return null;
  return { year: Number(match[3]), month, day: Number(match[2]) };
}
function codexHome2() {
  const configured = process.env.CODEX_HOME?.trim();
  return configured ? configured : join2(homedir2(), ".codex");
}
function codexLogRoots() {
  const home = codexHome2();
  return [join2(home, "sessions"), join2(home, "archived_sessions")];
}
function findJsonlFiles2(root) {
  if (!existsSync2(root)) return [];
  const found = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync2(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join2(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        found.push(path);
      }
    }
  }
  return found;
}
function latestCodexWeeklyReset() {
  if (weeklyResetCache !== void 0) return weeklyResetCache;
  weeklyResetCache = scanLatestCodexWeeklyReset();
  return weeklyResetCache;
}
function latestFutureCodexWeeklyReset() {
  const reset = latestCodexWeeklyReset();
  return reset ? nextFutureWeeklyReset(reset) : null;
}
function nextFutureWeeklyReset(reset, now = /* @__PURE__ */ new Date()) {
  let time = reset.getTime();
  const nowTime = now.getTime();
  if (time <= nowTime) {
    time += (Math.floor((nowTime - time) / weekMs) + 1) * weekMs;
  }
  return new Date(time);
}
function scanLatestCodexWeeklyReset() {
  let latestTimestamp = "";
  let latestResetSeconds = null;
  for (const root of codexLogRoots()) {
    for (const file of findJsonlFiles2(root)) {
      forEachJsonlLine(file, (line) => {
        let record;
        try {
          record = JSON.parse(line);
        } catch {
          return;
        }
        if (record?.type !== "event_msg") return;
        const payload = record.payload || {};
        if (payload.type !== "token_count") return;
        const secondary = payload.rate_limits?.secondary || {};
        if (Number(secondary.window_minutes || 0) !== 10080) return;
        const resetSeconds = Number(secondary.resets_at);
        if (!Number.isFinite(resetSeconds)) return;
        const timestamp = String(record.timestamp || "");
        if (latestResetSeconds === null || timestamp > latestTimestamp) {
          latestTimestamp = timestamp;
          latestResetSeconds = resetSeconds;
        }
      });
    }
  }
  return latestResetSeconds === null ? null : new Date(latestResetSeconds * 1e3);
}
function forEachJsonlLine(path, visit) {
  let fd;
  try {
    fd = openSync(path, "r");
    const decoder = new StringDecoder("utf8");
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let pending = "";
    while (true) {
      const bytesRead = readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      pending += decoder.write(buffer.subarray(0, bytesRead));
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() || "";
      for (const line of lines) {
        if (line) visit(line);
      }
    }
    pending += decoder.end();
    if (pending) visit(pending);
  } catch {
    return;
  } finally {
    if (fd !== void 0) {
      try {
        closeSync(fd);
      } catch {
      }
    }
  }
}
function parseTime(value) {
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
function normalizeTime(value) {
  const parsed = parseTime(value);
  if (!parsed) return value.trim();
  return `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
}
function localTimeInTimezone() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone(),
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(/* @__PURE__ */ new Date());
  const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { hour: value("hour"), minute: value("minute") };
}
function configuredWeeklyReset() {
  const config = loadConfig();
  if (config.quotaResetWeekday === void 0 || !config.quotaResetTime) return null;
  return { weekday: config.quotaResetWeekday, time: config.quotaResetTime };
}
function nextConfiguredWeeklyReset() {
  const reset = configuredWeeklyReset();
  if (!reset) return null;
  const today = todayInTimezone();
  const now = localTimeInTimezone();
  const resetTime = parseTime(reset.time);
  if (!resetTime) return null;
  let daysUntil = (reset.weekday - weekdaySundayZero(today) + 7) % 7;
  const resetMinutes = resetTime.hour * 60 + resetTime.minute;
  const nowMinutes = now.hour * 60 + now.minute;
  if (daysUntil === 0 && nowMinutes >= resetMinutes) daysUntil = 7;
  return { date: addDays(today, daysUntil), time: reset.time };
}
function detectedWeeklyResetLabel() {
  const reset = latestFutureCodexWeeklyReset();
  if (!reset) return null;
  const local = dateOnlyFromDate(reset, timezone());
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone(),
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(reset);
  const value = (type) => timeParts.find((part) => part.type === type)?.value || "00";
  return `${weekdayNames[weekdaySundayZero(local)]} ${value("hour")}:${value("minute")}`;
}
function weekStart() {
  const today = todayInTimezone();
  return addDays(today, -weekdayMondayZero(today));
}
function quotaStartFromResetDate(resetDate, resetTime) {
  const parsed = parseTime(resetTime);
  if (parsed && parsed.hour === 0 && parsed.minute === 0) return resetDate;
  return addDays(resetDate, 1);
}
function quotaStart() {
  const configuredReset = nextConfiguredWeeklyReset();
  if (configuredReset) return quotaStartFromResetDate(addDays(configuredReset.date, -7), configuredReset.time);
  const reset = latestFutureCodexWeeklyReset();
  if (!reset) return weekStart();
  const previousResetLocalDate = dateOnlyFromDate(new Date(reset.getTime() - weekMs), timezone());
  return quotaStartFromResetDate(previousResetLocalDate, timeInTimezone(reset));
}
function nextQuotaResetText(compact) {
  const configuredReset = nextConfiguredWeeklyReset();
  if (configuredReset) {
    return compact ? `${compactDate(configuredReset.date)} ${configuredReset.time}` : `${isoDate(configuredReset.date)}T${configuredReset.time} ${timezone()}`;
  }
  const reset = latestFutureCodexWeeklyReset();
  if (!reset) return null;
  return compact ? formatCompactReset(reset) : formatReset(reset);
}
function targetMonthLabel() {
  const configured = process.env.SUBSIDYBAR_MONTH;
  if (configured) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(configured.trim());
    if (match) return `${monthNames[Number(match[2]) - 1]} ${Number(match[1])}`;
  }
  const today = todayInTimezone();
  return `${monthNames[today.month - 1]} ${today.year}`;
}
function fmtInt(value) {
  return Math.round(value || 0).toLocaleString("en-US");
}
function fmtShort(value) {
  const rounded = Math.round(value || 0);
  const absValue = Math.abs(rounded);
  if (absValue >= 1e9) return `${(rounded / 1e9).toFixed(2)}B`;
  if (absValue >= 1e6) return `${(rounded / 1e6).toFixed(2)}M`;
  if (absValue >= 1e3) return `${(rounded / 1e3).toFixed(1)}K`;
  return String(rounded);
}
function fmtMoney(value) {
  const numeric = value || 0;
  if (Math.abs(numeric) >= 100) return `$${numeric.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (Math.abs(numeric) >= 1) return `$${numeric.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
  return `$${numeric.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}
function fmtUsdSetting(value) {
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
}
function subscriptionMonthlyUsd() {
  const fallback = 0;
  return parseSubscriptionUsd(process.env.SUBSIDYBAR_SUBSCRIPTION_USD ?? loadConfig().subscriptionUsd) ?? fallback;
}
function subscriptionAppliedUsd(currentPeriod) {
  const monthly = subscriptionMonthlyUsd();
  return currentPeriod === "month" ? monthly : monthly / 4;
}
function zeroRow() {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
    costUSD: 0
  };
}
function addRow(target, row) {
  for (const key of usageKeys) {
    target[key] = Number(target[key] || 0) + Number(row[key] || 0);
  }
  target.costUSD = Number(target.costUSD || 0) + Number(row.costUSD || 0);
}
function dailyRowsForPeriod(data, currentPeriod) {
  const today = todayInTimezone();
  let start;
  if (currentPeriod === "quota") {
    start = quotaStart();
  } else if (currentPeriod === "week") {
    start = weekStart();
  } else {
    start = { ...today, day: 1 };
  }
  if (dateKey(start) > dateKey(today)) {
    start = today;
  }
  const startKey = dateKey(start);
  const todayKey = dateKey(today);
  const rows = (data.daily || []).filter((row) => {
    const rowDate = parseCcusageDate(String(row.date || ""));
    if (!rowDate) return false;
    const key = dateKey(rowDate);
    return startKey <= key && key <= todayKey;
  });
  return { rows, label: `${isoDate(start)}..${isoDate(today)}` };
}
function weeklyRow(data, currentPeriod) {
  const { rows, label } = dailyRowsForPeriod(data, currentPeriod);
  const row = zeroRow();
  row.range = label;
  for (const daily of rows) addRow(row, daily);
  return row;
}
function monthlyRow(data) {
  const label = targetMonthLabel();
  const found = (data.monthly || []).find((row) => row.month === label);
  if (found) return found;
  return { ...zeroRow(), month: label };
}
function currentRow(data, currentPeriod) {
  if (currentPeriod === "quota" || currentPeriod === "week") return weeklyRow(data, currentPeriod);
  return monthlyRow(data);
}
function netCost(row, currentPeriod) {
  return Math.round(Number(row.costUSD || 0) - subscriptionAppliedUsd(currentPeriod));
}
function netText(row, currentPeriod) {
  const net = netCost(row, currentPeriod);
  const sign = net > 0 ? "-" : "";
  return `${sign}$${fmtInt(Math.abs(net))}`;
}
function netLabel(row, currentPeriod) {
  return netCost(row, currentPeriod) > 0 ? "Vendor loss" : "Unused allocation";
}
function statusText(data, currentPeriod) {
  const row = currentRow(data, currentPeriod);
  return netText(row, currentPeriod);
}
function detailsLines(data, currentPeriod) {
  const row = currentRow(data, currentPeriod);
  let suffix;
  if (currentPeriod === "quota") {
    suffix = `quota cycle ${row.range}`;
    const resetText = nextQuotaResetText(false);
    if (resetText) suffix += `, next reset ${resetText}`;
  } else if (currentPeriod === "week") {
    suffix = `week ${row.range}, Mon start`;
  } else {
    suffix = String(row.month || targetMonthLabel());
  }
  const lines = [
    `${netLabel(row, currentPeriod)}: ${netText(row, currentPeriod)}`,
    `API-equivalent value: ${fmtMoney(row.costUSD)}`,
    `Your subscription: ${fmtUsdSetting(subscriptionAppliedUsd(currentPeriod))}`,
    `Tokens: ${fmtShort(row.totalTokens)} (${fmtInt(row.totalTokens)})`,
    `Period: ${suffix}`
  ];
  return lines;
}
function swiftbarSummaryLines(data, currentPeriod) {
  const row = currentRow(data, currentPeriod);
  const periodLabel = currentPeriod === "quota" ? "Quota" : currentPeriod === "week" ? "Week" : "Month";
  const periodValue = currentPeriod === "month" ? String(row.month || targetMonthLabel()) : compactRange(row.range) || String(row.range || "");
  const monthlySubscription = subscriptionMonthlyUsd();
  const appliedSubscription = subscriptionAppliedUsd(currentPeriod);
  const lines = [
    `${periodLabel}: ${periodValue}`,
    `${netLabel(row, currentPeriod)}: ${netText(row, currentPeriod)}`,
    `API value: ${fmtMoney(row.costUSD)}`,
    `Subscription: ${currentPeriod === "month" ? `${fmtUsdSetting(monthlySubscription)}/mo` : `${fmtUsdSetting(appliedSubscription)} (${fmtUsdSetting(monthlySubscription)}/mo)`}`,
    `Tokens: ${fmtShort(row.totalTokens)}`
  ];
  if (currentPeriod === "quota") {
    const resetText = nextQuotaResetText(true);
    if (resetText) lines.push(`Reset: ${resetText}`);
  }
  return lines;
}
function formatReset(date) {
  const local = dateOnlyFromDate(date, timezone());
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone(),
    hourCycle: "h23",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "longOffset"
  }).formatToParts(date);
  const value = (type) => timeParts.find((part) => part.type === type)?.value || "00";
  const rawOffset = value("timeZoneName");
  const offset = rawOffset === "GMT" ? "+00:00" : rawOffset.replace(/^GMT/, "");
  return `${isoDate(local)}T${value("hour")}:${value("minute")}:${value("second")}${offset}`;
}
function timeInTimezone(date) {
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone(),
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date);
  const value = (type) => timeParts.find((part) => part.type === type)?.value || "00";
  return `${value("hour")}:${value("minute")}`;
}
function formatCompactReset(date) {
  const local = dateOnlyFromDate(date, timezone());
  return `${compactDate(local)} ${timeInTimezone(date)}`;
}
function ccusageCommandForPeriod(currentPeriod) {
  return currentPeriod === "month" ? "monthly" : "daily";
}
function runCcusage(command) {
  const pkg = process.env.CCUSAGE_CODEX_PACKAGE ?? "@ccusage/codex@18.0.11";
  const codexHome3 = createCcusageCodexHome();
  const timeout = ccusageTimeoutMs();
  try {
    const result = spawnSync("npx", ["--yes", pkg, command, "--json"], {
      encoding: "utf8",
      env: codexHome3 ? { ...process.env, CODEX_HOME: codexHome3.path } : process.env,
      maxBuffer: 50 * 1024 * 1024,
      timeout
    });
    if (result.status !== 0 || result.error) {
      const code = result.error && "code" in result.error ? String(result.error.code) : "";
      if (code === "ETIMEDOUT") return { ok: false, error: `ccusage timed out after ${timeout}ms` };
      return { ok: false, error: result.error?.message || result.stderr || result.stdout || "ccusage failed" };
    }
    try {
      return { ok: true, data: JSON.parse(result.stdout) };
    } catch (error) {
      return { ok: false, error: `Invalid ccusage JSON: ${String(error)}
${result.stdout}` };
    }
  } finally {
    codexHome3?.cleanup();
  }
}
function ccusageTimeoutMs() {
  const parsed = Number(process.env.SUBSIDYBAR_CCUSAGE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3e4;
}
function printLines(lines) {
  for (const line of lines) console.log(line);
}
function printMode(selectedMode) {
  const currentPeriod = period();
  const result = runCcusage(ccusageCommandForPeriod(currentPeriod));
  if (!result.ok) {
    console.error(result.error);
    return 1;
  }
  if (selectedMode === "status") {
    console.log(statusText(result.data, currentPeriod));
  } else {
    printLines(detailsLines(result.data, currentPeriod));
  }
  return 0;
}
function withSwiftBarStyle(lines) {
  return lines.map((line) => `${line} | font=Menlo size=11`);
}
function swiftbarCommand(args) {
  const command = cliCommand(args);
  const [bash, ...params] = command;
  return `bash=${swiftbarValue(bash)} ${params.map((param, index) => `param${index + 1}=${swiftbarValue(param)}`).join(" ")} terminal=false refresh=true`;
}
function swiftbarValue(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function swiftbarSafeText(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 3).join(" / ").replace(/\|/g, "\xA6").slice(0, 500);
}
function printSwiftBarSettingsMenu(currentPeriod) {
  console.log("Period");
  for (const [value, label] of [["quota", "Quota cycle"], ["week", "Week"], ["month", "Month"]]) {
    const mark = value === currentPeriod ? "\u2713 " : "";
    console.log(`--${mark}${label} | ${swiftbarCommand(["config", "set", "period", value])}`);
  }
  console.log("Total subscription / month");
  const currentSubscription = subscriptionMonthlyUsd();
  const presets = [0, 20, 25, 100, 200];
  for (const amount of presets) {
    const mark = amount === currentSubscription ? "\u2713 " : "";
    console.log(`--${mark}${fmtUsdSetting(amount)} | ${swiftbarCommand(["config", "set", "subscription", String(amount)])}`);
  }
  const customMark = presets.includes(currentSubscription) ? "" : "\u2713 ";
  const customSuffix = presets.includes(currentSubscription) ? "" : ` (${fmtUsdSetting(currentSubscription)})`;
  console.log(`--${customMark}Custom...${customSuffix} | ${swiftbarCommand(["config", "prompt", "subscription"])}`);
  console.log("Setup");
  console.log(`--Open config | bash="/usr/bin/open" param1=${swiftbarValue(configPath())} terminal=false`);
}
function printSwiftBar() {
  const currentPeriod = period();
  const primary = runCcusage(ccusageCommandForPeriod(currentPeriod));
  if (!primary.ok) {
    console.log("Codex cost: error");
    console.log("---");
    console.log(`${swiftbarSafeText(primary.error)} | color=red`);
    return 0;
  }
  console.log(statusText(primary.data, currentPeriod));
  console.log("---");
  printLines(withSwiftBarStyle(swiftbarSummaryLines(primary.data, currentPeriod)));
  console.log("---");
  printSwiftBarSettingsMenu(currentPeriod);
  console.log("---");
  console.log("Refresh | refresh=true");
  return 0;
}
function defaultSwiftBarPluginDir() {
  return process.env.SUBSIDYBAR_SWIFTBAR_PLUGIN_DIR || process.env.SWIFTBAR_PLUGINS_PATH || process.env.SWIFTBAR_PLUGIN_DIR || join2(homedir2(), "SubsidyBar");
}
function swiftBarWrapperScript() {
  const command = swiftBarWrapperCommand().map(shellQuote).join(" ");
  const version = packageMetadata().version || "0.1.0";
  return [
    "#!/usr/bin/env bash",
    "# <xbar.title>SubsidyBar</xbar.title>",
    `# <xbar.version>v${version}</xbar.version>`,
    "# <xbar.author>Codex</xbar.author>",
    "# <xbar.desc>Shows how much API-equivalent value OpenAI subsidized for your local Codex usage.</xbar.desc>",
    "# <xbar.dependencies>node</xbar.dependencies>",
    "# subsidybar-managed",
    "set -euo pipefail",
    `exec ${command}`,
    ""
  ].join("\n");
}
function swiftBarWrapperCommand() {
  return cliCommand(["swiftbar"]);
}
function cliCommand(args) {
  if (runningFromSource()) return [join2(projectRoot(), "bin", "subsidybar"), ...args];
  const metadata = packageMetadata();
  if (metadata.name && metadata.version && !metadata.private) {
    return ["npx", "--yes", "-p", `${metadata.name}@${metadata.version}`, metadata.name, ...args];
  }
  return [join2(projectRoot(), "bin", "subsidybar"), ...args];
}
function runningFromSource() {
  return fileURLToPath(import.meta.url).endsWith(join2("src", "subsidybar.ts"));
}
function packageMetadata() {
  try {
    const raw = JSON.parse(readFileSync(join2(projectRoot(), "package.json"), "utf8"));
    return {
      name: typeof raw.name === "string" ? raw.name : void 0,
      version: typeof raw.version === "string" ? raw.version : void 0,
      private: Boolean(raw.private)
    };
  } catch {
    return {};
  }
}
function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
function swiftBarAppPath() {
  const result = spawnSync("mdfind", ["kMDItemCFBundleIdentifier == 'com.ameba.SwiftBar'"], { encoding: "utf8" });
  const found = result.stdout?.split(/\r?\n/).find((line) => line.trim().endsWith(".app"));
  if (found) return found.trim();
  const common = ["/Applications/SwiftBar.app", join2(homedir2(), "Applications", "SwiftBar.app")];
  return common.find((path) => existsSync2(path)) || null;
}
function isManagedSwiftBarPlugin(path) {
  if (!existsSync2(path)) return false;
  const stat = lstatSync(path);
  if (!stat.isFile()) return false;
  try {
    return readFileSync(path, "utf8").includes("# subsidybar-managed");
  } catch {
    return false;
  }
}
async function runTerminalSetup(defaultPluginDir) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log("Skipping interactive setup because stdin/stdout is not a TTY.");
    return defaultPluginDir;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("SubsidyBar setup");
    const pluginDir = (await askWithDefault(rl, "SwiftBar Plugin Folder", defaultPluginDir)).trim() || defaultPluginDir;
    const config = { ...loadConfig() };
    config.subscriptionUsd = await askMoney(rl, "Total monthly subscription USD", subscriptionMonthlyUsd());
    const reset = await askWeeklyReset(rl);
    if (reset === "auto") {
      delete config.quotaResetWeekday;
      delete config.quotaResetTime;
    } else if (reset) {
      config.quotaResetWeekday = reset.weekday;
      config.quotaResetTime = reset.time;
      config.period = "quota";
    }
    saveConfig(config);
    console.log(`Config saved: ${configPath()}`);
    return pluginDir;
  } finally {
    rl.close();
  }
}
async function askWithDefault(rl, label, defaultValue) {
  return rl.question(`${label} [${defaultValue}]: `);
}
async function askMoney(rl, label, defaultValue) {
  while (true) {
    const answer = (await askWithDefault(rl, label, String(defaultValue))).trim();
    const value = answer ? Number(answer) : defaultValue;
    if (Number.isFinite(value) && value >= 0) return value;
    console.log("Please enter a non-negative number.");
  }
}
async function askWeeklyReset(rl) {
  const configured = configuredWeeklyReset();
  const configuredLabel = configured ? `${weekdayNames[configured.weekday]} ${configured.time}` : null;
  const detected = detectedWeeklyResetLabel();
  const defaultValue = configuredLabel || "auto";
  const hint = detected ? `auto uses detected Codex reset ${detected}` : "auto uses Codex logs when available";
  while (true) {
    const answer = (await rl.question(`Weekly reset (${hint}; e.g. Mon 23:08) [${defaultValue}]: `)).trim();
    const value = answer || defaultValue;
    if (/^auto$/i.test(value)) return "auto";
    const parsed = parseWeeklyReset(value);
    if (parsed) return parsed;
    console.log('Please enter "auto" or a weekly reset like "Mon 23:08".');
  }
}
function parseWeeklyReset(value) {
  const match = /^([^\s]+)\s+(\d{1,2}(?::\d{2})?)$/.exec(value.trim());
  if (!match) return null;
  const weekday = parseWeekday(match[1]);
  const time = parseTime(match[2]);
  if (weekday === null || !time) return null;
  return { weekday, time: normalizeTime(match[2]) };
}
function parseWeekday(value) {
  const normalized = value.trim().toLowerCase();
  const weekdays = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6
  };
  if (weekdays[normalized] !== void 0) return weekdays[normalized];
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;
  return null;
}
function parseSetupArgs(args) {
  let pluginDir = defaultSwiftBarPluginDir();
  let force = false;
  let setup = true;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") {
      force = true;
    } else if (arg === "--no-setup") {
      setup = false;
    } else if (arg === "--dir") {
      const value = args[index + 1];
      if (!value) {
        console.error(setupUsage);
        process.exitCode = 2;
        return { pluginDir, force, setup };
      }
      pluginDir = value;
      index += 1;
    } else if (!arg.startsWith("-")) {
      pluginDir = arg;
    } else {
      console.error(setupUsage);
      process.exitCode = 2;
      return { pluginDir, force, setup };
    }
  }
  return { pluginDir, force, setup };
}
async function setupSwiftBar(args) {
  const parsed = parseSetupArgs(args);
  if (process.exitCode) return Number(process.exitCode);
  let pluginDir = parsed.pluginDir;
  if (parsed.setup) {
    pluginDir = await runTerminalSetup(pluginDir);
  }
  const target = join2(pluginDir, "subsidybar.5m.sh");
  const wrapper = swiftBarWrapperScript();
  mkdirSync2(pluginDir, { recursive: true });
  if (existsSync2(target)) {
    const stat = lstatSync(target);
    const alreadyInstalled = stat.isFile() && readFileSync(target, "utf8") === wrapper;
    if (!alreadyInstalled) {
      const replaceable = stat.isSymbolicLink() || isManagedSwiftBarPlugin(target) || parsed.force && stat.isFile();
      if (!replaceable) {
        console.error(`SwiftBar plugin already exists: ${target}`);
        console.error("Re-run with --force to replace an existing file.");
        return 1;
      }
      unlinkSync(target);
      writeFileSync(target, wrapper, "utf8");
      chmodSync(target, 493);
    }
  } else {
    writeFileSync(target, wrapper, "utf8");
    chmodSync(target, 493);
  }
  console.log(`SwiftBar plugin: ${target}`);
  console.log(`Plugin directory: ${pluginDir}`);
  const appPath = swiftBarAppPath();
  if (!appPath) {
    console.log("SwiftBar was not found.");
    console.log("Install SwiftBar, then choose this plugin directory:");
    console.log(pluginDir);
    console.log("Homebrew: brew install --cask swiftbar");
    return 0;
  }
  const openResult = spawnSync("open", [appPath], { encoding: "utf8" });
  if (openResult.status !== 0) {
    console.error("SwiftBar plugin installed, but SwiftBar could not be opened automatically.");
    console.error(`Open SwiftBar manually, then choose this plugin directory: ${pluginDir}`);
  }
  return 0;
}
function printConfig() {
  const currentPeriod = period();
  console.log(`Config path: ${configPath()}`);
  console.log(`period: ${currentPeriod}`);
  console.log(`subscriptionMonthlyUsd: ${subscriptionMonthlyUsd()}`);
  console.log(`subscriptionAppliedUsd: ${subscriptionAppliedUsd(currentPeriod)}`);
  const reset = configuredWeeklyReset();
  console.log(`weeklyReset: ${reset ? `${weekdayNames[reset.weekday]} ${reset.time}` : "auto"}`);
  console.log(`timezone: ${timezone()}`);
}
function setConfigValue(key, value) {
  if (!key || value === void 0) {
    console.error(configSetUsage);
    return 2;
  }
  const config = { ...loadConfig() };
  if (key === "period") {
    if (value !== "quota" && value !== "week" && value !== "month") {
      console.error("period must be one of: quota, week, month");
      return 2;
    }
    config.period = value;
  } else if (key === "subscription") {
    const parsed = parseSubscriptionUsd(value);
    if (parsed === null) {
      console.error("subscription must be a non-negative number");
      return 2;
    }
    config.subscriptionUsd = parsed;
  } else if (key === "reset") {
    if (/^auto$/i.test(value)) {
      delete config.quotaResetWeekday;
      delete config.quotaResetTime;
    } else {
      const parsed = parseWeeklyReset(value);
      if (!parsed) {
        console.error('reset must be "auto" or a weekly time like "Mon 23:08"');
        return 2;
      }
      config.quotaResetWeekday = parsed.weekday;
      config.quotaResetTime = parsed.time;
      config.period = "quota";
    }
  } else if (key === "timezone") {
    if (!isValidTimezone(value)) {
      console.error("timezone must be a valid IANA timezone, for example America/Los_Angeles");
      return 2;
    }
    config.timezone = value;
  } else {
    console.error("config key must be one of: period, subscription, reset, timezone");
    return 2;
  }
  saveConfig(config);
  printConfig();
  return 0;
}
function appleScriptString(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function promptSubscription() {
  const current = subscriptionMonthlyUsd();
  const result = spawnSync(
    "osascript",
    [
      "-e",
      `display dialog "Total monthly subscription USD" default answer ${appleScriptString(String(current))} buttons {"Cancel", "Save"} default button "Save"`,
      "-e",
      "text returned of result"
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) return 0;
  const parsed = Number(result.stdout.trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    spawnSync("osascript", ["-e", `display alert ${appleScriptString("Subscription must be a non-negative number.")}`]);
    return 2;
  }
  saveConfig({ ...loadConfig(), subscriptionUsd: parsed });
  return 0;
}
function printConfigMode(args) {
  if (args[0] === "prompt" && args[1] === "subscription") return promptSubscription();
  if (args[0] === "set") return setConfigValue(args[1], args[2]);
  if (args.length > 0) {
    console.error(configUsage);
    return 2;
  }
  printConfig();
  return 0;
}
async function main() {
  const selectedMode = modeFromArg(process.argv[2]);
  if (selectedMode === "swiftbar") return printSwiftBar();
  if (selectedMode === "config") return printConfigMode(process.argv.slice(3));
  if (selectedMode === "setup") return await setupSwiftBar(process.argv.slice(3));
  return printMode(selectedMode);
}
process.exitCode = await main();
