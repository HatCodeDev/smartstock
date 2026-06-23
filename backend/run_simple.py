import uvicorn
from app.main import app

if __name__ == "__main__":
    # Ejecutar sin MQTT para pruebas básicas
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")