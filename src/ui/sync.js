import { buzz } from "../device.js";
import { lsGet, DEFAULT_SERVER, PB_KEY, pbReq, SYNC_LABEL, SYNC_COLOR } from "../storage.js";
import { I } from "./icons.js";
import { Sheet } from "./sheet.js";
import { useState, html } from "../lib.js";

export function SyncSheet({store,onClose}){
  const {pb,sync,pending,login,logout,resync}=store;
  const [url,setUrl]=useState(pb?pb.url:DEFAULT_SERVER); const [email,setEmail]=useState(pb?pb.email:""); const [pw,setPw]=useState("");
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false); const [info,setInfo]=useState("");
  const forgot=async()=>{ setErr(""); setInfo("");
    if(!email.trim()){ setErr("Saisissez d'abord votre e-mail."); return; }
    let base=url.trim().replace(/\/+$/,""); if(!/^https?:\/\//.test(base)) base="https://"+base;
    try{ await pbReq({url:base},"/api/collections/users/request-password-reset",{method:"POST",body:JSON.stringify({email:email.trim()})});
      setInfo("Si ce compte existe, un e-mail vient d'être envoyé avec un lien pour choisir un nouveau mot de passe."); buzz(15); }
    catch(x){ setErr(x.status?"L'envoi a échoué : le serveur n'a pas encore de messagerie configurée. Demandez à l'administrateur.":"Serveur injoignable."); } };
  const testNotif=async()=>{ setErr(""); setInfo(""); setBusy(true);
    try{ const r=await pbReq(pb,"/api/garde-manger/notify-test",{method:"POST"});
      setInfo(r&&r.count?`Notification envoyée (${r.count} produit${r.count>1?"s":""} à finir).`:"Notification envoyée : rien ne périme bientôt."); buzz(15); }
    catch(x){ setErr(x.status?x.message:"Serveur injoignable."); }
    finally{ setBusy(false); } };
  const submit=async(e)=>{ e.preventDefault(); setErr(""); setBusy(true);
    try{ await login(url,email,pw); setPw(""); buzz(15); }catch(x){ setErr(x.message); buzz([30,60,30]); } finally{ setBusy(false); } };
  const connected = pb && sync!=="error";
  return html`<${Sheet} label="Synchronisation" onClose=${onClose}>${(close)=>html`
    <h2>Synchronisation</h2>
    <div class="sync-state" style=${{"--rc":SYNC_COLOR[sync]}}><i></i><div><b>${SYNC_LABEL[sync]}</b>
      <span>${pb?`${pb.email} · ${pb.url.replace(/^https?:\/\//,"")}`:"Connectez votre serveur PocketBase pour partager le stock entre plusieurs téléphones."}</span>
      ${pending>0 && html`<span>${pending} modification${pending>1?"s":""} en attente d'envoi</span>`}</div></div>
    ${connected ? html`<div class="actions">
        <button type="button" class="btn del press" onClick=${()=>{logout(); buzz(10);}}>Se déconnecter</button>
        <button type="button" class="btn main press" onClick=${()=>{resync(); buzz(10);}}>Synchroniser</button></div>
        <button type="button" class="btn soft press" onClick=${testNotif} disabled=${busy}>${I.bell}${busy?"Envoi…":"Tester les notifications"}</button>
        ${info && html`<p class="hint" role="status">${info}</p>`}
        ${err && html`<p class="form-err" role="alert">${err}</p>`}`
    : html`<form class="form" onSubmit=${submit}>
        <label class="field">Adresse du serveur<input id="pb-url" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="https://stock.mondomaine.fr" required value=${url} onChange=${e=>setUrl(e.target.value)} /></label>
        <label class="field">E-mail<input id="pb-email" type="email" autocomplete="username" autocapitalize="off" required value=${email} onChange=${e=>setEmail(e.target.value)} /></label>
        <label class="field">Mot de passe<input id="pb-pw" type="password" autocomplete="current-password" required value=${pw} onChange=${e=>setPw(e.target.value)} /></label>
        ${err && html`<p class="form-err" role="alert">${err}</p>`}
        ${info && html`<p class="hint" role="status">${info}</p>`}
        <div class="actions">
          ${pb && html`<button type="button" class="btn del press" onClick=${()=>logout()}>Oublier</button>`}
          <button class="btn main press" type="submit" disabled=${busy}>${busy?"Connexion…":"Se connecter"}</button></div>
        <button type="button" class="link-btn" onClick=${forgot}>Mot de passe oublié ?</button>
        <p class="hint">Le stock déjà présent sur ce téléphone est envoyé sur le serveur à la connexion.</p>
      </form>`}
  `}<//>`;
}

/* ---------- New password, opened from the reset e-mail ---------- */
export function ResetSheet({token,onDone}){
  const [pw,setPw]=useState(""), [pw2,setPw2]=useState(""), [err,setErr]=useState(""), [ok,setOk]=useState(false), [busy,setBusy]=useState(false);
  const base=(lsGet(PB_KEY,null)||{}).url||DEFAULT_SERVER;
  const submit=async(e)=>{ e.preventDefault(); setErr("");
    if(pw.length<8){ setErr("8 caractères minimum."); return; }
    if(pw!==pw2){ setErr("Les deux mots de passe ne sont pas identiques."); return; }
    setBusy(true);
    try{ await pbReq({url:base},"/api/collections/users/confirm-password-reset",{method:"POST",body:JSON.stringify({token,password:pw,passwordConfirm:pw2})}); setOk(true); buzz(15); }
    catch(x){ setErr(x.status?"Ce lien a expiré ou a déjà servi. Redemandez un e-mail depuis l'app.":"Serveur injoignable."); }
    finally{ setBusy(false); } };
  return html`<${Sheet} label="Nouveau mot de passe" onClose=${onDone}>${(close)=>html`
    <h2>Nouveau mot de passe</h2>
    ${ok ? html`<p class="hint">C'est fait. Ouvrez Garde-manger depuis votre écran d'accueil et connectez-vous avec ce nouveau mot de passe (bouton nuage).</p>
        <div class="actions"><button class="btn main press" onClick=${close}>Fermer</button></div>`
    : html`<form class="form" onSubmit=${submit}>
        <label class="field">Nouveau mot de passe<input id="rs-pw" type="password" autocomplete="new-password" required value=${pw} onChange=${e=>setPw(e.target.value)} /></label>
        <label class="field">Confirmer<input id="rs-pw2" type="password" autocomplete="new-password" required value=${pw2} onChange=${e=>setPw2(e.target.value)} /></label>
        ${err && html`<p class="form-err" role="alert">${err}</p>`}
        <div class="actions"><button class="btn main press" type="submit" disabled=${busy}>${busy?"Enregistrement…":"Enregistrer"}</button></div>
      </form>`}
  `}<//>`;
}
