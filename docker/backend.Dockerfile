# syntax=docker/dockerfile:1.7
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt /tmp/dashboard-requirements.txt
COPY --from=reporting services/worker-py/pyproject.toml /opt/reporting/services/worker-py/pyproject.toml
COPY --from=reporting services/worker-py/src /opt/reporting/services/worker-py/src

RUN python -m pip install --no-cache-dir -r /tmp/dashboard-requirements.txt \
    && python -m pip install --no-cache-dir /opt/reporting/services/worker-py

COPY backend /app/backend

ENV DORIS_API_HOST=0.0.0.0 \
    DORIS_API_PORT=8788 \
    REPORTING_ROOT=/opt/reporting \
    REPORTING_PYTHON=/usr/local/bin/python \
    REPORTING_WORKER_SRC=/opt/reporting/services/worker-py/src

RUN useradd --create-home --uid 10001 dashboard
USER dashboard

EXPOSE 8788

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=4 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8788/health', timeout=3)"]

CMD ["python", "/app/backend/app.py"]
