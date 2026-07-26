import type { APIRoute } from "astro";
import { db } from "../../db";
import { profile } from "../../db/schema";
import { eq } from "drizzle-orm";

const DEFAULTS = {
  name: "kaven",
  bio: "",
  city: "",
  gender: "",
  avatar: "",
  github: "",
  website: "",
};

// GET — read profile
export const GET: APIRoute = async () => {
  const data = db.select().from(profile).where(eq(profile.id, 1)).get();
  if (!data) {
    return new Response(JSON.stringify(DEFAULTS), {
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};

// PUT — update profile (auth required)
export const PUT: APIRoute = async ({ request, cookies }) => {
  const authed = cookies.get("auth")?.value === "true";
  if (!authed) {
    return new Response(JSON.stringify({ error: "请先登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { name, bio, city, gender, avatar, github, website } = body;

    const existing = db.select().from(profile).where(eq(profile.id, 1)).get();

    if (existing) {
      db.update(profile)
        .set({
          name: name ?? existing.name,
          bio: bio ?? existing.bio,
          city: city ?? existing.city,
          gender: gender ?? existing.gender,
          avatar: avatar ?? existing.avatar,
          github: github ?? existing.github,
          website: website ?? existing.website,
        })
        .where(eq(profile.id, 1))
        .run();
    } else {
      db.insert(profile)
        .values({
          id: 1,
          name: name || DEFAULTS.name,
          bio: bio || DEFAULTS.bio,
          city: city || DEFAULTS.city,
          gender: gender || DEFAULTS.gender,
          avatar: avatar || DEFAULTS.avatar,
          github: github || DEFAULTS.github,
          website: website || DEFAULTS.website,
        })
        .run();
    }

    const updated = db.select().from(profile).where(eq(profile.id, 1)).get();
    return new Response(JSON.stringify(updated), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "更新失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
