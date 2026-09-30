import { createHmac, timingSafeEqual } from "node:crypto";

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
