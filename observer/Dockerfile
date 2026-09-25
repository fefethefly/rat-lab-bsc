FROM python:3.11-slim
WORKDIR /app
ENV OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 PYTHONUNBUFFERED=1
COPY observer/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY observer /app/observer
COPY runtime /app/runtime
ENV RAT_RUNTIME=/app/runtime
CMD ["sh", "-c", "uvicorn observer.app:app --host 0.0.0.0 --port ${PORT:-8080}"]
