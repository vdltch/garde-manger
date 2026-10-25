import { NUTRI_C } from "../domain.js";
import { html } from "../lib.js";

/* ---------- Receipt ---------- */
export function Barcode({code}){
  const s=(code||"0000000000000").replace(/\D/g,"").padEnd(13,"7");
  let x=0; const bars=[];
  for(let i=0;i<s.length*2;i++){ const d=+s[i%s.length]; const w=1+((d+i)%3); if(i%2===0) bars.push(html`<rect key=${i} x=${x} y="0" width=${w} height="38" fill="currentColor"/>`); x+=w+1+(d%2); }
  return html`<svg viewBox=${`0 0 ${x} 38`} preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
}
export function Score({label,g}){ return g ? html`<span class="score" style=${{"--sc":NUTRI_C[g]}}><small>${label}</small><b>${g.toUpperCase()}</b></span>` : null; }
export function Ticket({p,count}){
  const now=new Date();
  return html`<div class="ticket" aria-label="Ticket de scan">
    <div class="t-head">GARDE-MANGER</div>
    <div class="r"><span>${now.toLocaleDateString("fr-FR")}</span><span>${now.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span></div>
    <hr/>
    <div class="r"><span>SCAN N°</span><span>${String(count).padStart(4,"0")}</span></div>
    <div class="t-prod">
      <div class="t-big">${p.loading?html`<span class="blink">RECHERCHE DU PRODUIT…</span>`:(p.name||"Article non référencé")}</div>
      ${p.image && html`<img class="t-img" src=${p.image} alt="" referrerpolicy="no-referrer"/>`}
    </div>
    ${p.brand && html`<div class="r"><span>MARQUE</span><span>${p.brand.toUpperCase()}</span></div>`}
    ${p.hint && html`<div class="r"><span>FORMAT</span><span>${p.hint}</span></div>`}
    ${p.code && html`<div class="r"><span>EAN</span><span>${p.code}</span></div>`}
    ${(p.nutri||p.eco||p.nova>0) && html`<div class="t-scores"><${Score} label="NUTRI" g=${p.nutri}/>${p.nova>0 && html`<span class="score nova n${p.nova}"><small>NOVA</small><b>${p.nova}</b></span>`}<${Score} label="ÉCO" g=${p.eco}/></div>`}
    <div class="r"><span>SOURCE</span><span>${p.loading?"…":p.found?p.source:p.offline?"HORS LIGNE":p.code?"INCONNU · À COMPLÉTER":"QR CODE"}</span></div>
    <hr/>
    <${Barcode} code=${p.code||p.raw}/>
  </div>`;
}
