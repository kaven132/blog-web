/**
 * LogoutButton.tsx — Logout button (React Island)
 * client:load — needed globally in header
 */

import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";

export default function LogoutButton() {
  const { isLoggedIn, logout } = useAuth();
  const { showToast } = useToast();

  if (!isLoggedIn) return null;

  const handleLogout = async () => {
    await logout();
    showToast("已退出登录", "info");
    window.location.reload();
  };

  return (
    <>
      <span className="login-indicator" title="已登录">
        <i className="fa-solid fa-user-shield"></i> 已登录
      </span>
      <button
        className="btn btn-sm btn-logout"
        onClick={handleLogout}
        title="退出登录"
      >
        <i className="fa-solid fa-right-from-bracket"></i> 退出
      </button>
    </>
  );
}
