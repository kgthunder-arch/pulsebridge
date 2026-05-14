FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

# Install all deps including optional platform binaries (needed by Rollup/Vite)
RUN npm install --include=optional

COPY client ./client
COPY server ./server
COPY shared ./shared

RUN npm run build

EXPOSE 4000

CMD ["npm", "run", "start"]
