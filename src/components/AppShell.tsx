import { type ReactNode } from "react";
import TopNav from "./TopNav";
import ProfileCard from "./ProfileCard";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      {/* Body: two-column layout */}
      <div className="flex-1 w-full max-w-[var(--spacing-container)] mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Left — personal profile card */}
          <aside className="lg:w-60 lg:flex-shrink-0 order-1 lg:order-1">
            <ProfileCard />
          </aside>

          {/* Right — main content */}
          <div className="flex-1 min-w-0 order-2">
            {children}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto mb-6">
        <div className="w-full max-w-[var(--spacing-container)] mx-auto px-4 sm:px-6">
          <div className="border-t border-[var(--color-border)] pt-5 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[11px] text-[var(--color-text-subtle)] tracking-wide uppercase font-medium">
              &copy; {new Date().getFullYear()} kaven的个人网页
            </p>
            <p className="text-[11px] text-[var(--color-text-subtle)]">
              Astro SSR · React Islands · Tailwind v4 · Drizzle ORM
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
