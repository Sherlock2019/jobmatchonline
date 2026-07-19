# JobsMatchNow API — production container (API + built web app, RDS-backed via DATABASE_URL)
FROM node:22-alpine
WORKDIR /srv
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev --no-audit --no-fund
COPY server ./server
COPY dist ./dist
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=20s --timeout=4s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "server/index.js"]
