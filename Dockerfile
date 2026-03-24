# Usar Node.js
FROM node:20

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar TODO (incluye herramientas de build)
RUN npm install

# Copiar el resto del proyecto
COPY . .

# Realizar el build de Vite
RUN npm run build

# Abrir el puerto (Google usará PORT env var)
EXPOSE 8080

# Arrancar con node directamente
CMD ["node", "server.js"]
