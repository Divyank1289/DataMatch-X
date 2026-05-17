"""
DataMatchX — Application Configuration
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "DataMatchX"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "null",  # allow file:// origin for local frontend dev
    ]
    MAX_UPLOAD_SIZE_MB: int = 50
    REPORT_STORE_DIR: str = "./reports"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
