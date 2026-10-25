import { PLACES, UNITS, iso, daysLeft, uid, placeholderName } from "../domain.js";
import { buzz } from "../device.js";
import { Sheet } from "./sheet.js";
import { Ticket } from "./ticket.js";
import { useState, useEffect, useRef, html } from "../lib.js";

/* ---------- Editor ---------- */
export const FILLED=["name","brand","location","image","nutri","nova","eco","shelfDays"];
export function Editor({initial,scanCount,onSave,onDelete,onClose}){
  const [f,setF]=useState({qty:1,unit:"pcs",location:"Frigo",expiry:"",name:"",brand:"",code:"",...initial});
  const touched=useRef(new Set());
  const set=(k)=>(e)=>{ touched.current.add(k); setF(v=>({...v,[k]:e.target.value})); };
  // the product lookup finishes after the sheet opened: fill what the person has not typed yet
  useEffect(()=>{ if(initial.loading) return;
    setF(v=>{ const n={...v}; FILLED.forEach(k=>{ if(!touched.current.has(k) && initial[k]!=null && initial[k]!=="") n[k]=initial[k]; });
      // suggest a date from the product type, until the person picks one
      if(!initial.id && !touched.current.has("expiry") && !n.expiry && Number(n.shelfDays)>0){ n.expiry=iso(Number(n.shelfDays)); n.suggested=true; }
      return n; });
  },[initial.loading]);
  const isNew=!initial.id;
  const quick=[["+3 j",3],["+1 sem.",7],["+1 mois",30],["+6 mois",182]];
  return html`<${Sheet} label="Article" onClose=${onClose}>${(close)=>html`
    ${initial.scanned && html`<${Ticket} p=${initial} count=${scanCount}/>`}
    <h2>${isNew?(initial.newLot?"Nouveau lot":initial.scanned?"Ranger cet article":"Nouvel article"):"Modifier"}</h2>
    ${initial.newLot && html`<p class="hint" style=${{marginTop:"-8px",marginBottom:"14px"}}>Même produit, autre date de péremption : il apparaîtra comme un lot séparé.</p>`}
    <form class="form" onSubmit=${e=>{e.preventDefault(); if(!f.name.trim()&&!f.code) return;
      const {found,hint,scanned,raw,loading,offline,source,shelfDays,suggested,newLot,...clean}=f;
      onSave({...clean,name:f.name.trim()||placeholderName(f.code),_learn:isNew&&f.expiry&&!f.suggested?daysLeft(f.expiry):0,qty:Math.max(0,Number(f.qty)||0),id:f.id||uid(),addedAt:f.addedAt||Date.now()}); buzz(15); close();}}>
      <label class="field">Produit<input id="f-name" required=${!f.code} value=${f.name} onChange=${set("name")} placeholder=${initial.loading?"Recherche en cours…":f.code?"Laisser vide : complété plus tard":"Ex. Riz basmati"} autoComplete="off" /></label>
      ${initial.offline && html`<p class="hint">Pas de réseau : enregistrez l'article, sa fiche sera complétée automatiquement au retour du réseau.</p>`}
      <label class="field">Marque<input id="f-brand" value=${f.brand} onChange=${set("brand")} placeholder="Facultatif" autoComplete="off" /></label>
      <div class="field">Rangé où ?
        <div class="places" role="group" aria-label="Emplacement">
          ${PLACES.map(p=>html`<button type="button" key=${p.id} class="place press" style=${{"--c":p.c}} aria-pressed=${f.location===p.id}
            onClick=${()=>{ touched.current.add("location"); setF(v=>({...v,location:p.id})); }}><i></i>${p.id==="Congélateur"?"Congél.":p.id}</button>`)}
        </div></div>
      <div class="two">
        <label class="field">Quantité<input id="f-qty" type="number" min="0" step="any" inputmode="decimal" value=${f.qty} onChange=${set("qty")} /></label>
        <label class="field">Unité<select id="f-unit" value=${f.unit} onChange=${set("unit")}>${UNITS.map(u=>html`<option key=${u} value=${u}>${u}</option>`)}</select></label>
      </div>
      <label class="field">À consommer avant<input id="f-exp" type="date" value=${f.expiry} onChange=${e=>{ set("expiry")(e); setF(v=>({...v,suggested:false})); }} /></label>
      ${f.suggested && f.expiry && html`<p class="hint">Date suggérée pour ce type de produit (${daysLeft(f.expiry)} j). Vérifiez l'emballage.</p>`}
      <div class="quick">${quick.map(([l,n])=>html`<button type="button" key=${l} class="press" onClick=${()=>{ touched.current.add("expiry"); setF(v=>({...v,expiry:iso(n),suggested:false})); }}>${l}</button>`)}
        ${f.expiry && html`<button type="button" class="press" onClick=${()=>{ touched.current.add("expiry"); setF(v=>({...v,expiry:"",suggested:false})); }}>Sans date</button>`}</div>
      <div class="actions">
        ${!isNew && html`<button type="button" class="btn del press" onClick=${()=>{onDelete(f); close();}}>Supprimer</button>`}
        <button class="btn main press" type="submit">${isNew?"Ajouter au stock":"Enregistrer"}</button>
      </div>
    </form>`}<//>`;
}
