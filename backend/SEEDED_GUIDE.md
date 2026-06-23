# Guía de Limpieza y Seeding - SmartStock

Este script permite resetear la base de datos a un estado "limpio" con 50 artículos de prueba listos para ser vinculados con etiquetas RFID.

## Comando de Ejecución

Desde la carpeta `backend/`, ejecutá:

```powershell
# Opción con confirmación manual
python scripts/seed_db.py

# Opción automática (fuerza el borrado)
python scripts/seed_db.py --force
```

## Lo que hace el script:
1.  **Borra todas las tablas** (Productos, Etiquetas, Eventos, Alertas, etc.).
2.  **Recrea la estructura** desde cero.
3.  **Carga 50 productos** con:
    -   Stock inicial = 0.
    -   SKUs autogenerados (`SS-CAT-001`).
    -   Estado: Activo.

## Requisitos
Asegurate de tener el entorno virtual activo:
```powershell
.\venv\Scripts\activate
```
