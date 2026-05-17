FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/

RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend

WORKDIR /app/backend

EXPOSE 3000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3000}"]