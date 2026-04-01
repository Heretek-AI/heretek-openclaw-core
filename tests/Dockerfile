# ==============================================================================
# Heretek OpenClaw - Test Runner Docker Image
# ==============================================================================
# This Dockerfile creates a containerized test environment for running
# all test suites with proper dependencies and configurations.
# ==============================================================================

# ==============================================================================
# Base Stage - Node.js runtime
# ==============================================================================
FROM node:20-alpine AS base

# Install system dependencies required for tests
RUN apk add --no-cache \
    bash \
    git \
    python3 \
    py3-pip \
    redis \
    curl \
    dumb-init

# Set working directory
WORKDIR /app

# ==============================================================================
# Dependencies Stage - Install npm dependencies
# ==============================================================================
FROM base AS dependencies

# Copy package files
COPY package*.json ./
COPY package-lock.json* ./

# Install all dependencies (including devDependencies for tests)
RUN npm ci --ignore-scripts --legacy-peer-deps 2>/dev/null || npm ci --ignore-scripts

# ==============================================================================
# Test Runner Stage - Main test execution image
# ==============================================================================
FROM dependencies AS test-runner

# Install Playwright browsers for E2E tests
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Playwright environment variables
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1

# Copy source code
COPY . .

# Make test scripts executable
RUN chmod +x ./scripts/run-tests.sh \
    && chmod +x ./scripts/run-tests-e2e.sh \
    && chmod +x ./scripts/generate-coverage-report.sh

# Create directories for test outputs
RUN mkdir -p /app/test-results /app/coverage

# Set test environment variables
ENV NODE_ENV=test
ENV CI=true
ENV REDIS_URL=redis://redis:6379
ENV DATABASE_URL=postgresql://openclaw:openclaw_test@postgres:5432/openclaw_test
ENV GATEWAY_PORT=8787

# Default to running unit tests
ENTRYPOINT ["dumb-init", "--"]
CMD ["./scripts/run-tests.sh"]

# ==============================================================================
# Coverage Stage - Generate and export coverage reports
# ==============================================================================
FROM test-runner AS coverage

# Generate coverage report
RUN ./scripts/run-tests.sh --no-coverage || true

# Output directory for coverage reports
VOLUME ["/app/coverage"]

# ==============================================================================
# E2E Stage - End-to-end test execution
# ==============================================================================
FROM test-runner AS e2e

# Install additional E2E dependencies
RUN apk add --no-cache \
    xvfb \
    xorg-server \
    xauth

# Set E2E-specific environment variables
ENV PLAYWRIGHT_HEADLESS=true
ENV PLAYWRIGHT_BROWSERS=chromium

# Override entrypoint for E2E tests
CMD ["./scripts/run-tests-e2e.sh", "--skip-services"]

# ==============================================================================
# Development Stage - Interactive test debugging
# ==============================================================================
FROM test-runner AS dev

# Install debugging tools
RUN apk add --no-cache \
    vim \
    less \
    jq \
    procps

# Don't run tests automatically
CMD ["/bin/sh"]

# ==============================================================================
# Usage Examples:
# ==============================================================================
# 
# Build the test runner image:
#   docker build -f tests/Dockerfile -t openclaw-test-runner .
#
# Run all tests:
#   docker run --rm \
#     --network openclaw-test-network \
#     -v $(pwd)/test-results:/app/test-results \
#     -v $(pwd)/coverage:/app/coverage \
#     openclaw-test-runner
#
# Run only unit tests:
#   docker run --rm \
#     --network openclaw-test-network \
#     openclaw-test-runner ./scripts/run-tests.sh --unit-only
#
# Run E2E tests:
#   docker run --rm \
#     --network openclaw-test-network \
#     -e PLAYWRIGHT_TEST_BASE_URL=http://gateway:8787 \
#     openclaw-test-runner:latest ./scripts/run-tests-e2e.sh --skip-services
#
# Generate coverage report:
#   docker run --rm \
#     --network openclaw-test-network \
#     -v $(pwd)/coverage:/app/coverage \
#     openclaw-test-runner ./scripts/generate-coverage-report.sh
#
# Interactive debugging:
#   docker run --rm -it \
#     --network openclaw-test-network \
#     openclaw-test-runner:dev
#
# ==============================================================================
