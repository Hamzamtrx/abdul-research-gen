FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Install unzip and Bun
RUN apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Copy package files and install
COPY package.json bun.lock* ./
RUN bun install

# Copy source
COPY . .

# Create output directories
RUN mkdir -p src/output/Projects src/output/SlackThreads

EXPOSE 3000

CMD ["bun", "run", "start-all.ts"]
