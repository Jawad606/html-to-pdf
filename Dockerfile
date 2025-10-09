# Dockerfile
FROM node:20-slim

# Install dependencies for puppeteer/chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    libx11-6 \
    libx11-xcb1 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome itself
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package and install first to take advantage of Docker layer caching
COPY package.json package-lock.json* ./

# Tell Puppeteer to skip installing Chrome since we'll be using the installed package
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CHROME_BIN=/usr/bin/google-chrome \
    NODE_ENV=production \
    TZ=UTC

RUN npm ci --production

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Create a non-root user for security
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /usr/src/app \
    && chown -R pptruser:pptruser /home/pptruser

# Run everything after as non-root user
USER pptruser

CMD ["node", "src/index.js"]
