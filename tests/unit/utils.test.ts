/**
 * Unit tests for src/lib/utils.ts
 */
import { describe, it, expect } from "vitest";
import {
  generateId,
  parseTags,
  articleToJSON,
  profileToJSON,
  type ArticleRow,
  type ProfileRow,
} from "../../src/lib/utils";

describe("generateId", () => {
  it("should generate a string starting with the prefix", () => {
    const id = generateId("art");
    expect(id.startsWith("art_")).toBe(true);
  });

  it("should generate unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("test")));
    expect(ids.size).toBe(100);
  });

  it("should use default prefix 'art'", () => {
    const id = generateId();
    expect(id.startsWith("art_")).toBe(true);
  });

  it("should generate different IDs with different prefixes", () => {
    const a = generateId("art");
    const b = generateId("cmt");
    expect(a).not.toBe(b);
    expect(b.startsWith("cmt_")).toBe(true);
  });
});

describe("parseTags", () => {
  it("should parse valid JSON array", () => {
    expect(parseTags('["a","b","c"]')).toEqual(["a", "b", "c"]);
  });

  it("should return empty array for empty string", () => {
    expect(parseTags("")).toEqual([]);
  });

  it("should return empty array for null", () => {
    expect(parseTags(null)).toEqual([]);
  });

  it("should return empty array for undefined", () => {
    expect(parseTags(undefined)).toEqual([]);
  });

  it("should return empty array for invalid JSON", () => {
    expect(parseTags("not-valid-json")).toEqual([]);
  });

  it("should return empty array for JSON object (not array)", () => {
    expect(parseTags('{"key":"value"}')).toEqual([]);
  });
});

describe("articleToJSON", () => {
  it("should convert an ArticleRow to ArticleJSON", () => {
    const row: ArticleRow = {
      id: "art_001",
      title: "Test Title",
      content: "<p>Hello</p>",
      category: "Tech",
      subcategory: "JS",
      tags: '["js","ts"]',
      summary: "A test article",
      coverImage: "/img/test.png",
      likesCount: 5,
      isPinned: 0,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    };

    const result = articleToJSON(row);
    expect(result.id).toBe("art_001");
    expect(result.title).toBe("Test Title");
    expect(result.tags).toEqual(["js", "ts"]);
    expect(result.likesCount).toBe(5);
  });

  it("should handle null fields gracefully", () => {
    const row: ArticleRow = {
      id: "art_002",
      title: "Minimal",
      content: "",
      category: null,
      subcategory: null,
      tags: null,
      summary: null,
      coverImage: null,
      likesCount: null,
      isPinned: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const result = articleToJSON(row);
    expect(result.category).toBe("");
    expect(result.summary).toBe("");
    expect(result.likesCount).toBe(0);
    expect(result.isPinned).toBe(0);
    expect(result.tags).toEqual([]);
  });
});

describe("profileToJSON", () => {
  it("should convert a ProfileRow to ProfileJSON", () => {
    const row: ProfileRow = {
      name: "Test User",
      bio: "A developer",
      email: "test@example.com",
      location: "Beijing",
      avatar: "/img/avatar.png",
      socialGithub: "https://github.com/test",
      socialTwitter: "https://twitter.com/test",
      socialWebsite: "https://test.com",
    };

    const result = profileToJSON(row);
    expect(result.name).toBe("Test User");
    expect(result.bio).toBe("A developer");
    expect(result.social.github).toBe("https://github.com/test");
    expect(result.social.twitter).toBe("https://twitter.com/test");
    expect(result.social.website).toBe("https://test.com");
  });

  it("should handle null fields gracefully", () => {
    const row: ProfileRow = {
      name: null,
      bio: null,
      email: null,
      location: null,
      avatar: null,
      socialGithub: null,
      socialTwitter: null,
      socialWebsite: null,
    };

    const result = profileToJSON(row);
    expect(result.name).toBe("");
    expect(result.bio).toBe("");
    expect(result.social.github).toBe("");
    expect(result.social.twitter).toBe("");
    expect(result.social.website).toBe("");
  });
});
