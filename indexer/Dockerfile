FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src

USER node

CMD ["node", "--experimental-strip-types", "src/main.ts"]
