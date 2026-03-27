# Stage 1: Build Quasar SSR bundle
FROM node:20-alpine AS frontend-ssr-builder
WORKDIR /app
ENV NODE_ENV=development
RUN npm install -g @quasar/cli
COPY package*.json ./
COPY quasar.config.* ./
COPY index.html ./
COPY src ./src
COPY public ./public
COPY src-ssr ./src-ssr
RUN npm ci
COPY . .
RUN quasar build -m ssr

# Stage 2: Runtime image for Quasar SSR
FROM node:20-alpine AS frontend-ssr-runtime
WORKDIR /app
ENV NODE_ENV=production
ARG SSR_PORT=9010
ENV PORT=${SSR_PORT}
COPY --from=frontend-ssr-builder /app/dist/ssr ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force
EXPOSE ${PORT}
CMD ["node", "index.js"]