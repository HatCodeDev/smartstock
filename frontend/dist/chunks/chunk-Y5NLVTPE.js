import{b as d}from"./chunk-VBOOU2QQ.js";var s=class extends d{constructor(e){super(e)}render(){let{items:e=[],columns:n=[]}=this.props;if(e.length===0)return`
        <div class="empty-state glass">
          <p>No hay datos para mostrar.</p>
        </div>
      `;let r=n.filter(t=>!t.hidden);return`
      <div class="table-container glass">
        <table class="data-table">
          <thead>
            <tr>
              ${r.map(t=>`<th>${t.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${e.map(t=>`
              <tr>
                ${r.map(a=>`
                  <td data-label="${a.label}">${a.render?a.render(t[a.key],t):t[a.key]||"-"}</td>
                `).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `}};export{s as a};
