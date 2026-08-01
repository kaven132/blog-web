interface PostCardProps {
  title: string;
  slug: string;
  excerpt: string;
  tags: string;
  createdAt: string;
  coverImage?: string;
  index?: number;
}

import { getParentTag, getChildTags } from "../lib/tags";

export default function PostCard({ title, slug, excerpt, tags, createdAt, coverImage, index = 0 }: PostCardProps) {
  const tagList: string[] = (() => {
    try {
      return JSON.parse(tags);
    } catch {
      return [];
    }
  })();

  const parentTag = getParentTag(tagList);
  const childTags = getChildTags(tagList);

  return (
    <article
      className="group relative bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-border-hover)] hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] transition-all duration-400 ease-out"
      style={{ animation: `slide-up 0.4s ease-out ${index * 0.06}s both` }}
    >
      <a href={`/posts/${slug}`} className="block">
        {/* Cover */}
        {coverImage && (
          <img
            src={coverImage}
            alt={title}
            loading="lazy"
            className="w-full h-40 object-cover"
          />
        )}

        <div className="p-6 sm:p-7">
        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {parentTag && (
            <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md bg-[var(--color-accent)] text-white">
              {parentTag}
            </span>
          )}
          {childTags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h2 className="text-lg sm:text-xl font-semibold mb-2.5 text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors duration-300 leading-snug tracking-[-0.01em]">
          {title}
        </h2>

        {/* Excerpt — serif for editorial feel */}
        <p className="text-sm text-[var(--color-text-muted)] mb-5 leading-relaxed font-serif line-clamp-3">
          {excerpt}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <time className="text-xs text-[var(--color-text-subtle)] font-medium tracking-wide uppercase" dateTime={createdAt}>
            {new Date(createdAt).toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          <span className="text-xs text-[var(--color-accent)] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-x-0 group-hover:translate-x-1 transition-transform">
            阅读 →
          </span>
        </div>
        </div>
      </a>
    </article>
  );
}
