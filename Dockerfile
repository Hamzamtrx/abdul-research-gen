FROM oven/bun:1 AS base
WORKDIR /app

# Install minimal system dependencies in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
    python3-pip \
    ca-certificates \
    fonts-liberation \
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
    && rm -rf /var/lib/apt/lists/*

# Install Bun dependencies first (cache layer)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Install Playwright Chromium
RUN bunx playwright install chromium

# Install Python packages
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy source code
COPY . .

# Create output directories
RUN mkdir -p src/output/Projects src/output/SlackThreads

EXPOSE 3000

CMD ["bun", "run", "start-all.ts"]

