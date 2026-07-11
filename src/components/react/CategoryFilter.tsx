/**
 * CategoryFilter.tsx — Category/subcategory filter navigation (React Island)
 * client:load — needed for sidebar category interaction
 *
 * Handles clicking categories in sidebar to navigate to filtered views.
 * The SSR version already renders the category links, this enhances with
 * subcategory dynamic loading and active state management.
 */

import { useEffect } from "react";

export default function CategoryFilter() {
  useEffect(() => {
    // This component enhances the SSR-rendered category list.
    // The SSR version already has functional <a> links for navigation.
    // This Island adds:
    // 1. Active state management without full page reload awareness
    // 2. Subcategory toggling animation
    // Most navigation is handled by plain <a> links (SSR-friendly).

    const categoryItems = document.querySelectorAll(".category-item a");
    const currentUrl = new URL(window.location.href);
    const activeCategory = currentUrl.searchParams.get("category") || "all";

    categoryItems.forEach((link) => {
      const el = link as HTMLAnchorElement;
      const cat = el.getAttribute("data-category");
      if (cat === activeCategory) {
        el.parentElement?.classList.add("active");
      }
    });
  }, []);

  return null; // No UI — behavior enhancement only
}
