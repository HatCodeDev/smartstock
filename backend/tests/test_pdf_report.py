import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_current_user
from app.main import app
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.producto import Producto
from app.models.reporte_avanzado import ReporteAvanzado, TipoReporteAvanzado

# Sobrescribimos get_current_user para saltar la autenticación en estas pruebas
async def override_get_current_user():
    return {"id": 1, "username": "admin"}

app.dependency_overrides[get_current_user] = override_get_current_user

@pytest.mark.asyncio
async def test_download_pdf_report_empty_db(client: AsyncClient):
    """
    Verifica que el endpoint devuelva 200 OK y un PDF válido con la base de datos limpia.
    """
    response = await client.get("/api/reports/download/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment; filename=Reporte_Analitico_SmartStock.pdf" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-")

@pytest.mark.asyncio
async def test_download_pdf_report_with_data(client: AsyncClient, db_session: AsyncSession):
    """
    Verifica que el endpoint devuelva 200 OK y genere correctamente el reporte PDF
    cuando existen datos en tiempo real y cachés analíticos avanzados.
    """
    # 1. Crear producto crítico
    prod = Producto(
        nombre="Camiseta de Algodón Premium",
        categoria="Ropa",
        cantidad_inicial=1,
        stock_minimo=10,
        activo=True
    )
    db_session.add(prod)
    await db_session.flush()

    # 2. Agregar reportes avanzados simulados a la BD
    reporte_hw = ReporteAvanzado(
        tipo=TipoReporteAvanzado.HOLT_WINTERS,
        datos={
            "fechas": ["2026-05-23", "2026-05-24", "2026-05-25"],
            "pronostico_total": [35, 12, 5],
            "por_categoria": {
                "Ropa": [20, 10, 2],
                "Blanco": [15, 2, 3]
            },
            "mensaje_inteligente": "Se estima un pico de demanda moderado el fin de semana."
        }
    )
    
    reporte_km = ReporteAvanzado(
        tipo=TipoReporteAvanzado.K_MEANS,
        datos={
            "total_productos_analizados": 1,
            "mensaje_inteligente": "Optimizar existencias de Camiseta de Algodón Premium.",
            "clusters": [
                {
                    "nombre": "Alta Rotación",
                    "metrica_promedio_ventas": 15.5,
                    "descripcion": "Productos con velocidad de venta y reorden frecuente.",
                    "productos": [
                        {
                            "sku": "SKU-ROPA-01",
                            "nombre": "Camiseta de Algodón Premium",
                            "ventas": 25,
                            "stock": 1
                        }
                    ]
                }
            ]
        }
    )

    db_session.add(reporte_hw)
    db_session.add(reporte_km)
    await db_session.commit()

    # 3. Consultar endpoint
    response = await client.get("/api/reports/download/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert b"%PDF-" in response.content
