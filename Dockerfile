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

# Expose port and force it via ENV
ENV PORT=8000
EXPOSE 8000

# Run the FastAPI application explicitly on port 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port 8000
