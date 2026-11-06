FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Frontend
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Backend API
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --production

COPY --from=builder /app/backend ./backend
COPY --from=builder /app/api ./api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "backend/server.js"]
