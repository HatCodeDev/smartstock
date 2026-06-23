import asyncio
import os
import sys
from datetime import date
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func, case
from app.models.ciclo import Ciclo
from app.models.evento import Evento, TipoEvento
from app.models.etiqueta import Etiqueta

# Import labels from simulator script
from scripts.simulate_history import ETIQUETAS_REALES

async def verify():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not found")
        return
    
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    elif database_url.startswith("sqlite://"):
        database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")

    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 1. Saturday-to-Monday sales ratio
        print("--- 1. VENTAS POR DÍA DE LA SEMANA ---")
        stmt = select(
            Ciclo.fecha,
            func.sum(case((Evento.tipo == TipoEvento.SALIDA, 1), else_=0)).label("salidas"),
            func.sum(case((Evento.tipo == TipoEvento.RETORNO, 1), else_=0)).label("retornos")
        ).join(Evento, Evento.ciclo_id == Ciclo.id).group_by(Ciclo.fecha).order_by(Ciclo.fecha)
        
        result = await session.execute(stmt)
        rows = result.all()
        
        saturday_sales = []
        monday_sales = []
        
        for r in rows:
            fecha_val = r.fecha
            # If date is datetime.date (standard) or string, handle it
            if isinstance(fecha_val, str):
                fecha_val = date.fromisoformat(fecha_val)
            
            sales = r.salidas - r.retornos
            weekday = fecha_val.weekday()
            
            if weekday == 5: # Saturday
                saturday_sales.append((fecha_val, sales))
            elif weekday == 0: # Monday
                monday_sales.append((fecha_val, sales))
                
        total_sat = sum(s for _, s in saturday_sales)
        total_mon = sum(s for _, s in monday_sales)
        
        avg_sat = total_sat / len(saturday_sales) if saturday_sales else 0
        avg_mon = total_mon / len(monday_sales) if monday_sales else 0
        
        ratio = avg_sat / avg_mon if avg_mon > 0 else 0
        print(f"Total Sábado ventas: {total_sat} (Promedio: {avg_sat:.2f})")
        print(f"Total Lunes ventas: {total_mon} (Promedio: {avg_mon:.2f})")
        print(f"Ratio Sábado/Lunes: {ratio:.3f}x")
        if 3.6 <= ratio <= 5.6:
            print("✅ El ratio Sábado/Lunes cumple el rango [3.6, 5.6]")
        else:
            print("❌ El ratio Sábado/Lunes NO cumple el rango [3.6, 5.6]")
            
        # 2. Holiday sales conversion rates
        print("\n--- 2. TASAS DE CONVERSIÓN EN FERIADOS ---")
        feriados = {
            date(2026, 5, 1): "1 de Mayo (Día del Trabajo)",
            date(2026, 5, 5): "5 de Mayo (Batalla de Puebla)",
            date(2026, 5, 8): "8 de Mayo (Pre-Madres)",
            date(2026, 5, 9): "9 de Mayo (Pre-Madres)",
            date(2026, 5, 10): "10 de Mayo (Día de las Madres)",
            date(2026, 5, 15): "15 de Mayo (Día del Maestro)"
        }
        
        for f_date, label in feriados.items():
            found = False
            for r in rows:
                fecha_val = r.fecha
                if isinstance(fecha_val, str):
                    fecha_val = date.fromisoformat(fecha_val)
                if fecha_val == f_date:
                    sales = r.salidas - r.retornos
                    conv = sales / r.salidas if r.salidas > 0 else 0
                    print(f"- {label} ({f_date}): Salidas={r.salidas}, Ventas={sales}, Conversión={conv:.2%}")
                    if conv > 0.501:
                        print("  ❌ Conversión excede 50%")
                    else:
                        print("  ✅ Conversión <= 50%")
                    found = True
                    break
            if not found:
                print(f"- {label} ({f_date}): No simulado (posiblemente omitido por regla del Día del Trabajo)")
                
        # 3. ETIQUETAS_REALES status
        print("\n--- 3. PROTECCIÓN DE ETIQUETAS REALES ---")
        stmt_tags = select(Etiqueta).where(Etiqueta.epc.in_(ETIQUETAS_REALES))
        res_tags = await session.execute(stmt_tags)
        db_tags = res_tags.scalars().all()
        
        inactive_real_tags = [t.epc for t in db_tags if not t.activa]
        print(f"Total etiquetas reales encontradas en DB: {len(db_tags)} / {len(ETIQUETAS_REALES)}")
        if inactive_real_tags:
            print(f"❌ Etiquetas reales inactivas ({len(inactive_real_tags)}): {inactive_real_tags}")
        else:
            print("✅ Todas las etiquetas reales están activas (activa = True)")
            
        # Check if they have events
        stmt_events = select(Evento).where(Evento.epc.in_(ETIQUETAS_REALES))
        res_events = await session.execute(stmt_events)
        db_events = res_events.scalars().all()
        if db_events:
            print(f"❌ Se encontraron eventos asociados a etiquetas reales ({len(db_events)} eventos!)")
        else:
            print("✅ No se encontraron eventos de movimiento para las etiquetas reales")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(verify())
