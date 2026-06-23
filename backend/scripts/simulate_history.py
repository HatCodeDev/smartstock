#!/usr/bin/env python3
"""
SmartStock - Script de Simulación Histórica de Alta Fidelidad v2
================================================================

MODELO CORRECTO: 1 etiqueta RFID = 1 unidad física.
- cantidad_inicial de un Producto = número de etiquetas activas de ese SKU.
- Al vender 1 unidad: se desactiva ESE tag específico y se decrementa en 1.
- Al reponer: se crean tags nuevos y se incrementa cantidad_inicial.

USO:
    python backend/scripts/simulate_history.py

CONFIGURACIÓN:
    Modificá la constante FECHA_FIN para controlar hasta qué día simula.
    Ejemplo: FECHA_FIN = date(2026, 5, 25)  ← termina el 25 de mayo
"""

import asyncio
import os
import random
import sys
from datetime import date, datetime, timedelta, time, timezone
from pathlib import Path
from typing import List, Dict, Tuple
from dotenv import load_dotenv

# Agregar el directorio backend al path para imports
sys.path.append(str(Path(__file__).parent.parent))

# Asegurar que stdout y stderr usen codificación UTF-8 en cualquier terminal (especialmente Windows)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.database import Base
from app.models import (
    Configuracion, Producto, Etiqueta, Ciclo, EstadoCiclo, ModoPortal,
    Evento, TipoEvento, Alerta, TipoAlerta, BatchProcesado,
    ReporteAvanzado, TipoReporteAvanzado
)

# =============================================================================
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║               CONFIGURACIÓN — EDITÁ AQUÍ PARA CAMBIAR FECHAS           ║
# ╚══════════════════════════════════════════════════════════════════════════╝
# =============================================================================

FECHA_INICIO = date(2026, 5, 1)   # Primer día de simulación

# ↓ Cambiá esta línea para terminar antes o después ↓
FECHA_FIN    = date(2026, 6, 5)  # Último día de simulación (inclusive)
# ─────────────────────────────────────────────────────────────────────────────
# Ejemplos:
#   FECHA_FIN = date(2026, 5, 25)   ← termina el 25 de mayo
#   FECHA_FIN = date(2026, 5, 15)   ← termina el 15 de mayo
#   FECHA_FIN = date(2026, 6, 30)   ← simula hasta junio
# =============================================================================

# Etiquetas RFID reales del hardware físico (19 tags)
ETIQUETAS_REALES = [
    'E28069150000401CFAE6CA1E',
    'E28069150000501CFAE6B61E',
    'E28069150000401CFAE6B21E',
    'E28069150000401CFAE6C61E',
    'E28069150000402009022A2F',
    'E28069150000501CFAE6BA1E',
    'E28069150000401CFAE60A1E',
    'E28069150000401CFAE63A1E',
    'E28069150000501CFAE62A1E',
    'E28069150000501CFAE6321E',
    'E28069150000401CFAE62E1E',
    'E28069150000401CFAE6361E',
    'E28069150000501CFAE6261E',
    'E28069150000401CFAE61E1E',
    'E28069150000501CFAE60E1E',
    'E28069150000401CFAE6121E',
    'E28069150000401CFAE6221E',
    'E28069150000501CFAE6161E',
    'E28069150000501CFAE61A1E'
]

# Prefijo para etiquetas simuladas (evita colisiones con reales)
FAKE_TAG_PREFIX = "E28069159999FFFF"

# =============================================================================
# CATÁLOGO DE SKUS (25 productos únicos del tianguis de blancos)
# Cada SKU tendrá 20-40 unidades físicas (tags) al inicio.
# =============================================================================

CATALOGO_SKUS = {
    "Sábanas": [
        "Sábana de cajón matrimonial",
        "Sábana de cajón individual",
        "Sábana plana matrimonial",
        "Sábana con elástico king size",
        "Funda de almohada estándar",
    ],
    "Toallas": [
        "Toalla de baño grande",
        "Toalla de baño mediana",
        "Toalla de manos",
        "Toalla facial",
        "Toalla de playa",
    ],
    "Manteles": [
        "Mantel rectangular 150x200",
        "Mantel individual",
        "Camino de mesa",
        "Servilleta de tela",
    ],
    "Cojines": [
        "Cojín decorativo 40x40",
        "Almohada estándar",
        "Cubrecama matrimonial",
    ],
    "Batas y Pijamas": [
        "Bata de baño adulto",
        "Pijama de algodón dama",
        "Pijama de algodón caballero",
    ],
    "Blancos Baño": [
        "Tapete de baño antiderrapante",
        "Cortina de baño",
        "Edredón matrimonial",
    ],
    "Cocina": [
        "Paño de cocina",
        "Mandil de cocina",
        "Trapo multiusos",
    ],
}

