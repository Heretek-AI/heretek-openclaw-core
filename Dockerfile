# ==============================================================================
# Heretek OpenClaw — Gateway Dockerfile
# ==============================================================================
# Multi-stage build for OpenClaw Gateway v2026.3.28
# All 11 agents run as workspaces within the Gateway process
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source files
COPY . .

# Run type checking and linting
RUN npm run typecheck || true
RUN npm run lint || true

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS production

# Labels
LABEL org.opencontainers.image.title="Heretek OpenClaw Gateway"
LABEL org.opencontainers.image.description="Multi-agent AI collective with LiteLLM A2A protocol"
LABEL org.opencontainers.image.vendor="Heretek"
LABEL org.opencontainers.image.version="2.0.4"
LABEL org.opencontainers.image.source="https://github.com/heretek/heretek-openclaw"

# Install runtime dependencies
RUN apk add --no-cache curl bash jq

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy package files from builder
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files from builder
COPY --from=builder /app/agents ./agents
COPY --from=builder /app/skills ./skills
COPY --from=builder /app/plugins ./plugins
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tests ./tests
COPY --from=builder /app/openclaw.json ./openclaw.json
COPY --from=builder /app/litellm_config.yaml ./litellm_config.yaml
COPY --from=builder /app/README.md ./README.md
COPY --from=builder /app/LICENSE ./LICENSE

# Create necessary directories
RUN mkdir -p /app/.openclaw/agents && \
    mkdir -p /app/.openclaw/state && \
    mkdir -p /app/.openclaw/memory && \
    mkdir -p /app/.openclaw/sessions && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose Gateway port
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:18789/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV OPENCLAW_DIR=/app/.openclaw
ENV OPENCLAW_WORKSPACE=/app/.openclaw/agents
ENV GATEWAY_URL=ws://localhost:18789

# Default command - runs the Gateway
# Note: The actual Gateway binary is installed via npm package or curl script
# This is a placeholder for the Gateway runtime
CMD ["node", "-e", "console.log('OpenClaw Gateway placeholder - install via: curl -fsSL https://openclaw.ai/install.sh | bash')"]

# ------------------------------------------------------------------------------
# Stage 3: Development
# ------------------------------------------------------------------------------
FROM production AS development

USER root

# Install development dependencies
RUN npm ci

# Switch back to non-root user
USER nodejs

# Expose additional ports for development
EXPOSE 4000 3000

CMD ["npm", "run", "test:watch"]
