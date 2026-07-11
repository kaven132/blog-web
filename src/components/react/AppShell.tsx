/**
 * AppShell.tsx — Single React root wrapping all providers and modals.
 *
 * WHY: Astro's client:* creates isolated React roots.
 *   Multiple client:* = multiple roots = context doesn't cross.
 *   No client:* = static HTML = never hydrates = useEffect never runs.
 *
 * SOLUTION: One client:load on AppShell. Everything else lives inside React.
 */
import type { ReactNode } from "react";
import { ToastProvider } from "./Toast";
import { AuthProvider } from "./AuthProvider";
import LoginModal from "./LoginModal";
import ArticleEditor from "./ArticleEditor";
import ProfileEditor from "./ProfileEditor";
import GameNewsEditor from "./GameNewsEditor";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        {children}
        <LoginModal />
        <ArticleEditor />
        <ProfileEditor />
        <GameNewsEditor />
      </AuthProvider>
    </ToastProvider>
  );
}
