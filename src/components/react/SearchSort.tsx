/**
 * SearchSort.tsx — Search box + sort dropdown with debounce (React Island)
 * client:load — needed for immediate interaction
 *
 * Props:
 * - initialSearch: string
 * - initialSort: string
 */

import { useState, useCallback, useEffect, useRef } from "react";

interface Props {
  initialSearch: string;
  initialSort: string;
}

export default function SearchSort({ initialSearch, initialSort }: Props) {
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState(initialSort);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback((newSearch: string, newSort: string) => {
    const url = new URL(window.location.href);
    if (newSearch.trim()) {
      url.searchParams.set("search", newSearch.trim());
    } else {
      url.searchParams.delete("search");
    }
    if (newSort && newSort !== "newest") {
      url.searchParams.set("sort", newSort);
    } else {
      url.searchParams.delete("sort");
    }
    window.location.href = url.toString();
  }, []);

  const handleSearchInput = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        navigate(value, sort);
      }, 400);
    },
    [sort, navigate],
  );

  const handleSortChange = useCallback(
    (newSort: string) => {
      setSort(newSort);
      navigate(search, newSort);
    },
    [search, navigate],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="toolbar">
      <div className="search-box">
        <i className="fa-solid fa-magnifying-glass"></i>
        <input
          type="text"
          placeholder="搜索文章标题或内容..."
          value={search}
          onChange={(e) => handleSearchInput(e.target.value)}
        />
      </div>
      <div className="toolbar-actions">
        <select
          className="select-sm"
          value={sort}
          onChange={(e) => handleSortChange(e.target.value)}
        >
          <option value="newest">最新优先</option>
          <option value="oldest">最早优先</option>
          <option value="title">按标题</option>
        </select>
      </div>
    </div>
  );
}
