import { sqliteTable, text, integer, unique, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Kaven's Blog — Drizzle ORM Schema
 *
 * 6 tables: profile, articles, comments, likes, category_tree, game_news
 * camelCase property names → snake_case database columns (auto-mapped)
 * Designed to work with the existing data.db (zero migration needed)
 */

// ── Profile (single-row, id=1) ──────────────────

export const profile = sqliteTable(
  "profile",
  {
    id: integer("id").primaryKey().default(1),
    name: text("name").default(""),
    bio: text("bio").default(""),
    email: text("email").default(""),
    location: text("location").default(""),
    avatar: text("avatar").default(""),
    socialGithub: text("social_github").default(""),
    socialTwitter: text("social_twitter").default(""),
    socialWebsite: text("social_website").default(""),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [check("profile_single_row", sql`${table.id} = 1`)],
);

// ── Articles ────────────────────────────────────

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  category: text("category").default(""),
  subcategory: text("subcategory").default(""),
  tags: text("tags").default("[]"), // JSON string array
  summary: text("summary").default(""),
  coverImage: text("cover_image").default(""),
  likesCount: integer("likes_count").default(0),
  isPinned: integer("is_pinned").default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Comments ────────────────────────────────────

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  articleId: text("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  author: text("author").default("匿名"),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Likes ───────────────────────────────────────

export const likes = sqliteTable(
  "likes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    userToken: text("user_token").notNull(),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [unique().on(table.articleId, table.userToken)],
);

// ── Category Tree ───────────────────────────────

export const categoryTree = sqliteTable(
  "category_tree",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    parent: text("parent").notNull(),
    child: text("child").notNull(),
  },
  (table) => [unique().on(table.parent, table.child)],
);

// ── Game News (NEW — data-driven, replaces hardcoded HTML) ──

export const gameNews = sqliteTable("game_news", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  game: text("game").notNull(), // 'genshin' | 'starrail' | 'endfield' | 'nte'
  tag: text("tag").notNull(), // e.g. '更新' | '活动' | '联动' | '角色'
  title: text("title").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
