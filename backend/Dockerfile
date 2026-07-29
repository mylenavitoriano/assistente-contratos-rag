FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && cp -r src/db/migrations dist/db/migrations

FROM deps AS development
ENV NODE_ENV=development
COPY tsconfig.json ./
COPY src ./src
EXPOSE 3333
CMD ["npm", "run", "dev"]

FROM base AS production
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/.model-cache && chown -R node:node /app
USER node
EXPOSE 3333
CMD ["node", "dist/server.js"]
