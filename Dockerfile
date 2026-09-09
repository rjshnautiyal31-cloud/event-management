FROM node:20-alpine

# Install FFmpeg for video rendering
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json

RUN npm ci --omit=dev --workspace apps/api

COPY apps/api ./apps/api

ENV NODE_ENV=production

WORKDIR /app/apps/api

EXPOSE 8080

CMD ["node", "src/server.js"]
