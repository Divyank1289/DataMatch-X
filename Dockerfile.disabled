FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/

RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend

WORKDIR /app/backend

ENV PORT=3000
EXPOSE 3000

# Start Uvicorn directly, allowing Railway's PORT env var to dictate the port.
# Also enable proxy headers since we are behind Railway's edge proxy.
CMD uvicorn app.main:app --host :: --port ${PORT:-3000} --proxy-headers --forwarded-allow-ips="*"