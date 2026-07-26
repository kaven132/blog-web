interface HeaderProps {
  onToggle: () => void;
}

export default function Header({ onToggle }: HeaderProps) {
  return (
    <header className="lg:hidden sticky top-0 z-30 bg-[var(--color-surface)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between h-12 px-5">
        <a href="/" className="text-base font-bold tracking-tight text-[var(--color-text)]">
          <span className="text-[var(--color-accent)]">·</span>Blog3
        </a>
        <button
          onClick={onToggle}
          className="relative w-8 h-8 flex items-center justify-center"
          aria-label="切换菜单"
        >
          <span className="absolute w-4 h-px bg-current transition-all duration-300 -translate-y-1" />
          <span className="absolute w-4 h-px bg-current transition-all duration-300 translate-y-1" />
        </button>
      </div>
    </header>
  );
}
