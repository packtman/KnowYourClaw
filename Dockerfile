# AgentProof Dockerfile - API + UI
FROM node:20-alpine AS base
WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ 

# Install backend dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Install frontend dependencies
FROM node:20-alpine AS web-deps
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

# Build frontend
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY --from=web-deps /app/web/node_modules ./node_modules
COPY web/ .
ENV VITE_API_URL=""
RUN npm run build

# Build backend
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/agentproof.db

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache libstdc++

# Create data directory
RUN mkdir -p /app/data

# Copy built backend
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built frontend
COPY --from=web-builder /app/web/dist ./web-dist

# Create non-root user
RUN addgroup --system --gid 1001 agentproof && \
    adduser --system --uid 1001 agentproof && \
    chown -R agentproof:agentproof /app
USER agentproof

EXPOSE 3000

CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]
