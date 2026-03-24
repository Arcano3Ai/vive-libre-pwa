FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
# Google standard port
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]
