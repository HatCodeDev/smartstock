import{a as E}from"./chunk-Y5NLVTPE.js";import{b as u}from"./chunk-55AWPCXK.js";import{b as h}from"./chunk-VBOOU2QQ.js";var y=class extends h{constructor(e){super(e)}onMount(){let e=this.element.querySelector("#prev-page"),t=this.element.querySelector("#next-page");e&&!e.disabled&&e.addEventListener("click",()=>{this.props.onPageChange(this.props.currentPage-1)}),t&&!t.disabled&&t.addEventListener("click",()=>{this.props.onPageChange(this.props.currentPage+1)})}render(){let{totalItems:e,itemsPerPage:t,currentPage:r}=this.props,o=Math.ceil(e/t)||1,n=r===1,l=r===o;return`
      <div class="pagination-container glass">
        <div class="pagination-info">
          Mostrando <span class="highlight">${e>0?(r-1)*t+1:0}</span> 
          a <span class="highlight">${Math.min(r*t,e)}</span> 
          de <span class="highlight">${e}</span> productos
        </div>
        
        <div class="pagination-controls">
          <button id="prev-page" class="btn-icon glass" ${n?"disabled":""}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          
          <div class="page-indicator">
            P\xE1gina <strong>${r}</strong> de <strong>${o}</strong>
          </div>
          
          <button id="next-page" class="btn-icon glass" ${l?"disabled":""}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </div>
    `}};var b=class extends h{constructor(e){super(e),this.state={isSaving:!1,error:null}}render(){let{isSaving:e,error:t}=this.state;return`
      <div class="modal-overlay" id="product-modal-overlay">
        <div class="modal-content glass">
          <header class="modal-header">
            <h2 style="font-size: 1.5rem;">Nuevo Producto</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
              Complete los datos b\xE1sicos para registrar la mercanc\xEDa.
            </p>
          </header>

          <form id="product-form" class="form modal-form">
            <div class="form-group">
              <label for="nombre">Nombre del Producto *</label>
              <input type="text" id="nombre" name="nombre" placeholder="Ej: Blusa Seda Azul" required ${e?"disabled":""}>
            </div>

            <div class="form-group">
              <label for="sku">SKU / Referencia</label>
              <input type="text" id="sku" name="sku" placeholder="Ej: BLU-SDA-001" ${e?"disabled":""}>
            </div>

            <div class="form-group">
              <label for="categoria">Categor\xEDa</label>
              <input type="text" id="categoria" name="categoria" placeholder="Ej: Damas / Blusas" ${e?"disabled":""}>
            </div>

            <div class="form-group">
              <label for="stock_minimo">Stock M\xEDnimo (Alerta de Reorden) *</label>
              <input type="number" id="stock_minimo" name="stock_minimo" placeholder="Ej: 5" min="1" value="5" required ${e?"disabled":""}>
            </div>

            <div class="form-group modal-note-box">
              <p>
                <strong style="color: var(--primary);">Nota:</strong> El stock inicial ser\xE1 0. Para agregar stock, pase las etiquetas RFID por el portal en modo Registro.
              </p>
            </div>

            ${t?`<p class="form-error">${t}</p>`:""}

            <footer class="modal-footer">
              <button type="button" class="btn btn-secondary modal-cancel-btn" id="btn-cancel" ${e?"disabled":""}>
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary modal-save-btn" ${e?"disabled":""}>
                ${e?"Guardando...":"Guardar Producto"}
              </button>
            </footer>
          </form>
        </div>
      </div>
    `}onMount(){let e=this.element.querySelector("#product-form"),t=this.element.querySelector("#btn-cancel"),r=this.element.querySelector("#product-modal-overlay");e&&e.addEventListener("submit",o=>{o.preventDefault();let n=new FormData(e),l={nombre:n.get("nombre"),sku:n.get("sku")||null,categoria:n.get("categoria")||"Sin categor\xEDa",stock_minimo:parseInt(n.get("stock_minimo"),10)||5,cantidad_inicial:0};this.props.onSave&&(this.setState({isSaving:!0,error:null}),this.props.onSave(l).catch(c=>{this.setState({isSaving:!1,error:c.message||"Error al guardar el producto"})}))}),t&&t.addEventListener("click",()=>{this.props.onClose&&this.props.onClose()}),r&&r.addEventListener("click",o=>{o.target===r&&this.props.onClose&&!this.state.isSaving&&this.props.onClose()})}};var x=class extends h{constructor(e){super(e),this.state={isLoading:!0,tags:[],returnRate:0,excedeUmbral:!1,umbral:80,error:null,isInitialFetchDone:!1}}async fetchData(){try{let[e,t]=await Promise.all([u.get(`/products/${this.props.product.id}/tags`),u.get("/reports/products/return-rates")]),r=t.find(o=>o.id===this.props.product.id)||{return_rate:0,excede_umbral:!1,umbral_retorno_critico:80};this.setState({tags:e,returnRate:r.return_rate,excedeUmbral:r.excede_umbral,umbral:r.umbral_retorno_critico,isLoading:!1,isInitialFetchDone:!0})}catch(e){console.error("Error fetching product detail metrics:",e),this.setState({error:"No se pudieron cargar las m\xE9tricas y etiquetas del producto.",isLoading:!1,isInitialFetchDone:!0})}}async unlinkTag(e){if(confirm(`\xBFEst\xE1s seguro de que quer\xE9s desvincular la etiqueta RFID ${e}? Esta acci\xF3n la desactivar\xE1 y ajustar\xE1 el stock.`))try{await u.delete(`/tags/${e}`),window.showToast&&window.showToast("Etiqueta desvinculada exitosamente","success"),this.fetchData(),appStore.setState({inventoryUpdated:Date.now()})}catch(t){console.error("Error unlinking tag:",t),alert("Error al desvincular la etiqueta: "+(t.response?.data?.detail||t.message))}}render(){let{product:e,onClose:t}=this.props,{isLoading:r,tags:o,returnRate:n,excedeUmbral:l,umbral:c,error:d,isInitialFetchDone:s}=this.state,i=n>c,p="success",a="var(--success)";i?(p="danger",a="var(--danger)"):n>=c*.5&&(p="warning",a="var(--warning)");let g=50,v=2*Math.PI*g,k=v-Math.min(n,100)/100*v;return`
      <div class="modal-overlay" id="product-detail-modal-overlay">
        <div class="modal-content glass product-detail-modal-content" style="max-width: 750px; padding: 2rem;">
          <header class="modal-header" style="position: relative; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
              <div>
                <span class="badge badge-secondary" style="margin-bottom: 0.5rem; text-transform: uppercase;">
                  ${e.categoria||"Sin categor\xEDa"}
                </span>
                <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--text);">${e.nombre}</h2>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">
                  SKU: <strong style="color: var(--text);">${e.sku||"Sin SKU"}</strong>
                </p>
              </div>
              <button class="btn btn-secondary glass close-detail-btn" id="btn-close-detail" style="padding: 0.5rem; border-radius: 50%; min-width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </header>

          ${r&&!s?`
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 1rem;">
              <div class="spinner"></div>
              <p style="color: var(--text-muted); font-size: 0.9rem;">Obteniendo informaci\xF3n de trazabilidad...</p>
            </div>
          `:d?`
            <div class="empty-state glass" style="padding: 2.5rem; border-color: rgba(239, 68, 68, 0.2);">
              <p style="color: var(--danger); font-weight: 600;">${d}</p>
              <button class="btn btn-secondary glass" onclick="window.retryFetchDetail()" style="margin-top: 1rem;">Reintentar</button>
            </div>
          `:`
            <div class="product-detail-grid">
              
              <!-- Left Column: Metrics & Alerts -->
              <div class="product-detail-left">
                
                <!-- Stock card -->
                <div class="detail-card glass">
                  <span class="card-label">Inventario F\xEDsico</span>
                  <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-top: 0.5rem;">
                    <span style="font-size: 2.5rem; font-weight: 900; color: ${e.stock<e.stock_minimo?"var(--danger)":"var(--primary)"};">${e.stock}</span>
                    <span style="color: var(--text-muted); font-size: 0.85rem;">prendas en stock</span>
                  </div>
                  <div style="margin-top: 0.75rem; font-size: 0.8rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem; display: flex; justify-content: space-between; color: var(--text-muted);">
                    <span>M\xEDnimo requerido:</span>
                    <strong style="color: var(--text);">${e.stock_minimo} unidades</strong>
                  </div>
                  ${e.stock<e.stock_minimo?`
                    <div style="margin-top: 0.75rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.5rem; border-radius: 6px; color: var(--danger); font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.35rem;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      STOCK BAJO EL M\xCDNIMO REQUERIDO
                    </div>
                  `:""}
                </div>

                <!-- Return Rate Widget -->
                <div class="detail-card glass return-rate-widget-card" style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.75rem; position: relative; overflow: hidden;">
                  <span class="card-label" style="align-self: flex-start;">Tasa de Retorno de Exhibici\xF3n</span>
                  
                  <div class="svg-gauge-container" style="position: relative; width: 130px; height: 130px; margin-top: 0.5rem;">
                    <svg width="130" height="130" viewBox="0 0 120 120" style="transform: rotate(-90deg);">
                      <!-- Background circle -->
                      <circle cx="60" cy="60" r="${g}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="10"></circle>
                      <!-- Progress circle -->
                      <circle cx="60" cy="60" r="${g}" fill="none" stroke="${a}" stroke-width="10"
                              stroke-dasharray="${v}" stroke-dashoffset="${k}"
                              stroke-linecap="round" style="transition: stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1);"></circle>
                    </svg>
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                      <span style="font-size: 1.75rem; font-weight: 900; color: var(--text);">${n}%</span>
                      <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Retorno</span>
                    </div>
                  </div>

                  <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                    Porcentaje de stock en exhibici\xF3n que retorn\xF3 a bodega sin venderse. Umbral tolerado: <strong>${c}%</strong>.
                  </p>

                  ${i?`
                    <div class="pulse-alert-critical text-blink" style="width: 100%; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.65rem 0.5rem; border-radius: 8px; color: var(--danger); font-size: 0.75rem; font-weight: 800; text-align: center; letter-spacing: 0.02em;">
                      \xA1RETORNO CR\xCDTICO SUPERADO!
                    </div>
                  `:`
                    <div style="width: 100%; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); padding: 0.5rem; border-radius: 8px; color: var(--success); font-size: 0.75rem; font-weight: 700; text-align: center;">
                      TASA DENTRO DEL L\xCDMITE SEGURO
                    </div>
                  `}
                </div>

              </div>

              <!-- Right Column: RFID Tags List -->
              <div class="product-detail-right glass">
                <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--text); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
                  <span style="display: inline-flex; align-items: center; gap: 0.4rem;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                    Trazabilidad RFID (${o.length})
                  </span>
                  <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">EPC \xDAnico</span>
                </h3>
                
                <div class="detail-tags-list-container" style="max-height: 290px; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 0.5rem;">
                  ${o.length===0?`
                    <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-size: 0.85rem; opacity: 0.5; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      No hay etiquetas vinculadas a este art\xEDculo.
                    </div>
                  `:o.map(f=>`
                    <div class="detail-tag-item" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.65rem 0.85rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;">
                      <div style="display: flex; flex-direction: column; gap: 0.15rem;">
                        <code style="color: var(--text); font-family: monospace; font-size: 0.8rem; font-weight: 600;">${f.epc}</code>
                        <span style="font-size: 0.65rem; color: var(--text-muted);">Asignado: ${f.asignada_en?new Date(f.asignada_en).toLocaleDateString():"N/A"}</span>
                      </div>
                      <button class="btn-unlink-tag" onclick="window.unlinkProductTag('${f.epc}')" title="Desvincular etiqueta RFID del producto">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        <span>Desvincular</span>
                      </button>
                    </div>
                  `).join("")}
                </div>
              </div>

            </div>
          `}
        </div>
      </div>

      <style>
      .product-detail-modal-content {
        animation: pd-scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      @keyframes pd-scale-up {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .product-detail-grid {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: 1.5rem;
        width: 100%;
      }
      .product-detail-left {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .product-detail-right {
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 1rem;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
      }
      .detail-card {
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 1rem;
        padding: 1.25rem;
      }
      .card-label {
        font-size: 0.725rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .btn-unlink-tag {
        background: transparent;
        border: 1px solid rgba(239, 68, 68, 0.2);
        color: rgba(239, 68, 68, 0.85);
        padding: 0.25rem 0.6rem;
        border-radius: 6px;
        font-size: 0.7rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        transition: all 0.2s ease;
      }
      .btn-unlink-tag:hover {
        background: rgba(239, 68, 68, 0.08);
        border-color: var(--danger);
        color: var(--danger);
        transform: translateY(-1px);
      }
      .detail-tag-item:hover {
        background: rgba(255,255,255,0.04) !important;
        border-color: rgba(255,255,255,0.08) !important;
      }
      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(255, 255, 255, 0.05);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes pd-pulse-blink {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(0.98); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
      }
      .text-blink {
        animation: pd-pulse-blink 1.5s infinite;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
      }
      @media (max-width: 700px) {
        .product-detail-grid {
          grid-template-columns: 1fr !important;
        }
      }
      </style>
    `}onMount(){let e=this.element.querySelector("#btn-close-detail"),t=this.element.querySelector("#product-detail-modal-overlay");e&&e.addEventListener("click",()=>{this.props.onClose&&this.props.onClose()}),t&&t.addEventListener("click",r=>{r.target===t&&this.props.onClose&&this.props.onClose()}),window.unlinkProductTag=r=>this.unlinkTag(r),window.retryFetchDetail=()=>this.fetchData(),this.state.isInitialFetchDone||this.fetchData()}dispose(){delete window.unlinkProductTag,delete window.retryFetchDetail}};var C=class extends h{constructor(e){super(e),this.state={products:[],isLoading:!0,error:null,isModalOpen:!1,isDetailModalOpen:!1,selectedProduct:null,lastActiveProductId:null,searchQuery:"",currentPage:1,itemsPerPage:10,stockFilter:"all",isColumnMenuOpen:!1,columns:[{key:"nombre",label:"Producto",hidden:!1,render:(t,r)=>`
            <span class="product-detail-trigger" style="color: var(--primary); font-weight: 700; cursor: pointer; border-bottom: 1px dashed var(--primary); transition: all 0.2s;" 
               onclick="window.dispatchEvent(new CustomEvent('show-product-detail', {detail: ${JSON.stringify(r).replace(/"/g,"&quot;")}}))">
              ${t}
            </span>
          `},{key:"sku",label:"SKU",hidden:!1},{key:"stock",label:"Stock Actual",hidden:!1,render:(t,r)=>{let o=r.stock_minimo||5;return t<o?`
                <div style="display: flex; align-items: center; gap: 0.5rem;" title="El stock actual es menor al m\xEDnimo seguro de ${o}">
                  <strong style="color: var(--danger); font-size: 1.1em;">${t}</strong>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.9;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
              `:`<strong style="color: var(--primary);">${t}</strong>`}},{key:"actions",label:"Acciones",hidden:!1,render:(t,r)=>`
            <div style="display: flex; justify-content: center;">
              <button class="btn btn-primary glass" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;" 
                      onclick="window.dispatchEvent(new CustomEvent('start-reg', {detail: {id: '${r.id}', name: '${r.nombre}'}}))">
                Vincular Tags
              </button>
            </div>`}]},this.table=new E({items:[],columns:this.state.columns}),this.unsubscribe=null,this.isInitialLoadDone=!1,this.handleStartReg=t=>this.startRegistration(t.detail.id,t.detail.name),this.handleShowDetail=t=>{this.setState({isDetailModalOpen:!0,selectedProduct:t.detail})}}async onMount(){if(this.isInitialLoadDone||(this.isInitialLoadDone=!0,this.fetchProducts()),window.removeEventListener("start-reg",this.handleStartReg),window.addEventListener("start-reg",this.handleStartReg),window.removeEventListener("show-product-detail",this.handleShowDetail),window.addEventListener("show-product-detail",this.handleShowDetail),!this.unsubscribe){let s=appStore.getState().inventoryUpdated;this.unsubscribe=appStore.subscribe(i=>{i.inventoryUpdated!==s?(s=i.inventoryUpdated,this.fetchProducts()):this.update()})}let e=this.element.querySelector(".filter-input");e&&(e.addEventListener("input",s=>{this.setState({searchQuery:s.target.value,currentPage:1})}),this.state.searchQuery&&(e.focus(),e.setSelectionRange(e.value.length,e.value.length)));let t=this.element.querySelector("#stock-filter-dropdown");if(t){let s=t.querySelector(".custom-select-trigger"),i=t.querySelectorAll(".custom-select-option");s&&s.addEventListener("click",a=>{a.stopPropagation(),t.classList.toggle("open")}),i.forEach(a=>{a.addEventListener("click",g=>{g.stopPropagation();let v=a.dataset.value;t.classList.remove("open"),this.setState({stockFilter:v,currentPage:1})})});let p=a=>{t.contains(a.target)||t.classList.remove("open")};document.addEventListener("click",p),this.closeDropdownFn=p}let r=this.element.querySelector("#column-menu-btn");if(r&&r.addEventListener("click",s=>{s.stopPropagation(),this.setState({isColumnMenuOpen:!this.state.isColumnMenuOpen})}),this.state.isColumnMenuOpen){let s=i=>{let p=this.element.querySelector(".column-menu-dropdown");p&&!p.contains(i.target)&&i.target.id!=="column-menu-btn"&&(this.setState({isColumnMenuOpen:!1}),document.removeEventListener("click",s))};document.addEventListener("click",s)}this.element.querySelectorAll(".col-toggle-cb").forEach(s=>{s.addEventListener("change",i=>{let p=i.target.dataset.key,a=this.state.columns.map(g=>g.key===p?{...g,hidden:!i.target.checked}:g);this.setState({columns:a})})});let n=this.element.querySelector(".pagination-container");n&&this.pagination&&(this.pagination.element=n,this.pagination.onMount());let l=this.element.querySelector("#btn-add-product");l&&l.addEventListener("click",()=>this.setState({isModalOpen:!0})),this.state.isModalOpen&&this.modal&&(this.modal.element=this.element.querySelector("#product-modal-overlay"),this.modal.element&&this.modal.onMount()),this.state.isDetailModalOpen&&this.detailModal&&(this.detailModal.element=this.element.querySelector("#product-detail-modal-overlay"),this.detailModal.element&&this.detailModal.onMount());let{registrationSession:c}=appStore.getState(),d=this.element.querySelector("#registration-panel");c&&d&&this._lastScrolledSession!==c.sessionId&&(this._lastScrolledSession=c.sessionId,setTimeout(()=>{d.scrollIntoView({behavior:"smooth",block:"start"})},0))}dispose(){this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=null),this.closeDropdownFn&&document.removeEventListener("click",this.closeDropdownFn),window.removeEventListener("start-reg",this.handleStartReg),window.removeEventListener("show-product-detail",this.handleShowDetail)}async handleSaveProduct(e){try{await u.post("/products",e),this.setState({isModalOpen:!1}),this.fetchProducts(),window.showToast?window.showToast("Producto creado exitosamente","success"):console.log("\u2705 Producto creado exitosamente")}catch(t){throw console.error("Error saving product:",t),t}}async startRegistration(e,t){try{let o=(await u.post("/tags/scan-batch",{product_id:e})).session_id;await u.post("/portal/mode",{mode:"REGISTRO",device_id:"smartstock-portal-01"}),appStore.setState({registrationSession:{productId:e,productName:t,sessionId:o,registeredTags:[],targetCount:1},portalMode:"REGISTRO"}),console.log(`\u{1F3AF} Registro iniciado para: ${t}`)}catch(r){console.error("Error al iniciar registro:",r),alert("No se pudo iniciar la sesi\xF3n de registro")}}async stopRegistration(){try{await u.post("/portal/mode",{mode:"APAGADO",device_id:"smartstock-portal-01"}),appStore.setState({registrationSession:null,portalMode:"APAGADO"}),this.fetchProducts()}catch(e){console.error("Error al detener registro:",e)}}async fetchProducts(){this.setState({isLoading:!0});try{let t=(await u.get("/products")).map(r=>({...r,stock:r.stock!==void 0?r.stock:r.cantidad_inicial}));this.setState({products:t,isLoading:!1})}catch(e){console.error("Error fetching products:",e),this.setState({error:"No se pudo cargar el inventario",isLoading:!1})}}render(){let{products:e,isLoading:t,error:r,isModalOpen:o,isDetailModalOpen:n,searchQuery:l,currentPage:c,itemsPerPage:d,stockFilter:s,isColumnMenuOpen:i,columns:p}=this.state,{registrationSession:a,portalMode:g,isAuthenticated:v}=appStore.getState();if(!v)return'<div class="empty-state">Redirigiendo al login...</div>';let k=e.filter(m=>{let w=l.toLowerCase(),L=m.nombre?.toLowerCase().includes(w)||m.sku?.toLowerCase().includes(w),$=!0;return s==="in-stock"&&($=m.stock>0),s==="out-of-stock"&&($=m.stock===0),L&&$}),f=k.length,P=(c-1)*d,M=k.slice(P,P+d),D=e.length,R=e.reduce((m,w)=>m+(w.stock||0),0);return`
      <div class="inventory-page">
        ${a?this.renderRegistrationPanel(a):""}
        
        ${o?this.renderModal():""}
        ${n?this.renderDetailModal():""}
 
        <header class="inventory-header" style="${a?"opacity: 0.5; pointer-events: none;":""}">
          <div class="header-titles">
            <h1 class="page-title">Inventario de Productos</h1>
            <p class="page-subtitle" style="margin-bottom: 0.5rem;">Gesti\xF3n de stock y trazabilidad RFID.</p>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <span class="badge badge-muted" style="text-transform: none; font-size: 0.75rem; padding: 0.2rem 0.6rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>
                <strong>${D}</strong> productos
              </span>
              <span class="badge badge-primary" style="text-transform: none; font-size: 0.75rem; padding: 0.2rem 0.6rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8;"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3m18 0v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8m18 0H3m4.5 4h9"></path></svg>
                <strong>${R}</strong> unidades en total
              </span>
            </div>
          </div>
          <button class="btn btn-primary" id="btn-add-product">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Nuevo Producto</span>
          </button>
        </header>

        ${a?"":`
          <div class="inventory-filters-bar glass">
            <div class="search-input-wrapper">
              <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Buscar por nombre o SKU..." class="filter-input" value="${l}">
            </div>
            
            <div class="filters-actions">
              <div class="custom-select-container" id="stock-filter-dropdown">
                <div class="custom-select-trigger filter-select">
                  <span>${s==="in-stock"?"Con Stock":s==="out-of-stock"?"Sin Stock":"Todo el Stock"}</span>
                </div>
                <div class="custom-select-options">
                  <div class="custom-select-option ${s==="all"?"selected":""}" data-value="all">Todo el Stock</div>
                  <div class="custom-select-option ${s==="in-stock"?"selected":""}" data-value="in-stock">Con Stock</div>
                  <div class="custom-select-option ${s==="out-of-stock"?"selected":""}" data-value="out-of-stock">Sin Stock</div>
                </div>
              </div>

              <div class="column-menu-wrapper">
                <button id="column-menu-btn" class="btn btn-secondary glass">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                </button>
                
                ${i?`
                  <div class="column-menu-dropdown">
                    <h4 style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem; letter-spacing: 0.05em;">Columnas</h4>
                    ${p.map(m=>`
                      <label class="column-toggle-label">
                        <input type="checkbox" class="col-toggle-cb" data-key="${m.key}" ${m.hidden?"":"checked"}>
                        <span>${m.label}</span>
                      </label>
                    `).join("")}
                  </div>
                `:""}
              </div>
            </div>
          </div>
        `}

        ${t?'<div class="empty-state glass"><p>Cargando inventario...</p></div>':r?`<div class="empty-state glass"><p style="color: var(--danger);">${r}</p></div>`:`
            ${this.renderTable(M)}
            ${a?"":this.renderPagination(f)}
          `}
      </div>
    `}renderPagination(e){return this.pagination=new y({totalItems:e,itemsPerPage:this.state.itemsPerPage,currentPage:this.state.currentPage,onPageChange:t=>this.setState({currentPage:t})}),this.pagination.render()}renderModal(){return this.modal=new b({onClose:()=>this.setState({isModalOpen:!1}),onSave:e=>this.handleSaveProduct(e)}),this.modal.render()}renderDetailModal(){return this.detailModal=new x({product:this.state.selectedProduct,onClose:()=>this.setState({isDetailModalOpen:!1,selectedProduct:null})}),this.detailModal.render()}renderRegistrationPanel(e){let t=e.registeredTags.filter(s=>s.status==="new"),r=t.length,o=e.targetCount||1,n=Math.min(r/o*100,100),l=r>=o,c=this.state.lastActiveProductId!==e.productId;c&&(this.state.lastActiveProductId=e.productId);let d={target:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',scan:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>',check:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="success-icon-animate"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',tag:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; opacity: 0.5;"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',plus:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',minus:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>'};return window.updateTarget=s=>{let i=Math.max(1,parseInt(s)||1);appStore.setState({registrationSession:{...appStore.getState().registrationSession,targetCount:i}})},window.adjustTarget=s=>{let i=appStore.getState().registrationSession.targetCount||1;window.updateTarget(i+s)},`
      <div id="registration-panel" class="registration-panel glass ${l?"success":""} ${c?"entrance-animation":""}">
        <div class="registration-panel-header">
          <div class="registration-info">
            <span class="badge badge-primary" style="margin-bottom: 0.75rem; display: inline-flex; align-items: center; gap: 0.5rem;">
              ${d.scan}
              MODO REGISTRO
            </span>
            <h2 class="registration-title">${e.productName}</h2>
            <p class="registration-subtitle">Aproxime las etiquetas al lector RFID.</p>
          </div>
          <div class="registration-actions">
            ${l?d.check:""}
            <button class="btn ${l?"btn-primary":"btn-danger"} registration-stop-btn" onclick="window.stopReg()">
              ${l?"Confirmar Registro":"Finalizar registro"}
            </button>
          </div>
        </div>

        <div class="registration-progress-container">
          <div class="registration-progress-fill" style="width: ${n}%"></div>
        </div>

        <div class="registration-stats-row">
          <div class="registration-stat">
            <span class="stat-label">Objetivo</span>
            <div class="stepper-container">
              <button class="stepper-btn" onclick="window.adjustTarget(-1)">${d.minus}</button>
              <input type="number" class="target-input-minimal" value="${o}" 
                     min="1" onchange="window.updateTarget(this.value)" 
                     onkeyup="if(event.key === 'Enter') window.updateTarget(this.value)">
              <button class="stepper-btn" onclick="window.adjustTarget(1)">${d.plus}</button>
            </div>
          </div>
          
          <div class="registration-stat" style="border-left: 1px solid rgba(255,255,255,0.05);">
            <span class="stat-label">Nuevas</span>
            <div class="stat-value-group">
              <span class="stat-value" style="color: ${l?"var(--success)":"var(--text)"}">${r}</span>
              <span class="stat-unit">/ ${o}</span>
            </div>
          </div>
        </div>

        <div class="registration-tags-list">
          ${t.length===0?'<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem; opacity: 0.5;">Esperando lecturas de hardware...</div>':t.map(s=>`
                <div class="tag-item-new">
                  <div class="tag-item-id">
                    ${d.tag}
                    <span>${s.epc}</span>
                  </div>
                  <span class="tag-item-status">VINCULADO</span>
                </div>
              `).reverse().join("")}
        </div>
        
        ${this.renderConflictsPanel(e)}
      </div>
    `}renderConflictsPanel(e){let t=new Map;e.registeredTags.filter(s=>s.status==="conflict").forEach(s=>{t.set(s.epc,s)});let r=Array.from(t.values());if(r.length===0)return"";let o=r.filter(s=>s.derived_state==="reassignable"),n=r.filter(s=>s.derived_state==="recyclable"),l=r.filter(s=>s.derived_state==="blocked_transit"),c=r.filter(s=>s.derived_state==="blocked_return");window.resolveConflicts=async()=>{try{let s=[];if(o.forEach(i=>s.push({epc:i.epc,deduct_from_original:!0})),n.forEach(i=>s.push({epc:i.epc,deduct_from_original:!1})),s.length>0){await u.post("/tags/resolve-conflicts",{session_id:appStore.getState().registrationSession.sessionId,action:"reassign_all",decisions:s}),window.showToast&&window.showToast("Etiquetas reasignadas exitosamente","success");let i=appStore.getState().registrationSession,p=i.registeredTags.map(a=>a.status==="conflict"&&(a.derived_state==="reassignable"||a.derived_state==="recyclable")?{...a,status:"new"}:a).filter(a=>a.status!=="conflict");appStore.setState({registrationSession:{...i,registeredTags:p}})}}catch(s){console.error("Error al resolver conflictos",s),alert("Error al reasignar: "+(s.response?.data?.detail||s.message))}};let d=s=>[...new Set(s.map(p=>p.original_product_name||"Desconocido"))].join(", ");return`
      <div class="conflicts-panel" style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
        <h4 style="color: var(--warning); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
           Etiquetas en Conflicto (${r.length})
        </h4>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">Estas etiquetas ya estaban vinculadas a otros productos.</p>
        
        <div style="font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
          ${o.length>0?`
            <div style="color: var(--text); padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 6px; border-left: 3px solid var(--text-muted);">
               <strong>${o.length} por Error de Registro:</strong> 
               Pertenec\xEDan a <em>${d(o)}</em>. <br>
               <span style="opacity: 0.7; font-size: 0.75rem;">Se descontar\xE1n de su origen y se sumar\xE1n a este producto.</span>
            </div>`:""}
            
          ${n.length>0?`
            <div style="color: var(--success); padding: 0.75rem; background: rgba(0,255,0,0.05); border-radius: 6px; border-left: 3px solid var(--success);">
               <strong>${n.length} Listas para Reciclar:</strong> 
               Eran de <em>${d(n)}</em> y ya fueron vendidas. <br>
               <span style="opacity: 0.7; font-size: 0.75rem;">Se sumar\xE1n a este producto sin afectar otros inventarios.</span>
            </div>`:""}
            
          ${l.length>0?`
            <div style="color: var(--danger); padding: 0.75rem; background: rgba(255,0,0,0.05); border-radius: 6px; border-left: 3px solid var(--danger);">
               <strong>${l.length} Bloqueadas (En tr\xE1nsito):</strong> 
               Pertenecen a <em>${d(l)}</em> y salieron en este turno. Termine el turno primero si desea reasignarlas.
            </div>`:""}
            
          ${c.length>0?`
            <div style="color: var(--danger); padding: 0.75rem; background: rgba(255,0,0,0.05); border-radius: 6px; border-left: 3px solid var(--danger);">
               <strong>${c.length} Bloqueadas (Retornadas):</strong> 
               Pertenec\xEDan a <em>${d(c)}</em> y est\xE1n marcadas como devoluci\xF3n. Por seguridad, no pueden reasignarse directamente.
            </div>`:""}
        </div>
        
        ${o.length>0||n.length>0?`
          <button class="btn btn-primary" onclick="window.resolveConflicts()" style="width: 100%; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            Corregir e Incorporar (${o.length+n.length})
          </button>
        `:""}
      </div>
    `}renderTable(e){return window.stopReg=()=>{let r=appStore.getState().registrationSession?.registeredTags?.filter(o=>o.status==="conflict")?.length||0;r>0&&!confirm(`Tienes ${r} etiqueta(s) en conflicto sin resolver.

Si finalizas ahora, estas etiquetas SER\xC1N IGNORADAS y no se vincular\xE1n a este producto.

\xBFDeseas finalizar el registro de todos modos?`)||this.stopRegistration()},this.table.props.items=e,this.table.props.columns=this.state.columns,this.table.render()}};export{C as default};
