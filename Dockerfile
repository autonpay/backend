FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci

# Copy source and build.
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
RUN npm run build

# Generate Prisma client and prune dev dependencies for runtime image.
RUN npx prisma generate && npm prune --omit=dev

FROM node:20-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Copy only what runtime needs.
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/index.js"]
