# Multi-stage optimizado: imagen final sin cache npm, sin build tools
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit --no-fund \
 && npm cache clean --force \
 && rm -rf /root/.npm /tmp/*

FROM node:20-alpine AS runtime
WORKDIR /app

# P0 FEAT 2026-05-08 (peticion usuario "PDFs deben respetar A4 210x297mm"):
# Chromium + libs minimas para que puppeteer-core renderice HTML->PDF con
# fidelidad CSS print (Drive Docs no respetaba @page ni page-breaks).
# Alpine chromium ~50MB. ttf-freefont para fonts en print.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
 && rm -rf /var/cache/apk/*

# Decirle a puppeteer-core donde esta chromium del sistema
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts

RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Europe/Madrid
# BLINDAJE 2026-05-08: max-old-space-size=1024 alineado con mem_limit=1200m
# del docker-compose.yml. Si Node intenta superar 1024MB de heap, V8 lanza
# OOM antes de que Docker mate el contenedor (mejor: stack trace en logs).
ENV NODE_OPTIONS="--max-old-space-size=1024"

CMD ["node", "src/server.js"]
