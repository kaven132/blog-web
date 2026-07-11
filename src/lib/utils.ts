/**
 * Kaven's Blog — Utility Functions
 * Migrated from server.js (generateId, parseTags, articleToJSON, profileToJSON)
 */

// ── Types ────────────────────────────────────────

export interface ArticleRow {
  id: string;
  title: string;
  content: string;
  category: string | null;
  subcategory: string | null;
  tags: string | null; // JSON string in DB
  summary: string | null;
  coverImage: string | null;
  likesCount: number | null;
  isPinned: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleJSON {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory: string;
  tags: string[];
  summary: string;
  coverImage: string;
  likesCount: number;
  isPinned: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileRow {
  name: string | null;
  bio: string | null;
  email: string | null;
  location: string | null;
  avatar: string | null;
  socialGithub: string | null;
  socialTwitter: string | null;
  socialWebsite: string | null;
}

export interface ProfileJSON {
  name: string;
  bio: string;
  email: string;
  location: string;
  avatar: string;
  social: {
    github: string;
    twitter: string;
    website: string;
  };
}

// ── Functions ────────────────────────────────────

/** Generate a unique ID: {prefix}_{timestamp36}_{random6} */
export function generateId(prefix = "art"): string {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

/** Safely parse a JSON string array into a real array */
export function parseTags(tagsStr: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(tagsStr || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Serialize a raw DB article row → API JSON (parses tags) */
export function articleToJSON(row: ArticleRow): ArticleJSON {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category ?? "",
    subcategory: row.subcategory ?? "",
    tags: parseTags(row.tags),
    summary: row.summary ?? "",
    coverImage: row.coverImage ?? "",
    likesCount: row.likesCount ?? 0,
    isPinned: row.isPinned ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Serialize a raw DB profile row → API JSON (nests social fields) */
export function profileToJSON(row: ProfileRow): ProfileJSON {
  return {
    name: row.name ?? "",
    bio: row.bio ?? "",
    email: row.email ?? "",
    location: row.location ?? "",
    avatar: row.avatar ?? "",
    social: {
      github: row.socialGithub ?? "",
      twitter: row.socialTwitter ?? "",
      website: row.socialWebsite ?? "",
    },
  };
}
