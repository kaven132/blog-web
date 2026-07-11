import type { APIRoute } from "astro";
import { db } from "../../lib/db";
import { profile } from "../../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../lib/auth";
import { profileToJSON } from "../../lib/utils";

/**
 * GET /api/profile — Public, returns profile row (id=1)
 */
export const GET: APIRoute = () => {
  const row = db.select().from(profile).where(eq(profile.id, 1)).get();

  if (!row) {
    return new Response(JSON.stringify({ error: "个人信息不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(profileToJSON(row)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * PUT /api/profile — Protected, updates profile row
 * Body: { name, bio, email, location, avatar, social: { github, twitter, website } }
 */
export const PUT: APIRoute = async ({ request }) => {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { name, bio, email, location, avatar, social } = body || {};

  db.update(profile)
    .set({
      name: name || "",
      bio: bio || "",
      email: email || "",
      location: location || "",
      avatar: avatar || "",
      socialGithub: social?.github || "",
      socialTwitter: social?.twitter || "",
      socialWebsite: social?.website || "",
    })
    .where(eq(profile.id, 1))
    .run();

  const row = db.select().from(profile).where(eq(profile.id, 1)).get();

  return new Response(JSON.stringify(profileToJSON(row!)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
