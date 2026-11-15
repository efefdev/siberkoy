# ─── Ortak taban ─────────────────────────────
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ─── Bağımlılıklar (build için devDependencies dahil) ───
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ─── Build ───────────────────────────────────
FROM base AS builder
# CSP ve izinli Socket.io adresi build sırasında bu değere göre üretilir
ARG NEXT_PUBLIC_APP_URL=https://siberkoy.omusiber.org
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
 && npm run build \
 && npm prune --omit=dev \
 && npx prisma generate \
 && rm -rf .next/cache \
 && chmod -R a+rX,go-w /app
# Son chmod: derleme bağlamındaki dosya izinleri imaja aynen geçer. Kaynak 600 izinliyse (ör. macOS'ta
# kopyalanmış dosyalar) root'a ait dosyaları nextjs kullanıcısı okuyamaz ve uygulama açılmaz.

# ─── Üretim imajı ────────────────────────────
# Özel server.js (Socket.io) kullanıldığı için Next.js "standalone" çıktısı yerine
# yalnızca üretim bağımlılıklarıyla tam .next klasörü kopyalanır.
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# Docker HOSTNAME'i konteyner kimliğine ayarlar; sunucu tüm arayüzleri dinlesin
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/server ./server
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
