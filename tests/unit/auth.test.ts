/**
 * Unit tests for src/lib/auth.ts
 *
 * Note: Auth module reads env vars at import time.
 * We set them before importing.
 */

import { describe, it, expect, beforeAll } from "vitest";

// Set env vars before importing the auth module
beforeAll(() => {
  process.env.ADMIN_USERNAME = "testadmin";
  process.env.ADMIN_PASSWORD = "testpass123";
  process.env.AUTH_SECRET = "test-secret-key-for-unit-tests-32bytes!";
});

// Dynamic import to ensure env vars are set before module loads
async function getAuth() {
  // Use dynamic import with cache busting
  return await import("../../src/lib/auth");
}

describe("auth — verifyCredentials", () => {
  it("should accept correct credentials", async () => {
    const { verifyCredentials } = await getAuth();
    expect(verifyCredentials("testadmin", "testpass123")).toBe(true);
  });

  it("should reject wrong password", async () => {
    const { verifyCredentials } = await getAuth();
    expect(verifyCredentials("testadmin", "wrongpassword")).toBe(false);
  });

  it("should reject wrong username", async () => {
    const { verifyCredentials } = await getAuth();
    expect(verifyCredentials("wronguser", "testpass123")).toBe(false);
  });
});

describe("auth — JWT", () => {
  it("should create and verify a valid JWT", async () => {
    const { createJWT, verifyJWT } = await getAuth();
    const token = await createJWT("testadmin");
    expect(token).toBeTruthy();

    const payload = await verifyJWT(token);
    expect(payload).not.toBeNull();
    expect(payload!.username).toBe("testadmin");
  });

  it("should return null for invalid JWT", async () => {
    const { verifyJWT } = await getAuth();
    const result = await verifyJWT("not.a.valid.jwt");
    expect(result).toBeNull();
  });

  it("should return null for tampered JWT", async () => {
    const { createJWT, verifyJWT } = await getAuth();
    const token = await createJWT("testadmin");
    // Tamper with the token
    const tampered = token.slice(0, -5) + "xxxxx";
    const result = await verifyJWT(tampered);
    expect(result).toBeNull();
  });
});

describe("auth — login/logout", () => {
  it("should login with correct credentials and return token + cookie", async () => {
    const { login } = await getAuth();
    const result = await login("testadmin", "testpass123");
    expect(result).not.toBeNull();
    expect(result!.username).toBe("testadmin");
    expect(result!.token).toBeTruthy();
    expect(result!.cookieHeader).toContain("blog_session=");
    expect(result!.cookieHeader).toContain("HttpOnly");
    expect(result!.cookieHeader).toContain("SameSite=Strict");
  });

  it("should return null for wrong password", async () => {
    const { login } = await getAuth();
    const result = await login("testadmin", "wrongpass");
    expect(result).toBeNull();
  });

  it("should return a clear-cookie header on logout", async () => {
    const { logoutCookie } = await getAuth();
    const header = logoutCookie();
    expect(header).toContain("blog_session=");
    expect(header).toContain("Max-Age=0");
  });
});

describe("auth — requireAuth", () => {
  it("should reject request without cookie", async () => {
    const { requireAuth } = await getAuth();
    const request = new Request("http://localhost/api/profile", {
      headers: {},
    });
    const result = await requireAuth(request);
    expect(result instanceof Response).toBe(true);
    expect((result as Response).status).toBe(401);
  });

  it("should accept request with valid JWT cookie", async () => {
    const { requireAuth, createJWT } = await getAuth();
    const jwt = await createJWT("testadmin");

    const request = new Request("http://localhost/api/profile", {
      headers: {
        cookie: `blog_session=${jwt}`,
      },
    });
    const result = await requireAuth(request);
    expect(result instanceof Response).toBe(false);
    if (!(result instanceof Response)) {
      expect(result.username).toBe("testadmin");
    }
  });

  it("should reject request with invalid JWT cookie", async () => {
    const { requireAuth } = await getAuth();
    const request = new Request("http://localhost/api/profile", {
      headers: {
        cookie: "blog_session=invalid-token-here",
      },
    });
    const result = await requireAuth(request);
    expect(result instanceof Response).toBe(true);
    expect((result as Response).status).toBe(401);
  });
});
