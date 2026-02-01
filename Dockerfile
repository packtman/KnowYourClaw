# AgentProof Dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create data directory
RUN mkdir -p /app/data

# Copy files
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup --system --gid 1001 agentproof
RUN adduser --system --uid 1001 agentproof
RUN chown -R agentproof:agentproof /app
USER agentproof

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
