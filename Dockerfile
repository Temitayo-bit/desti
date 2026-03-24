FROM node:20-bookworm-slim

WORKDIR /app

ARG DATABASE_URL="postgresql://postgres:postgres@db:5432/desti?schema=public"
ENV DATABASE_URL=$DATABASE_URL

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
