/**
 * 一次性导入：创建三个公共展示相册（自然风格 / 城市灯光 / 过年灯会）。
 * 照片文件已在 data/uploads/（gallery-<主题>-<n>.jpg），此处只写库。
 * 幂等：按标题查重，已存在的相册跳过（避免重复运行时插重）。
 *
 * 用法：node_modules/.bin/tsx scripts/_import-galleries.ts
 */
import { db } from "../src/db";
import { galleries, galleryPhotos } from "../src/db/schema";
import { eq } from "drizzle-orm";

const ALBUMS: { title: string; category: string; prefix: string }[] = [
  { title: "自然风格", category: "自然风格", prefix: "gallery-nature" },
  { title: "城市灯光", category: "城市灯光", prefix: "gallery-city" },
  { title: "过年灯会", category: "过年灯会", prefix: "gallery-lantern" },
];

for (const a of ALBUMS) {
  const exists = db.select({ id: galleries.id }).from(galleries).where(eq(galleries.title, a.title)).get();
  if (exists) {
    console.log(`⏭️  「${a.title}」已存在（id=${exists.id}），跳过`);
    continue;
  }
  const photos = [1, 2, 3, 4, 5, 6].map((n) => `/uploads/${a.prefix}-${n}.jpg`);
  const id = db.transaction((tx) => {
    const g = tx
      .insert(galleries)
      .values({ title: a.title, category: JSON.stringify([a.category]), description: "", isPrivate: 0 })
      .returning({ id: galleries.id })
      .get();
    tx.insert(galleryPhotos).values(photos.map((path, i) => ({ galleryId: g.id, path, sort: i }))).run();
    return g.id;
  });
  console.log(`✅ 「${a.title}」id=${id}，6 张照片`);
}
