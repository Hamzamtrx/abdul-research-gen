FROM oven/bun:1 AS base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    pkg-config \
    libcairo2 \
    libcairo2-dev \
    libgirepository1.0-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libfontconfig1 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    shared-mime-info \
    ffmpeg \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 (required for Claude Code CLI)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Pre-configure Claude CLI to skip onboarding prompts
ENV HOME=/root
RUN mkdir -p /root/.claude \
    && echo '{"hasCompletedOnboarding":true,"hasAcknowledgedCostThreshold":true}' > /root/.claude/settings.json

# Verify Claude CLI is installed
RUN claude --version || echo "Claude CLI installed"

# Install yt-dlp
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Install Python packages for PDF generation
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Install Bun dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Install Playwright browsers
RUN bunx playwright install chromium --with-deps

# Copy source code
COPY . .

# Verify .claude directory was copied
RUN ls -la src/output/.claude && \
    echo "✓ .claude directory found with skills and agents" || \
    (echo "✗ ERROR: .claude directory not found!" && exit 1)

# Create output directories
RUN mkdir -p src/output/Projects src/output/SlackThreads

# Expose the webhook port
EXPOSE 3000

# Run both the webhook server and Slack bot
CMD ["bun", "run", "start-all.ts"]

