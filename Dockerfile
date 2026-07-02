# ============================================
# Kaven's Blog — Dockerfile (Node.js App)
# ============================================
FROM node:22-alpine

# Install build dependencies for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install dependencies (better-sqlite3 will compile natively)
RUN npm ci --only=production && \
    apk del python3 make g++ && \
    rm -rf /var/cache/apk/* /root/.npm /root/.cache

# Copy application code
COPY server.js ./
COPY css/ ./css/
COPY js/ ./js/
COPY image/ ./image/
COPY index.html ./

# Create uploads directory & data directory
RUN mkdir -p uploads && chown -R node:node /app

# Run as non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
