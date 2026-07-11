# ============================================
# Kaven's Blog — Dockerfile (Multi-stage Build)
# Astro SSR + React + Tailwind v4 + Drizzle ORM
# ============================================

# ── Stage 1: Build ──────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Runtime ─────────────────────────
FROM node:22-alpine

WORKDIR /app

# Copy built artifacts and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create uploads directory
RUN mkdir -p uploads && chown -R node:node /app

# Run as non-root user
USER node

EXPOSE 4321

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4321/api/health',r=>{process.exit(r.statusCode===200?0:1)})"

CMD ["node", "dist/server/entry.mjs"]
