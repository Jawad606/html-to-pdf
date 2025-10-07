# Dockerfile
FROM node:18-slim

# Install dependencies for puppeteer/chromium
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libc6 \
    libc6-dev \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libx11-6 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpangocairo-1.0-0 \
    libnss3 \
    libnspr4 \
    libxshmfence1 \
    wget \
    unzip \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package and install first to take advantage of Docker layer caching
COPY package.json package-lock.json* ./

# Allow Puppeteer to download Chromium during npm install
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false \
    PUPPETEER_EXECUTABLE_PATH="" \
    NODE_ENV=production \
    TZ=UTC

RUN npm ci --production

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Recommended: run as non-root for security
# Create user and ownership
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /usr/src/app

USER pptruser

CMD ["node", "index.js"]
