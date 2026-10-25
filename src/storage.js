// Storage: localStorage cache + PocketBase sync (queue, realtime, auth).
import { LS_KEY, uid } from "./domain.js";
import { vt } from "./device.js";
import { useState, useEffect, useRef } from "./lib.js";

/* ---------- Storage ----------
   1. localStorage: always, as the on-device cache (works offline).
   2. PocketBase: when the user signs in to their own server, changes go through a queue and sync in real time. */
export const lsGet=(k,d)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } };
export const lsSet=(k,v)=>{ try{ v==null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
export function loadLocal(){ return lsGet(LS_KEY,null); }
export function saveLocal(items){ lsSet(LS_KEY,items); }
export const DEFAULT_SERVER = (typeof location!=="undefined" && location.protocol==="https:" && !/github\.io$/.test(location.hostname)) ? location.origin : "https://stock.quipaie.com"; // serveur du foyer, pré-rempli dans l'écran de connexion
export const PB_KEY="gm-pocketbase", Q_KEY="gm-sync-queue";
export const PB_FIELDS=["name","brand","code","qty","unit","location","expiry","addedAt","image","nutri","nova","eco","toBuy","inCart"];
export const PB_NUMBERS=["qty","addedAt","nova","toBuy"];
export const isPbId=(id)=>/^[a-z0-9]{15}$/.test(id||"");
export const toRec=(it)=>{ const r={}; PB_FIELDS.forEach(f=>{ r[f]= it[f]!=null ? it[f] : (PB_NUMBERS.includes(f)?0:""); }); PB_NUMBERS.forEach(f=>{ r[f]=Number(r[f])||0; }); r.inCart=!!it.inCart; return r; };
export const fromRec=(r)=>{ const it={id:r.id}; PB_FIELDS.forEach(f=>{ it[f]=r[f]; }); PB_NUMBERS.forEach(f=>{ it[f]=Number(it[f])||0; }); FIELD_STR.forEach(f=>{ if(it[f]==null) it[f]=""; }); it.inCart=!!it.inCart; return it; };
export const FIELD_STR=["image","nutri","eco"];

export function pbReq(cfg,path,opt={}){
  const headers={"Content-Type":"application/json"}; if(cfg.token) headers.Authorization=cfg.token;
  return fetch(cfg.url+path,{...opt,headers}).then(async r=>{
    if(r.status===204) return null;
    const j=await r.json().catch(()=>null);
    if(!r.ok){ const e=new Error((j&&j.message)||("Erreur "+r.status)); e.status=r.status; throw e; }
    return j;
  });
}

export function useStock(){
  const [items,setItems] = useState(()=> (loadLocal() || []).filter(i=>!i.demo));
  const [pb,setPb] = useState(()=> lsGet(PB_KEY,null));            // {url, token, email}
  const [sync,setSync] = useState(()=> lsGet(PB_KEY,null) ? "connecting" : "local"); // local | connecting | live | offline | error
  const [pending,setPending] = useState(()=> lsGet(Q_KEY,[]).length);
  const itemsRef = useRef(items), cfg = useRef(pb), queue = useRef(lsGet(Q_KEY,[])), flushing = useRef(false);
  itemsRef.current = items; cfg.current = pb;

  const saveQ = ()=>{ lsSet(Q_KEY,queue.current); setPending(queue.current.length); };
  const opId = (o)=> o.op==="put" ? o.it.id : o.id;
  // put/del replace whatever was pending for that item; +/- steps add up so no tap is lost
  const enqueue = (op)=>{ const id=opId(op);
    if(op.op==="inc"){
      let last=-1; queue.current.forEach((o,i)=>{ if(opId(o)===id) last=i; });
      const prev=queue.current[last];
      if(prev && prev.op==="inc" && !(last===0 && flushing.current)) prev.d+=op.d; else queue.current.push(op);
    } else { queue.current = queue.current.filter(o=>opId(o)!==id); queue.current.push(op); }
    saveQ(); };
  const pendingIds = ()=> new Set(queue.current.map(opId));

  const flush = async()=>{
    const c=cfg.current; if(!c||!c.token||flushing.current) return true; flushing.current=true;
    try{
      while(queue.current.length){
        const op=queue.current[0];
        if(op.op==="put"){
          try{ await pbReq(c,`/api/collections/stock/records/${op.it.id}`,{method:"PATCH",body:JSON.stringify(toRec(op.it))}); }
          catch(e){ if(e.status!==404) throw e;
            await pbReq(c,`/api/collections/stock/records`,{method:"POST",body:JSON.stringify({id:op.it.id,...toRec(op.it)})}); }
        } else if(op.op==="inc"){
          // server-side increment: two phones tapping +1 at the same time both count
          if(op.d!==0){
            try{
              const r=await pbReq(c,`/api/collections/stock/records/${op.id}`,{method:"PATCH",body:JSON.stringify(op.d>0?{"qty+":op.d}:{"qty-":-op.d})});
              if(r && Number(r.qty)<0) await pbReq(c,`/api/collections/stock/records/${op.id}`,{method:"PATCH",body:JSON.stringify({qty:0})});
            }catch(e){ if(e.status!==404) throw e;
              const it=itemsRef.current.find(x=>x.id===op.id);
              if(it) await pbReq(c,`/api/collections/stock/records`,{method:"POST",body:JSON.stringify({id:it.id,...toRec(it)})}); }
          }
        } else {
          try{ await pbReq(c,`/api/collections/stock/records/${op.id}`,{method:"DELETE"}); }catch(e){ if(e.status!==404) throw e; }
        }
        queue.current = queue.current.filter(o=>o!==op); saveQ();
      }
      return true;
    }catch(e){ setSync(e.status===401||e.status===403?"error":"offline"); return false; }
    finally{ flushing.current=false; }
  };

  const pull = async()=>{
    const c=cfg.current; let all=[];
    for(let p=1;;p++){ const j=await pbReq(c,`/api/collections/stock/records?page=${p}&perPage=500&skipTotal=1`); all=all.concat(j.items); if(j.items.length<500) break; }
    const pend=pendingIds(); const deleted=new Set(queue.current.filter(o=>o.op==="del").map(o=>o.id));
    const keep=itemsRef.current.filter(i=>pend.has(i.id)&&!deleted.has(i.id));
    vt(()=>setItems([...all.map(fromRec).filter(i=>!pend.has(i.id)),...keep]));
  };
  const resync = async()=>{ if(!cfg.current) return; setSync("connecting");
    try{ if(await flush()){ await pull(); setSync("live"); } }catch(e){ setSync(e.status===401||e.status===403?"error":"offline"); } };


  // PocketBase: refresh the session, then live updates over server-sent events
  useEffect(()=>{
    if(!pb||!pb.token){ setSync("local"); return; }
    let es=null, alive=true; setSync("connecting");
    (async()=>{
      try{
        const r=await pbReq(cfg.current,"/api/collections/users/auth-refresh",{method:"POST"});
        if(r&&r.token){ const n={...cfg.current,token:r.token}; cfg.current=n; lsSet(PB_KEY,n); }
      }catch(e){ if(e.status===401||e.status===403){ if(alive) setSync("error"); return; } }
      if(!alive) return;
      es=new EventSource(cfg.current.url+"/api/realtime");
      es.addEventListener("PB_CONNECT",async e=>{
        try{
          const {clientId}=JSON.parse(e.data);
          await pbReq(cfg.current,"/api/realtime",{method:"POST",body:JSON.stringify({clientId,subscriptions:["stock/*"]})});
          await resync();
        }catch(x){ setSync("offline"); }
      });
      es.addEventListener("stock/*",e=>{
        let m; try{ m=JSON.parse(e.data); }catch(x){ return; }
        if(!m||!m.record||pendingIds().has(m.record.id)) return;
        const it=fromRec(m.record);
        vt(()=>setItems(p=>{ if(m.action==="delete") return p.filter(i=>i.id!==it.id);
          const i=p.findIndex(x=>x.id===it.id); const n=[...p]; i<0?n.push(it):n[i]=it; return n; }));
      });
      es.onerror=()=>setSync(s=>s==="error"?s:"offline");
    })();
    const online=()=>resync(); addEventListener("online",online);
    return ()=>{ alive=false; es&&es.close(); removeEventListener("online",online); };
  },[pb&&pb.url,pb&&pb.token]);

  useEffect(()=>{ saveLocal(items); },[items]);

  const put = (it)=>{ setItems(p=>{const i=p.findIndex(x=>x.id===it.id); const n=[...p]; i<0?n.push(it):n[i]=it; return n;});
    if(cfg.current&&cfg.current.token){ enqueue({op:"put",it}); flush(); } };
  const bump = (it,d)=>{ const n=Math.max(0,(Number(it.qty)||0)+d);
    setItems(p=>p.map(x=>x.id===it.id?{...x,qty:n}:x));
    if(cfg.current&&cfg.current.token){ enqueue({op:"inc",id:it.id,d}); flush(); }
    return n; };
  const del = (id)=>{ setItems(p=>p.filter(x=>x.id!==id));
    if(cfg.current&&cfg.current.token){ enqueue({op:"del",id}); flush(); } };

  const login = async(url,email,password)=>{
    url=url.trim().replace(/\/+$/,""); if(!/^https?:\/\//.test(url)) url="https://"+url;
    if(location.protocol==="https:"&&url.startsWith("http:")){ const e=new Error("Le serveur doit être en HTTPS : un site HTTPS ne peut pas parler à un serveur HTTP."); throw e; }
    let r;
    try{ r=await pbReq({url},"/api/collections/users/auth-with-password",{method:"POST",body:JSON.stringify({identity:email.trim(),password})}); }
    catch(e){ if(!e.status) throw new Error("Serveur injoignable. Vérifiez l'adresse et que PocketBase tourne.");
      if(e.status===400) throw new Error("E-mail ou mot de passe incorrect."); throw e; }
    // send what is already on this phone, with ids PocketBase accepts
    const mine=itemsRef.current.map(i=>isPbId(i.id)?i:{...i,id:uid()});
    setItems(mine);
    mine.forEach(it=>enqueue({op:"put",it}));
    const n={url,token:r.token,email:(r.record&&r.record.email)||email.trim()};
    lsSet(PB_KEY,n); cfg.current=n; setPb(n);
  };
  const logout = ()=>{ lsSet(PB_KEY,null); queue.current=[]; saveQ(); cfg.current=null; setPb(null); };

  return {items,put,del,bump,sync,pb,pending,login,logout,resync};
}

/* ---------- Sync settings ---------- */
export const SYNC_LABEL={local:"Sur ce téléphone uniquement",connecting:"Connexion…",live:"Synchronisé",offline:"Hors ligne · en attente",error:"Session expirée"};
export const SYNC_COLOR={local:"var(--muted)",connecting:"var(--warn)",live:"var(--ok)",offline:"var(--warn)",error:"var(--bad)"};
/* Household product catalog on the PocketBase server: a product found or completed once is known by every phone */
export const pbCfg=()=>{ const c=lsGet(PB_KEY,null); return c&&c.token?c:null; };
