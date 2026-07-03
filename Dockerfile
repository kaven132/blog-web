# ============================================
# Kaven's Blog — Dockerfile (Multi-stage Build)
# ============================================

# ── Stage 1: Build native modules ──────────
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ── Stage 2: Runtime image ────────────────
FROM node:22-alpine

WORKDIR /app

# Copy compiled node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY server.js ./
COPY css/ ./css/
COPY js/ ./js/
COPY image/ ./image/
COPY index.html ./

# Create uploads directory
RUN mkdir -p uploads && chown -R node:node /app

# Run as non-root user
USER node

EXPOSE 3000

# Health check using Node.js (no extra packages needed)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health',r=>{process.exit(r.statusCode===200?0:1)})"

CMD ["node", "server.js"]
