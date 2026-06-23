import asyncio
import sys
import os
import uuid
from typing import List

# Añadir el directorio raíz al path para que reconozca el módulo 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine, Base, async_session_maker
from app.models import Producto, Etiqueta, Ciclo, Evento, Alerta, BatchProcesado, Configuracion

# Lista de productos base para generar los 50 artículos
PRODUCTOS_BASE = [
    ("Playera Oversize Negra", "Tops"),
    ("Playera Oversize Blanca", "Tops"),
    ("Playera Slim Fit Azul Marino", "Tops"),
    ("Playera Tipo Polo Clásica", "Tops"),
    ("Camiseta de Tirantes Deportiva", "Tops"),
    ("Pantalón de Mezclilla Slim Fit", "Pantalones"),
    ("Jeans Corte Recto", "Pantalones"),
    ("Pantalón Chino Caqui", "Pantalones"),
    ("Pants Deportivo", "Pantalones"),
    ("Traje de Baño", "Pantalones"),
    ("Chamarra de Mezclilla", "Outerwear"),
    ("Sudadera con Gorro Gris", "Outerwear"),
    ("Chamarra Bomber", "Outerwear"),
    ("Abrigo de Lana", "Outerwear"),
    ("Chaleco Acolchado", "Outerwear"),
    ("Paquete de Calcetas x3 Blancas", "Accesorios"),
    ("Cinturón de Piel", "Accesorios"),
    ("Gorra Plana", "Accesorios"),
    ("Bufanda de Lana", "Accesorios"),
    ("Cartera Minimalista", "Accesorios"),
    ("Tenis Urbanos", "Calzado"),
    ("Botas de Piel", "Calzado"),
    ("Chanclas de Playa", "Calzado"),
    ("Zapatos de Vestir", "Calzado"),
    ("Tenis para Correr", "Calzado")
]

async def seed_db():
    print("--- INICIANDO SEEDER DE SMARTSTOCK ---")
    
    # 1. Resetear Base de Datos
    print("Limpiando tablas existentes...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Tablas recreadas con éxito.")

    # 2. Generar 50 Productos
    print("Generando 50 artículos de prueba...")
    async with async_session_maker() as session:
        async with session.begin():
            productos_to_add = []
            
            # Generamos 2 variaciones de cada producto base para llegar a 50
            for i in range(50):
                base_idx = i % len(PRODUCTOS_BASE)
                nombre_base, categoria = PRODUCTOS_BASE[base_idx]
                
                # Variamos el nombre si es una segunda vuelta
                nombre = f"{nombre_base} V{i // len(PRODUCTOS_BASE) + 1}" if i >= len(PRODUCTOS_BASE) else nombre_base
                sku = f"SS-{categoria[:3].upper()}-{i+1:03d}"
                
                nuevo_producto = Producto(
                    id=uuid.uuid4(),
                    nombre=nombre,
                    sku=sku,
                    categoria=categoria,
                    cantidad_inicial=0,
                    activo=True
                )
                productos_to_add.append(nuevo_producto)
            
            session.add_all(productos_to_add)

        await session.commit()
    
    # Asegurar que haya configuración
    async with engine.begin() as conn:
        await conn.execute(
            text("INSERT OR IGNORE INTO configuracion (id, hora_cierre_auto, cierre_auto_habilitado) VALUES (1, '23:00', 0)")
        )
    
    print(f"Éxito: Se crearon 50 artículos con stock inicial 0.")
    print("--- PROCESO FINALIZADO ---")

if __name__ == "__main__":
    if "--force" not in sys.argv:
        confirm = input("ADVERTENCIA: Esto borrará TODOS los datos de la DB. ¿Continuar? (s/n): ")
        if confirm.lower() != 's':
            print("Operación cancelada.")
            sys.exit(0)
            
    asyncio.run(seed_db())
