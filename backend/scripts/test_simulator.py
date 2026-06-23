#!/usr/bin/env python3
"""
Test básico para verificar que el simulator funciona correctamente
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Agregar el directorio backend al path para imports
sys.path.append(str(Path(__file__).parent.parent))

async def test_simulator():
    """Prueba básica del simulador."""
    load_dotenv()
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL no encontrada en el archivo .env")
        return False
    
    # Convertir URL si es necesario
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    
    print("OK: DATABASE_URL configurada correctamente")
    print(f"OK: Conexión a base de datos: {database_url.split('@')[1] if '@' in database_url else 'local'}")
    
    # Importar el simulador
    try:
        from scripts.simulate_history import SmartStockSimulator, ETIQUETAS_REALES, FECHA_INICIO, FECHA_FIN
        print("OK: SmartStockSimulator importado correctamente")
        print(f"OK: {len(ETIQUETAS_REALES)} etiquetas reales configuradas")
        print(f"OK: Período de simulación: {FECHA_INICIO} → {FECHA_FIN}")
        
        # Crear instancia (sin ejecutar)
        simulator = SmartStockSimulator(database_url)
        print("OK: Simulador inicializado correctamente")
        
        await simulator.close()
        return True
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_simulator())
    if success:
        print("\nTodas las pruebas pasaron. El script está listo para usar.")
        print("\nPara ejecutar la simulación completa:")
        print("python backend/scripts/simulate_history.py")
    else:
        print("\nHay errores que deben corregirse.")
        sys.exit(1)