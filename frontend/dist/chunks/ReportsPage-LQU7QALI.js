import{a as T,b as C}from"./chunk-55AWPCXK.js";import{b as E}from"./chunk-VBOOU2QQ.js";function M(k,s=20){return k?k.length<=s?k:k.slice(0,s)+"...":""}function j(k){return k?/[Z+\-]\d*$/.test(String(k).trim())?new Date(k):new Date(String(k).trim()+"Z"):null}var R=class extends E{constructor(s){super(s),this.state={activeTab:"supply",criticalProducts:[],trends:[],fpGrowthReport:null,holtWintersReport:null,kmeansReport:null,shiftsReport:null,selectedMonth:(()=>{let i=new Date,g=i.getFullYear(),l=String(i.getMonth()+1).padStart(2,"0");return`${g}-${l}`})(),selectedDayShifts:null,selectedDayDate:null,isLoading:!1,error:null,isMobile:window.innerWidth<=768,selectedCategory:"all"},this.handleResize=this.handleResize.bind(this)}fetchReportData(){this.setState({isLoading:!0,error:null}),Promise.all([C.get("/products/critical").catch(s=>(console.error("Error fetching critical products:",s),[])),C.get("/reports/trends").catch(s=>(console.error("Error fetching trends:",s),[])),C.get("/reports/advanced?tipo=HOLT_WINTERS").catch(s=>(console.error("Error fetching HOLT_WINTERS report:",s),null)),C.get("/reports/advanced?tipo=K_MEANS").catch(s=>(console.error("Error fetching K_MEANS report:",s),null)),C.get("/reports/products/return-rates").catch(s=>(console.error("Error fetching return rates:",s),[])),C.get("/reports/categories/transit-lead-times").catch(s=>(console.error("Error fetching transit times:",s),[]))]).then(([s,i,g,l,y,h])=>{this.setState({criticalProducts:s,trends:i,fpGrowthReport:null,holtWintersReport:g,kmeansReport:l,returnRates:y,transitTimes:h,isLoading:!1})}).catch(s=>{this.setState({isLoading:!1,error:s.message||"Error al cargar los datos del reporte"})})}fetchShiftsData(s){let i=s||this.state.selectedMonth;this.setState({isLoading:!0,error:null}),C.get(`/reports/shifts?month=${i}`).then(g=>{this.setState({shiftsReport:g,selectedDayShifts:null,selectedDayDate:null,isLoading:!1})}).catch(g=>{this.setState({isLoading:!1,error:g.message||"Error al cargar el an\xE1lisis de turnos"})})}handleResize(){let s=window.innerWidth<=768;s!==this.state.isMobile&&this.setState({isMobile:s})}onMount(){this.element.querySelectorAll(".reports-tab-btn").forEach(o=>{o.addEventListener("click",m=>{m.preventDefault();let d=o.getAttribute("data-tab");d&&d!==this.state.activeTab&&(this.setState({activeTab:d}),d==="turnos"&&this.state.shiftsReport===null&&this.fetchShiftsData())})});let i=this.element.querySelector("#shifts-month-picker");i&&i.addEventListener("change",o=>{this.setState({selectedMonth:o.target.value}),this.fetchShiftsData(o.target.value)}),this.element.querySelectorAll(".heatmap-cell:not(.cell-none)").forEach(o=>{o.addEventListener("click",()=>{let m=o.getAttribute("data-date"),d=(this.state.shiftsReport||[]).filter(c=>c.fecha===m);this.element.querySelectorAll(".heatmap-cell").forEach(c=>c.classList.remove("active-cell")),o.classList.add("active-cell"),this.setState({selectedDayDate:m,selectedDayShifts:d})})});let l=this.element.querySelector("#export-report-btn");l&&l.addEventListener("click",async()=>{try{l.disabled=!0,l.innerHTML=`
            <div class="loading-spinner" style="border: 2px solid rgba(255, 255, 255, 0.1); border-top: 2px solid var(--text); border-radius: 50%; width: 14px; height: 14px; animation: spin 1s linear infinite; display: inline-block; vertical-align: middle;"></div>
            <span>Generando PDF...</span>
          `;let o=localStorage.getItem(T.TOKEN_KEY),m={};o&&(m.Authorization=`Bearer ${o}`);let d=`${T.API_BASE_URL}/reports/download/pdf`,c=await fetch(d,{method:"GET",headers:m});if(!c.ok)throw new Error("No se pudo generar el reporte PDF.");let r=await c.blob(),t=window.URL.createObjectURL(r),e=document.createElement("a");e.href=t,e.download="Reporte_Analitico_SmartStock.pdf",document.body.appendChild(e),e.click(),e.remove(),window.URL.revokeObjectURL(t)}catch(o){console.error(o),alert("Error al descargar el reporte anal\xEDtico: "+o.message)}finally{l.disabled=!1,l.innerHTML=`
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Exportar PDF/CSV</span>
          `}}),this.state.activeTab!=="turnos"&&!this.state.holtWintersReport&&!this.state.kmeansReport&&!this.state.isLoading?this.fetchReportData():this.state.activeTab==="turnos"&&this.state.shiftsReport===null&&!this.state.isLoading&&this.fetchShiftsData(),window.addEventListener("resize",this.handleResize),this.element.addEventListener("click",o=>{let m=o.target.closest(".accordion-header");if(m){let d=m.closest(".accordion-card");if(d){let c=d.classList.contains("expanded");d.classList.toggle("expanded");let r=d.querySelector(".accordion-arrow");r&&(r.style.transform=c?"rotate(0deg)":"rotate(180deg)")}}}),this.element.addEventListener("click",o=>{let m=o.target.closest(".product-name-truncated");if(m){let d=m.getAttribute("data-full-text"),c=this.element.querySelector("#product-detail-modal"),r=this.element.querySelector("#product-detail-modal-body");c&&r&&(r.innerHTML=`
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div>
                <span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; display: block; margin-bottom: 0.25rem;">Nombre Completo:</span>
                <strong style="font-size: 1.2rem; color: var(--text);">${d}</strong>
              </div>
            </div>
          `,c.style.display="flex")}});let y=this.element.querySelector("#close-product-detail-modal"),h=this.element.querySelector("#btn-close-product-detail-modal-ok"),p=this.element.querySelector("#product-detail-modal"),b=()=>{p&&(p.style.display="none")};y&&y.addEventListener("click",b),h&&h.addEventListener("click",b),p&&p.addEventListener("click",o=>{o.target===p&&b()})}dispose(){window.removeEventListener("resize",this.handleResize)}render(){let{activeTab:s,isLoading:i,error:g}=this.state,l=this.state.criticalProducts?this.state.criticalProducts.length:0,y=this.state.trends||[],h=0;y.length>0&&(h=y.reduce((d,c)=>d+c.cambio_pct,0)/y.length,h=Math.round(h*10)/10);let p=h>=0,b=p?"+":"",o=p?"var(--success)":"var(--danger)";return`
      <div class="reports-page" style="animation: fadeIn 0.4s ease-out;">
        <!-- Encabezado de la p\xE1gina -->
        <header class="reports-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.875rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text);">Reportes del Negocio</h1>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 0.25rem;">An\xE1lisis predictivo e insights de alto valor de forma m\xF3vil-friendly.</p>
          </div>
          <button class="btn btn-secondary" id="export-report-btn" style="display: flex; align-items: center; gap: 0.5rem; background: var(--surface); border: 1px solid var(--border); padding: 0.75rem 1.25rem; border-radius: 0.875rem; cursor: pointer; color: var(--text); font-weight: 600; transition: all 0.2s ease;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Exportar PDF/CSV</span>
          </button>
        </header>

        <!-- Fila de Umbrales Cr\xEDticos / An\xE1lisis en Tiempo Real -->
        <div class="reports-critical-row stats-grid" style="margin-bottom: 2rem;">
          <div class="stat-card" style="display: flex; flex-direction: column; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem;">
            <div class="stat-header" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
              <span class="stat-title" style="color: var(--text-muted); font-size: 0.875rem; font-weight: 600;">Productos en Riesgo de Agotarse</span>
              <div class="stat-icon-wrapper ${l===0?"color-success":"color-danger"}" style="background: ${l===0?"rgba(34, 197, 94, 0.1)":"rgba(239, 68, 68, 0.1)"}; padding: 0.5rem; border-radius: 0.75rem; color: ${l===0?"var(--success)":"var(--danger)"}; display: flex; align-items: center; justify-content: center;">
                ${l===0?`
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                    <path d="m9 12 2 2 4-4"></path>
                  </svg>
                `:`
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                `}
              </div>
            </div>
            <div style="margin-top: 1rem;">
              <div class="stat-value" style="color: ${l===0?"var(--success)":"var(--danger)"}; font-size: 2.25rem; font-weight: 800; line-height: 1.1;">${l} SKU${l!==1?"s":""}</div>
              <span class="stat-trend" style="color: var(--text-muted); font-weight: normal; margin-top: 0.5rem; font-size: 0.85rem; display: block;">
                ${l===0?"Sin riesgos detectados":"Requieren reabastecimiento inmediato"}
              </span>
            </div>
          </div>

          <div class="stat-card" style="display: flex; flex-direction: column; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem;">
            <div class="stat-header" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
              <span class="stat-title" style="color: var(--text-muted); font-size: 0.875rem; font-weight: 600;">Tendencia de Ventas (7d)</span>
              <div class="stat-icon-wrapper ${p?"color-success":"color-danger"}" style="background: ${p?"rgba(34, 197, 94, 0.1)":"rgba(239, 68, 68, 0.1)"}; padding: 0.5rem; border-radius: 0.75rem; color: ${o}; display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  ${p?`
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                    <polyline points="17 6 23 6 23 12"></polyline>
                  `:`
                    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
                    <polyline points="17 18 23 18 23 12"></polyline>
                  `}
                </svg>
              </div>
            </div>
            <div style="margin-top: 1rem;">
              <div class="stat-value" style="color: ${o}; font-size: 2.25rem; font-weight: 800; line-height: 1.1;">${b}${h}%</div>
              <span class="stat-trend" style="color: var(--text-muted); font-weight: normal; margin-top: 0.5rem; font-size: 0.85rem; display: flex; align-items: center; gap: 0.25rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: ${o};">
                  ${p?'<polyline points="18 15 12 9 6 15"></polyline>':'<polyline points="6 9 12 15 18 9"></polyline>'}
                </svg>
                Respecto a la semana anterior
              </span>
            </div>
          </div>
        </div>

        <div class="reports-tabs-container" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border); margin-bottom: 2rem; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none;">
          <button class="reports-tab-btn ${s==="supply"?"active":""}" data-tab="supply" style="white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; background: none; border: none; padding: 0.75rem 1.25rem; color: var(--text-muted); font-weight: 600; cursor: pointer; transition: all 0.2s ease; border-bottom: 2px solid transparent;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
            <span>Planificaci\xF3n de Compras</span>
          </button>
          <button class="reports-tab-btn ${s==="health"?"active":""}" data-tab="health" style="white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; background: none; border: none; padding: 0.75rem 1.25rem; color: var(--text-muted); font-weight: 600; cursor: pointer; transition: all 0.2s ease; border-bottom: 2px solid transparent;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6.01" y2="6"></line>
              <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
            <span>Salud de Inventario</span>
          </button>
          <button class="reports-tab-btn ${s==="turnos"?"active":""}" data-tab="turnos" style="white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; background: none; border: none; padding: 0.75rem 1.25rem; color: var(--text-muted); font-weight: 600; cursor: pointer; transition: all 0.2s ease; border-bottom: 2px solid transparent;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Auditor\xEDa de Turnos</span>
          </button>
        </div>

        <!-- Contenedor Principal (Panel de Contenido) -->
        <div class="reports-tab-content glass" style="padding: 2rem; border-radius: 1.25rem; border: 1px solid var(--border); background: rgba(26, 26, 36, 0.6); backdrop-filter: blur(20px); min-height: 350px; display: flex; flex-direction: column;">
          ${i?`
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex-grow: 1; min-height: 250px; width: 100%;">
              <div class="loading-spinner" style="border: 3px solid rgba(108, 92, 231, 0.1); border-top: 3px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
              <span style="color: var(--text-muted); font-weight: 600; font-size: 0.95rem;">Analizando base de datos SmartStock...</span>
            </div>
          `:g?`
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex-grow: 1; text-align: center; padding: 2rem;">
              <div style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border-radius: 50%; padding: 1rem; margin-bottom: 1rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text);">Error al cargar an\xE1lisis</h3>
              <p style="color: var(--text-muted); max-width: 400px; font-size: 0.9rem; margin-bottom: 1.5rem;">${g}</p>
              <button class="btn btn-primary" onclick="window.location.reload();" style="background: var(--primary); border: none; padding: 0.75rem 1.5rem; border-radius: 0.75rem; color: var(--text); font-weight: 600; cursor: pointer;">Reintentar</button>
            </div>
          `:this.renderTabContent(s)}
        </div>



        <!-- Modal de detalle de producto truncado -->
        <div class="modal-overlay" id="product-detail-modal" style="display: none;">
          <div class="modal-content glass" style="max-width: 400px; width: 90%;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; margin-bottom: 1rem;">
              <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text); margin: 0;">Detalle del Producto</h2>
              <button class="btn btn-secondary glass" id="close-product-detail-modal" style="padding: 0.25rem 0.5rem; font-size: 1.25rem; line-height: 1; border: none; background: none; color: var(--text-muted); cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" id="product-detail-modal-body" style="color: var(--text); font-size: 1rem; line-height: 1.5; padding: 0.5rem 0;">
              <!-- Se llenar\xE1 din\xE1micamente -->
            </div>
            <div class="modal-footer" style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
              <button class="btn btn-primary" id="btn-close-product-detail-modal-ok">Aceptar</button>
            </div>
          </div>
        </div>
      </div>
    `}renderTabContent(s){if(s==="supply"){let i=this.state.holtWintersReport,g=i&&i.datos&&i.datos.fechas?i.datos.fechas:[],l=i&&i.datos&&i.datos.pronostico_total?i.datos.pronostico_total:[],y=i&&i.datos&&i.datos.por_categoria?i.datos.por_categoria:{},h=i&&i.datos?i.datos.mensaje_inteligente:"Analizando historial de demanda diaria...",p=l.length>0?Math.max(...l):100,b=l.map((t,e)=>{let n=g[e]||"",a="",x="";if(n){let u=new Date(n+"T00:00:00");a=u.toLocaleDateString("es-ES",{weekday:"short"}),x=u.getDate()}let v=Math.max(12,Math.round(t/p*100));return`
          <div style="display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; justify-content: flex-end; position: relative;" class="bar-container">
            <!-- Valor en hover -->
            <div style="background: var(--text); border: 1px solid var(--border); padding: 0.25rem 0.5rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 800; color: var(--surface); margin-bottom: 0.5rem; pointer-events: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" class="bar-value">
              ${t}
            </div>
            <!-- Columna -->
            <div style="height: ${v}%; width: 60%; max-width: 32px; background: linear-gradient(180deg, var(--primary) 0%, rgba(108, 92, 231, 0.4) 100%); border-radius: 0.5rem 0.5rem 0 0; transition: all 0.2s ease; cursor: pointer; box-shadow: 0 4px 12px rgba(108, 92, 231, 0.2);" class="bar-column"></div>
            <!-- Etiqueta de D\xEDa -->
            <div style="margin-top: 0.75rem; text-align: center; display: flex; flex-direction: column; gap: 0.15rem;">
              <span style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">${a}</span>
              <span style="font-size: 0.85rem; color: var(--text); font-weight: 800;">${x}</span>
            </div>
          </div>
        `}).join(""),o=[];for(let t in y){let e=y[t].reduce((n,a)=>n+a,0);o.push({cat:t,sumVal:e})}o.sort((t,e)=>e.sumVal-t.sumVal);let m=o.length>0?Math.max(...o.map(t=>t.sumVal)):100,d=this.state.selectedCategory&&this.state.selectedCategory!=="all"?o.filter(t=>t.cat===this.state.selectedCategory):o,c=d.map(t=>{let e=Math.max(10,Math.round(t.sumVal/m*100));return`
          <div style="display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem 0;">
            <div style="display: flex; justify-content: space-between; font-size: 0.875rem; font-weight: 600;">
              <span style="color: var(--text);">${t.cat}</span>
              <span style="color: var(--primary); font-weight: 700;">${t.sumVal} unidades estimadas</span>
            </div>
            <!-- Barra de Progreso Lineal -->
            <div style="background: rgba(255, 255, 255, 0.05); height: 6px; border-radius: 3px; width: 100%; overflow: hidden;">
              <div style="background: linear-gradient(90deg, var(--primary) 0%, var(--success) 100%); height: 100%; border-radius: 3px; width: ${e}%; transition: width 0.3s ease;"></div>
            </div>
          </div>
        `}).join(""),r=d.map((t,e)=>{let n=Math.max(10,Math.round(t.sumVal/m*100)),a='<span class="badge badge-success">Bajo</span>';return t.sumVal>15&&(a='<span class="badge badge-warning">Medio</span>'),t.sumVal>30&&(a='<span class="badge badge-primary">Alto</span>'),`
          <div class="accordion-card" data-index="supply-cat-${e}">
            <div class="accordion-header">
              <div style="display: flex; flex-direction: column; gap: 0.15rem; text-align: left;">
                <strong style="color: var(--text); font-size: 0.95rem;">${t.cat}</strong>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Estimado: ${t.sumVal} unidades</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                ${a}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="accordion-arrow" style="transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <div class="accordion-details">
              <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.85rem; color: var(--text-muted); text-align: left;">
                <div style="display: flex; justify-content: space-between;">
                  <span>Volumen Sugerido:</span>
                  <strong style="color: var(--text);">${t.sumVal} unidades</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Nivel de Prioridad:</span>
                  <strong style="color: var(--text);">${t.sumVal>30?"ALTO REORDEN":t.sumVal>15?"MEDIO REORDEN":"MANTENER STOCK"}</strong>
                </div>
                <div style="margin-top: 0.25rem;">
                  <span style="display: block; margin-bottom: 0.35rem;">Porcentaje de Demanda Total:</span>
                  <div style="background: rgba(255, 255, 255, 0.05); height: 6px; border-radius: 3px; width: 100%; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, var(--primary) 0%, var(--success) 100%); height: 100%; border-radius: 3px; width: ${n}%; transition: width 0.3s ease;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `}).join("");return`
        <div class="tab-pane-container" style="animation: fadeIn 0.3s ease-out; display: flex; flex-direction: column; gap: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
            <div style="background: rgba(34, 197, 94, 0.1); padding: 0.75rem; border-radius: 1rem; color: var(--success); display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
            </div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Planificaci\xF3n de Compras (Abastecimiento)</h2>
              <p style="color: var(--text-muted); font-size: 0.875rem;">Modelado predictivo de demanda semanal mediante el algoritmo Holt-Winters (Triple Suavizado Exponencial).</p>
            </div>
          </div>

          <!-- Mensaje Inteligente / Insight de Demanda -->
          <div class="alert-box glass" style="border-left: 4px solid var(--warning); padding: 1.25rem; border-radius: 0.875rem; background: rgba(245, 158, 11, 0.03);">
            <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
              <div style="color: var(--warning); display: flex; align-items: center; justify-content: center; margin-top: 0.15rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div>
                <strong style="color: var(--text); display: block; margin-bottom: 0.25rem; font-size: 0.95rem;">Planificaci\xF3n Predictiva de Stock</strong>
                <span style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.45;">
                  ${h}
                </span>
              </div>
            </div>
          </div>

          <!-- Layout Gr\xE1fico -->
          ${g.length>0?`
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; flex-wrap: wrap; align-items: stretch; margin-top: 0.5rem;" class="supply-grid">
              
              <!-- Tarjeta de Gr\xE1fica CSS de Ventas Totales Proyectadas -->
              <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
                <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  Proyecci\xF3n Diaria (Pr\xF3ximos 7 D\xEDas)
                </h3>
                
                <!-- Bar chart: desktop only -->
                <div class="desktop-only chart-scroll-container">
                  <div style="height: 180px; display: flex; align-items: flex-end; gap: 0.75rem; border-bottom: 2px solid var(--text-muted); padding-bottom: 0.25rem; margin-top: 1rem; padding-top: 1.5rem; min-width: 480px;" class="graph-area">
                    ${b}
                  </div>
                </div>

                <!-- Day-list: mobile only (no overflow) -->
                <div class="mobile-only projection-day-list">
                  ${l.map((t,e)=>{let n=g[e]||"",a="",x="";if(n){let f=new Date(n+"T00:00:00");a=f.toLocaleDateString("es-ES",{weekday:"long"}),a=a.charAt(0).toUpperCase()+a.slice(1),x=f.getDate()}let v=Math.max(10,Math.round(t/p*100)),u=t===p;return`
                      <div class="projection-day-row">
                        <div class="projection-day-label">
                          <span class="projection-day-name">${a}</span>
                          <span class="projection-day-num">${x}</span>
                        </div>
                        <div class="projection-day-bar-wrap">
                          <div class="projection-day-bar" style="width: ${v}%; background: ${u?"linear-gradient(90deg, var(--primary), hsl(var(--primary-h, 262), 80%, 65%))":"linear-gradient(90deg, rgba(108,92,231,0.7), rgba(108,92,231,0.3))"};"></div>
                        </div>
                        <span class="projection-day-val${u?" projection-day-val--peak":""}">${t}</span>
                      </div>
                    `}).join("")}
                </div>
              </div>

              <!-- Listado de Abastecimiento por Categor\xEDa -->
              <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem;">
                  Lista de Compras Sugerida (Reorden)
                </h3>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem; line-height: 1.4;">
                  *<strong>Reorden:</strong> Cantidad recomendada que deber\xEDas comprar a tus proveedores para no quedarte sin inventario esta semana.
                </p>
                
                <!-- Desktop View: List -->
                <div class="desktop-only" style="display: flex; flex-direction: column; gap: 0.25rem; overflow-y: auto; max-height: 250px;">
                  ${c}
                </div>

                <!-- Mobile View: Accordion Cards -->
                <div class="mobile-only" style="display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto; max-height: 250px;">
                  ${r}
                </div>
              </div>
            </div>
          `:`
            <div style="text-align: center; padding: 3rem 1.5rem; background: rgba(0, 0, 0, 0.15); border-radius: 1rem; border: 1px dashed var(--border);">
              <p style="color: var(--text-muted); font-size: 0.9rem;">
                No hay historial de ventas en ciclos cerrados para alimentar el pron\xF3stico Holt-Winters. Complete ciclos diarios para inicializar.
              </p>
            </div>
          `}
        </div>
      `}if(s==="health"){let i=this.state.kmeansReport,g=i&&i.datos&&i.datos.clusters?i.datos.clusters:[],l=i&&i.datos?i.datos.mensaje_inteligente:"Procesando matriz RFV...",y=i&&i.datos?i.datos.total_productos_analizados:0,h=this.state.returnRates?this.state.returnRates.filter(r=>!this.state.selectedCategory||this.state.selectedCategory==="all"||r.categoria===this.state.selectedCategory):[],p=this.state.transitTimes?this.state.transitTimes.filter(r=>!this.state.selectedCategory||this.state.selectedCategory==="all"||r.categoria===this.state.selectedCategory):[],b=`
        <div class="desktop-only" style="overflow-x: auto; width: 100%;">
          <table class="report-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-weight: 600;">
                <th style="padding: 0.5rem;">Prenda</th>
                <th style="padding: 0.5rem; text-align: right;">SKU</th>
                <th style="padding: 0.5rem; text-align: right;">Tasa</th>
                <th style="padding: 0.5rem; text-align: right;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${h.length>0?h.map(r=>{let t=r.return_rate,e=r.umbral_retorno_critico||80,n=t>e,a="var(--success)";return t>e?a="var(--danger)":t>=e*.5&&(a="var(--warning)"),`
                  <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 0.5rem; font-weight: 600;">${r.nombre}</td>
                    <td style="padding: 0.5rem; text-align: right; color: var(--text-muted);">${r.sku||"N/A"}</td>
                    <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: ${a};">${t}%</td>
                    <td style="padding: 0.5rem; text-align: right;">
                      ${n?'<span class="badge badge-danger" style="font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 800;">CR\xCDTICO</span>':'<span class="badge badge-success" style="font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 800;">\xD3PTIMO</span>'}
                    </td>
                  </tr>
                `}).join(""):`
                <tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted); opacity: 0.5;">No hay tasas de retorno.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `,o=`
        <div class="mobile-only" style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${h.length>0?h.map(r=>{let t=r.return_rate,e=r.umbral_retorno_critico||80,n=t>e,a="var(--success)";return t>e?a="var(--danger)":t>=e*.5&&(a="var(--warning)"),`
              <div class="accordion-card" style="margin-bottom: 0.5rem; border: 1px solid var(--border); padding: 0.85rem; border-radius: 0.75rem; background: rgba(255, 255, 255, 0.01);">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                  <div style="display: flex; flex-direction: column; gap: 0.15rem; text-align: left;">
                    <strong style="color: var(--text); font-size: 0.85rem;">${r.nombre}</strong>
                    <span style="font-size: 0.7rem; color: var(--text-muted);">SKU: ${r.sku||"N/A"}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <strong style="color: ${a}; font-size: 0.85rem;">${t}%</strong>
                    ${n?'<span class="badge badge-danger" style="font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 800;">CR\xCDTICO</span>':'<span class="badge badge-success" style="font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 800;">\xD3PTIMO</span>'}
                  </div>
                </div>
              </div>
            `}).join(""):`
            <div style="text-align: center; padding: 2rem; color: var(--text-muted); opacity: 0.5;">No hay tasas de retorno.</div>
          `}
        </div>
      `,m=`
        <div class="desktop-only" style="overflow-x: auto; width: 100%;">
          <table class="report-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-weight: 600;">
                <th style="padding: 0.5rem;">Categor\xEDa</th>
                <th style="padding: 0.5rem; text-align: right;">Tr\xE1nsitos</th>
                <th style="padding: 0.5rem; text-align: right;">Tiempo Promedio</th>
              </tr>
            </thead>
            <tbody>
              ${p.length>0?p.map(r=>{let t=r.transit_lead_time_hours,e=t>48,n="";if(t>=24){let a=(t/24).toFixed(1);n=`${a} d\xEDa${a!=="1.0"?"s":""} (${t} hrs)`}else n=`${t} horas`;return`
                  <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 0.5rem; font-weight: 600;">${r.categoria}</td>
                    <td style="padding: 0.5rem; text-align: right; color: var(--text-muted);">${r.total_transitos_medidos} salidas</td>
                    <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: ${e?"var(--warning)":"var(--primary)"};">${n}</td>
                  </tr>
                `}).join(""):`
                <tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted); opacity: 0.5;">No hay tr\xE1nsitos.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      `,d=`
        <div class="mobile-only" style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${p.length>0?p.map(r=>{let t=r.transit_lead_time_hours,e=t>48,n="";if(t>=24){let a=(t/24).toFixed(1);n=`${a} d\xEDa${a!=="1.0"?"s":""} (${t} hrs)`}else n=`${t} horas`;return`
              <div class="transit-card" style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); padding: 0.85rem; border-radius: 0.75rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="display: flex; flex-direction: column; gap: 0.15rem; text-align: left;">
                  <strong style="color: var(--text); font-size: 0.85rem;">${r.categoria}</strong>
                  <span style="font-size: 0.7rem; color: var(--text-muted);">${r.total_transitos_medidos} salidas</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
                  <span style="font-size: 0.85rem; font-weight: 800; color: ${e?"var(--warning)":"var(--primary)"};">${n}</span>
                  ${e?'<span style="color: var(--warning); font-size: 0.65rem; font-weight: 700;">TR\xC1NSITO ALTO</span>':'<span style="color: var(--success); font-size: 0.65rem; font-weight: 700;">FLUIDEZ \xD3PTIMA</span>'}
                </div>
              </div>
            `}).join(""):`
            <div style="text-align: center; padding: 2rem; color: var(--text-muted); opacity: 0.5;">No hay tr\xE1nsitos.</div>
          `}
        </div>
      `,c=g.map(r=>{let t="var(--text)",e="rgba(255, 255, 255, 0.05)",n="var(--text-muted)",a="1px solid var(--border)";r.nombre==="Alta Rotaci\xF3n"?(t="var(--success)",e="rgba(34, 197, 94, 0.1)",n="var(--success)",a="1px solid rgba(34, 197, 94, 0.3)"):r.nombre==="Rotaci\xF3n Media"?(t="var(--primary)",e="rgba(108, 92, 231, 0.1)",n="var(--primary)",a="1px solid rgba(108, 92, 231, 0.3)"):r.nombre==="Stock Inactivo"&&(t="var(--danger)",e="rgba(239, 68, 68, 0.1)",n="var(--danger)",a="1px solid rgba(239, 68, 68, 0.3)");let x=r.productos.map(v=>{let u=v.stock<3,f=u?"var(--danger)":"var(--text-muted)",$=u?"800":"normal",z=M(v.nombre,20);return`
            <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); padding: 0.85rem; border-radius: 0.75rem; display: flex; flex-direction: column; gap: 0.25rem;">
              <div style="display: flex; justify-content: space-between; gap: 0.5rem; align-items: flex-start;">
                <span style="font-size: 0.85rem; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;">
                  ${v.nombre.length>20?`<span class="product-name-truncated" data-full-text="${v.nombre.replace(/"/g,"&quot;")}" style="cursor: pointer; text-decoration: underline; color: var(--primary); font-weight: 600;" title="Click para ver nombre completo">${z}</span>`:`<span style="font-weight: 600; color: var(--text);">${v.nombre}</span>`}
                </span>
                <span style="font-size: 0.85rem; font-weight: 700; color: ${t};">
                  ${v.ventas} uds
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted);">
                <span>SKU: ${v.sku||"N/A"}</span>
                <span style="color: ${f}; font-weight: ${$};">
                  Stock: ${v.stock}
                </span>
              </div>
            </div>
          `}).join("");return`
          <div style="background: rgba(255, 255, 255, 0.01); border-radius: 1.25rem; border: ${a}; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; flex: 1; min-width: 260px;" class="cluster-col">
            <!-- Cabecera del Cl\xFAster -->
            <header style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: ${t};">${r.nombre}</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.15rem;" title="Unidades vendidas promedio por producto en este segmento a lo largo del historial del negocio">
                  Ventas Promedio: <strong>${r.metrica_promedio_ventas} uds. (Hist\xF3rico)</strong>
                </span>
              </div>
              <span style="background: ${e}; color: ${n}; padding: 0.35rem 0.65rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 800;">
                ${r.productos.length} SKUs
              </span>
            </header>
            
            <!-- Descripci\xF3n -->
            <p style="color: var(--text-muted); font-size: 0.8rem; line-height: 1.45;">
              ${r.descripcion} <br><small style="display: block; margin-top: 0.5rem; opacity: 0.85; font-style: italic;">* Las ventas promedio indican el total acumulado de unidades vendidas por SKU en este cl\xFAster a lo largo del historial del negocio.</small>
            </p>

            <!-- Listado de Productos -->
            <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 350px; overflow-y: auto; padding-right: 2px;">
              ${r.productos.length>0?x:`
                <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem;">
                  Sin productos asignados en este segmento.
                </div>
              `}
            </div>
          </div>
        `}).join("");return`
        <div class="tab-pane-container" style="animation: fadeIn 0.3s ease-out; display: flex; flex-direction: column; gap: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
            <div style="background: rgba(239, 68, 68, 0.1); padding: 0.75rem; border-radius: 1rem; color: var(--danger); display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
            </div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Matriz de Rotaci\xF3n y Salud de Cat\xE1logo</h2>
              <p style="color: var(--text-muted); font-size: 0.875rem;">Segmentaci\xF3n de productos en 3 grupos \xF3ptimos mediante matriz de Recencia, Frecuencia y Volumen (K-Means 3D).</p>
            </div>
          </div>

          <!-- Mensaje Inteligente / Insight de Salud de Cat\xE1logo -->
          <div class="alert-box glass" style="border-left: 4px solid var(--danger); padding: 1.25rem; border-radius: 0.875rem; background: rgba(239, 68, 68, 0.03);">
            <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
              <div style="color: var(--danger); display: flex; align-items: center; justify-content: center; margin-top: 0.15rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <div>
                <strong style="color: var(--text); display: block; margin-bottom: 0.25rem; font-size: 0.95rem;">An\xE1lisis de Liquidez de Inventario</strong>
                <span style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.45;">
                  ${l}
                </span>
              </div>
            </div>
          </div>

          <!-- Columnas de Clusters -->
          ${g.length>0?`
            <div style="display: flex; gap: 1.25rem; flex-wrap: wrap; justify-content: stretch; align-items: stretch; margin-top: 0.5rem;" class="clusters-container">
              ${c}
            </div>
          `:`
            <div style="text-align: center; padding: 3rem 1.5rem; background: rgba(0, 0, 0, 0.15); border-radius: 1rem; border: 1px dashed var(--border);">
              <p style="color: var(--text-muted); font-size: 0.9rem;">
                No hay productos activos suficientes para realizar el agrupamiento K-Means.
              </p>
            </div>
          `}
          
          <!-- Nuevos Widgets Comerciales: Tasa de Retorno y Tiempo de Tr\xE1nsito -->
          <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 2rem; margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1.5rem;" class="new-widgets-grid">
            
            <!-- Widget 1: Tasa de Retorno (Return Rate) -->
            <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
              <h3 style="font-size: 1rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--danger);">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                </svg>
                Tasa de Retorno de Exhibici\xF3n (Exhibition Return Rate)
              </h3>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                Porcentaje de stock en exhibici\xF3n que retorn\xF3 a bodega sin venderse (L\xEDmite: ${this.state.returnRates&&this.state.returnRates.length>0&&this.state.returnRates[0].umbral_retorno_critico||80}%).
              </p>
              
              <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
                ${b}
                ${o}
              </div>
            </div>
            
            <!-- Widget 2: Tiempo de Tr\xE1nsito (Transit Lead Time) -->
            <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
              <h3 style="font-size: 1rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Tiempo de Tr\xE1nsito de Ropa
              </h3>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                Promedio de horas o d\xEDas que las prendas permanecen en la calle con vendedores.
              </p>
              
              <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
                ${m}
                ${d}
              </div>
            </div>
          </div>

          <style>
          @keyframes text-pulse-blink {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(0.95); opacity: 0.5; }
            100% { transform: scale(1); opacity: 1; }
          }
          .text-blink {
            animation: text-pulse-blink 1.5s infinite;
            box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
          }
          .transit-card:hover {
            transform: translateY(-2px);
            border-color: var(--primary) !important;
            background: rgba(108, 92, 231, 0.03) !important;
          }
          @media (max-width: 900px) {
            .new-widgets-grid {
              grid-template-columns: 1fr !important;
              gap: 1.5rem !important;
            }
          }
          </style>

          <!-- Nota de Pie de P\xE1gina -->
          <footer style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border); padding-top: 1rem; font-size: 0.8rem; color: var(--text-muted); margin-top: 1rem;">
            <span>Cat\xE1logo activo analizado: <strong>${y} productos</strong></span>
            <span>Estad\xEDstica RFV calculada deterministamente.</span>
          </footer>
        </div>
      `}if(s==="turnos"){let{selectedMonth:i,shiftsReport:g,selectedDayShifts:l,selectedDayDate:y}=this.state,h=parseInt(i.split("-")[0]),p=parseInt(i.split("-")[1]),b=new Date(h,p-1,1).getDay(),o=new Date(h,p,0).getDate(),m="";for(let c=0;c<b;c++)m+='<div class="heatmap-cell cell-none"></div>';for(let c=1;c<=o;c++){let r=c.toString().padStart(2,"0"),t=`${i}-${r}`,e=(g||[]).filter(v=>v.fecha===t),n="cell-none",a="";if(e.length>0){n=e.some(f=>!f.kpi_cumplido)?"cell-warning":"cell-success";let u=e.reduce((f,$)=>f+$.alertas_count,0);u>0&&(a=`<span class="cell-alert-badge">${u}</span>`)}m+=`
          <div class="heatmap-cell ${n} ${y===t?"active-cell":""}" data-date="${t}">
            <span class="cell-number">${c}</span>
            ${a}
          </div>
        `}let d="";if(y||(g&&g.length===0?d=`
            <div class="shift-detail-drawer" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--text-muted); padding: 3rem 2rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; color: var(--warning); opacity: 0.8;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem;">Sin Registros</h3>
              <p style="font-size: 0.875rem; max-width: 250px;">No hay turnos registrados para el mes seleccionado. Intent\xE1 con otro mes.</p>
            </div>
          `:d=`
            <div class="shift-detail-drawer" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--text-muted); padding: 3rem 2rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; color: var(--text-muted); opacity: 0.5;">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem;">Detalle de Turnos</h3>
              <p style="font-size: 0.875rem; max-width: 250px;">Seleccion\xE1 un d\xEDa del calendario con turnos para ver la auditor\xEDa de stock y el cumplimiento de horarios.</p>
            </div>
          `),y){let c=new Date(y+"T00:00:00").toLocaleDateString("es-ES",{weekday:"long",year:"numeric",month:"long",day:"numeric"});if(l&&l.length>0){let r=`
            <div class="desktop-only shift-audit-cards">
              ${l.map(e=>{let n=e.creado_en?j(e.creado_en).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",hour12:!1}):"N/A",a=e.cerrado_en?j(e.cerrado_en).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",hour12:!1}):"Activo",x="Activo";if(e.duracion_segundos){let S=Math.floor(e.duracion_segundos/3600),D=Math.floor(e.duracion_segundos%3600/60);x=`${S}h ${D}m`}let v="badge-compliant",u="KPI CUMPLIDO",f="var(--success)";e.estado==="ABIERTO"?(v="badge-active",u="TURNO ACTIVO",f="var(--primary)"):e.kpi_cumplido||(v="badge-warning",u="CIERRE FORZADO",f="var(--warning)");let $=e.salidas-e.retornos,z=[];e.kpi_cumplido||(e.cierre_automatico&&z.push("Cierre autom\xE1tico por l\xEDmite diario (Scheduler)."),e.duracion_segundos&&e.duracion_segundos>=43200&&z.push("El turno excedi\xF3 las 12 horas reglamentarias."));let w=e.alertas&&e.alertas.length>0?`<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem;">
                      ${e.alertas.map(S=>`
                        <div class="alert-subcard">
                          <span style="color: var(--danger); flex-shrink: 0; display: flex; align-items: flex-start; padding-top: 2px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="8" x2="12" y2="12"></line>
                              <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                          </span>
                          <div style="text-align: left; min-width: 0;">
                            <strong style="color: var(--text); font-size: 0.75rem; display: block;">${S.tipo}</strong>
                            <span style="color: var(--text-muted); font-size: 0.75rem; line-height: 1.35;">${S.descripcion}</span>
                          </div>
                        </div>
                      `).join("")}
                    </div>`:'<p style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; margin-top: 0.75rem;">Sin incidentes reportados en este turno.</p>';return`
                  <div class="shift-audit-card-desktop" style="background: rgba(26, 26, 36, 0.65); border: 1px solid var(--border); border-left: 4px solid ${f}; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);">
                    <!-- Card header -->
                    <div class="sacd-header">
                      <div class="sacd-title-group">
                        <span class="sacd-id">Turno #${e.id}</span>
                        <span class="sacd-time">${n} \u2192 ${a} hs &nbsp;\xB7&nbsp; ${x}</span>
                      </div>
                      <span class="${v}">${u}</span>
                    </div>

                    <!-- KPI strip -->
                    <div class="sacd-kpi-strip">
                      <div class="sacd-kpi">
                        <span class="sacd-kpi-label">Salidas</span>
                        <span class="sacd-kpi-value" style="color: var(--primary);">${e.salidas}</span>
                      </div>
                      <div class="sacd-kpi-divider"></div>
                      <div class="sacd-kpi">
                        <span class="sacd-kpi-label">Retornos</span>
                        <span class="sacd-kpi-value" style="color: var(--success);">${e.retornos}</span>
                      </div>
                      <div class="sacd-kpi-divider"></div>
                      <div class="sacd-kpi">
                        <span class="sacd-kpi-label">Ventas Estimadas</span>
                        <span class="sacd-kpi-value" style="color: ${$>=0?"var(--text)":"var(--danger)"};">${Math.abs($)} uds</span>
                      </div>
                    </div>

                    <!-- Alerts / Observations -->
                    <div class="sacd-alerts-section">
                      <strong style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
                        ${e.alertas&&e.alertas.length>0?`${e.alertas.length} Incidente${e.alertas.length>1?"s":""}`:"Incidentes"}
                      </strong>
                      ${w}
                      ${z.length>0?`
                        <div style="margin-top: 0.75rem; background: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.15); border-radius: 0.6rem; padding: 0.65rem 0.9rem;">
                          <strong style="color: var(--warning); font-size: 0.72rem; display: block; margin-bottom: 0.25rem;">Observaciones de Horario</strong>
                          <span style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4;">${z.join("<br>")}</span>
                        </div>
                      `:""}
                    </div>
                  </div>
                `}).join("")}
            </div>
          `,t=`
            <div class="mobile-only" style="display: flex; flex-direction: column; gap: 0.75rem; width: 100%;">
              ${l.map((e,n)=>{let a=e.creado_en?j(e.creado_en).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",hour12:!1}):"N/A",x=e.cerrado_en?j(e.cerrado_en).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",hour12:!1}):"Activo",v="Activo";if(e.duracion_segundos){let w=Math.floor(e.duracion_segundos/3600),S=Math.floor(e.duracion_segundos%3600/60);v=`${w}h ${S}m`}let u="badge-compliant",f="KPI CUMPLIDO",$="";if(e.estado==="ABIERTO")u="badge-active",f="TURNO ACTIVO";else if(!e.kpi_cumplido){u="badge-warning",f="CIERRE FORZADO";let w=[];e.cierre_automatico&&w.push("Cierre autom\xE1tico por l\xEDmite de tiempo diario (Scheduler)."),e.duracion_segundos&&e.duracion_segundos>=12*3600&&w.push("El turno excedi\xF3 las 12 horas reglamentarias de actividad."),$=`
                    <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: 0.75rem; padding: 0.75rem 1rem; margin-top: 0.5rem;">
                      <strong style="color: var(--warning); font-size: 0.75rem; display: block; margin-bottom: 0.25rem;">Observaciones de Horario:</strong>
                      <span style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.35;">${w.join("<br>")}</span>
                    </div>
                  `}let z=e.alertas&&e.alertas.length>0?e.alertas.map(w=>`
                      <div class="alert-subcard">
                        <span style="color: var(--danger); font-size: 0.85rem; display: flex; align-items: center; justify-content: center; margin-top: 2px;">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                        </span>
                        <div style="text-align: left;">
                          <strong style="color: var(--text); font-size: 0.75rem; display: block;">${w.tipo}</strong>
                          <span style="color: var(--text-muted); font-size: 0.75rem; line-height: 1.3;">${w.descripcion}</span>
                        </div>
                      </div>
                    `).join(""):'<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Sin incidentes reportados en este turno.</span>';return`
                  <div class="accordion-card" data-index="shift-audit-${n}">
                    <div class="accordion-header">
                      <div style="display: flex; flex-direction: column; gap: 0.15rem; text-align: left;">
                        <strong style="color: var(--text); font-size: 0.95rem;">Turno #${e.id}</strong>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${a} - ${x} hs (${v})</span>
                      </div>
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="${u}">${f}</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="accordion-arrow" style="transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                    </div>
                    <div class="accordion-details">
                      <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.85rem; color: var(--text-muted); text-align: left;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; text-align: center; font-size: 0.75rem; margin-bottom: 0.5rem;">
                          <div style="background: rgba(255,255,255,0.02); padding: 0.5rem; border-radius: 0.5rem;">
                            <span style="color: var(--text-muted); display: block;">Salidas</span>
                            <strong style="color: var(--primary); font-size: 0.85rem;">${e.salidas} uds</strong>
                          </div>
                          <div style="background: rgba(255,255,255,0.02); padding: 0.5rem; border-radius: 0.5rem;">
                            <span style="color: var(--text-muted); display: block;">Retornos</span>
                            <strong style="color: var(--success); font-size: 0.85rem;">${e.retornos} uds</strong>
                          </div>
                          <div style="background: rgba(255,255,255,0.02); padding: 0.5rem; border-radius: 0.5rem;">
                            <span style="color: var(--text-muted); display: block;">Ventas Estimadas</span>
                            <strong style="color: var(--text); font-size: 0.85rem;">${e.salidas-e.retornos} uds</strong>
                          </div>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                          <strong style="color: var(--text); font-size: 0.8rem; display: block;">Registro de Incidentes/Auditor\xEDa:</strong>
                          ${z}
                        </div>

                        ${$}
                      </div>
                    </div>
                  </div>
                `}).join("")}
            </div>
          `;d=`
            <div class="shift-detail-drawer" style="animation: fadeIn 0.3s ease-out;">
              <header style="border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
                <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text); text-transform: capitalize;">${c}</h3>
                <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.15rem;">Turnos registrados: <strong>${l.length}</strong></span>
              </header>
              <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 480px; overflow-y: auto; padding-right: 4px; margin-top: 0.5rem;">
                ${r}
                ${t}
              </div>
            </div>
          `}else d=`
            <div class="shift-detail-drawer" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--text-muted); padding: 3rem 2rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; color: var(--text-muted); opacity: 0.4;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
              </svg>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 0.5rem; text-transform: capitalize;">${c}</h3>
              <p style="font-size: 0.875rem; max-width: 250px;">No se registraron turnos ni movimientos de inventario en este d\xEDa.</p>
            </div>
          `}return`
        <div class="tab-pane-container" style="animation: fadeIn 0.3s ease-out; display: flex; flex-direction: column; gap: 1.5rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="background: rgba(108, 92, 231, 0.1); padding: 0.75rem; border-radius: 1rem; color: var(--primary); display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <div>
                <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Auditor\xEDa de Turnos y Cumplimiento</h2>
                <p style="color: var(--text-muted); font-size: 0.875rem;">Control de horarios, balance de stock por turnos y visualizaci\xF3n heatmap de incidentes.</p>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">Mes:</span>
              <input type="month" id="shifts-month-picker" class="filter-select" value="${i}" style="min-height: 38px; padding: 0.4rem 0.75rem; border-radius: 0.6rem; border: 1px solid var(--border); font-size: 0.875rem;">
            </div>
          </div>

          <div class="heatmap-container">
            <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border); padding: 1.5rem; border-radius: 1.25rem;">
              <div class="heatmap-grid" style="grid-template-rows: auto auto;">
                <div class="heatmap-day-header">Dom</div>
                <div class="heatmap-day-header">Lun</div>
                <div class="heatmap-day-header">Mar</div>
                <div class="heatmap-day-header">Mi\xE9</div>
                <div class="heatmap-day-header">Jue</div>
                <div class="heatmap-day-header">Vie</div>
                <div class="heatmap-day-header">S\xE1b</div>
                ${m}
              </div>
              
              <div style="display: flex; gap: 1rem; margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem; flex-wrap: wrap; font-size: 0.75rem; color: var(--text-muted);">
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <span style="width: 12px; height: 12px; border-radius: 3px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); display: inline-block;"></span>
                  <span>Sin turnos</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <span style="width: 12px; height: 12px; border-radius: 3px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); display: inline-block;"></span>
                  <span>Turnos Completados</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <span style="width: 12px; height: 12px; border-radius: 3px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); display: inline-block;"></span>
                  <span>Cierre Forzado / Advertencias</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <span style="display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; background: var(--danger); color: white; font-size: 0.6rem; font-weight: bold; line-height: 1;">!</span>
                  <span>Badge Alerta (Incidentes)</span>
                </div>
              </div>
            </div>

            ${d}
          </div>
        </div>
      `}return""}};export{R as default};
