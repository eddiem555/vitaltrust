# Build Stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies required for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy configuration files (relative to project root)
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code and static assets
COPY . .

# Build the application (Vite production build)
RUN npm run build

# Final Stage
FROM node:20-slim

WORKDIR /app

# curl for in-container health checks (e.g. /api/mcp/status, /mcp probe)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy the built application and server code
COPY --from=builder /app /app

# Prune devDependencies to keep image small
RUN npm prune --production

# Expose the application port
EXPOSE 3000

# Start the application using tsx (simpler for standalone prototype)
CMD ["npm", "start"]
