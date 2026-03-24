# Stage 1: Build
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Run
FROM node:20-slim
WORKDIR /app
# Copy only necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/agents ./agents
# Install only production dependencies
RUN npm install --production
# Ensure port 4000
EXPOSE 4000
CMD ["node", "server.js"]
