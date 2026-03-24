# Use Node.js LTS
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDeps for the build)
RUN npm install

# Copy project files
COPY . .

# Build the frontend (Vite)
RUN npm run build

# Clean up dev dependencies to save space (Optional but recommended)
# RUN npm prune --production

# Port 4000 is used by server.js
EXPOSE 4000

# Start command
CMD ["node", "server.js"]
