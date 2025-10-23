# Stage 1 — build
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies (use package-lock if present)
COPY package*.json ./
RUN npm ci --production

# Copy the server code
COPY . .

# Optional: build step (if you have a build)
# RUN npm run build

# Stage 2 — runtime (smaller)
FROM node:18-alpine AS runtime
WORKDIR /app

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only what we need from builder
COPY --from=builder /app /app

# Expose port used by your express app
ENV PORT=4000
EXPOSE 4000

# Use non-root user for security
USER appuser

# Default start command (adjust if your start script is different)
CMD ["node", "server/server.js"]
