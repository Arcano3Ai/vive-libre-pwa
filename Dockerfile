# Usar Node.js
FROM node:20

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Abrir el puerto 8080
EXPOSE 8080
ENV PORT=8080

# Arrancar con node
CMD ["node", "server.js"]
