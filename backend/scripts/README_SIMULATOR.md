# SmartStock - Script de Simulación Histórica

## Descripción

Script asíncrono independiente que genera datos históricos de alta fidelidad para SmartStock del **01 al 31 de Mayo de 2026**. Simula un puesto de blancos en tianguis mexicano con patrones realistas de negocio.

## Características Principales

### 🏷️ Manejo de Etiquetas RFID
- **19 etiquetas reales** del hardware físico integradas
- **Etiquetas fake** con prefijo seguro `E28069159999FFFF` (evita colisiones)
- Asignación automática: etiquetas reales a productos "estrella"

### 📊 Motor de Datos Realista
- **60 productos** en lote base inicial (01 Mayo)
- **Embarques de proveedor** cada 7 días (15-25 productos nuevos)
- **Catálogo dinámico**: 120-150 productos al final del período

### 🔄 Ciclos Diarios Completos
- **SALIDA** (05:00-06:00 AM): 40%-80% del inventario
- **RETORNO** (17:00-18:00 PM): productos no vendidos regresan
- **CIERRE** (23:00 PM): automático, descuenta stock vendido

### 📈 Patrones de Venta
- **Lun-Mar**: 10% ventas
- **Miércoles**: 35% ventas  
- **Jue-Vie**: 20-30% ventas
- **Sáb-Dom**: 75% ventas
- **Día de las Madres** (8-10 Mayo): 95% ventas

### ⚠️ Anomalías para Minería de Datos
- **TAG_DESCONOCIDA**: EPCs aleatorios no registrados
- **MOVIMIENTO_DUPLICADO**: Lecturas duplicadas de etiquetas

### 🛒 Reglas de Asociación
- **Combo Cama**: Sábana cajón + plana + funda (70%)
- **Combo Baño**: Toalla baño + manos + tapete (60%)  
- **Combo Mesa**: Mantel + servilletas + camino (50%)

## Uso

### Requisitos Previos
```bash
cd backend
pip install -r requirements.txt
```

### Configurar Base de Datos
Verificar que existe `.env` con:
```
DATABASE_URL=postgresql://user:pass@host:port/dbname
```

### Ejecutar Simulación
```bash
python backend/scripts/simulate_history.py
```

### Test Rápido
```bash
python backend/scripts/test_quick.py
```

## Eventos Especiales

| Fecha | Evento | Comportamiento |
|-------|--------|---------------|
| 08 Mayo | Pre-Día Madres | Apertura 07:30 AM, ventas 95% |
| 10 Mayo | Día de las Madres | Cierre temprano 15:00, ventas 95% |
| 12 Mayo | Día de lluvia | Cierre forzado 14:15 por clima |

## Estructura de Datos Generada

### Productos (120-150)
```python
{
    "nombre": "Sábana de cajón matrimonial Premium",
    "categoria": "Sábanas", 
    "sku": "SAB0001",
    "cantidad_inicial": 5,
    "activo": True
}
```

### Etiquetas (~300-400)
```python
{
    "epc": "E28069150000401CFAE6CA1E",  # Real
    "epc": "E28069159999FFFF00000001",  # Fake
    "producto_id": "uuid-here",
    "activa": True
}
```

### Eventos (~15,000-20,000)
```python
{
    "epc": "E28069150000401CFAE6CA1E",
    "tipo": "SALIDA|RETORNO", 
    "ciclo_id": 15,
    "timestamp_servidor": "2026-05-15T08:30:00Z"
}
```

### Alertas (~30-50)
```python
{
    "tipo": "TAG_DESCONOCIDA|MOVIMIENTO_DUPLICADO",
    "descripcion": "EPC desconocido detectado...",
    "epc": "E28069150000401CFAE6CA1E"
}
```

## Resultado Final

Al completar la simulación tendrás:
- **31 ciclos diarios** completos y cerrados
- **Dataset perfecto** para análisis predictivo
- **Patrones realistas** de comportamiento de negocio  
- **Base de datos lista** para producción con SmartStock

## Notas Técnicas

- **Transacciones atómicas**: Cada día se procesa en una sola transacción
- **Batching**: Eventos agrupados por lotes como en hardware real
- **Timestamps**: Precisos con zona horaria UTC
- **Deduplicación**: Evita conflictos entre etiquetas reales y fake
- **Escalabilidad**: El catálogo crece orgánicamente con el tiempo

¡La base de datos quedará lista para comenzar operaciones en vivo desde Junio 2026!

---

## 🔄 Repoblamiento Seguro en Supabase (Producción / Pruebas)

Al haber eliminado la lógica y columna de `horas_max_transito`, es necesario reflejar estos cambios en tu base de datos de producción/pruebas de **Supabase**. Seguí estos pasos en orden para asegurar que los datos antiguos no tengan discrepancias de esquema:

### Paso 1: Limpieza del Esquema Existente (SQL Editor en Supabase)
Si deseás conservar los datos y solo eliminar la columna obsoleta de forma segura, ejecutá esta consulta en el **SQL Editor** de Supabase:
```sql
ALTER TABLE configuracion DROP COLUMN IF EXISTS horas_max_transito;
```

**Si preferís resetear la base de datos completa para poblarla desde cero con la simulación limpia (Recomendado):**
Ejecutá lo siguiente en el SQL Editor para eliminar todas las tablas viejas:
```sql
DROP TABLE IF EXISTS alertas CASCADE;
DROP TABLE IF EXISTS eventos CASCADE;
DROP TABLE IF EXISTS etiquetas CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS ciclos CASCADE;
DROP TABLE IF EXISTS configuracion CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS batches_procesados CASCADE;
```

### Paso 2: Regenerar Tablas
Reiniciá o redesplegá tu backend en **Render**. Al arrancar con el nuevo código, la función `Base.metadata.create_all` volverá a crear todas las tablas automáticamente en Supabase con el esquema 100% depurado y correcto.

### Paso 3: Volver a Ejecutar la Simulación
Una vez que el backend haya levantado y recreado el esquema vacío, ejecutá el script de simulación localmente apuntando a Supabase para cargar el nuevo dataset corregido:
```bash
python backend/scripts/simulate_history.py
```
*(Asegúrate de que tu archivo `.env` en la carpeta `backend/` contenga la URL de base de datos `DATABASE_URL` de Supabase apuntando al pooler correcto).*

---

## 📊 Arquitectura de Reportes Seleccionada (Opción B)

Para garantizar la estabilidad y rendimiento del MVP dentro de los límites del tier gratuito de **Render** (512MB RAM) y **Supabase** (500MB storage), hemos adoptado la siguiente estrategia para el módulo de Reportes Analíticos Avanzados:

### Cómputo Pre-calculado y Cacheado
Los algoritmos analíticos pesados (FP-Growth, K-Means RFM, y predicción temporal) **no se ejecutarán al vuelo con cada petición HTTP** (lo cual saturaría el CPU y RAM de Render hasta causar crasheos OOM).

1. **Momento de Ejecución**: La minería de datos avanzada se procesa en el backend únicamente una vez al día cuando se ejecuta la llamada a `cierre_diario` (ya sea por el scheduler o cierre manual).
2. **Persistencia**: El resultado estructurado se almacena como un único bloque serializado en formato JSON en una tabla optimizada de reportes/analíticas.
3. **Consulta del Dashboard**: Al cargar la pestaña de reportes, el frontend (Vanilla JS) hace una petición GET instantánea que lee este JSON pre-calculado, garantizando latencia ultra baja, cero sobrecarga del servidor y consumo óptimo de tu tier gratuito.

¡Esta estructura robusta nos permitirá experimentar con algoritmos avanzados de manera segura y profesional!