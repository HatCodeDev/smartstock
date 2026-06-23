from fpdf import FPDF
from datetime import datetime, timezone
import json

class PDFReportGenerator(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="Letter")
        self.set_margins(15, 20, 15)
        self.alias_nb_pages()
        
    def header(self):
        # Draw fine header
        self.set_font("helvetica", "B", 9)
        self.set_text_color(108, 92, 231)  # Violet Accent
        self.cell(0, 6, "SMARTSTOCK - REPORTE ANALÍTICO PREMIUM Y PLANIFICACIÓN", border=0, align="L")
        
        self.set_font("helvetica", "", 8)
        self.set_text_color(100, 116, 139)  # Slate Text
        fecha_str = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
        self.cell(0, 6, f"Emitido: {fecha_str}", border=0, align="R")
        self.ln(6)
        
        # Horizontal accent line
        self.set_draw_color(108, 92, 231)
        self.set_line_width(0.4)
        self.line(15, 25, 200, 25)
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, f"Página {self.page_no()} de {{nb}}", border=0, align="R")
        
        self.set_x(15)
        self.cell(0, 10, "SmartStock | Análisis Predictivo de Inventario | Datos Confidenciales del Negocio", border=0, align="L")

    def draw_card(self, title, val, desc, x, y, w, h, accent_color=(108, 92, 231)):
        # Draw outer card border and background
        self.set_draw_color(226, 232, 240)
        self.set_fill_color(248, 250, 252)
        self.rect(x, y, w, h, style="FD")
        
        # Draw left accent line
        self.set_fill_color(*accent_color)
        self.rect(x, y, 2.5, h, style="F")
        
        # Write content
        self.set_xy(x + 5, y + 3)
        self.set_font("helvetica", "B", 7.5)
        self.set_text_color(100, 116, 139)
        self.cell(w - 8, 4, title.upper(), ln=1)
        
        self.set_x(x + 5)
        self.set_font("helvetica", "B", 16)
        self.set_text_color(*accent_color)
        self.cell(w - 8, 7, str(val), ln=1)
        
        self.set_x(x + 5)
        self.set_font("helvetica", "", 7)
        self.set_text_color(100, 116, 139)
        self.multi_cell(w - 8, 3.2, desc)

    def draw_section_header(self, title, icon_color=(108, 92, 231)):
        self.ln(4)
        self.set_fill_color(241, 245, 249)
        self.set_draw_color(226, 232, 240)
        self.rect(15, self.get_y(), 185, 8, style="FD")
        
        # Accent indicator
        self.set_fill_color(*icon_color)
        self.rect(15, self.get_y(), 3.5, 8, style="F")
        
        self.set_x(21)
        self.set_font("helvetica", "B", 9)
        self.set_text_color(30, 41, 59)
        self.cell(180, 8, title, border=0, ln=1, align="L")
        self.ln(3)

    def generate_pdf(self, averages: dict, trends: list, holt_winters: dict, kmeans: dict, shifts_data: list = None, return_rates: list = None, transit_times: list = None) -> bytes:
        # Initial Setup
        self.add_page()
        
        # Title of the Report
        self.set_font("helvetica", "B", 18)
        self.set_text_color(30, 41, 59)
        self.cell(0, 10, "REPORTE ANALÍTICO DE NEGOCIOS", ln=1, align="L")
        self.set_font("helvetica", "", 9.5)
        self.set_text_color(100, 116, 139)
        self.cell(0, 5, "Consolidado de Inteligencia Artificial, Minería de Datos y Proyecciones Predictivas", ln=1, align="L")
        self.ln(5)
        
        # 1. Executive Summary Banners / Cards
        # Layout 3 cards horizontally
        y_start = self.get_y()
        
        # Card 1: Punto de Reorden
        critical_count = len(averages.get("critical_products", [])) if averages else 0
        self.draw_card(
            title="Productos en Riesgo de Agotarse",
            val=f"{critical_count} SKUs",
            desc="Requieren reabastecimiento inmediato.",
            x=15, y=y_start, w=58, h=25,
            accent_color=(239, 68, 68)  # Red Alert
        )
        
        # Card 2: Rendimiento Diario
        avg_pct = averages.get("diferencia_pct", 0.0) if averages else 0.0
        sign = "+" if avg_pct >= 0 else ""
        color = (34, 197, 94) if avg_pct >= 0 else (239, 68, 68)
        self.draw_card(
            title="Desempeño del Turno",
            val=f"{sign}{avg_pct}%",
            desc="Rendimiento del ciclo activo respecto al promedio histórico registrado para este mismo día.",
            x=78, y=y_start, w=58, h=25,
            accent_color=color
        )
        
        # Card 3: Productos Totales
        total_analizados = kmeans.get("datos", {}).get("total_productos_analizados", 0) if kmeans else 0
        self.draw_card(
            title="Catálogo Monitoreado",
            val=f"{total_analizados} SKUs",
            desc="Total de artículos activos segmentados y rastreados mediante RFID UHF.",
            x=142, y=y_start, w=58, h=25,
            accent_color=(108, 92, 231)  # Violet
        )
        
        self.set_y(y_start + 28)
        
        # 2. Real-Time Averages Analysis
        self.draw_section_header("I. RENDIMIENTO HISTÓRICO Y COMPARATIVO")
        if averages:
            self.set_font("helvetica", "", 8.5)
            self.set_text_color(51, 65, 85)
            self.write(5, "Hoy se registra un comportamiento del ciclo en estado ")
            self.set_font("helvetica", "B", 8.5)
            self.write(5, f"'{averages.get('dia_semana', 'N/A')}'")
            self.set_font("helvetica", "", 8.5)
            self.write(5, ". Históricamente, las ventas promedio para este día ascienden a ")
            self.set_font("helvetica", "B", 8.5)
            self.write(5, f"{averages.get('promedio_historico', 0.0)} unidades")
            self.set_font("helvetica", "", 8.5)
            self.write(5, ", mientras que en el transcurso del ciclo actual se han consolidado ")
            self.set_font("helvetica", "B", 8.5)
            self.write(5, f"{averages.get('ventas_hoy', 0)} unidades")
            self.set_font("helvetica", "", 8.5)
            self.write(5, f" ({abs(avg_pct)}% por {'arriba' if avg_pct >= 0 else 'debajo'} del histórico).\n")
            self.ln(2)
 
        # 3. Weekly Trends Table
        self.set_font("helvetica", "B", 8)
        self.set_text_color(71, 85, 105)
        self.cell(185, 5, "Tendencias de Venta por Categoría (Últimos 7 Días vs. Período Anterior):", ln=1)
        self.ln(1)
        
        # Table headers
        self.set_fill_color(226, 232, 240)
        self.set_font("helvetica", "B", 8)
        self.set_text_color(51, 65, 85)
        self.cell(50, 6, " Categoría de Producto", border=1, fill=True)
        self.cell(35, 6, " Ventas Act. (7d)", border=1, fill=True, align="C")
        self.cell(35, 6, " Ventas Ant. (7d)", border=1, fill=True, align="C")
        self.cell(35, 6, " Cambio Pct", border=1, fill=True, align="C")
        self.cell(30, 6, " Tendencia", border=1, fill=True, align="C", ln=1)
        
        self.set_font("helvetica", "", 8)
        if trends:
            for item in trends:
                self.cell(50, 5.5, f" {item.get('categoria', 'N/A')}", border=1)
                self.cell(35, 5.5, f"{item.get('ventas_actual', 0)} uds", border=1, align="C")
                self.cell(35, 5.5, f"{item.get('ventas_anterior', 0)} uds", border=1, align="C")
                pct = item.get('cambio_pct', 0.0)
                sign = "+" if pct > 0 else ""
                self.cell(35, 5.5, f"{sign}{pct}%", border=1, align="C")
                
                # Dynamic text color for trends
                tend = item.get('tendencia', 'STABLE')
                if tend == "UP":
                    self.set_text_color(34, 197, 94)
                elif tend == "DOWN":
                    self.set_text_color(239, 68, 68)
                else:
                    self.set_text_color(100, 116, 139)
                self.cell(30, 5.5, tend, border=1, align="C", ln=1)
                self.set_text_color(51, 65, 85)
        else:
            self.cell(185, 6, "Sin datos de tendencias disponibles.", border=1, align="C", ln=1)
        
        self.ln(2)
 
        # 4. Holt-Winters Projections (Demand Forecast)
        self.add_page()
        self.draw_section_header("II. PREDICCIÓN DE DEMANDA A 7 DÍAS (HOLT-WINTERS)")
        
        hw_datos = holt_winters.get("datos", {}) if holt_winters else {}
        insight_hw = hw_datos.get("mensaje_inteligente", "Analizando estacionalidad y volumen del catálogo...")
        
        self.set_fill_color(243, 244, 246)
        self.set_draw_color(245, 158, 11)  # Warning/Amber Accent
        self.set_line_width(0.5)
        self.rect(15, self.get_y(), 185, 10, style="FD")
        self.set_xy(17, self.get_y() + 2)
        self.set_font("helvetica", "B", 7.5)
        self.set_text_color(245, 158, 11)
        self.cell(30, 6, "PROYECCIÓN:")
        self.set_font("helvetica", "", 7.5)
        self.set_text_color(51, 65, 85)
        self.cell(150, 6, insight_hw, ln=1)
        self.ln(4)
        
        # Projections Table
        self.set_fill_color(226, 232, 240)
        self.set_font("helvetica", "B", 8)
        self.cell(45, 6, " Fecha de Proyección", border=1, fill=True)
        self.cell(45, 6, " Día de la Semana", border=1, fill=True, align="C")
        self.cell(45, 6, " Demanda Estimada (Unidades)", border=1, fill=True, align="C")
        self.cell(50, 6, " Nivel de Abastecimiento", border=1, fill=True, align="C", ln=1)
        
        self.set_font("helvetica", "", 8)
        fechas = hw_datos.get("fechas", [])
        pronosticos = hw_datos.get("pronostico_total", [])
        dias_semana_nombres = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
        
        if fechas:
            for idx, f in enumerate(fechas):
                val = pronosticos[idx] if idx < len(pronosticos) else 0
                date_obj = datetime.strptime(f, "%Y-%m-%d")
                dia_nombre = dias_semana_nombres[date_obj.weekday()]
                
                self.cell(45, 5.5, f" {f}", border=1)
                self.cell(45, 5.5, dia_nombre, border=1, align="C")
                self.cell(45, 5.5, f"{val} uds", border=1, align="C")
                
                if val > 30:
                    self.set_text_color(239, 68, 68)
                    abast = "Crítico (Demanda Alta)"
                elif val > 15:
                    self.set_text_color(245, 158, 11)
                    abast = "Moderado"
                else:
                    self.set_text_color(34, 197, 94)
                    abast = "Estable"
                self.cell(50, 5.5, abast, border=1, align="C", ln=1)
                self.set_text_color(51, 65, 85)
        else:
            self.cell(185, 6, "Historial insuficiente para alimentar el modelo Holt-Winters.", border=1, align="C", ln=1)
            
        self.ln(4)
        
        # Category Suggestion
        self.set_font("helvetica", "B", 8)
        self.set_text_color(71, 85, 105)
        self.cell(185, 5, "Sugerencia de Reorden e Incrementos por Categoría:", ln=1)
        self.ln(1)
        
        por_cat = hw_datos.get("por_categoria", {})
        self.set_fill_color(226, 232, 240)
        self.cell(90, 6, " Categoría de Vestimenta", border=1, fill=True)
        self.cell(95, 6, " Volumen de Abastecimiento Proyectado (Acumulado 7 Días)", border=1, fill=True, align="C", ln=1)
        
        self.set_font("helvetica", "", 8)
        if por_cat:
            for cat, vals in por_cat.items():
                total_cat = sum(vals)
                self.cell(90, 5.5, f" {cat}", border=1)
                self.cell(95, 5.5, f"{total_cat} unidades", border=1, align="C", ln=1)
        else:
            self.cell(185, 6, "Sin desglose de categorías disponible.", border=1, align="C", ln=1)
 
        # 5. K-Means Clustering (Inventory Health)
        self.draw_section_header("III. MATRIZ DE ROTACIÓN Y SALUD DE CATÁLOGO (K-MEANS)")
        
        km_datos = kmeans.get("datos", {}) if kmeans else {}
        insight_km = km_datos.get("mensaje_inteligente", "Clasificando liquidez y volumen del stock...")
        
        self.set_fill_color(243, 244, 246)
        self.set_draw_color(239, 68, 68)  # Danger/Red Accent
        self.set_line_width(0.5)
        self.rect(15, self.get_y(), 185, 10, style="FD")
        self.set_xy(17, self.get_y() + 2)
        self.set_font("helvetica", "B", 7.5)
        self.set_text_color(239, 68, 68)
        self.cell(30, 6, "INVENTARIO:")
        self.set_font("helvetica", "", 7.5)
        self.set_text_color(51, 65, 85)
        self.cell(150, 6, insight_km, ln=1)
        self.ln(4)
        
        clusters = km_datos.get("clusters", [])
        if clusters:
            for c in clusters:
                c_nombre = c.get("nombre", "Segmento")
                c_promedio = c.get("metrica_promedio_ventas", 0.0)
                c_descripcion = c.get("descripcion", "")
                skus = c.get("productos", [])
                
                # Segment Header
                self.set_font("helvetica", "B", 8.5)
                if c_nombre == "Alta Rotación":
                    self.set_text_color(34, 197, 94)
                elif c_nombre == "Rotación Media":
                    self.set_text_color(108, 92, 231)
                else:
                    self.set_text_color(239, 68, 68)
                    
                self.cell(185, 5, f"Clúster: {c_nombre} (Ventas Promedio: {c_promedio} uds) - {len(skus)} productos", ln=1)
                
                self.set_font("helvetica", "I", 7.5)
                self.set_text_color(100, 116, 139)
                self.multi_cell(185, 3.5, c_descripcion)
                self.ln(1)
                
                # Show top 5 products in this segment to keep the document concise
                self.set_fill_color(241, 245, 249)
                self.set_font("helvetica", "B", 7)
                self.set_text_color(51, 65, 85)
                self.cell(75, 4.5, " SKU - Nombre de Producto", border=1, fill=True)
                self.cell(40, 4.5, " Ventas Acumuladas", border=1, fill=True, align="C")
                self.cell(40, 4.5, " Existencias en Bodega", border=1, fill=True, align="C")
                self.cell(30, 4.5, " Estado de Alerta", border=1, fill=True, align="C", ln=1)
                
                self.set_font("helvetica", "", 7)
                top_skus = skus[:5]
                for p in top_skus:
                    self.cell(75, 4.2, f" {p.get('sku', 'N/A')} - {p.get('nombre', 'Producto')}", border=1)
                    self.cell(40, 4.2, f"{p.get('ventas', 0)} uds", border=1, align="C")
                    
                    stock = p.get('stock', 0)
                    self.cell(40, 4.2, f"{stock} uds", border=1, align="C")
                    
                    if stock < 3:
                        self.set_text_color(239, 68, 68)
                        alerta = "Reorden Crítico"
                    else:
                        self.set_text_color(100, 116, 139)
                        alerta = "Suficiente"
                    self.cell(30, 4.2, alerta, border=1, align="C", ln=1)
                    self.set_text_color(51, 65, 85)
                    
                if len(skus) > 5:
                    self.set_font("helvetica", "I", 6.5)
                    self.set_text_color(148, 163, 184)
                    self.cell(185, 4.5, f"... y otros {len(skus) - 5} productos en este clúster.", align="L", ln=1)
                    
                self.ln(2.5)
        else:
            self.cell(185, 6, "No hay agrupación K-Means disponible para reportar.", border=1, align="C", ln=1)
 
        # New Section IV: Return Rates and Transit Lead Times
        self.add_page()
        self.draw_section_header("IV. TASAS DE RETORNO DE EXHIBICIÓN Y TIEMPOS DE TRÁNSITO")
        
        self.set_font("helvetica", "B", 8.5)
        self.set_text_color(71, 85, 105)
        self.cell(185, 5, "Tasa de Retorno de Exhibición por Producto (Exhibition Return Rate):", ln=1)
        self.ln(1)
        
        self.set_fill_color(226, 232, 240)
        self.set_font("helvetica", "B", 7.5)
        self.cell(75, 6, " Producto (SKU)", border=1, fill=True)
        self.cell(35, 6, " Salidas Totales", border=1, fill=True, align="C")
        self.cell(35, 6, " Retornos Totales", border=1, fill=True, align="C")
        self.cell(40, 6, " Tasa de Retorno de Exhibición", border=1, fill=True, align="C", ln=1)
        
        self.set_font("helvetica", "", 7.5)
        if return_rates:
            for r in return_rates[:10]:  # Mostrar los primeros 10
                self.cell(75, 5.5, f" {r.get('nombre')} ({r.get('sku') or 'N/A'})", border=1)
                self.cell(35, 5.5, f"{r.get('total_salidas')} uds", border=1, align="C")
                self.cell(35, 5.5, f"{r.get('total_retornos')} uds", border=1, align="C")
                
                rate = r.get('return_rate', 0.0)
                if r.get('excede_umbral'):
                    self.set_text_color(239, 68, 68)  # Rojo crítico
                    rate_text = f"{rate}% (¡CRÍTICO!)"
                else:
                    self.set_text_color(51, 65, 85)
                    rate_text = f"{rate}%"
                self.cell(40, 5.5, rate_text, border=1, align="C", ln=1)
                self.set_text_color(51, 65, 85)
        else:
            self.cell(185, 6, "Sin datos de tasas de retorno de exhibición por prenda.", border=1, align="C", ln=1)
            
        self.ln(4)
        
        self.set_font("helvetica", "B", 8.5)
        self.set_text_color(71, 85, 105)
        self.cell(185, 5, "Tiempo de Tránsito Promedio por Categoría (Lead Time):", ln=1)
        self.ln(1)
        
        self.set_fill_color(226, 232, 240)
        self.set_font("helvetica", "B", 7.5)
        self.cell(90, 6, " Categoría de Prenda", border=1, fill=True)
        self.cell(50, 6, " Tiempo de Tránsito Promedio", border=1, fill=True, align="C")
        self.cell(45, 6, " Tránsitos Medidos", border=1, fill=True, align="C", ln=1)
        
        self.set_font("helvetica", "", 7.5)
        if transit_times:
            for t in transit_times:
                self.cell(90, 5.5, f" {t.get('categoria')}", border=1)
                hours = t.get('transit_lead_time_hours', 0.0)
                if hours >= 24:
                    days = round(hours / 24.0, 1)
                    time_text = f"{days} días ({hours} hrs)"
                else:
                    time_text = f"{hours} horas"
                self.cell(50, 5.5, time_text, border=1, align="C")
                self.cell(45, 5.5, f"{t.get('total_transitos_medidos')} uds", border=1, align="C", ln=1)
        else:
            self.cell(185, 6, "Sin datos de tiempo de tránsito por categoría.", border=1, align="C", ln=1)
            
        self.ln(4)
 
        # Section V: Turnos / Auditoría de Horarios
        if shifts_data:
            self.add_page()
            self.draw_section_header("V. AUDITORÍA Y ANÁLISIS DE TURNOS (MENSUAL)")
            
            y_start = self.get_y()
            # KPI Banners / Cards
            total_turnos = len(shifts_data)
            cierres_forzados = sum(1 for s in shifts_data if not s.get('kpi_cumplido'))
            
            self.draw_card(
                title="Turnos Auditados",
                val=f"{total_turnos} Turnos",
                desc="Total de ciclos de trabajo analizados en el transcurso del mes.",
                x=15, y=y_start, w=90, h=22,
                accent_color=(108, 92, 231) # Violet
            )
            
            self.draw_card(
                title="Cierres Forzados",
                val=f"{cierres_forzados} Ciclos",
                desc="Turnos que excedieron el límite de 12 horas o requirieron cierre automático.",
                x=110, y=y_start, w=90, h=22,
                accent_color=(245, 158, 11) # Amber
            )
            
            self.set_y(y_start + 25)
            
            # Table Header
            self.set_fill_color(226, 232, 240)
            self.set_font("helvetica", "B", 7.5)
            self.set_text_color(51, 65, 85)
            self.cell(22, 6, " Fecha", border=1, fill=True)
            self.cell(13, 6, " ID", border=1, fill=True, align="C")
            self.cell(45, 6, " Horario Activo (Inicio - Fin)", border=1, fill=True, align="C")
            self.cell(20, 6, " Salidas", border=1, fill=True, align="C")
            self.cell(20, 6, " Retornos", border=1, fill=True, align="C")
            self.cell(20, 6, " Alertas", border=1, fill=True, align="C")
            self.cell(45, 6, " Auditoría / Cumplimiento", border=1, fill=True, align="C", ln=1)
            
            # Table Rows
            self.set_font("helvetica", "", 7.5)
            for s in shifts_data:
                # Page break guard
                if self.get_y() > 240:
                    self.add_page()
                    # Redraw Table Header
                    self.set_fill_color(226, 232, 240)
                    self.set_font("helvetica", "B", 7.5)
                    self.set_text_color(51, 65, 85)
                    self.cell(22, 6, " Fecha", border=1, fill=True)
                    self.cell(13, 6, " ID", border=1, fill=True, align="C")
                    self.cell(45, 6, " Horario Activo (Inicio - Fin)", border=1, fill=True, align="C")
                    self.cell(20, 6, " Salidas", border=1, fill=True, align="C")
                    self.cell(20, 6, " Retornos", border=1, fill=True, align="C")
                    self.cell(20, 6, " Alertas", border=1, fill=True, align="C")
                    self.cell(45, 6, " Auditoría / Cumplimiento", border=1, fill=True, align="C", ln=1)
                    self.set_font("helvetica", "", 7.5)
 
                self.cell(22, 5.5, f" {s['fecha']}", border=1)
                self.cell(13, 5.5, f"{s['id']}", border=1, align="C")
                
                # TIMESTAMPS format safely
                creado_dt = datetime.fromisoformat(s['creado_en']) if isinstance(s.get('creado_en'), str) else s.get('creado_en')
                cerrado_dt = datetime.fromisoformat(s['cerrado_en']) if isinstance(s.get('cerrado_en'), str) else s.get('cerrado_en')
                
                creado = creado_dt.strftime("%H:%M") if creado_dt else "N/A"
                cerrado = cerrado_dt.strftime("%H:%M") if cerrado_dt else "Activo"
                self.cell(45, 5.5, f"{creado} - {cerrado}", border=1, align="C")
                
                self.cell(20, 5.5, f"{s['salidas']} uds", border=1, align="C")
                self.cell(20, 5.5, f"{s['retornos']} uds", border=1, align="C")
                self.cell(20, 5.5, f"{s['alertas_count']} alertas", border=1, align="C")
                
                if s.get('kpi_cumplido'):
                    self.set_text_color(34, 197, 94) # Green
                    kpi_text = "CUMPLIDO"
                elif s.get('cierre_automatico') or (s.get('duracion_segundos') and s['duracion_segundos'] >= 12 * 3600):
                    self.set_text_color(245, 158, 11) # Amber
                    kpi_text = "CIERRE FORZADO"
                else:
                    self.set_text_color(100, 116, 139) # Slate
                    kpi_text = "ABIERTO"
                
                self.cell(45, 5.5, kpi_text, border=1, align="C", ln=1)
                self.set_text_color(51, 65, 85)
 
        # Output the PDF as binary stream bytes
        return self.output(dest="S")

pdf_report_service = PDFReportGenerator()
