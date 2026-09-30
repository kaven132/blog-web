/**
 * 修复自检（可用 tsx 随时重跑）：node_modules/.bin/tsx scripts/_fixes-selfcheck.ts
 * 覆盖纯函数层：slug 清洗、UTC 时间解析、markdown 链接安全、HMAC 登录 token。
 * 接口层的验证见 verify 步骤（起服务后 curl）。
 */

import { strict as assert } from "node:assert";
import { sanitizeSlug, slugify } from "../src/lib/slug";
import { parseDbDate, dbDateToISO, formatDateCN } from "../src/lib/datetime";
import { renderMarkdown, escapeHtml } from "../src/lib/markdown";
import { makeAuthToken, isAuthed } from "../src/lib/auth";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✅ ${name}`);
}

console.log("── slug ──");
check("手输 slug 剔除空格与特殊字符", () => {
  assert.equal(sanitizeSlug("我的 文章!!!"), "我的-文章");
  assert.equal(sanitizeSlug("hello world??"), "hello-world");
  assert.equal(sanitizeSlug("  --a--b--  "), "a-b");
  assert.equal(sanitizeSlug("!!!???"), "");
});
check("自动 slugify 行为不变（中文保留）", () => {
  assert.equal(slugify("洛阳一日游 2026"), "洛阳一日游-2026");
  assert.equal(slugify("English Title"), "english-title");
});

console.log("── 时区 ──");
check("UTC 时间串按 UTC 解析，不再当本地时间", () => {
  const d = parseDbDate("2026-09-30 01:00:00");
  assert.equal(d.toISOString(), "2026-09-30T01:00:00.000Z");
});
check("东八区下凌晨发布的文章显示当天", () => {
  // 2026-09-30 01:00 UTC+8 == 2026-09-29 17:00 UTC（旧实现会显示 9月29日）
  const d = parseDbDate("2026-09-29 17:00:00");
  assert.equal(d.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }), "2026/9/30");
});
check("ISO 转换与中文格式化", () => {
  assert.equal(dbDateToISO("2026-09-30 01:00:00"), "2026-09-30T01:00:00.000Z");
  assert.equal(dbDateToISO("garbage"), "");
  assert.match(formatDateCN("2026-09-30 01:00:00"), /2026/);
  assert.equal(formatDateCN(""), "");
});

console.log("── markdown ──");
check("https 链接正常渲染", () => {
  const html = renderMarkdown("[百度](https://baidu.com)");
  assert.ok(html.includes('<a href="https://baidu.com" target="_blank" rel="noopener">百度</a>'), html);
});
check("javascript: 伪协议被拒，保持原文不渲染成链接", () => {
  const html = renderMarkdown("[点我](javascript:alert(1))");
  assert.ok(!html.includes("<a "), html);
  assert.ok(html.includes("javascript"), html);
});
check("data: 协议链接同样被拒", () => {
  const html = renderMarkdown("[x](data:text/html;base64,PHNjcmlwdD4=)");
  assert.ok(!html.includes("<a "), html);
});
check("正文 HTML 注入仍被转义", () => {
  const html = renderMarkdown('<script>alert(1)</script>');
  assert.ok(!html.includes("<script>"), html);
  assert.ok(html.includes(escapeHtml("<script>")), html);
});

console.log("── 鉴权 token ──");
check("合法 token 通过、伪造值被拒", () => {
  const token = makeAuthToken();
  assert.equal(isAuthed(token), true);
  assert.equal(isAuthed("true"), false, "旧版明文 auth=true 必须失效");
  assert.equal(isAuthed(undefined), false);
  assert.equal(isAuthed(""), false);
  assert.equal(isAuthed(token.slice(0, 32)), false, "截断的 token 不能通过");
  assert.equal(isAuthed(token + "x"), false, "超长的 token 不能通过");
});

console.log(`\n✅ 全部通过：${passed} 组断言`);
