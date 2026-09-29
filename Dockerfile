# API image (FastAPI + LangGraph agent + CRM MCP server). The dashboard and n8n deploy separately.
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /uvx /bin/

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1

# Dependencies first, so code changes don't reinstall them.
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-dev --no-install-project

COPY src/ai_bussiness_workflow ./src/ai_bussiness_workflow
RUN uv sync --locked --no-dev --no-editable

RUN useradd --create-home --uid 1000 app
USER app
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000
# Render sets PORT. No --reload in production; one worker because agent runs happen in-process.
CMD ["sh", "-c", "exec uvicorn ai_bussiness_workflow.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
