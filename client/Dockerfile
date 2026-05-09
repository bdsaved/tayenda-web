FROM node:22-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@10.23.0 && pnpm install --config.dangerouslyAllowAllBuilds=true

COPY . .

CMD ["pnpm", "dev", "--host"]
