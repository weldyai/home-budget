from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    telegram_token: str
    openrouter_api_key: str
    supabase_url: str
    supabase_key: str
    allowed_user_ids: str  # "id1,id2"

    def get_allowed_ids(self) -> list[int]:
        return [int(x.strip()) for x in self.allowed_user_ids.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
