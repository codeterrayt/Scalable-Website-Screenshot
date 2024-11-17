FROM node:20-alpine

# Install dependencies required for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    yarn

# Install pnpm
RUN npm install -g pnpm

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies with pnpm
RUN pnpm install

# Copy app source
COPY . .

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create screenshots directory
RUN mkdir -p screenshots

EXPOSE 3000

CMD ["pnpm", "start"]
