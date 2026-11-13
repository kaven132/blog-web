// 一次性断言：会话版本化令牌 + verifyPassword fail-fast（不打印任何真实密钥/密码）
import { createHmac, scryptSync } from "node:crypto";
import { AUTH_COOKIE, makeAuthToken, isAuthed, verifyPassword, hashPassword, ADMIN_ACCOUNT } from "../src/lib/auth";

// 从 .env 读 secret 仅在进程内使用，绝不输出
const line = (await import("node:fs")).readFileSync(".env", "utf-8").split("\n").find((l) => l.startsWith("AUTH_SECRET="));
const SECRET = line!.slice("AUTH_SECRET=".length).trim().replace(/^["']|["']$/g, "");

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name); }
};

// 1. 新令牌被接受
const cur = makeAuthToken();
ok("当前 makeAuthToken() 通过 isAuthed", isAuthed(cur));

// 2. 旧公式令牌（无 SESSION_VERSION 段）被拒绝 —— 证明版本变更即全员下线
const legacy = createHmac("sha256", SECRET).update(`auth-v1:${ADMIN_ACCOUNT}`).digest("hex");
ok("旧公式令牌（无版本段）被拒绝", !isAuthed(legacy));

// 3. 版本号 +1 后的令牌被拒绝
const v2 = createHmac("sha256", SECRET).update(`auth-v1:2:${ADMIN_ACCOUNT}`).digest("hex");
ok("SESSION_VERSION=2 的令牌被当前实现拒绝", !isAuthed(v2));

// 4. 篡改/垃圾/空值拒绝
ok("篡改令牌被拒绝", !isAuthed(cur.slice(0, -2) + "zz"));
ok("垃圾输入被拒绝", !isAuthed("g" .repeat(64)));
ok("undefined 被拒绝", !isAuthed(undefined));

// 5. verifyPassword fail-fast：不知道真实密码，断言错误密码一律 false
ok("错误密码 → false", verifyPassword("definitely-wrong-123") === false);
ok("空密码 → false", verifyPassword("") === false);

// 6. hashPassword 格式与可验证性（算法往返）
const stored = hashPassword("roundtrip-test-pw");
const [salt, hash] = stored.split(":");
ok("哈希格式 salt:hash（32/128 hex）", salt.length === 32 && hash.length === 128);
const re = scryptSync("roundtrip-test-pw", salt, 64).toString("hex");
ok("同口令 scrypt 往返一致", re === hash);
const re2 = scryptSync("roundtrip-test-pw2", salt, 64).toString("hex");
ok("不同口令哈希不同", re2 !== hash);

// 7. cookie 名未变
ok("AUTH_COOKIE 仍为 'auth'", AUTH_COOKIE === "auth");

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
