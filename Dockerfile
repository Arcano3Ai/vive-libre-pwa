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

# Port 8080 is the Cloud Run default
EXPOSE 8080

# Start server
CMD ["npm", "start"]
