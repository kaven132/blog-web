/**
 * 相册分类：两级自由分类（一级必填、二级可选），对齐文章标签的用法 ——
 * 分类在编辑相册时自由输入即可生效（新名字自动出现在列表页标签里），无需预先创建。
 * 存储格式：galleries.category = JSON 数组字符串（如 '["旅行"]' 或 '["旅行","川西"]'）。
 */

/** 编辑页分类输入的联想建议项（与既有数据合并去重后展示） */
export const GALLERY_CATEGORY_SUGGESTIONS = ["旅行", "日常", "其他"];

/** 解析 category 字段为分类路径数组（最多两级，容错脏数据） */
export function parseCategoryPath(raw) {
  try {
    const v = JSON.parse(raw ?? "[]");
    if (Array.isArray(v)) {
      return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 2);
    }
  } catch {
    /* 脏数据回落空路径 */
  }
  return [];
}

/** 分类显示名：两级显示为「一级 / 二级」 */
export function categoryLabel(path) {
  if (!path || path.length === 0) return "其他";
  return path.length === 2 ? `${path[0]} / ${path[1]}` : path[0];
}
