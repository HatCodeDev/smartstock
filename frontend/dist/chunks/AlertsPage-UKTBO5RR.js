import"./chunk-NUFRM6SI.js";import{a as i}from"./chunk-Y5NLVTPE.js";import{a as t,b as a}from"./chunk-VBOOU2QQ.js";var r=class extends a{constructor(e){super(e),this.state=t.getState(),this.table=new i({items:[],columns:[{key:"timestamp",label:"Fecha/Hora",render:s=>new Date(s).toLocaleString()},{key:"type",label:"Categor\xEDa",render:s=>`<span class="badge ${s==="TAG_DESCONOCIDA"?"badge-warning":"badge-danger"}">${s}</span>`},{key:"message",label:"Descripci\xF3n"},{key:"status",label:"Estado",render:()=>'<span class="badge badge-success">Auditado</span>'}]}),this.unsubscribe=null}onMount(){this.unsubscribe||(this.unsubscribe=t.subscribe(e=>{this.setState(e)}))}render(){let{alerts:e}=this.state;return`
      <div class="alerts-page">
        <header style="margin-bottom: 2rem;">
          <h1 style="font-size: 1.5rem; font-weight: 700;">Historial de Alertas</h1>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Registro de incidencias detectadas por el sistema RFID.</p>
        </header>

        <div class="alerts-summary glass" style="display: flex; gap: 2rem; padding: 1.5rem; border-radius: 1rem; margin-bottom: 2rem;">
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Total Alertas (D\xEDa)</span>
            <span style="font-size: 1.5rem; font-weight: 700;">${e.length}</span>
          </div>
        </div>

        ${this.renderTable(e)}
      </div>
    `}renderTable(e){return this.table.props.items=e,this.table.render()}dispose(){this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=null)}};export{r as default};