# Unidades iniciales por SKU (rango realista para un puesto de tianguis)
UNIDADES_INICIALES_MIN = 6
UNIDADES_INICIALES_MAX = 12

# Unidades que llegan en cada reposición semanal por SKU bajo stock
REPOSICION_UNIDADES_MIN = 3
REPOSICION_UNIDADES_MAX = 7

# Umbral de stock mínimo por producto
STOCK_MINIMO_DEFAULT = 5

# Configuración de ventas por día de semana (% de unidades que NO retornan = ventas)
# Ratio máx/mín ~2x.
PATRONES_VENTA = {
    0: 0.14,  # Lunes   - 14%
    1: 0.10,  # Martes  - 10%
    2: 0.20,  # Miércoles - 20%
    3: 0.12,  # Jueves  - 12%
    4: 0.20,  # Viernes - 20%
    5: 0.25,  # Sábado  - 25%
    6: 0.25,  # Domingo - 25%
}

# Configuración de salidas por día de semana (% de stock activo que sale a tránsito/exhibición)
PATRONES_SALIDA = {
    0: (0.12, 0.20),  # Lunes
    1: (0.12, 0.20),  # Martes
    2: (0.20, 0.30),  # Miércoles
    3: (0.15, 0.25),  # Jueves
    4: (0.20, 0.30),  # Viernes
    5: (0.30, 0.40),  # Sábado
    6: (0.30, 0.40),  # Domingo
}


# Clasificación de SKUs para comportamiento analítico a voluntad (K-Means)
SKUS_ALTA_ROTACION = [
    "Sábana de cajón matrimonial",
    "Funda de almohada estándar",
    "Toalla de baño grande",
    "Toalla de manos",
    "Mandil de cocina",
    "Paño de cocina"
]

SKUS_ROTACION_MEDIA = [
    "Sábana de cajón individual",
    "Sábana plana matrimonial",
    "Toalla de baño mediana",
    "Toalla facial",
    "Mantel rectangular 150x200",
    "Mantel individual",
    "Camino de mesa",
    "Cojín decorativo 40x40",
    "Cubrecama matrimonial",
    "Pijama de algodón dama",
    "Pijama de algodón caballero",
    "Tapete de baño antiderrapante"
]


# =============================================================================
# CLASE PRINCIPAL DEL SIMULADOR
# =============================================================================

