FROM node:22-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY server.js ./
COPY index.html ./

EXPOSE 3000

# Scores persist in /app/scores.json — mount a volume to keep them across restarts:
#   docker run -v snake_scores:/app/scores.json ...
CMD ["node", "server.js"]
