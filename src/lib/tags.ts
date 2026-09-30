export const PARENT_TAGS = ["技术", "游戏", "生活"] as const;

export type ParentTag = (typeof PARENT_TAGS)[number];

export function isParentTag(tag: string): tag is ParentTag {
  return (PARENT_TAGS as readonly string[]).includes(tag);
}

export function parseTags(tags: string): string[] {
  try {
    return JSON.parse(tags);
  } catch {
    return [];
  }
}

export function getParentTag(tagList: string[]): string {
  return isParentTag(tagList[0]) ? tagList[0] : "";
}

export function getChildTags(tagList: string[]): string[] {
  const parent = getParentTag(tagList);
  return parent ? tagList.filter((tag) => tag !== parent) : tagList;
}

export interface TagFacets {
  l1Counts: Record<string, number>;
  l2Options: string[];
  l2Counts: Record<string, number>;
  l3Options: string[];
  l3Counts: Record<string, number>;
}

/**
 * 三层分类的计数与候选集，一次遍历算完。
 * posts 列表页与 admin 管理页共用（原先两页各抄一份循环）。
 */
export function buildTagFacets(tagLists: string[][], l1: string, l2: string): TagFacets {
  const l1Counts: Record<string, number> = {};
  const l2Counts: Record<string, number> = {};
  const l3Counts: Record<string, number> = {};
  const l2Set = new Set<string>();
  const l3Set = new Set<string>();
  for (const t of tagLists) {
    if (t[0]) l1Counts[t[0]] = (l1Counts[t[0]] || 0) + 1;
    if (t[0] === l1 && t[1]) {
      l2Counts[t[1]] = (l2Counts[t[1]] || 0) + 1;
      l2Set.add(t[1]);
      if (t[1] === l2 && t[2]) {
        l3Counts[t[2]] = (l3Counts[t[2]] || 0) + 1;
        l3Set.add(t[2]);
      }
    }
  }
  return {
    l1Counts,
    l2Options: [...l2Set],
    l2Counts,
    l3Options: [...l3Set],
    l3Counts,
  };
}
