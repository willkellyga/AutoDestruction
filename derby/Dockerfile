# Auto Destruction's online server for Fly.io (derby/FLY.md). Built from the repo's root:
#   fly deploy --config derby/fly.toml --dockerfile derby/Dockerfile --ha=false
# Stage 1 builds the game page (one HTML file); stage 2 is the small server that hands it out and runs the lobby.
FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN node derby/build.mjs

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/derby/server ./derby/server
COPY --from=build /app/derby/dist/auto-destruction.html ./derby/dist/auto-destruction.html
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "derby/server/server.mjs"]
