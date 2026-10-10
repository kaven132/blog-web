interface PostCardProps {
  title: string;
  slug: string;
  excerpt: string;
  tags: string;
  createdAt: string;
  coverImage?: string;
  index?: number;
  likeCount?: number;
}

import { getParentTag, getChildTags } from "../lib/tags";
import { formatDateCN, dbDateToISO } from "../lib/datetime";

export default function PostCard({ title, slug, excerpt, tags, createdAt, coverImage, index = 0, likeCount = 0 }: PostCardProps) {
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

        {/* Title — 固定两行：超长截断省略，短标题也占满两行高度，保证卡片高度统一 */}
        <h2 className="text-lg sm:text-xl font-semibold mb-2.5 text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors duration-300 leading-snug tracking-[-0.01em] line-clamp-2 min-h-[2.75em]">
          {title}
        </h2>

        {/* Excerpt — serif for editorial feel */}
        <p className="text-sm text-[var(--color-text-muted)] mb-5 leading-relaxed font-serif line-clamp-3">
          {excerpt}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs text-[var(--color-text-subtle)]">
            <time className="font-medium tracking-wide uppercase" dateTime={dbDateToISO(createdAt)}>
              {formatDateCN(createdAt)}
            </time>
            <span className="inline-flex items-center gap-1" title="点赞数">
              <svg className="w-3.5 h-3.5 text-[var(--color-accent)]/60" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
              <span className="tabular-nums">{likeCount}</span>
            </span>
          </div>
          <span className="text-xs text-[var(--color-accent)] font-medium opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition duration-300">
            阅读 →
          </span>
        </div>
        </div>
      </a>
    </article>
  );
}
