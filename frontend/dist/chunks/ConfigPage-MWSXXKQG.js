import{a as i}from"./chunk-C266VY5R.js";import{b as o}from"./chunk-55AWPCXK.js";import{b as s}from"./chunk-VBOOU2QQ.js";var n=class extends s{constructor(r){super(r),this.state={config:null,loading:!0}}async onMount(){if(this.state.loading){try{let t=await o.get("/config");this.setState({config:t,loading:!1})}catch{i.show("Error al cargar configuraci\xF3n","danger"),this.setState({loading:!1})}return}let r=this.element.querySelector("#toggle-cierre"),e=this.element.querySelector("#input-hora");r&&r.addEventListener("change",t=>{this.updateConfig("cierre_auto_habilitado",t.target.checked)}),e&&e.addEventListener("change",t=>{t.target.value&&this.updateConfig("hora_cierre_auto",t.target.value)})}async updateConfig(r,e){try{let t={[r]:e},a=await o.put("/config",t);this.setState({config:a}),i.show("Configuraci\xF3n guardada","success")}catch{i.show("Error al guardar","danger");let a=await o.get("/config");this.setState({config:a})}}render(){if(this.state.loading)return'<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Cargando...</div>';if(!this.state.config)return'<div style="padding: 2rem; text-align: center; color: var(--danger);">No se pudo cargar la configuraci\xF3n.</div>';let{hora_cierre_auto:r,cierre_auto_habilitado:e}=this.state.config;return`
      <div class="config-page" style="max-width: 800px; margin: 0 auto; animation: slideDownFade 0.4s ease-out forwards;">
        <header style="margin-bottom: 2rem;">
          <h1 style="font-size: 1.8rem; font-weight: 700; margin-bottom: 0.25rem;">Configuraci\xF3n</h1>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Ajustes del sistema y automatizaciones.</p>
        </header>

        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Cierre Autom\xE1tico -->
          <div class="glass" style="padding: 1.5rem; border-radius: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
              <div>
                <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Cierre Autom\xE1tico
                </h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">
                  Si te olvid\xE1s de hacer el corte manual, el sistema lo har\xE1 por vos a esta hora y descontar\xE1 el stock autom\xE1ticamente.
                </p>
              </div>
              <label style="position: relative; display: inline-block; width: 50px; height: 28px; flex-shrink: 0;">
                <input type="checkbox" id="toggle-cierre" ${e?"checked":""} style="opacity: 0; width: 0; height: 0; position: absolute;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${e?"var(--primary)":"var(--border)"}; transition: .4s; border-radius: 34px;">
                  <span style="position: absolute; content: ''; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; transform: ${e?"translateX(22px)":"translateX(0)"};"></span>
                </span>
              </label>
            </div>
            
            <div style="display: flex; align-items: center; gap: 1rem; opacity: ${e?"1":"0.5"}; pointer-events: ${e?"auto":"none"}; transition: 0.3s;">
              <label for="input-hora" style="font-size: 0.95rem; font-weight: 500;">Hora de ejecuci\xF3n:</label>
              <input type="time" id="input-hora" value="${r}" style="background: var(--background); border: 1px solid var(--border); color: var(--text); padding: 0.5rem 1rem; border-radius: 0.5rem; font-family: inherit; font-size: 1rem; outline: none; cursor: pointer;">
            </div>
          </div>

          <!-- El panel de Alertas de Tiempo Excedido fue removido por requerimiento de negocio. -->

        </div>
      </div>
    `}};export{n as default};
