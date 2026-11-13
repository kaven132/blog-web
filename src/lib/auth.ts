import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { db } from "../db";
import { credentials } from "../db/schema";
import { eq } from "drizzle-orm";

// astro preview 与生产 node 入口都不会把 .env 注入 process.env，这里显式加载一次
// （仅补齐 process.env 里缺失的键，外部注入的环境变量优先；.env 已被 .gitignore 排除）
try {
  for (const line of readFileSync(".env", "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* 无 .env 文件时使用外部注入的环境变量 */
}

export const AUTH_COOKIE = "auth";

/** NSFW 开关（TopNav 显示设置下拉切换）：cookie 存在且为 1 时登录用户可见隐私内容，缺省一律隐藏 */
export const NSFW_COOKIE = "nsfw";

/**
 * 隐私内容可见性（相册/视频的 isPrivate 项、Flash/RPG 游戏区）：
 * 登录 且 NSFW 开关打开 才可见 —— 开关只影响登录后的视角，匿名访客本来就不可见。
 */
export function nsfwOpen(cookies: { get(name: string): { value: string | undefined } | undefined }): boolean {
  return cookies.get(NSFW_COOKIE)?.value === "1";
}

/**
 * 账号密码与签名密钥：ADMIN_PASSWORD / AUTH_SECRET 必须由 .env 或部署环境变量提供，
 * ADMIN_ACCOUNT 缺省用 "kavenyyds"。旧版在源码里内置默认密码回退——仓库公开，
 * 等于把备用钥匙贴在大门上；现在缺配置直接拒绝启动（fail-fast）。
 */
export const ADMIN_ACCOUNT = process.env.ADMIN_ACCOUNT || "kavenyyds";
const ADMIN_PASSWORD_ENV = process.env.ADMIN_PASSWORD;
const AUTH_SECRET_ENV = process.env.AUTH_SECRET;
if (!ADMIN_PASSWORD_ENV || !AUTH_SECRET_ENV) {
  throw new Error(
    "[auth] 缺少 ADMIN_PASSWORD / AUTH_SECRET 配置：请在项目根 .env 或部署环境变量中提供后再启动。",
  );
}
export const ADMIN_PASSWORD = ADMIN_PASSWORD_ENV;

/** 签名密钥：AUTH_SECRET 必填（独立于密码，改密码不再顺带踢掉所有会话） */
const SECRET = AUTH_SECRET_ENV;

/**
 * 会话版本号：令牌 = HMAC(secret, "auth-v1:<版本>:<账号>")。
 * 令牌本身是确定性 HMAC、无过期时间——版本号是唯一的吊销手段：
 * 怀疑 cookie 泄漏或改密码后，把 .env 的 SESSION_VERSION +1 重启，即全体旧会话失效（要重新登录）。
 * 缺省 "1"，不配置也能正常工作。
 */
const SESSION_VERSION = process.env.SESSION_VERSION || "1";

function authToken(): string {
  return createHmac("sha256", SECRET).update(`auth-v1:${SESSION_VERSION}:${ADMIN_ACCOUNT}`).digest("hex");
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

// ── 密码（「账户设置」页可改，改过落库 scrypt 哈希） ──

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

/**
 * 当前生效密码校验：只认库内 scrypt 凭证。
 * 无凭证行 / 表不可用一律 fail-fast 拒绝——不再回退 .env 明文比较：
 * 那条老路一方面绕过恒定时间比较，另一方面 DB 恢复到空凭证时，
 * .env 里早已「死亡」的旧密码会静默复活成有效钥匙。
 */
export function verifyPassword(password: string): boolean {
  try {
    const row = db.select().from(credentials).where(eq(credentials.id, 1)).get();
    if (row?.passwordHash) return verifyHash(password, row.passwordHash);
  } catch {
    // 表暂时不可用（迁移中/库损坏）→ 拒绝登录，去修库而不是换一条更弱的验证路
  }
  return false;
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
