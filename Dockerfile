FROM python:3.14-alpine AS backend

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY pyproject.toml ./
RUN uv sync --no-cache --no-dev

COPY main.py ./main.py
COPY backend/ ./backend/

EXPOSE 8000

CMD ["sh", "-c", "if [ -f backend/alembic.ini ]; then uv run alembic -c backend/alembic.ini upgrade head; fi && uv run uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info"]


FROM node:22-alpine AS frontend

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./

ARG VITE_PROXY_TARGET=http://backend:8000
ENV VITE_PROXY_TARGET=${VITE_PROXY_TARGET}

EXPOSE 5173

CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0 --port 5173"]
