# Multi-stage optimizado: imagen final sin cache npm, sin build tools
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit --no-fund \
 && npm cache clean --force \
 && rm -rf /root/.npm /tmp/*

FROM node:20-alpine AS runtime
WORKDIR /app
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
ENV NODE_OPTIONS="--max-old-space-size=512"

CMD ["node", "src/server.js"]
