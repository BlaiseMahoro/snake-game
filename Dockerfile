FROM node:22-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY server.js game.js db.js index.html ./

# Mount a volume here to persist scores.db across container restarts:
#   docker run -v snake_data:/app/data -e DB_PATH=/app/data/scores.db ...

# Render injects $PORT at runtime; fallback to 3000 locally
EXPOSE ${PORT:-3000}

CMD ["node", "server.js"]
