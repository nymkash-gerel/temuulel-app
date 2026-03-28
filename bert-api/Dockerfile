FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model and server
COPY main.py .
COPY ../models/mongolian-intent-bert/final /app/model/

ENV MODEL_PATH=/app/model
ENV PORT=8000

EXPOSE 8000

CMD ["python", "main.py"]
