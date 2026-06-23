import"./chunk-NUFRM6SI.js";import{a as c}from"./chunk-C266VY5R.js";import{b as d}from"./chunk-55AWPCXK.js";import{a as n,b as h}from"./chunk-VBOOU2QQ.js";var p=class extends h{constructor(e){super(e),this.state=n.getState(),this.icons={out:'<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>',in:'<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',sale:'<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',stock:'<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3m18 0v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8m18 0H3m4.5 4h9"/></svg>'},this.unsubscribe=null,this.state.averageReport=null,this.hasFetchedAverages=!1}fetchAverages(){this.state.ciclo_estado==="ABIERTO"&&!this.hasFetchedAverages&&(this.hasFetchedAverages=!0,d.get("/reports/averages").then(e=>{this.state.averageReport=e,document.querySelector(".dashboard-page")&&this.setState(this.state)}).catch(e=>{this.hasFetchedAverages=!1,console.error("Error fetching weekday averages:",e)}))}updateCountersUI(e){this.state.counters=e;let i=this.element.querySelector("#stat-salidos"),s=this.element.querySelector("#stat-retornados"),o=this.element.querySelector("#stat-ventas"),t=this.element.querySelector("#stat-bodega");i&&(i.textContent=e.salidos||0),s&&(s.textContent=e.retornados||0),o&&(o.textContent=e.vendidos_estimado||0),t&&(t.textContent=e.en_bodega||0)}updateActivityHistoryUI(e){this.state.activityHistory=e;let i=this.element.querySelector(".alerts-list");i&&(e&&e.length>0?i.innerHTML=e.map(s=>this.renderActivityRow(s)).join(""):i.innerHTML='<p style="color: var(--text-muted); font-size: 0.9rem; padding: 2rem; text-align: center;">Sin actividad reciente.</p>')}renderAverageBanner(){let e=this.state.averageReport;if(!e)return"";let{dia_semana:i,promedio_historico:s,ventas_hoy:o,diferencia_pct:t}=e,a=t>=0,r=Math.abs(t),l=a?"var(--success)":"var(--danger)";return`
      <div class="average-banner glass" style="margin-bottom: 1.5rem; padding: 1.2rem; border-radius: 1rem; display: flex; align-items: center; justify-content: space-between; border-left: 4px solid ${l};">
        <div style="display: flex; align-items: center; gap: 0.8rem;">
          <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: ${a?"rgba(16, 185, 129, 0.15)":"rgba(239, 68, 68, 0.15)"}; color: ${l}; font-size: 1.2rem; font-weight: bold;">
            ${a?"\u2191":"\u2193"}
          </div>
          <div style="text-align: left;">
            <p style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--text);">
              Rendimiento del D\xEDa: <span style="color: ${l}; font-weight: 700;">${r}% ${a?"arriba":"abajo"}</span> que un ${i} promedio.
            </p>
            <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">
              Hoy llev\xE1s ${o} unidades vs un promedio hist\xF3rico de ${s} unidades para este d\xEDa.
            </p>
          </div>
        </div>
      </div>
    `}onMount(){if(!this.unsubscribe){let e=n.getState().activityHistory,i=n.getState().counters,s=n.getState().ciclo_estado,o=n.getState().portalMode;this.unsubscribe=n.subscribe(t=>{if(t.activityHistory!==e||t.counters!==i||t.ciclo_estado!==s||t.portalMode!==o){let a=t.ciclo_estado==="ABIERTO"&&s!=="ABIERTO";t.ciclo_estado!==s||t.portalMode!==o?(e=t.activityHistory,i=t.counters,s=t.ciclo_estado,o=t.portalMode,a&&(this.hasFetchedAverages=!1),this.setState(t),a&&this.fetchAverages()):(t.counters!==i&&(this.updateCountersUI(t.counters),i=t.counters),t.activityHistory!==e&&(this.updateActivityHistoryUI(t.activityHistory),e=t.activityHistory))}})}this.handleCycleClose=this.handleCycleClose.bind(this),window.handleCycleClose=this.handleCycleClose,this.handleCycleStart=this.handleCycleStart.bind(this),window.handleCycleStart=this.handleCycleStart,this.timeUpdateTimer=setInterval(()=>{this.element.querySelectorAll(".activity-time").forEach(i=>{let s=parseInt(i.getAttribute("data-timestamp"));if(s){let o=i.querySelector("span");o&&(o.textContent=this.getRelativeTime(s))}})},6e4),this.state.ciclo_estado==="ABIERTO"&&!this.hasFetchedAverages&&this.fetchAverages()}render(){let{counters:e,alerts:i}=this.state;return`
      <div class="dashboard-page">
        <header class="dashboard-header">
          <div class="dashboard-title-group">
            <h1>Resumen del Sistema</h1>
            <p>Monitoreo en tiempo real de entradas y salidas.</p>
          </div>
          <div class="dashboard-actions">
            ${this.state.ciclo_estado==="ABIERTO"?`
              <button class="btn btn-danger" onclick="window.handleCycleClose()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                <span>Realizar Corte del D\xEDa</span>
              </button>
            `:""}
            
            <button class="btn btn-secondary" onclick="window.location.hash='#/reportes'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <span>Generar Reporte</span>
            </button>
          </div>
        </header>

        ${this.state.ciclo_estado!=="ABIERTO"?`
          <div class="empty-state-card glass">
            <div class="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h2>Sistema en Pausa (Turno Cerrado)</h2>
            <p>El inventario est\xE1 protegido. El portal ignorar\xE1 cualquier lectura hasta que inicies formalmente el turno.</p>
            <button class="btn btn-primary btn-lg" onclick="window.handleCycleStart()" style="display: inline-flex; align-items: center; gap: 0.5rem; justify-content: center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span>Iniciar Nuevo Turno</span>
            </button>
          </div>
        `:`
          ${this.renderAverageBanner()}
          <div class="stats-grid">
            ${this.renderStatCards(e)}
          </div>

          <section class="activity-section glass">
            <div class="section-header">
              <h3>Actividad Reciente</h3>
              <a href="#/alertas">Ver todo</a>
            </div>
            <div class="alerts-list">
              ${this.state.activityHistory&&this.state.activityHistory.length>0?this.state.activityHistory.map(s=>this.renderActivityRow(s)).join(""):'<p style="color: var(--text-muted); font-size: 0.9rem; padding: 2rem; text-align: center;">Sin actividad reciente.</p>'}
            </div>
          </section>
        `}
      </div>
    `}renderStatCards(e){return[{id:"stat-salidos",title:"Salidos Hoy",value:e.salidos||0,icon:this.icons.out,color:"primary"},{id:"stat-retornados",title:"Retornados",value:e.retornados||0,icon:this.icons.in,color:"success"},{id:"stat-ventas",title:"Ventas Est.",value:e.vendidos_estimado||0,icon:this.icons.sale,color:"warning"},{id:"stat-bodega",title:"En Bodega",value:e.en_bodega||0,icon:this.icons.stock,color:"primary"}].map(s=>`
      <div class="stat-card glass">
        <div class="stat-header">
          <span class="stat-title">${s.title}</span>
          <div class="stat-icon-wrapper color-${s.color}">
            ${s.icon}
          </div>
        </div>
        <div class="stat-body">
          <h2 class="stat-value" id="${s.id}">${s.value}</h2>
          ${s.trend?`<span class="stat-trend">${s.trend}</span>`:""}
        </div>
      </div>
    `).join("")}renderActivityRow(e){let i,s,o,t,a;return e.type==="alert"?(i='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',s="rgba(239, 68, 68, 0.15)",o="#ef4444",t="badge-danger",a="ALERTA"):e.type==="move-out"?(i='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>',s="rgba(59, 130, 246, 0.15)",o="#3b82f6",t="badge-primary",a="SALIDA"):(i='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>',s="rgba(16, 185, 129, 0.15)",o="#10b981",t="badge-success",a="RETORNO"),`
      <div class="activity-row" style="display: flex; align-items: flex-start; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border);">
        <div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; background: ${s}; color: ${o}; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          ${i}
        </div>
        <div style="flex: 1; padding-top: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <p style="font-size: 0.95rem; font-weight: 600; margin: 0; color: var(--text);">${e.title}</p>
            <span class="badge ${t}" style="font-size: 0.65rem; padding: 3px 8px; border-radius: 6px; font-weight: 600; letter-spacing: 0.5px;">${a}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 6px 0; line-height: 1.4;">${e.description}</p>
          <span class="activity-time" data-timestamp="${e.timestamp}" style="font-size: 0.75rem; color: var(--text-muted); opacity: 0.7; display: flex; align-items: center; gap: 4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${this.getRelativeTime(e.timestamp)}</span>
          </span>
        </div>
      </div>
    `}getRelativeTime(e){if(!e||typeof e=="string")return e;let i=new Intl.RelativeTimeFormat("es",{numeric:"auto"}),s=e-Date.now(),o=Math.round(s/1e3),t=Math.round(o/60),a=Math.round(t/60);if(Math.abs(o)<60)return i.format(o,"second");if(Math.abs(t)<60)return i.format(t,"minute");if(Math.abs(a)<24)return i.format(a,"hour");{let r=Math.round(a/24);return i.format(r,"day")}}handleCycleStart(){let e=document.createElement("div");e.className="modal-overlay";let i=document.createElement("div");i.className="glass",i.style.cssText="padding: 2rem; max-width: 400px; width: 90%; border-radius: 1rem; text-align: center; animation: slideDownFade 0.3s ease-out;",i.innerHTML=`
      <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(59, 130, 246, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      </div>
      <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">\xBFIniciar Nuevo Turno?</h3>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem;">
        Esto habilitar\xE1 las lecturas del portal y pondr\xE1 los contadores a cero. Aseg\xFArate de que el personal est\xE9 listo.
      </p>
      <div style="display: flex; gap: 1rem;">
        <button id="btn-cancel-start" class="btn btn-secondary" style="flex: 1;">Cancelar</button>
        <button id="btn-confirm-start" class="btn btn-primary" style="flex: 1;">S\xED, Iniciar Turno</button>
      </div>
    `,e.appendChild(i),document.body.appendChild(e);let s=()=>{document.body.contains(e)&&document.body.removeChild(e)};document.getElementById("btn-cancel-start").addEventListener("click",s),document.getElementById("btn-confirm-start").addEventListener("click",async o=>{let t=o.currentTarget;t.innerHTML="Iniciando...",t.disabled=!0,document.getElementById("btn-cancel-start").disabled=!0;try{await d.post("/cycle/start");let[a,r]=await Promise.all([d.get("/dashboard").catch(()=>null),d.get("/portal/status").catch(()=>null)]),l=a?{salidos:a.total_salidas||0,retornados:a.total_retornos||0,vendidos_estimado:a.articulos_en_transito||0,en_bodega:a.total_en_bodega||0,alertas:a.alertas_activas||0}:{salidos:0,retornados:0,vendidos_estimado:0,articulos_en_transito:0,en_bodega:0};n.setState({ciclo_estado:"ABIERTO",counters:l,activityHistory:[],portalMode:r?.modo_portal||"APAGADO",portalStatus:r?.status||"offline"}),c.show("Turno iniciado exitosamente","success"),s()}catch(a){t.innerHTML="S\xED, Iniciar Turno",t.disabled=!1,document.getElementById("btn-cancel-start").disabled=!1,c.show(a.message||"Error al iniciar turno","danger")}})}handleCycleClose(){let{counters:e}=this.state,i=e.vendidos_estimado||e.articulos_en_transito||0,s=document.createElement("div");s.className="modal-overlay",s.style.cssText="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);";let o=document.createElement("div");o.className="glass",o.style.cssText="background: var(--surface); padding: 2rem; border-radius: 1rem; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);",o.innerHTML=`
      <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); color: var(--danger); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text);">Confirmar Corte de D\xEDa</h3>
      <p style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1.5rem;">
        Ten\xE9s <strong style="color: var(--danger);">${i}</strong> art\xEDculos fuera del local. Al hacer el corte, estos art\xEDculos se considerar\xE1n vendidos y se descontar\xE1n definitivamente del stock f\xEDsico.
      </p>
      <div style="display: flex; gap: 1rem;">
        <button id="btn-cancel-close" class="btn btn-secondary" style="flex: 1;">Cancelar</button>
        <button id="btn-confirm-close" class="btn btn-danger" style="flex: 1; background: var(--danger);">S\xED, Cortar D\xEDa</button>
      </div>
    `,s.appendChild(o),document.body.appendChild(s);let t=()=>{document.body.removeChild(s)};document.getElementById("btn-cancel-close").addEventListener("click",t),document.getElementById("btn-confirm-close").addEventListener("click",async a=>{let r=a.currentTarget;r.innerHTML="Cortando...",r.disabled=!0,document.getElementById("btn-cancel-close").disabled=!0;try{await d.post("/cycle/close"),t()}catch(l){r.innerHTML="S\xED, Cortar D\xEDa",r.disabled=!1,document.getElementById("btn-cancel-close").disabled=!1,c.show(l.message||"Error al cerrar el ciclo","danger")}})}dispose(){this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=null),this.timeUpdateTimer&&(clearInterval(this.timeUpdateTimer),this.timeUpdateTimer=null),delete window.handleCycleClose}};export{p as default};
