import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull().default(""),
  content: text("content").notNull(),
  coverImage: text("cover_image"),
  tags: text("tags").notNull().default("[]"), // JSON array stored as text
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  views: integer("views").notNull().default(0), // 浏览量：详情页每次渲染 +1
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"), // 回复目标（仅一层：必须是顶层评论）
  author: text("author").notNull().default("匿名"),
  content: text("content").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const likes = sqliteTable("likes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .unique()
    .references(() => posts.id, { onDelete: "cascade" }),
  count: integer("count").notNull().default(0),
});

export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull().default("kaven"),
  bio: text("bio").notNull().default("前端开发者，热爱 Web 技术与开源。"),
  city: text("city").default(""),
  gender: text("gender").default(""),
  avatar: text("avatar").default(""), // base64 data URL
  github: text("github").default(""),
  website: text("website").default(""),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/** 登录凭证（单行）：在「账户设置」页改过密码后落库，未设置时登录回退 env / 默认密码 */
export const credentials = sqliteTable("credentials", {
  id: integer("id").primaryKey().default(1),
  passwordHash: text("password_hash").notNull(), // scrypt: "<salt hex>:<hash hex>"
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/** 网页游戏云端存档：每用户每游戏一条，data 为 base64 的 .sol 文件字节（Flash SharedObject） */
export const gameSaves = sqliteTable("game_saves", {
  userId: integer("user_id").notNull(), // 单管理员体系恒为 credentials.id=1
  game: text("game").notNull(), // 游戏标识（如 kakutoumusume）
  data: text("data").notNull(), // base64(.sol)
  size: integer("size").notNull().default(0), // 解码后字节数，列表展示用
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/** 相册：分类型存放照片的相册，封面取 photos 中的第一张 */
export const galleries = sqliteTable("galleries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category").notNull().default("other"), // 分类标识，见 lib/gallery-categories
  description: text("description").notNull().default(""),
  views: integer("views").notNull().default(0), // 浏览量：浏览页每次渲染 +1
  isPrivate: integer("is_private").notNull().default(0), // 隐私相册：仅登录可见
  sort: integer("sort").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/** 相册点赞：每相册一行，原子累加（与文章 likes 同款并发方案） */
export const galleryLikes = sqliteTable("gallery_likes", {
  galleryId: integer("gallery_id")
    .primaryKey()
    .references(() => galleries.id, { onDelete: "cascade" }),
  count: integer("count").notNull().default(0),
});

/** 相册评论：盖楼回复（只做一层），随相册级联删除 */
export const galleryComments = sqliteTable("gallery_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  galleryId: integer("gallery_id")
    .notNull()
    .references(() => galleries.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"), // 回复目标（仅一层：必须是顶层评论）
  author: text("author").notNull().default("匿名"),
  content: text("content").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/** 相册内的照片：路径指向 /uploads/ 下的图片，sort 顺序即浏览顺序 */
export const galleryPhotos = sqliteTable("gallery_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  galleryId: integer("gallery_id")
    .notNull()
    .references(() => galleries.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  sort: integer("sort").notNull().default(0),
});

/** 浏览历史（随账号走）：kind = post | gallery | game，ref_id 为 slug 或数字 id 字符串；(user_id,kind,ref_id) 唯一，重复浏览 upsert 置顶 */
export const browseHistory = sqliteTable("browse_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(), // 单管理员体系恒为 1
  kind: text("kind").notNull(),
  refId: text("ref_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  viewedAt: text("viewed_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

