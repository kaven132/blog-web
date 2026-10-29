import { sqlite } from "../db";

export type BrowseKind = "post" | "gallery" | "game";

/**
 * 浏览历史采集：仅登录用户记录（单管理员 user_id=1），详情页 SSR 渲染时调用。
 * (user_id, kind, ref_id) 唯一 —— 重复浏览 upsert 置顶并刷新标题；容量由表上的 AFTER INSERT 触发器封顶（最近 200 条）。
 */
export function trackBrowse(kind: BrowseKind, refId: string | number, title: string, url: string): void {
  try {
    sqlite.prepare(
      `INSERT INTO browse_history (user_id, kind, ref_id, title, url) VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(user_id, kind, ref_id) DO UPDATE SET viewed_at = CURRENT_TIMESTAMP, title = excluded.title, url = excluded.url`
    ).run(kind, String(refId), title, url);
  } catch (err) {
    // 历史记录失败不阻塞正文渲染
    console.error("[history] trackBrowse failed:", err instanceof Error ? err.message : err);
  }
}

/** 相对时间展示：「3 小时前」/「2 天前」；超 30 天回落日期 */
export function timeAgo(viewedAt: string, now = new Date()): string {
  const [d, t] = viewedAt.split(" ");
  const date = new Date(`${d}T${(t ?? "00:00:00")}Z`);
  if (isNaN(date.getTime())) return viewedAt;
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 60) return "刚刚";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 30 * 86400) return `${Math.floor(diffSec / 86400)} 天前`;
  return viewedAt.slice(0, 10);
}
