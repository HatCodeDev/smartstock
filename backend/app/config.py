from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./smartstock.db"
    JWT_SECRET: str = "your-secret-key-here"
    TIMEZONE: str = "America/Mexico_City"

    # MQTT
    MQTT_DEVICE_ID: str = "default-device-id"
    MQTT_BROKER_URL: str = "localhost"
    MQTT_PORT: int = 1883
    MQTT_USERNAME: str = ""
    MQTT_PASSWORD: str = ""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
