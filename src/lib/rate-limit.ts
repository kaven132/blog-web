/**
 * 进程内滑动窗口限流：按 key（如来源 IP）计数，窗口内超过 max 次返回超限。
 * 个人站量级无需 Redis——进程内 Map 足够，重启清零无妨。
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const rec = buckets.get(key);
  if (!rec || now >= rec.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  rec.count += 1;
  if (rec.count > max) {
    return { ok: false, retryAfterSec: Math.ceil((rec.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

// 周期清理过期桶，防 Map 无限增长（unref 不阻碍进程退出）
const cleaner = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now >= v.resetAt) buckets.delete(k);
  }
}, 10 * 60 * 1000);
cleaner.unref?.();
