# Use Node.js LTS
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY . .

# Build the frontend (creates /dist)
RUN npm run build

# Port 4000 is the user preferred port
EXPOSE 4000

# Start server
CMD ["npm", "start"]
