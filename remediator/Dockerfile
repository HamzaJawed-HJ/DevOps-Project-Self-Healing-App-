FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Use npm install instead of npm ci
RUN npm install --only=production

# RUN npm ci --only=production

COPY app.js ./

EXPOSE 8080
CMD ["npm", "start"]
