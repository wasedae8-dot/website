FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy all files
COPY . .

# Set build-time environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Build the app
RUN npm run build


# Expose port (Railway injects PORT env var)
EXPOSE 3000

# Start production server
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT:-3000}"]

