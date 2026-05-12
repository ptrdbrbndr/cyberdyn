FROM node:20-alpine
WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
COPY api/server.mjs ./
EXPOSE 3001
CMD ["node", "server.mjs"]
