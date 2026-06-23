# ========================================================
# SmartStock - Dockerfile Multietapa (Monolito Compacto)
# ========================================================

# --- Etapa 1: Compilación de Frontend ---
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Copiar archivos de dependencias y hacer caché
COPY frontend/package*.json ./
RUN npm ci

# Copiar código del frontend y compilar
COPY frontend/ ./
RUN npm run build

# --- Etapa 2: Servidor Backend en Python ---
FROM python:3.10-slim
WORKDIR /app

# Instalar dependencias del sistema mínimas
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements y compilar dependencias de Python
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copiar el build compilado del frontend al contenedor final
COPY --from=frontend-builder /app/frontend /app/frontend

# Copiar el código del backend al contenedor final
COPY backend/ /app/backend/

# Definir variables de entorno por defecto
ENV PORT=8000
ENV PYTHONPATH=/app/backend

# Exponer el puerto
EXPOSE 8000

# Arrancar la aplicación
WORKDIR /app/backend
CMD ["python", "run.py"]
