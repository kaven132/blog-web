/**
 * SidebarToggle.tsx — Mobile sidebar toggle (React Island)
 * client:idle — non-critical, loads when browser is idle
 */

import { useEffect } from "react";

export default function SidebarToggle() {
  useEffect(() => {
    const toggleBtn = document.getElementById("sidebar-toggle");
    const closeBtn = document.getElementById("sidebar-close");
    const overlay = document.getElementById("sidebar-overlay");
    const sidebar = document.querySelector(".sidebar") as HTMLElement | null;

    if (!toggleBtn || !sidebar) return;

    const open = () => {
      sidebar.classList.add("open");
      overlay?.classList.add("open");
      document.body.style.overflow = "hidden";
    };

    const close = () => {
      sidebar.classList.remove("open");
      overlay?.classList.remove("open");
      document.body.style.overflow = "";
    };

    toggleBtn.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    overlay?.addEventListener("click", close);

    // Close on Escape
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebar.classList.contains("open")) {
        close();
      }
    };
    document.addEventListener("keydown", handleEsc);

    return () => {
      toggleBtn.removeEventListener("click", open);
      closeBtn?.removeEventListener("click", close);
      overlay?.removeEventListener("click", close);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return null; // No UI — just behavior
}
