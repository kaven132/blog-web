/**
 * SQLite 的 CURRENT_TIMESTAMP / datetime('now') 存的是 UTC 的 "YYYY-MM-DD HH:MM:SS"。
 * JS 的 new Date() 对这种「空格分隔、无时区」的格式按本地时区解析，东八区下
 * 凌晨 0-8 点发布的内容日期会显示成前一天 —— 必须补上 Z 再解析。
 */
export function parseDbDate(s: string): Date {
  if (!s) return new Date(NaN);
  return new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
}

/** 给 <time datetime> 用的合法 ISO 字符串；解析失败返回空串 */
export function dbDateToISO(s: string): string {
  const d = parseDbDate(s);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

/** 日期中文展示，默认「2026年9月30日」；解析失败返回空串 */
export function formatDateCN(
  s: string,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }
): string {
  const d = parseDbDate(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", opts);
}
