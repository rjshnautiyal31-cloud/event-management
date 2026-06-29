FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json

RUN npm ci --omit=dev --workspace apps/api

COPY apps/api ./apps/api

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["npm", "start"]

