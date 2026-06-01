# ── Etapa 1: build ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# ── Etapa 2: producción ───────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Solo lo necesario para correr
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/package.json  ./

# Directorio para PDFs generados
RUN mkdir -p public/uploads/pdfs

EXPOSE 3001
CMD ["node", "dist/main"]
