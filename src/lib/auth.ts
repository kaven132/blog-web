/**
 * Kaven's Blog — Authentication Module
 *
 * JWT httpOnly cookie-based auth (blog_session).
 * Password hashing: scrypt.
 * JWT: jose library, HS256, 24h expiry.
 */

import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

// ── Config ───────────────────────────────────────

const ADMIN_USERNAME = import.meta.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || "admin";
const AUTH_SECRET = import.meta.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");

// JWT key (must be Uint8Array for jose)
const JWT_SECRET = new TextEncoder().encode(AUTH_SECRET);

// ── Password Hashing (scrypt) ────────────────────

function hashPassword(password: string): string {
  const salt = crypto
    .createHash("sha256")
    .update("blog_salt_" + AUTH_SECRET)
    .digest()
    .subarray(0, 16);
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

const PASSWORD_HASH = hashPassword(ADMIN_PASSWORD);

function verifyPassword(password: string): boolean {
  const hash = hashPassword(password);
  const bufA = Buffer.from(hash, "hex");
  const bufB = Buffer.from(PASSWORD_HASH, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ── JWT ──────────────────────────────────────────

export async function createJWT(username: string): Promise<string> {
  return await new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<{ username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { username: payload.username as string };
  } catch {
    return null;
  }
}

// ── Cookie helpers ────────────────────────────────

const COOKIE_NAME = "blog_session";

function setCookieHeader(token: string): string {
  const isProd = import.meta.env.PROD;
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Max-Age=${24 * 60 * 60}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`;
}

// ── Login / Logout ────────────────────────────────

export function verifyCredentials(
  username: string,
  password: string,
): boolean {
  // Timing-safe username comparison
  const inputUser = Buffer.from(username);
  const storedUser = Buffer.from(ADMIN_USERNAME);
  const maxLen = Math.max(inputUser.length, storedUser.length);
  const paddedInput = Buffer.alloc(maxLen, 0);
  const paddedStored = Buffer.alloc(maxLen, 0);
  inputUser.copy(paddedInput);
  storedUser.copy(paddedStored);

  return crypto.timingSafeEqual(paddedInput, paddedStored) && verifyPassword(password);
}

export interface LoginResult {
  token: string;
  username: string;
  cookieHeader: string;
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResult | null> {
  if (!verifyCredentials(username, password)) return null;

  const jwt = await createJWT(username);

  return {
    token: jwt,
    username,
    cookieHeader: setCookieHeader(jwt),
  };
}

export function logoutCookie(): string {
  return clearCookieHeader();
}

// ── requireAuth — JWT cookie middleware ───────────

/**
 * Authenticate a request via JWT httpOnly cookie.
 * Returns username on success, or a 401 Response on failure.
 */
export async function requireAuth(
  request: Request,
): Promise<{ username: string } | Response> {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`),
  );
  if (match) {
    const jwt = await verifyJWT(match[1]);
    if (jwt) return { username: jwt.username };
  }

  return new Response(JSON.stringify({ error: "请先登录", requireAuth: true }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
