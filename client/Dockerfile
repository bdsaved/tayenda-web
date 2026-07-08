FROM node:22-slim AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@10.23.0 && pnpm install --config.dangerouslyAllowAllBuilds=true

FROM node:22-slim AS builder

WORKDIR /app

ARG VITE_API_URL=https://tayenda.renai-labs.com
ARG VITE_PUBLIC_WEB_URL=https://tayenda.renai-labs.com
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUBLIC_WEB_URL=$VITE_PUBLIC_WEB_URL

RUN npm install -g pnpm@10.23.0
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml* ./
COPY . .
RUN pnpm build

FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
