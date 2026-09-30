/**
 * 登录请求共享实现。/login 页与顶栏 LoginModal 已统一走 LoginModal 组件，
 * 这里保留独立函数供未来调用方（如 CLI 工具、自动化脚本）复用。
 */
export async function loginRequest(
  account: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, error: data.error || "账号或密码错误" };
  } catch {
    return { ok: false, error: "网络错误，请重试" };
  }
}
