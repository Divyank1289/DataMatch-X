FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if any are needed for lxml/pandas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt ./backend/

# Install python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the rest of the backend code
COPY backend ./backend

# Change working directory to backend so relative paths work (like sample_data)
WORKDIR /app/backend

# Explicitly EXPOSE 8080 to instruct Railway's Edge Proxy
EXPOSE 8080

# Hardcode Uvicorn to listen on 8080, entirely ignoring any PORT environment variables
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "*"]