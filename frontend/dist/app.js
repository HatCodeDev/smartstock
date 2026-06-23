import{a as R}from"./chunks/chunk-C266VY5R.js";import{a as h,b}from"./chunks/chunk-55AWPCXK.js";import{a as i,b as u}from"./chunks/chunk-VBOOU2QQ.js";var z=class{constructor(){this.socket=null,this.reconnectAttempts=0,this.maxReconnectAttempts=10,this.baseDelay=1e3,this.heartbeatInterval=3e4,this.heartbeatTimer=null,this.isManuallyClosed=!1,i.subscribe((t,e)=>{t.isAuthenticated&&!e.isAuthenticated?(console.log("\u{1F511} Auth detected, connecting WebSocket..."),this.connect()):!t.isAuthenticated&&e.isAuthenticated&&(console.log("\u{1F512} Auth lost, closing WebSocket..."),this.close())})}connect(){if(this.socket&&(this.socket.readyState===WebSocket.OPEN||this.socket.readyState===WebSocket.CONNECTING))return;this.isManuallyClosed=!1;let t=localStorage.getItem(h.TOKEN_KEY);if(!t){console.warn("\u26A0\uFE0F No token found, WebSocket connection deferred."),setTimeout(()=>this.reconnect(),5e3);return}let e=`${h.WS_BASE_URL}${t?`?token=${t}`:""}`;console.log(`\u{1F50C} Connecting to WebSocket: ${h.WS_BASE_URL}`),this.socket=new WebSocket(e),this.socket.onopen=()=>{console.log("\u2705 WebSocket Connected"),this.reconnectAttempts=0,i.setState({isConnected:!0}),this.startHeartbeat()},this.socket.onmessage=r=>{this.handleMessage(r.data)},this.socket.onclose=r=>{i.setState({isConnected:!1}),this.stopHeartbeat(),this.isManuallyClosed||(console.warn(`\u26A0\uFE0F WebSocket Closed (Code: ${r.code}). Attempting reconnection...`),this.reconnect())},this.socket.onerror=r=>{console.error("\u274C WebSocket Error:",r)}}reconnect(){if(this.reconnectAttempts>=this.maxReconnectAttempts){console.error("\u274C Max reconnection attempts reached.");return}if(!localStorage.getItem(h.TOKEN_KEY)){console.warn("\u26A0\uFE0F No token found, retrying in 5s..."),setTimeout(()=>this.reconnect(),5e3);return}let e=Math.min(this.baseDelay*Math.pow(2,this.reconnectAttempts),3e4);this.reconnectAttempts++,console.log(`\u{1F504} Retrying in ${e/1e3}s... (Attempt ${this.reconnectAttempts})`),setTimeout(()=>this.connect(),e)}handleMessage(t){try{let e=JSON.parse(t);switch(console.log("\u{1F4E5} WS Message:",e),e.type){case"COUNTER_UPDATE":if(e.payload.counters){let d=i.getState(),c="Movimiento detectado en portal principal",p=`${e.payload.modo}: ${e.payload.eventos_creados} unidades`;if(e.payload.articulos_movidos&&e.payload.articulos_movidos.length>0){let m=e.payload.articulos_movidos,g=m.slice(0,2).map(C=>`${C.cantidad}x ${C.nombre}`),A=m.length-2;A>0&&g.push(`${A} art\xEDculo${A>1?"s":""} m\xE1s`),c=g.join(", "),e.payload.eventos_creados>0&&(p=`${e.payload.modo==="SALIDA"?"Salida":"Retorno"} de ${e.payload.eventos_creados} art\xEDculo${e.payload.eventos_creados>1?"s":""}`)}if(e.payload.eventos_creados>0){let m={id:e.payload.batch_id||Date.now(),type:e.payload.modo==="SALIDA"?"move-out":"move-in",title:p,timestamp:Date.now(),description:c};i.setState({counters:e.payload.counters,activityHistory:[m,...d.activityHistory].slice(0,20)})}else i.setState({counters:e.payload.counters})}break;case"REGISTRATION_UPDATE":let r=i.getState().registrationSession;if(r){let d=e.payload.registro_resultados||[],c=new Map;[...r.registeredTags].reverse().forEach(m=>c.set(m.epc,m)),d.reverse().forEach(m=>{let g=c.get(m.epc);g&&g.status==="new"&&m.status==="duplicate"?c.set(m.epc,g):c.set(m.epc,m)});let p=Array.from(c.values()).reverse().slice(0,50);i.setState({registrationSession:{...r,registeredTags:p}})}break;case"CYCLE_STARTED":i.setState({ciclo_estado:e.payload.estado,counters:{salidos:0,retornados:0,vendidos_estimado:0,en_bodega:i.getState().counters.en_bodega||0},activityHistory:[]}),import("./chunks/ToastService-DTDZNJ7Y.js").then(d=>{d.default.show("Nuevo turno iniciado.","success")});break;case"CYCLE_CLOSED":i.setState({ciclo_estado:"CERRADO",ciclo_en_transito:0,counters:{salidos:e.payload.salidos||e.payload.summary?.salidos||0,retornados:e.payload.retornados||e.payload.summary?.retornados||0,vendidos_estimado:0,en_bodega:i.getState().counters.en_bodega},inventoryUpdated:Date.now()}),import("./chunks/ToastService-DTDZNJ7Y.js").then(d=>{d.default.show(`Corte realizado. ${e.payload.vendidos_final||e.payload.summary?.vendidos_final||0} art\xEDculos descontados del stock.`,"success")});break;case"PORTAL_MODE_CHANGED":let o=i.getState().portalMode;i.setState({portalMode:e.payload}),o==="REGISTRO"&&e.payload!=="REGISTRO"&&i.setState({inventoryUpdated:Date.now()});break;case"INVENTORY_UPDATED":i.setState({inventoryUpdated:Date.now()});break;case"PORTAL_STATUS":i.setState({portalStatus:e.payload.status});break;case"ALERT":let a=i.getState().alerts,l=i.getState().activityHistory,n={id:e.payload.id||Date.now(),type:e.payload.type,message:e.payload.message,timestamp:e.payload.timestamp||Date.now()},s={id:n.id,type:"alert",title:n.type,timestamp:n.timestamp,description:n.message};i.setState({alerts:[n,...a].slice(0,50),activityHistory:[s,...l].slice(0,20)});break;case"BATCH_ERROR":console.error("\u274C Error processing RFID Batch:",e.payload.error);break;case"PONG":break;default:console.warn("\u2753 Unknown WS message type:",e.type)}}catch(e){console.error("\u274C Error parsing WS message:",e)}}send(t){this.socket&&this.socket.readyState===WebSocket.OPEN?this.socket.send(JSON.stringify(t)):console.error("\u274C Cannot send message: WebSocket is not open.")}close(){this.isManuallyClosed=!0,this.socket&&this.socket.close()}startHeartbeat(){this.heartbeatTimer=setInterval(()=>{this.send({type:"PING"})},this.heartbeatInterval)}stopHeartbeat(){this.heartbeatTimer&&(clearInterval(this.heartbeatTimer),this.heartbeatTimer=null)}},E=new z,S=E;var v=class extends u{constructor(t){super(t),this.unsubscribe=null}render(){let{isConnected:t,portalMode:e,portalStatus:r}=i.getState(),o="badge-primary";e==="RETORNO"&&(o="badge-success"),e==="REGISTRO"&&(o="badge-warning"),e==="APAGADO"&&(o="badge-muted");let a=e==="REGISTRO",l=r==="online",n=e||"APAGADO";return`
      <nav class="navbar">
        <div class="navbar-left">
          <button class="sidebar-toggle" id="toggle-sidebar" aria-label="Toggle Sidebar" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.5rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div class="custom-select-container hide-on-mobile" id="nav-mode-dropdown">
            <div class="badge ${o} mode-select custom-select-trigger" ${a?'data-disabled="true"':""}>
              <span>Modo: ${n.charAt(0)+n.slice(1).toLowerCase()}</span>
            </div>
            <div class="custom-select-options">
              <div class="custom-select-option ${e==="SALIDA"?"selected":""}" data-value="SALIDA">
                Salida
                ${e==="SALIDA"?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>':""}
              </div>
              <div class="custom-select-option ${e==="RETORNO"?"selected":""}" data-value="RETORNO">
                Retorno
                ${e==="RETORNO"?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>':""}
              </div>
              <div class="custom-select-option ${e==="APAGADO"?"selected":""}" data-value="APAGADO">
                Apagado
                ${e==="APAGADO"?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>':""}
              </div>
              ${a?`
                <div class="custom-select-option selected" data-value="REGISTRO" data-disabled="true">
                  Registro
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              `:""}
            </div>
          </div>
        </div>
        
        <div class="navbar-right" style="display: flex; align-items: center; gap: 1rem;">
          <div id="connection-indicator" class="hide-on-mobile" style="display: flex; align-items: center; gap: 1rem; font-size: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 0.25rem;">
              
            </div>
            <div style="display: flex; align-items: center; gap: 0.25rem;">
              <span class="dot ${l?"dot-online":"dot-offline"}"></span>
              <span class="hide-on-mobile" style="color: ${l?"var(--success)":"var(--warning)"};">
                ${l?"Portal Activo":"Portal Inactivo"}
              </span>
            </div>
          </div>
          
          <div class="user-profile" style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 32px; height: 32px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8rem;">
              A
            </div>
            <div class="hide-on-mobile" style="display: flex; flex-direction: column;">
              <span style="font-size: 0.8rem; font-weight: 500;">Admin</span>
            </div>
          </div>
        </div>
      </nav>
    `}onMount(){this.unsubscribe||(this.unsubscribe=i.subscribe((r,o)=>{(r.isConnected!==o.isConnected||r.portalMode!==o.portalMode||r.portalStatus!==o.portalStatus)&&this.update()}));let t=this.element.querySelector("#toggle-sidebar");t&&t.addEventListener("click",()=>{let r=document.querySelector(".layout-container");r&&(window.innerWidth<=768?r.classList.toggle("sidebar-open"):r.classList.toggle("sidebar-collapsed"))});let e=this.element.querySelector("#nav-mode-dropdown");if(e){let r=e.querySelector(".custom-select-trigger"),o=e.querySelectorAll(".custom-select-option");r&&r.getAttribute("data-disabled")!=="true"&&(this.triggerHandler=a=>{a.stopPropagation(),e.classList.toggle("open")},r.addEventListener("click",this.triggerHandler)),o.forEach(a=>{a.addEventListener("click",async()=>{if(a.getAttribute("data-disabled")==="true")return;let l=a.dataset.value;e.classList.remove("open");try{await b.post("/portal/mode",{mode:l,device_id:"smartstock-portal-01"}),console.log(`\u{1F680} (Desktop) Modo cambiado a ${l}`)}catch(n){console.error("\u274C Error al cambiar modo:",n),this.update()}})}),this.outsideClickHandler=a=>{e.contains(a.target)||e.classList.remove("open")},document.addEventListener("click",this.outsideClickHandler)}}update(){if(!this.element)return;let t=i.getState(),e=t.portalStatus==="online",r=t.portalMode==="REGISTRO",o=this.element.querySelector("#connection-indicator > div:nth-child(1) .dot"),a=this.element.querySelector("#connection-indicator > div:nth-child(1) span:nth-child(2)");o&&a&&(o.className=`dot ${t.isConnected?"dot-online":"dot-offline"}`,a.style.color=t.isConnected?"var(--success)":"var(--danger)",a.textContent=t.isConnected?"WebSocket":"Sin WS");let l=this.element.querySelector("#connection-indicator > div:nth-child(2) .dot"),n=this.element.querySelector("#connection-indicator > div:nth-child(2) span:nth-child(2)");l&&n&&(l.className=`dot ${e?"dot-online":"dot-offline"}`,n.style.color=e?"var(--success)":"var(--warning)",n.textContent=e?"Portal Activo":"Portal Inactivo");let s=this.element.querySelector("#nav-mode-dropdown");if(s){let d=s.querySelector(".custom-select-trigger");if(d){let p="badge-primary";t.portalMode==="RETORNO"&&(p="badge-success"),t.portalMode==="REGISTRO"&&(p="badge-warning"),t.portalMode==="APAGADO"&&(p="badge-muted"),d.className=`badge ${p} mode-select custom-select-trigger`,r?d.setAttribute("data-disabled","true"):d.removeAttribute("data-disabled");let m=t.portalMode||"APAGADO",g=d.querySelector("span");g&&(g.textContent=`Modo: ${m.charAt(0)+m.slice(1).toLowerCase()}`)}s.querySelectorAll(".custom-select-option").forEach(p=>{if(p.getAttribute("data-value")===t.portalMode)p.classList.add("selected"),p.querySelector("svg")||(p.innerHTML+='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>');else{p.classList.remove("selected");let g=p.querySelector("svg");g&&g.remove()}})}}dispose(){this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=null),this.outsideClickHandler&&document.removeEventListener("click",this.outsideClickHandler)}};var x=class extends u{render(){return`
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <span class="logo-text" style="font-weight: 800; font-size: 1.5rem; color: var(--text);">
              <span class="logo-full"><span style="color: var(--primary);">SMART</span>STOCK</span>
              <span class="logo-short"><span style="color: var(--primary);">S</span>T</span>
            </span>
          </div>
        </div>
        
        <nav aria-label="Navegaci\xF3n Principal">
          <ul class="nav-list">
            <li>
              <a href="#/" class="nav-link active" aria-current="page" data-route="#/">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="9"></rect>
                  <rect x="14" y="3" width="7" height="5"></rect>
                  <rect x="14" y="12" width="7" height="9"></rect>
                  <rect x="3" y="16" width="7" height="5"></rect>
                </svg>
                <span>Dashboard</span>
              </a>
            </li>
            <li>
              <a href="#/inventario" class="nav-link" data-route="#/inventario">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"></path>
                  <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"></path>
                  <path d="M4 12h16"></path>
                </svg>
                <span>Inventario</span>
              </a>
            </li>
            <li>
              <a href="#/alertas" class="nav-link" data-route="#/alertas">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span>Alertas</span>
              </a>
            </li>
            <li>
              <a href="#/reportes" class="nav-link" data-route="#/reportes">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <span>Reportes</span>
              </a>
            </li>
          </ul>
        </nav>
        
        <div class="sidebar-footer">
          <a href="#/configuracion" class="nav-link" aria-label="Configuraci\xF3n" data-route="#/configuracion" style="margin-bottom: 0.5rem;">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Configuraci\xF3n</span>
          </a>
          
          <button class="nav-link nav-link-logout" id="logout-btn" style="width: 100%; border: none; cursor: pointer; text-align: left;">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Cerrar sesi\xF3n</span>
          </button>
        </div>
      </aside>
    `}onMount(){let t=this.element.querySelector("#logout-btn");t&&t.addEventListener("click",()=>{confirm("\xBFEst\xE1s seguro de que quieres cerrar sesi\xF3n?")&&b.logout()}),this.boundUpdateActiveLink=()=>{let e=window.location.hash||"#/";if(this.element.querySelectorAll(".nav-link").forEach(r=>{r.getAttribute("data-route")===e?r.classList.add("active"):r.classList.remove("active")}),window.innerWidth<=768){let r=document.querySelector(".layout-container");r&&r.classList.remove("sidebar-open")}},window.addEventListener("hashchange",this.boundUpdateActiveLink),this.boundUpdateActiveLink()}dispose(){this.boundUpdateActiveLink&&window.removeEventListener("hashchange",this.boundUpdateActiveLink)}};var y=class extends u{constructor(t){super(t),this.unsubscribe=null}render(){let{isConnected:t,portalMode:e,portalStatus:r,isAuthenticated:o,ciclo_estado:a}=i.getState();if(!o)return"";let l=r==="online",n=e||"APAGADO",s="mode-salida";e==="RETORNO"&&(s="mode-retorno"),e==="REGISTRO"&&(s="mode-registro"),e==="APAGADO"&&(s="mode-apagado");let d=e==="REGISTRO",c=a!=="ABIERTO";return c&&(s="mode-apagado"),`
      <div class="status-bar-mobile">
        <div class="status-bar-left">
          <select class="status-badge ${s} mode-select" id="mobile-mode-selector" ${d||c?"disabled":""} style="font-size: 0.65rem;">
            ${c?'<option value="APAGADO" selected>APAGADO (Turno Cerrado)</option>':`
              <option value="SALIDA" ${e==="SALIDA"?"selected":""}>SALIDA</option>
              <option value="RETORNO" ${e==="RETORNO"?"selected":""}>RETORNO</option>
              <option value="APAGADO" ${e==="APAGADO"?"selected":""}>APAGADO</option>
              ${d?'<option value="REGISTRO" selected disabled>REGISTRO</option>':""}
            `}
          </select>
        </div>
        <div class="status-bar-right">
          <div class="status-indicator">
            
          </div>
          <div class="status-indicator">
            <span class="dot ${l?"dot-online":"dot-offline"}"></span>
            <span class="status-text">Portal</span>
          </div>
        </div>
      </div>
    `}onMount(){this.unsubscribe||(this.unsubscribe=i.subscribe((e,r)=>{(e.isConnected!==r.isConnected||e.portalMode!==r.portalMode||e.portalStatus!==r.portalStatus||e.isAuthenticated!==r.isAuthenticated||e.ciclo_estado!==r.ciclo_estado)&&this.update()}));let t=this.element.querySelector("#mobile-mode-selector");t&&t.addEventListener("change",async e=>{let r=e.target.value;try{await b.post("/portal/mode",{mode:r,device_id:"smartstock-portal-01"}),console.log(`\u{1F680} (Mobile) Modo cambiado a ${r}`)}catch(o){console.error("\u274C Error al cambiar modo:",o),this.update()}})}update(){if(!this.element)return;let t=i.getState(),e=t.portalStatus==="online",r=t.portalMode==="REGISTRO",o=t.ciclo_estado!=="ABIERTO",a=this.element.querySelector(".status-bar-right .status-indicator:nth-child(1) .dot");a&&(a.className=`dot ${t.isConnected?"dot-online":"dot-offline"}`);let l=this.element.querySelector(".status-bar-right .status-indicator:nth-child(2) .dot");l&&(l.className=`dot ${e?"dot-online":"dot-offline"}`);let n=this.element.querySelector("#mobile-mode-selector");if(n){n.disabled=r||o;let s="mode-salida";t.portalMode==="RETORNO"&&(s="mode-retorno"),t.portalMode==="REGISTRO"&&(s="mode-registro"),(t.portalMode==="APAGADO"||o)&&(s="mode-apagado"),n.className=`status-badge ${s} mode-select`,o?n.innerHTML='<option value="APAGADO" selected>APAGADO (Turno Cerrado)</option>':n.innerHTML=`
          <option value="SALIDA" ${t.portalMode==="SALIDA"?"selected":""}>SALIDA</option>
          <option value="RETORNO" ${t.portalMode==="RETORNO"?"selected":""}>RETORNO</option>
          <option value="APAGADO" ${t.portalMode==="APAGADO"?"selected":""}>APAGADO</option>
          ${r?'<option value="REGISTRO" selected disabled>REGISTRO</option>':""}
        `}}dispose(){this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=null)}};var w=class extends u{constructor(t){super(t),this.state={isLoading:!1,error:null}}async handleSubmit(t){t.preventDefault();let e=new FormData(t.target),r=e.get("username"),o=e.get("password");this.setState({isLoading:!0,error:null});try{let a=new URLSearchParams;a.append("username",r),a.append("password",o);let l=await b.post("/auth/login",a);localStorage.setItem(h.TOKEN_KEY,l.access_token);let n=null,s=null,d=null;try{let[p,m,g]=await Promise.all([b.get("/dashboard").catch(()=>null),b.get("/cycle/status").catch(()=>null),b.get("/portal/status").catch(()=>null)]);n=p,s=m,d=g}catch(p){console.warn("Could not hydrate data on login:",p)}let c={isAuthenticated:!0,user:{username:r,role:"admin"}};s&&(c.ciclo_estado=s.estado),n&&(c.counters={salidos:n.total_salidas||0,retornados:n.total_retornos||0,vendidos_estimado:n.articulos_en_transito||0,en_bodega:n.total_en_bodega||0,alertas:n.alertas_activas||0},c.portalMode=n.modo_portal||"APAGADO"),d&&(c.portalStatus=d.status||"offline",d.modo_portal&&(c.portalMode=d.modo_portal)),i.setState(c),window.location.hash="#/"}catch(a){this.setState({error:a.message,isLoading:!1})}}render(){let{isLoading:t,error:e}=this.state;return`
      <div class="auth-wrapper">
        <div class="login-card glass">
          <div class="login-logo">
            <h1 class="logo-text">
              SMART<span class="logo-accent">STOCK</span>
            </h1>
            <p style="color: var(--text-muted); font-size: 0.875rem; margin-top: -0.5rem;">
              Inventory Control System
            </p>
          </div>
          
          <form id="login-form" class="form">
            <div class="form-group">
              <label for="username">Usuario</label>
              <input 
                type="text" 
                id="username" 
                name="username" 
                class="login-input"
                required 
                placeholder="admin" 
                autocomplete="username"
                ${t?"disabled":""}
              >
            </div>
            
            <div class="form-group" style="margin-top: 1rem;">
              <label for="password">Contrase\xF1a</label>
              <input 
                type="password" 
                id="password" 
                name="password" 
                class="login-input"
                required 
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" 
                autocomplete="current-password"
                ${t?"disabled":""}
              >
            </div>
            
            ${e?`
              <div class="form-error" style="background: rgba(239, 68, 68, 0.1); padding: 0.75rem; border-radius: 0.5rem; margin-top: 1rem; border: 1px solid rgba(239, 68, 68, 0.2);">
                ${e}
              </div>
            `:""}
            
            <button type="submit" class="btn btn-primary btn-block btn-login" style="margin-top: 2rem;" ${t?"disabled":""}>
              ${t?`
                <svg class="animate-spin" style="width: 20px; height: 20px; margin-right: 0.5rem;" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Iniciando...
              `:"Entrar al Sistema"}
            </button>
          </form>
          
          <div class="login-footer" style="margin-top: 3rem; text-align: center;">
            <p style="font-size: 0.75rem; color: var(--text-muted);">
              &copy; 2026 SmartStock IoT Solutions<br>
              Control de Inventario Textil en Tiempo Real
            </p>
          </div>
        </div>
      </div>
    `}onMount(){this.state.isLoading=!1,this.state.error=null;let t=this.element.querySelector("#login-form");t&&t.addEventListener("submit",e=>this.handleSubmit(e))}};var k=class extends u{constructor(t){super(t),this.navbar=new v,this.sidebar=new x,this.statusBar=new y,this.loginPage=new w,this.currentPage=null,this.unsubscribe=null}render(){let{isAuthenticated:t}=i.getState();return t?`
      <div class="layout-container">
        <!-- Sidebar overlay for mobile -->
        <div class="sidebar-overlay" id="sidebar-overlay"></div>

        <!-- Sidebar placeholder -->
        <div id="sidebar-target"></div>
        
        <!-- Status Bar for mobile -->
        <div id="statusbar-target"></div>
        
        <!-- Navbar placeholder -->
        <div id="navbar-target"></div>
        
        <!-- Main content area -->
        <main class="main-content">
          <div id="router-view"></div>
        </main>
      </div>
    `:'<div class="auth-wrapper"><div id="login-target"></div></div>'}onMount(){let{isAuthenticated:t}=i.getState();if(t){let r=this.element.querySelector("#sidebar-target"),o=this.element.querySelector("#navbar-target"),a=this.element.querySelector("#statusbar-target");r&&(this.sidebar.mount(r),r.replaceWith(this.sidebar.element)),a&&(this.statusBar.mount(a),a.replaceWith(this.statusBar.element)),o&&(this.navbar.mount(o),o.replaceWith(this.navbar.element)),this.handleRouting()}else{let r=this.element.querySelector("#login-target");r&&(this.loginPage.mount(r),r.replaceWith(this.loginPage.element))}this.boundHandleRouting=this.handleRouting.bind(this),window.addEventListener("hashchange",this.boundHandleRouting),this.unsubscribe=i.subscribe((r,o)=>{r.isAuthenticated!==o.isAuthenticated&&this.update()});let e=this.element.classList.contains("layout-container")?this.element:this.element.querySelector(".layout-container");if(e){let r=this.element.querySelector("#sidebar-overlay");r&&r.addEventListener("click",o=>{o.stopPropagation(),e.classList.remove("sidebar-open")}),e.addEventListener("click",o=>{if(window.innerWidth<=768&&e.classList.contains("sidebar-open")){let a=this.element.querySelector(".sidebar"),l=document.querySelector("#toggle-sidebar");a&&!a.contains(o.target)&&l&&!l.contains(o.target)&&e.classList.remove("sidebar-open")}})}}dispose(){console.log("\u{1F9F9} MainLayout Cleaning up..."),this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=null),this.boundHandleRouting&&window.removeEventListener("hashchange",this.boundHandleRouting),[this.navbar,this.sidebar,this.statusBar,this.loginPage,this.currentPage].forEach(e=>{e&&typeof e.dispose=="function"&&e.dispose()})}async handleRouting(){let t=window.location.hash||"#/",e=this.element.querySelector("#router-view");if(e){this.currentPage&&this.currentPage.dispose&&this.currentPage.dispose(),e.innerHTML='<div class="empty-state glass"><p>Cargando m\xF3dulo...</p></div>';try{let r;t==="#/"||t===""?r=(await import("./chunks/DashboardPage-PKKVP5I3.js")).default:t==="#/inventario"?r=(await import("./chunks/InventoryPage-AX3G3QQQ.js")).default:t==="#/alertas"?r=(await import("./chunks/AlertsPage-UKTBO5RR.js")).default:t==="#/configuracion"?r=(await import("./chunks/ConfigPage-MWSXXKQG.js")).default:t==="#/reportes"&&(r=(await import("./chunks/ReportsPage-LQU7QALI.js")).default),r?(e.innerHTML="",this.currentPage=new r,this.currentPage.mount(e)):e.innerHTML=`<div class="empty-state glass"><h2>P\xE1gina ${t} en desarrollo</h2></div>`}catch(r){console.error("\u{1F680} Lazy Loading Error:",r),e.innerHTML=`<div class="empty-state glass"><p style="color: var(--danger);">Error al cargar el m\xF3dulo: ${r.message}</p></div>`}}}};async function O(){if(console.log("\u{1F680} SmartStock Frontend Initialized"),window.appStore=i,localStorage.getItem(h.TOKEN_KEY))try{let o=null,a=null,l=null,n=null;try{let[d,c,p,m]=await Promise.all([b.get("/dashboard").catch(g=>{if(g.message.includes("No hay ciclo")||g.message.includes("404"))return null;throw g}),b.get("/cycle/status").catch(g=>(console.warn("Could not fetch cycle status:",g),null)),b.get("/portal/status").catch(()=>null),b.get("/dashboard/activity").catch(()=>null)]);o=d,a=c,l=p,n=m}catch(d){throw d}let s={isAuthenticated:!0,user:{username:"admin",role:"admin"}};a&&(s.ciclo_estado=a.estado,s.ciclo_en_transito=a.en_transito,s.ciclo_fecha=a.fecha),o&&(s.counters={salidos:o.total_salidas||0,retornados:o.total_retornos||0,vendidos_estimado:o.articulos_en_transito||0,en_bodega:o.total_en_bodega||0,alertas:o.alertas_activas||0},s.portalMode=o.modo_portal||"APAGADO"),l&&(s.portalStatus=l.status||"offline",l.modo_portal&&(s.portalMode=l.modo_portal)),n&&n.history&&(s.activityHistory=n.history,s.alerts=n.alerts||[]),i.setState(s),S.connect()}catch(o){console.warn("\u26A0\uFE0F Session invalid or expired:",o.message)}let t=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1";"serviceWorker"in navigator&&!t&&window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").then(o=>console.log("\u{1F4E6} PWA: Service Worker Registered",o.scope)).catch(o=>console.error("\u{1F4E6} PWA: Registration Failed",o))});let e=document.getElementById("app");e&&(e.innerHTML="",new k().mount(e)),setTimeout(()=>{S.socket&&S.socket.readyState===WebSocket.OPEN&&!i.getState().isConnected&&(console.log("\u{1F504} Sincronizando estado del WebSocket (Fallback)"),i.setState({isConnected:!0}))},500);let r=i.getState().alerts.length;i.subscribe(o=>{if(o.alerts.length>r){let a=o.alerts[0];a&&R.show(a.message,a.type==="TAG_DESCONOCIDA"?"warning":"danger"),r=o.alerts.length}}),i.subscribe(o=>{console.log("\u{1F514} State Updated:",o)})}document.addEventListener("DOMContentLoaded",O);
