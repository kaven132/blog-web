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

export function getLayer2Options(tagLists: string[][], layer1: string): string[] {
  const set = new Set<string>();
  for (const list of tagLists) {
    if (list[0] === layer1 && list[1]) set.add(list[1]);
  }
  return [...set];
}

export function getLayer3Options(tagLists: string[][], layer1: string, layer2: string): string[] {
  const set = new Set<string>();
  for (const list of tagLists) {
    if (list[0] === layer1 && list[1] === layer2 && list[2]) set.add(list[2]);
  }
  return [...set];
}
