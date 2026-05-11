FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY articles-src/ ./articles-src/
COPY build-articles.mjs ./
COPY public/ ./public/
RUN node build-articles.mjs

FROM nginx:alpine
COPY --from=builder /app/public/ /usr/share/nginx/html/
EXPOSE 80
