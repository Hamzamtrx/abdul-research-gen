FROM oven/bun:1

WORKDIR /app

# Install dependencies for Playwright Chromium
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install

# Install Playwright Chromium
RUN bunx playwright install chromium

# Copy source
COPY . .

# Create output directories
RUN mkdir -p src/output/Projects src/output/SlackThreads

EXPOSE 3000

CMD ["bun", "run", "start-all.ts"]
