FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Copy package files
COPY package.json ./

# Install with npm
RUN npm install

# Install tsx for TypeScript execution
RUN npm install -g tsx

# Copy source
COPY . .

# Create output directories
RUN mkdir -p src/output/Projects src/output/SlackThreads

EXPOSE 3000

CMD ["tsx", "start-all.ts"]
