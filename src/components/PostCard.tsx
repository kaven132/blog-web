interface PostCardProps {
  title: string;
  slug: string;
  excerpt: string;
  tags: string;
  createdAt: string;
  coverImage?: string;
  index?: number;
  likeCount?: number;
  views?: number;
  contentLen?: number;
  /** 全文搜索命中片段（含 <mark> 高亮，已在服务端转义）；有值时替代摘要展示 */
  searchSnippet?: string;
}

import { getParentTag, getChildTags } from "../lib/tags";
import { formatDateCN, dbDateToISO } from "../lib/datetime";

export default function PostCard({ title, slug, excerpt, tags, createdAt, coverImage, index = 0, likeCount = 0, views = 0, contentLen = 0, searchSnippet }: PostCardProps) {
  const readMinutes = contentLen ? Math.max(1, Math.ceil(contentLen / 400)) : null;
  const viewsDisplay = views > 9999 ? `${(views / 10000).toFixed(1)} 万` : String(views);
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

        {/* Excerpt / 搜索命中片段（含高亮标记） */}
        {searchSnippet ? (
          <p
            className="text-sm text-[var(--color-text-muted)] mb-5 leading-relaxed font-serif line-clamp-3 [&_mark]:bg-transparent [&_mark]:text-[var(--color-accent)] [&_mark]:font-semibold"
            dangerouslySetInnerHTML={{ __html: searchSnippet }}
          />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] mb-5 leading-relaxed font-serif line-clamp-3">{excerpt}</p>
        )}

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
            <span className="inline-flex items-center gap-1" title="浏览量">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <span className="tabular-nums">{viewsDisplay}</span>
            </span>
          </div>
          {readMinutes && (
            <span className="text-xs text-[var(--color-text-subtle)] tabular-nums">约 {readMinutes} 分钟</span>
          )}
        </div>
        </div>
      </a>
    </article>
  );
}
