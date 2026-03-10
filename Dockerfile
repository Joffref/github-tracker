FROM node:22-alpine

RUN apk update && apk add --no-cache \
  git \
  curl \
  netcat-openbsd \
  && rm -rf /var/cache/apk/*

WORKDIR /app

COPY --from=ghcr.io/blaxel-ai/sandbox:latest /sandbox-api /usr/local/bin/sandbox-api

# Copy project files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile

COPY . .

# Build the Next.js app
# Source .env if present so NEXT_PUBLIC_* vars are inlined at build time
RUN if [ -f .env ]; then export $(cat .env | xargs) 2>/dev/null; fi && pnpm build

EXPOSE 3000

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PATH="/usr/local/bin:$PATH"

ENTRYPOINT ["/entrypoint.sh"]
