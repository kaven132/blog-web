import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";
import { db } from "../db";
import { credentials } from "../db/schema";
import { eq } from "drizzle-orm";

export const AUTH_COOKIE = "auth";

/**
 * 账号密码：优先环境变量（ADMIN_ACCOUNT / ADMIN_PASSWORD），未配置时退回本地默认值。
 * 旧实现把明文密码写死且 Cookie 值就是 "true"，任何人 curl 带上 auth=true 即可绕过登录。
 */
export const ADMIN_ACCOUNT = process.env.ADMIN_ACCOUNT || "kavenyyds";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "4399123456";

/** 签名密钥：默认从密码派生，可用 AUTH_SECRET 独立配置（改密码不再顺带踢掉所有会话） */
const SECRET = process.env.AUTH_SECRET || `kaven-blog::v1::${ADMIN_PASSWORD}`;

function authToken(): string {
  return createHmac("sha256", SECRET).update(`auth-v1:${ADMIN_ACCOUNT}`).digest("hex");
}

/** 登录成功后要种下的 Cookie 值（不可伪造的 HMAC token） */
export function makeAuthToken(): string {
  return authToken();
}

/** 恒定时间比较，长度不一致直接 false（timingSafeEqual 遇到不等长会抛异常） */
export function isAuthed(value: string | undefined): boolean {
  if (!value) return false;
  const expected = Buffer.from(authToken());
  const got = Buffer.from(value);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// ── 密码（「账户设置」页可改，改过落库；未改过回退 env / 默认值） ──

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyHash(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const orig = Buffer.from(hash, "hex");
  return orig.length === test.length && timingSafeEqual(orig, test);
}

/** 当前生效密码校验：优先读库内凭证，表缺失/未设置时回退 env / 默认密码 */
export function verifyPassword(password: string): boolean {
  try {
    const row = db.select().from(credentials).where(eq(credentials.id, 1)).get();
    if (row?.passwordHash) return verifyHash(password, row.passwordHash);
  } catch {
    // 表暂时不可用等异常 → 回退环境变量比对
  }
  return password === ADMIN_PASSWORD;
}

/** 落库新密码（覆盖单行凭证） */
export function savePassword(password: string): void {
  const hash = hashPassword(password);
  const existing = db.select().from(credentials).where(eq(credentials.id, 1)).get();
  if (existing) {
    db.update(credentials).set({ passwordHash: hash, updatedAt: new Date().toISOString() }).where(eq(credentials.id, 1)).run();
  } else {
    db.insert(credentials).values({ id: 1, passwordHash: hash }).run();
  }
}