class SmartStockSimulator:
    """
    Simulador de datos históricos para SmartStock.

    Modelo de datos correcto:
    ─────────────────────────
    - Producto (SKU): representa un tipo de artículo (ej: "Toalla de baño grande").
      Su `cantidad_inicial` refleja cuántas unidades físicas activas tiene.
    - Etiqueta (tag RFID): representa UNA unidad física con su chip único.
      Activa = está en stock. Inactiva = fue vendida.
    - Evento: un tag específico entró o salió. 1 evento = 1 unidad física.
    """

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.engine = create_async_engine(database_url, echo=False)
        self.async_session = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

        # Contador para generar EPCs únicos
        self.fake_tag_counter = 1
        self.batch_counter = 1

        # Cache de SKUs y sus unidades activas (tags)
        # productos_sku: dict[uuid] → Producto
        self.productos_sku: Dict = {}
        # tags_activos: list de Etiqueta activas en stock
        self.tags_activos: List[Etiqueta] = []
        # tags_reales_epc: set de EPCs reales ya usados
        self.tags_reales_usados = set()

        self.fechas_anomalias = self._generar_fechas_anomalias()

        print("SmartStock Simulator v2 inicializado")
        print(f"Período: {FECHA_INICIO} → {FECHA_FIN}")
        print(f"Días a simular: {(FECHA_FIN - FECHA_INICIO).days + 1}")
        print(f"SKUs en catálogo: {sum(len(v) for v in CATALOGO_SKUS.values())}")
        print(f"Etiquetas reales disponibles: {len(ETIQUETAS_REALES)}")

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _generar_fake_tag(self) -> str:
        """Genera un EPC único para una unidad física simulada."""
        correlativo = f"{self.fake_tag_counter:08X}"
        self.fake_tag_counter += 1
        return f"{FAKE_TAG_PREFIX}{correlativo}"

    def _generar_sku_code(self, nombre: str, idx: int) -> str:
        """Genera un código SKU legible basado en el nombre."""
        prefijo = "".join(c for c in nombre.upper() if c.isalpha())[:3]
        return f"{prefijo}{idx:04d}"

    def _generar_fechas_anomalias(self) -> Dict:
        """Genera fechas aleatorias para inyectar anomalías realistas."""
        fechas = []
        current = FECHA_INICIO
        while current <= FECHA_FIN:
            fechas.append(current)
            current += timedelta(days=1)
        random.shuffle(fechas)
        n = len(fechas)
        return {
            'tag_desconocida':    fechas[:max(1, n // 8)],
            'movimiento_duplicado': fechas[max(1, n // 8): max(2, n // 5)]
        }

    def _calcular_porcentaje_venta(self, fecha: date) -> float:
        """Porcentaje de unidades salidas que se venden (no retornan) con feriados de México."""
        dia = fecha.weekday()
        porcentaje = PATRONES_VENTA[dia]
        
        # --- Feriados y Festividades Mexicanas ---
        # 1 de Mayo: Día del Trabajo (Gran actividad en tianguis)
        if fecha == date(2026, 5, 1):
            porcentaje = 0.40
        # 5 de Mayo: Batalla de Puebla (Actividad media-alta)
        elif fecha == date(2026, 5, 5):
            porcentaje = 0.25
        # Pre-Día de las Madres (8 y 9 de Mayo: Furor extremo de compras de manteles, colchas, batas de regalo)
        elif fecha in [date(2026, 5, 8), date(2026, 5, 9)]:
            porcentaje = 0.45
        # 10 de Mayo: Día de las Madres (Ventas pico absolutas, pero se abre temprano y se cierra a mediodía)
        elif fecha == date(2026, 5, 10):
            porcentaje = 0.50
        # 15 de Mayo: Día del Maestro (Movimiento extra en blancos)
        elif fecha == date(2026, 5, 15):
            porcentaje = 0.30
            
        return porcentaje

    # -------------------------------------------------------------------------
    # Fase 0: Recrear base de datos
    # -------------------------------------------------------------------------

    async def recrear_base_datos(self):
        """Borra y recrea todas las tablas."""
        print("🗑️  Borrando tablas existentes...")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        print("🏗️  Creando tablas nuevas...")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Base de datos recreada exitosamente")

    # -------------------------------------------------------------------------
    # Fase 1: Crear inventario inicial (SKUs + unidades físicas con tags)
    # -------------------------------------------------------------------------

    async def crear_inventario_inicial(self):
        """
        Crea los SKUs del catálogo y asigna unidades físicas con tags RFID.
        Regla: 1 etiqueta = 1 unidad física → cantidad_inicial = len(tags activos)
        """
        print("📦 Creando inventario inicial...")

        async with self.async_session() as session:
            sku_idx = 1
            real_tag_pool = list(ETIQUETAS_REALES)  # copia para asignar de a 1

            for categoria, nombres in CATALOGO_SKUS.items():
                for nombre in nombres:
                    n_unidades = random.randint(UNIDADES_INICIALES_MIN, UNIDADES_INICIALES_MAX)

                    producto = Producto(
                        nombre=nombre,
                        sku=self._generar_sku_code(nombre, sku_idx),
                        categoria=categoria,
                        cantidad_inicial=n_unidades,
                        stock_minimo=STOCK_MINIMO_DEFAULT,
                        activo=True
                    )
                    session.add(producto)
                    await session.flush()  # 1 flush para obtener producto.id

                    # Crear 1 tag RFID por unidad física — bulk add, 1 flush por SKU
                    tags_batch = []
                    for u in range(n_unidades):
                        # Usar tag real si queda disponible para las primeras unidades
                        if real_tag_pool and u == 0:
                            epc = real_tag_pool.pop(0)
                        else:
                            epc = self._generar_fake_tag()

                        etiqueta = Etiqueta(
                            epc=epc,
                            producto_id=producto.id,
                            activa=True,
                            asignada_en=datetime.combine(FECHA_INICIO, time(6, 0), timezone.utc).replace(tzinfo=None)
                        )
                        session.add(etiqueta)
                        tags_batch.append(etiqueta)

                    await session.flush()  # 1 flush para todas las tags del SKU
                    self.tags_activos.extend(tags_batch)

                    self.productos_sku[producto.id] = producto
                    sku_idx += 1

            await session.commit()

        total_skus = len(self.productos_sku)
        total_tags = len(self.tags_activos)
        print(f"✅ {total_skus} SKUs creados — {total_tags} unidades físicas en stock")
        print(f"🏷️  {len(ETIQUETAS_REALES) - len(real_tag_pool)} etiquetas reales asignadas")

    # -------------------------------------------------------------------------
    # Fase 2: Reposición semanal (lunes)
    # -------------------------------------------------------------------------

    async def reponer_stock(self, fecha: date):
        """
        Agrega unidades físicas nuevas (tags) a los SKUs con stock bajo.
        Simula un embarque de proveedor cada lunes.
        """
        print(f"🚛 Reposición de proveedor ({fecha.strftime('%d/%m/%Y')})...")

        async with self.async_session() as session:
            total_repuesto = 0

            for prod_id, producto in self.productos_sku.items():
                merged = await session.get(Producto, prod_id)
                if not merged:
                    continue

                # Solo reponer si el stock cayó al 50% del inicial o menos (10 unidades o menos)
                if merged.cantidad_inicial > UNIDADES_INICIALES_MIN // 2:
                    continue

                n_nuevas = random.randint(REPOSICION_UNIDADES_MIN, REPOSICION_UNIDADES_MAX)

                tags_batch = []
                for _ in range(n_nuevas):
                    epc = self._generar_fake_tag()
                    etiqueta = Etiqueta(
                        epc=epc,
                        producto_id=prod_id,
                        activa=True,
                        asignada_en=datetime.combine(fecha, time(6, 0), timezone.utc).replace(tzinfo=None)
                    )
                    session.add(etiqueta)
                    tags_batch.append(etiqueta)

                await session.flush()  # 1 flush por SKU repuesto
                self.tags_activos.extend(tags_batch)

                merged.cantidad_inicial += n_nuevas
                merged.activo = True  # Reactivar producto
                
                # Sincronizar caché
                producto.cantidad_inicial = merged.cantidad_inicial
                producto.activo = True
                total_repuesto += n_nuevas

            await session.commit()

        if total_repuesto:
            print(f"   ✅ {total_repuesto} unidades repuestas en stock bajo")
        else:
            print(f"   ℹ️  Stock saludable — sin necesidad de reposición")

    # -------------------------------------------------------------------------
    # Fase 3: Jornada diaria
    # -------------------------------------------------------------------------

    async def simular_jornada_diaria(self, fecha: date):
        """
        Simula una jornada completa.

        Unidad de trabajo: ETIQUETA (tag) = 1 unidad física.
        - SALIDA: se registra el EPC del tag que sale.
        - RETORNO: se registra el EPC del tag que vuelve.
        - VENTA: el tag que NO retorna se desactiva → stock decrementa 1.
        """
        print(f"📅 Simulando jornada: {fecha.strftime('%d/%m/%Y')} ({fecha.strftime('%A')})")

        async with self.async_session() as session:
            # Decidir el comportamiento del ciclo para cumplir con las expectativas del usuario:
            # - KPI CUMPLIDO: manual y duración < 12h (~90%)
            # - CIERRE FORZADO (límite tiempo): manual y duración >= 12h (~7%)
            # - CIERRE FORZADO (scheduler): automático, a las 23:00 (~3%)
            rand_type = random.random()
            if fecha == date(2026, 5, 10):
                # Día de la Madre abrimos temprano y cerramos temprano
                es_cierre_manual = True
                excede_12h = False
            elif fecha == date(2026, 5, 1):
                # Día del Trabajo: abrimos temprano y cerramos temprano
                es_cierre_manual = True
                excede_12h = False
            elif rand_type < 0.90:
                es_cierre_manual = True
                excede_12h = False
            elif rand_type < 0.97:
                es_cierre_manual = True
                excede_12h = True
            else:
                es_cierre_manual = False
                excede_12h = True

            # ── APERTURA ────────────────────────────────────────────────────
            # Apertura según feriados mexicanos y picos de ventas
            if fecha in [date(2026, 5, 1), date(2026, 5, 8), date(2026, 5, 9)]:
                # Madrugadores para capturar el gran flujo de clientes
                hora_apertura = time(5, 0)
            elif fecha == date(2026, 5, 10):
                # Día de la Madre abrimos normal pero temprano
                hora_apertura = time(6, 0)
            else:
                if excede_12h:
                    hora_apertura = time(
                        hour=random.randint(5, 6),
                        minute=random.randint(0, 30)
                    )
                else:
                    hora_apertura = time(
                        hour=random.randint(8, 9),
                        minute=random.randint(0, 59)
                    )
            timestamp_apertura = datetime.combine(fecha, hora_apertura, timezone.utc)

            ciclo = Ciclo(
                estado=EstadoCiclo.ABIERTO,
                modo_portal=ModoPortal.SALIDA,
                fecha=fecha,
                creado_en=timestamp_apertura.replace(tzinfo=None),
                cierre_automatico=False
            )
            session.add(ciclo)
            await session.flush()

            print(f"  🌅 Apertura: {hora_apertura.strftime('%H:%M')}")

            # ── SALIDA — selección de unidades físicas (tags) ────────────────
            # Trabajamos con tags activos (unidades en stock).
            # Las etiquetas RFID reales NUNCA se venden: se preservan activas
            # para poder pasarlas por el portal físico después de la simulación.
            EPCS_REALES = set(ETIQUETAS_REALES)
            tags_en_stock = [t for t in self.tags_activos if t.activa and t.epc not in EPCS_REALES]

            if not tags_en_stock:
                print("  ⚠️  Sin stock disponible — jornada sin movimientos")
                es_cierre_manual = random.random() < 0.75
                if es_cierre_manual:
                    # En cierre manual sin movimientos, cerramos temprano (por ejemplo, a las 18:00)
                    timestamp_cierre = datetime.combine(fecha, time(18, 0), timezone.utc)
                    ciclo.cierre_automatico = False
                else:
                    # En cierre automático, a las 23:00
                    timestamp_cierre = datetime.combine(fecha, time(23, 0), timezone.utc)
                    ciclo.cierre_automatico = True
                
                ciclo.estado = EstadoCiclo.CERRADO
                ciclo.cerrado_en = timestamp_cierre.replace(tzinfo=None)
                ciclo.modo_portal = ModoPortal.APAGADO
                await session.commit()
                return

            # Calcular porcentaje de salidas dinámicas según día de la semana o festividades
            dia_semana = fecha.weekday()
            es_dia_especial = (
                fecha == date(2026, 5, 1) or  # Día del Trabajo
                fecha == date(2026, 5, 5) or  # Batalla de Puebla
                fecha in [date(2026, 5, 8), date(2026, 5, 9), date(2026, 5, 10)] or  # Temporada Día de las Madres
                fecha == date(2026, 5, 15)    # Día del Maestro
            )
            
            if es_dia_especial:
                # Boost del ~50% sobre el patrón normal del día, sin exceder el máximo.
                # Así un martes especial pasa de 12-20% a 18-30%, no a 65%.
                base_min, base_max = PATRONES_SALIDA[dia_semana]
                min_sal = min(base_min * 1.5, 0.65)
                max_sal = min(base_max * 1.5, 0.70)
            else:
                min_sal, max_sal = PATRONES_SALIDA[dia_semana]
                
            porcentaje_salida = random.uniform(min_sal, max_sal)
            n_salidas = max(1, int(len(tags_en_stock) * porcentaje_salida))

            porcentaje_venta = self._calcular_porcentaje_venta(fecha)
            # El total de vendidos diario está dictado por el patrón estacional (Holt-Winters)
            n_vendidos = int(n_salidas * porcentaje_venta)
            # --- SELECCIÓN CONTROLADA A VOLUNTAD (K-Means & Holt-Winters) ---
            # Agrupamos los tags disponibles en stock por producto_id
            from collections import defaultdict
            tags_por_producto = defaultdict(list)
            for t in tags_en_stock:
                tags_por_producto[t.producto_id].append(t)

            # Mapeo de nombre de producto a producto_id
            prod_name_to_id = {p.nombre: p.id for p in self.productos_sku.values()}

            tags_vendidos = []
            tags_vendidos_set = set()

            # Clasificación de IDs según rotación deseada (K-Means)
            alta_ids = [prod_name_to_id[n] for n in SKUS_ALTA_ROTACION if n in prod_name_to_id]
            media_ids = [prod_name_to_id[n] for n in SKUS_ROTACION_MEDIA if n in prod_name_to_id]
            baja_ids = [pid for pid in self.productos_sku.keys() if pid not in alta_ids and pid not in media_ids]

            # Seleccionar los vendidos según comportamiento a voluntad en días activos
            if n_vendidos > 0:
                # 1. Ventas de Alta Rotación (70% del volumen diario)
                limite_alta = int(n_vendidos * 0.70)
                while len(tags_vendidos) < limite_alta:
                    disponibles = [pid for pid in alta_ids if len(tags_por_producto[pid]) > 0]
                    if not disponibles:
                        break
                    pid = random.choice(disponibles)
                    tag = tags_por_producto[pid].pop(0)
                    tags_vendidos.append(tag)
                    tags_vendidos_set.add(tag.epc)

                # 2. Ventas de Rotación Media (25% del volumen en días pico)
                es_dia_pico = fecha.weekday() in [2, 4, 5, 6]
                pct_media = 0.25 if es_dia_pico else 0.05
                limite_media = int(n_vendidos * pct_media)
                
                media_vendidos_count = 0
                while len(tags_vendidos) < (n_vendidos - 1) and media_vendidos_count < limite_media:
                    disponibles = [pid for pid in media_ids if len(tags_por_producto[pid]) > 0]
                    if not disponibles:
                        break
                    pid = random.choice(disponibles)
                    tag = tags_por_producto[pid].pop(0)
                    tags_vendidos.append(tag)
                    tags_vendidos_set.add(tag.epc)
                    media_vendidos_count += 1

                # 3. Ventas de Baja Rotación (alimenta K-Means con recencia 15-25 días)
                # Ocurren raramente para mantener el stock inactivo estable
                if random.random() < 0.05:
                    disponibles_baja = [pid for pid in baja_ids if len(tags_por_producto[pid]) > 0]
                    if disponibles_baja:
                        pid = random.choice(disponibles_baja)
                        tag = tags_por_producto[pid].pop(0)
                        tags_vendidos.append(tag)
                        tags_vendidos_set.add(tag.epc)

            # Rellenar o recortar para cumplir exactamente con n_vendidos
            # Rellenamos prioritariamente con Alta Rotación para consolidar su perfil RFV
            while len(tags_vendidos) < n_vendidos:
                disponibles_alta = [pid for pid in alta_ids if len(tags_por_producto[pid]) > 0]
                if disponibles_alta:
                    pid = random.choice(disponibles_alta)
                    tag = tags_por_producto[pid].pop(0)
                    tags_vendidos.append(tag)
                    tags_vendidos_set.add(tag.epc)
                else:
                    restantes = [pid for pid, lst in tags_por_producto.items() if len(lst) > 0]
                    if not restantes:
                        break
                    pid = random.choice(restantes)
                    tag = tags_por_producto[pid].pop(0)
                    tags_vendidos.append(tag)
                    tags_vendidos_set.add(tag.epc)

            # Recortar si nos pasamos
            if len(tags_vendidos) > n_vendidos:
                tags_vendidos = tags_vendidos[:n_vendidos]
                tags_vendidos_set = {t.epc for t in tags_vendidos}

            # Definir retornos y salidas generales
            n_retornos = max(0, n_salidas - len(tags_vendidos))
            tags_restantes_libres = [t for t in tags_en_stock if t.epc not in tags_vendidos_set]

            if len(tags_restantes_libres) >= n_retornos:
                tags_retorno = random.sample(tags_restantes_libres, n_retornos)
            else:
                tags_retorno = list(tags_restantes_libres)

            tags_salida = tags_vendidos + tags_retorno
            n_salidas = len(tags_salida)

            # --- REGISTRAR EVENTOS DE SALIDA EN DB ---
            batch_id_salida = f"BATCH_SALIDA_{fecha.strftime('%Y%m%d')}_{self.batch_counter}"
            self.batch_counter += 1

            for idx, tag in enumerate(tags_salida):
                # Sumamos un offset secuencial de 100ms a cada tag para simular el paso físico continuo
                # por el portal y asegurar que el ordenamiento de base de datos mantenga los combos contiguos
                timestamp_esp32_offset = int(timestamp_apertura.timestamp() * 1000) + (idx * 100)

                evento = Evento(
                    epc=tag.epc,
                    ciclo_id=ciclo.id,
                    tipo=TipoEvento.SALIDA,
                    producto_id=tag.producto_id,
                    batch_id=batch_id_salida,
                    timestamp_servidor=(timestamp_apertura + timedelta(minutes=random.randint(0, 30))).replace(tzinfo=None),
                    timestamp_esp32=timestamp_esp32_offset
                )
                session.add(evento)

            print(f"  📤 {n_salidas} unidades salieron ({n_salidas} eventos)")

            # ── RETORNO ──────────────────────────────────────────────────────
            # Cierre/Retorno según festividades mexicanas y eventos
            if fecha == date(2026, 5, 10):
                # Día de la Madre: se cierra súper temprano (13:00) para celebrar en familia
                hora_retorno = time(13, 0)
            elif fecha == date(2026, 5, 1):
                # Día del Trabajo: tianguis reduce horario (14:00)
                hora_retorno = time(14, 0)
            elif fecha in [date(2026, 5, 8), date(2026, 5, 9)]:
                # Día antes del día de la madre (furor), abrimos temprano, cerramos normal pero cuidamos no pasar 12h
                hora_retorno = time(
                    hour=16,
                    minute=random.randint(0, 30)
                )
            elif fecha == date(2026, 5, 12):
                hora_retorno = time(14, 15)
            else:
                if excede_12h:
                    hora_retorno = time(
                        hour=random.randint(18, 19),
                        minute=random.randint(30, 59)
                    )
                else:
                    hora_retorno = time(
                        hour=random.randint(16, 17),
                        minute=random.randint(0, 59)
                    )
            timestamp_retorno = datetime.combine(fecha, hora_retorno, timezone.utc)
            ciclo.modo_portal = ModoPortal.RETORNO

            print(f"  🌆 Retorno: {hora_retorno.strftime('%H:%M')}")

            # --- REGISTRAR EVENTOS DE RETORNO EN DB ---
            batch_id_retorno = f"BATCH_RETORNO_{fecha.strftime('%Y%m%d')}_{self.batch_counter}"
            self.batch_counter += 1

            for idx, tag in enumerate(tags_retorno):
                # Offset incremental para retornos
                timestamp_esp32_offset = int(timestamp_retorno.timestamp() * 1000) + (idx * 100)

                evento = Evento(
                    epc=tag.epc,
                    ciclo_id=ciclo.id,
                    tipo=TipoEvento.RETORNO,
                    producto_id=tag.producto_id,
                    batch_id=batch_id_retorno,
                    timestamp_servidor=(timestamp_retorno + timedelta(minutes=random.randint(0, 45))).replace(tzinfo=None),
                    timestamp_esp32=timestamp_esp32_offset
                )
                session.add(evento)

            print(f"  📥 {len(tags_retorno)} unidades retornaron")
            print(f"  💰 {n_vendidos} unidades vendidas ({porcentaje_venta:.0%})")

            # ── ANOMALÍAS ────────────────────────────────────────────────────
            await self._inyectar_anomalias(session, ciclo, fecha, timestamp_retorno)

            # ── CIERRE — desactivar tags vendidos y actualizar stock ─────────
            if es_cierre_manual:
                # Cierre manual ocurre poco después del retorno (entre 5 y 25 minutos)
                minutos_despues = random.randint(5, 25)
                timestamp_cierre = timestamp_retorno + timedelta(minutes=minutos_despues)
                ciclo.cierre_automatico = False
                tipo_cierre_str = "MANUALMENTE"
            else:
                # Cierre automático ocurre a las 23:00
                timestamp_cierre = datetime.combine(fecha, time(23, 0), timezone.utc)
                ciclo.cierre_automatico = True
                tipo_cierre_str = "AUTOMÁTICAMENTE"

            ciclo.estado = EstadoCiclo.CERRADO
            ciclo.cerrado_en = timestamp_cierre.replace(tzinfo=None)
            ciclo.modo_portal = ModoPortal.APAGADO

            # Contar cuántos tags vendidos hay por producto
            vendidos_por_producto: Dict = {}
            for tag in tags_vendidos:
                pid = tag.producto_id
                vendidos_por_producto[pid] = vendidos_por_producto.get(pid, 0) + 1

            # Desactivar tags vendidos — BULK UPDATE en lugar de N selects individuales.
            # Primero actualizamos el caché en memoria, luego un solo UPDATE por lote.
            epcs_vendidos = [tag.epc for tag in tags_vendidos]

            # Actualizar caché en memoria
            epcs_vendidos_set = set(epcs_vendidos)
            for tag in tags_vendidos:
                tag.activa = False
            self.tags_activos = [t for t in self.tags_activos if t.epc not in epcs_vendidos_set]

            # Bulk UPDATE en la DB (1 query para todos los tags vendidos del día)
            if epcs_vendidos:
                from sqlalchemy import update as sa_update
                await session.execute(
                    sa_update(Etiqueta)
                    .where(Etiqueta.epc.in_(epcs_vendidos))
                    .values(activa=False)
                    .execution_options(synchronize_session=False)
                )

            # Actualizar cantidad_inicial por producto — 1 query por SKU afectado
            for prod_id, cant in vendidos_por_producto.items():
                db_prod = await session.get(Producto, prod_id)
                if db_prod:
                    db_prod.cantidad_inicial = max(0, db_prod.cantidad_inicial - cant)
                    if db_prod.cantidad_inicial == 0:
                        db_prod.activo = False
                    # Sincronizar caché
                    if prod_id in self.productos_sku:
                        self.productos_sku[prod_id].cantidad_inicial = db_prod.cantidad_inicial
                        self.productos_sku[prod_id].activo = db_prod.activo

            await session.commit()
            print(f"  🔒 Ciclo cerrado {tipo_cierre_str} a las {ciclo.cerrado_en.strftime('%H:%M')} — Stock actualizado")

            # ── ANALÍTICA AVANZADA ───────────────────────────────────────────
            try:
                from app.services.advanced_report_service import advanced_report_service
                await advanced_report_service.generar_reportes_avanzados_ciclo(ciclo.id, session)
                await session.commit()
                print(f"  🧠 Analítica avanzada generada para el día {fecha.strftime('%d/%m/%Y')}")
            except Exception as e:
                print(f"  ❌ Error generando analítica: {e}")
                await session.rollback()

    # -------------------------------------------------------------------------
    # Inyección de anomalías
    # -------------------------------------------------------------------------

    async def _inyectar_anomalias(self, session: AsyncSession, ciclo: Ciclo,
                                  fecha: date, timestamp_base: datetime):
        """Inyecta alertas de anomalía en fechas programadas."""

        if fecha in self.fechas_anomalias['tag_desconocida']:
            epc_random = "A1B2C3D4E5F67890ABCDEF12"
            alerta = Alerta(
                tipo=TipoAlerta.TAG_DESCONOCIDA,
                descripcion="EPC desconocido detectado en el sistema",
                epc=epc_random,
                ciclo_id=ciclo.id,
                timestamp=(timestamp_base + timedelta(minutes=random.randint(10, 60))).replace(tzinfo=None),
                revisada=False
            )
            session.add(alerta)
            print(f"  ⚠️  TAG_DESCONOCIDA: {epc_random}")

        if fecha in self.fechas_anomalias['movimiento_duplicado']:
            if ETIQUETAS_REALES:
                epc_dup = random.choice(ETIQUETAS_REALES)
                alerta = Alerta(
                    tipo=TipoAlerta.MOVIMIENTO_DUPLICADO,
                    descripcion=f"Movimiento duplicado detectado para EPC {epc_dup}",
                    epc=epc_dup,
                    ciclo_id=ciclo.id,
                    timestamp=(timestamp_base + timedelta(minutes=random.randint(5, 30))).replace(tzinfo=None),
                    revisada=False
                )
                session.add(alerta)
                print(f"  ⚠️  MOVIMIENTO_DUPLICADO: {epc_dup}")

    # -------------------------------------------------------------------------
    # Orquestador principal
    # -------------------------------------------------------------------------

    async def ejecutar_simulacion_completa(self):
        """Orquesta la simulación completa del período configurado."""
        dias_total = (FECHA_FIN - FECHA_INICIO).days + 1

        print("🎬 Iniciando simulación histórica completa")
        print("=" * 60)

        # 1. Recrear base de datos
        await self.recrear_base_datos()

        # 2. Inventario inicial
        await self.crear_inventario_inicial()

        # 3. Simular cada jornada del período
        current_date = FECHA_INICIO
        while current_date <= FECHA_FIN:
            # 1 de Mayo: Día del Trabajo (Feriado oficial - Sin labores)
            if current_date == date(2026, 5, 1):
                print(f"📅 {current_date.strftime('%d/%m/%Y')}: Día del Trabajo (Feriado Oficial - Sin Labores)")
                current_date += timedelta(days=1)
                continue

            # Reposición de proveedor cada lunes (excepto el primer día)
            if current_date.weekday() == 0 and current_date != FECHA_INICIO:
                await self.reponer_stock(current_date)

            await self.simular_jornada_diaria(current_date)
            current_date += timedelta(days=1)

        # 4. Configuración por defecto (idempotente)
        async with self.async_session() as session:
            stmt = select(Configuracion).where(Configuracion.id == 1)
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                session.add(Configuracion(id=1, hora_cierre_auto="23:00", umbral_retorno_critico=80.0))
            else:
                existing.umbral_retorno_critico = 80.0
            await session.commit()

        # 5. Resumen
        tags_activos_final = len([t for t in self.tags_activos if t.activa])
        tags_total = self.fake_tag_counter - 1 + len(ETIQUETAS_REALES)

        print("=" * 60)
        print("🎉 Simulación completada exitosamente")
        print(f"📊 Estadísticas finales:")
        print(f"   • SKUs únicos:         {len(self.productos_sku)}")
        print(f"   • Unidades en stock:   {tags_activos_final} (de {tags_total} totales)")
        print(f"   • Período simulado:    {dias_total} días ({FECHA_INICIO} → {FECHA_FIN})")
        print("🚀 La base de datos está lista para producción")

    async def close(self):
        """Cierra las conexiones de base de datos."""
        await self.engine.dispose()


# =============================================================================
# FUNCIÓN PRINCIPAL
# =============================================================================

async def main():
    """Función principal del script."""
    load_dotenv()

    database_url = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ ERROR: DATABASE_URL o DIRECT_URL no encontrada en el archivo .env")
        return 1

    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    elif database_url.startswith("sqlite://"):
        database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")

    if not (database_url.startswith("postgresql+asyncpg://") or database_url.startswith("sqlite+aiosqlite://")):
        print("❌ ERROR: La base de datos debe ser PostgreSQL o SQLite")
        return 1

    simulator = None
    try:
        simulator = SmartStockSimulator(database_url)
        await simulator.ejecutar_simulacion_completa()
        return 0
    except Exception as e:
        print(f"❌ ERROR durante la simulación: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        if simulator:
            await simulator.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)