import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable {name} (see .env.example)")
    return value


@dataclass(frozen=True)
class Settings:
    webhook_secret: str
    admin_api_key: str
    supabase_url: str
    supabase_key: str
    database_url: str
    groq_api_key: str
    groq_model: str
    approval_confidence_threshold: float
    always_require_approval: bool


@lru_cache
def get_settings() -> Settings:
    return Settings(
        webhook_secret=require_env("WEBHOOK_SECRET"),
        admin_api_key=require_env("ADMIN_API_KEY"),
        supabase_url=require_env("SUPABASE_URL"),
        supabase_key=require_env("SUPABASE_SERVICE_ROLE_KEY"),
        database_url=require_env("DATABASE_URL"),
        groq_api_key=require_env("GROQ_API_KEY"),
        groq_model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
        approval_confidence_threshold=float(os.environ.get("APPROVAL_CONFIDENCE_THRESHOLD", "0.75")),
        always_require_approval=os.environ.get("ALWAYS_REQUIRE_APPROVAL", "false").lower() in {"1", "true", "yes"},
    )
