FROM node:24-alpine AS frontend
WORKDIR /build
COPY scripts/build.cjs scripts/build.cjs
COPY js js
RUN node scripts/build.cjs

FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    DB_PATH=/data/health_battle.db
WORKDIR /app
COPY requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt \
    && groupadd --gid 10001 game \
    && useradd --uid 10001 --gid game --no-create-home game \
    && mkdir /data && chown game:game /data
COPY server.py index.html admin.html ./
COPY css css
COPY assets/images assets/images
COPY --from=frontend /build/js js
USER game
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=3).read()"
CMD ["python", "server.py"]
