FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for psycopg2 (PostgreSQL driver)
RUN apt-get update \
    && apt-get -y install libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Use PORT env var injected by Railway, defaulting to 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
