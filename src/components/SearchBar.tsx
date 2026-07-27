import { useState, useCallback } from "react";

interface SearchBarProps {
  placeholder?: string;
}

export default function SearchBar({ placeholder = "搜索文章..." }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        window.location.href = `/posts?search=${encodeURIComponent(query.trim())}`;
      }
    },
    [query]
  );

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-xl">
      {/* Search icon */}
      <svg
        className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-300 ${
          focused ? "text-[var(--color-accent)]" : "text-[var(--color-text-subtle)]"
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]/50 transition-all duration-300 ease-out"
        style={{
          borderColor: focused ? "var(--color-accent)" : "var(--color-border)",
          boxShadow: focused ? "0 0 0 3px var(--color-accent-muted)" : "none",
        }}
      />

      {/* Clear button */}
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </form>
  );
}