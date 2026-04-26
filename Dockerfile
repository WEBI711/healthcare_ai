FROM node:20-slim

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create auth directory
RUN mkdir -p auth_info_baileys

# Expose ports
# 3000 - App port (for future web interface)
# 9229 - Node.js debugger port
EXPOSE 3000 9229

# Start the application with debugger enabled
# --inspect=0.0.0.0:9229 allows connections from outside the container
CMD ["node", "--inspect=0.0.0.0:9229", "dist/index.js"]