FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir \
      "fastapi>=0.115" "uvicorn>=0.32" "jinja2>=3.1" "httpx>=0.27" \
      "psycopg[binary,pool]>=3.2" "numpy>=2.1"

COPY collective_sky ./collective_sky
COPY templates ./templates

USER nobody

CMD ["python", "-m", "collective_sky.narrator"]
