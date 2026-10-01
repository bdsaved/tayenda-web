FROM node:22-slim AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@10.23.0 && pnpm install --frozen-lockfile --config.dangerouslyAllowAllBuilds=true

FROM node:22-slim AS builder

WORKDIR /app

# Empty = same-origin API requests (Caddy routes /api/* to FastAPI).
ARG VITE_API_URL=""
ARG VITE_PUBLIC_WEB_URL=https://tayenda.renai-labs.com
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_MAPBOX_TOKEN=""
ARG VITE_MAPBOX_STYLE=""
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
ENV VITE_MAPBOX_STYLE=$VITE_MAPBOX_STYLE
ENV VITE_PUBLIC_WEB_URL=$VITE_PUBLIC_WEB_URL

RUN npm install -g pnpm@10.23.0
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml* ./
COPY . .
RUN rm -rf .output .vinxi && pnpm build

FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
