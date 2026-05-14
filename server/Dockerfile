FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

RUN npm install

COPY client ./client
COPY server ./server
COPY shared ./shared

RUN npm run build

EXPOSE 4000

CMD ["npm", "run", "start"]
