// Main screen: stock, soon-to-expire, shopping list, scan flows.
import { PLACES, iso, status, uid, qtyText, classify, placeholderName } from "./domain.js";
import { REDUCED, vt, buzz, unlockAudio } from "./device.js";
import { lsGet, useStock, SYNC_LABEL, SYNC_COLOR } from "./storage.js";
import { OFF_CACHE, catalogSave, lookup, completeMissing } from "./products.js";
import { I } from "./ui/icons.js";
import { Scanner } from "./ui/scanner.js";
import { Editor } from "./ui/editor.js";
import { StockCard, CourseCard } from "./ui/cards.js";
import { SyncSheet, ResetSheet } from "./ui/sync.js";
import { StorePicker, TripLineSheet, TripBar, BasketSheet } from "./ui/trip.js";
import { loadTrip, saveTrip, newTrip, rememberStore, rememberPrice, priceFor, archiveTrip, lineKey, euros, tripTotal } from "./trip.js";
import { useState, useEffect, useRef, html } from "./lib.js";

/* ---------- App ---------- */
export function App(){
  const store=useStock(); const {items,put,del,bump,sync}=store; const [syncOpen,setSyncOpen]=useState(false);
  const [tab,setTab]=useState("stock");
  const [q,setQ]=useState(""); const [place,setPlace]=useState("Tout");
  const [scan,setScan]=useState(false); const [edit,setEdit]=useState(null);
  const [toast,setToast]=useState(null);
  const [scanCount,setScanCount]=useState(()=>{ try{ return +localStorage.getItem("gm-scans")||0; }catch(e){ return 0; } });
  const [resetToken,setResetToken]=useState(()=>{ const m=location.hash.match(/^#reset=([\w.\-]+)/); return m?m[1]:null; });
  const closeReset=()=>{ setResetToken(null); try{ history.replaceState(null,"",location.pathname+location.search); }catch(e){} };

  // scans saved without network: complete their product sheet once the network is back
  const itemsNow=useRef(items); itemsNow.current=items;
  useEffect(()=>{ let running=false;
    const run=async()=>{ if(running) return; running=true;
      try{ const n=await completeMissing(itemsNow.current,put); if(n>0) flash(`${n} fiche${n>1?"s":""} produit complétée${n>1?"s":""}`); }
      catch(e){} finally{ running=false; } };
    const t=setTimeout(run,3000); const vis=()=>{ if(document.visibilityState==="visible") run(); };
    addEventListener("online",run); document.addEventListener("visibilitychange",vis);
    return ()=>{ clearTimeout(t); removeEventListener("online",run); document.removeEventListener("visibilitychange",vis); };
  },[]);

  const stock=items.filter(i=>(Number(i.qty)||0)>0);
  const courses=items.filter(i=>(Number(i.qty)||0)<=0);
  const toBuyCount=courses.filter(i=>!i.inCart).length, inCart=courses.filter(i=>i.inCart);
  const lotCount={}; stock.forEach(i=>{ if(i.code) lotCount[i.code]=(lotCount[i.code]||0)+1; });
  const [newItem,setNewItem]=useState("");

  // ---- Jour de courses
  const [trip,setTripState]=useState(()=>loadTrip());
  const tripRef=useRef(trip); tripRef.current=trip;
  const setTrip=(t)=>{ tripRef.current=t; setTripState(t); saveTrip(t); };
  const [tripSheet,setTripSheet]=useState(null);      // "store" | "basket" | null
  const [tripLine,setTripLine]=useState(null);         // line being priced, over the camera
  const startTrip=(store,budget)=>{ rememberStore(store); setTrip(newTrip(store,budget)); flash(`Courses chez ${store.name} : scannez en remplissant le chariot`); };
  const onTrip=(text)=>{
    const p=classify(text), t=tripRef.current; if(!t) return;
    const known=p.code?itemsNow.current.find(i=>i.code===p.code):null;
    const line={id:"l"+Date.now(), code:p.code||"", name:p.name||(known&&known.name)||(p.code?placeholderName(p.code):"Article"), brand:known?known.brand:"", image:known?known.image:"",
      nutri:known?known.nutri:"", nova:known?known.nova:0, eco:known?known.eco:"", location:known?known.location:"", qty:1, price:0, loading:!!(p.code&&!known), pricing:true};
    setTripLine(line);
    const patch=(x)=>setTripLine(l=>l&&l.id===line.id?{...l,...x}:l);
    if(p.code && !known) lookup(p.code).then(r=>patch({loading:false, ...(r.found?{name:r.name||line.name,brand:r.brand,image:r.image,nutri:r.nutri,nova:r.nova,eco:r.eco,location:r.location,shelfDays:r.shelfDays}:{})}));
    priceFor(t.store,line).then(r=>patch({pricing:false, ...(r?{price:r.price,priceSource:r.source}:{})})).catch(()=>patch({pricing:false}));
  };
  const addTripLine=(l)=>{ const t=tripRef.current; if(!t) return;
    const {loading,pricing,...line}=l;
    const same=t.lines.find(x=>lineKey(x)===lineKey(line)&&Number(x.price)===Number(line.price));
    const lines=same?t.lines.map(x=>x===same?{...x,qty:x.qty+line.qty}:x):[...t.lines,line];
    setTrip({...t,lines}); rememberPrice(t.store,line);
    const listed=courses.find(i=>(line.code&&i.code===line.code)||(!line.code&&i.name.toLowerCase()===line.name.toLowerCase()));
    if(listed && !listed.inCart) put({...listed,inCart:true});
    flash(`Panier : ${line.name}${line.qty>1?` ×${line.qty}`:""}${line.price>0?` · ${euros(line.price*line.qty)}`:""} — total ${euros(tripTotal(lines))}`); };
  // end of the day: put everything away (new lots, shopping list lines back in stock), archive the receipt
  const finishTrip=async(store)=>{ const t=tripRef.current; if(!t) return;
    if(store) vt(()=>t.lines.forEach(l=>{
      const all=itemsNow.current, same=(i)=>l.code?i.code===l.code:i.name.toLowerCase()===l.name.toLowerCase();
      const sd=Number(l.shelfDays)||shelfFor(l.code); const exp=sd?iso(sd):"";
      const lots=all.filter(i=>same(i)&&(Number(i.qty)||0)>0), listed=all.find(i=>same(i)&&!(Number(i.qty)>0));
      if(listed) put({...listed,qty:l.qty,inCart:false,toBuy:1,expiry:exp,addedAt:Date.now()});
      else if(lots.length && !exp){ const lot=latestLot(lots); put({...lot,qty:(Number(lot.qty)||0)+l.qty}); }
      else { const base=lots[0]||{}; put({id:uid(),name:l.name,brand:l.brand||base.brand||"",code:l.code||"",image:l.image||base.image||"",nutri:l.nutri||base.nutri||"",nova:l.nova||base.nova||0,eco:l.eco||base.eco||"",
        qty:l.qty,unit:base.unit||"pcs",location:l.location||base.location||"Placard",expiry:exp,addedAt:Date.now(),toBuy:1,inCart:false}); }
    }));
    const sum=await archiveTrip(t); setTrip(null);
    flash(store?`Courses rangées · ${euros(sum.total)}`:`Courses terminées · ${euros(sum.total)}`); };
  const c={ok:0,warn:0,bad:0,none:0}; stock.forEach(i=>c[status(i)]++);
  const watch=c.warn+c.bad;

  const match=(i)=>{ const s=q.trim().toLowerCase(); return (place==="Tout"||i.location===place)&&(!s||(i.name+" "+(i.brand||"")+" "+(i.code||"")).toLowerCase().includes(s)); };
  const sorter= tab==="courses"
    ? (a,b)=>(!!a.inCart-!!b.inCart)||(a.location||"").localeCompare(b.location||"")||a.name.localeCompare(b.name)
    : (a,b)=>(a.expiry||"9999").localeCompare(b.expiry||"9999")||a.name.localeCompare(b.name);
  const list = (tab==="soon" ? stock.filter(i=>["warn","bad"].includes(status(i))) : tab==="courses" ? courses : stock).filter(match).sort(sorter);
  const shelves = tab==="stock" ? PLACES.map(p=>[p,list.filter(i=>i.location===p.id)]).filter(s=>s[1].length) : [[null,list]];

  const flash=(msg,undo,label)=>{ setToast({msg,undo,label:label||"Annuler",k:Date.now()}); clearTimeout(window.__t); window.__t=setTimeout(()=>setToast(null),undo?5500:4200); };
  const bumpScans=()=>{ setScanCount(n=>{ try{ localStorage.setItem("gm-scans",n+1); }catch(e){} return n+1; }); };
  const latestLot=(lots)=>lots.slice().sort((a,b)=>(b.addedAt||0)-(a.addedAt||0))[0];
  const shelfFor=(code)=>{ const c=code&&lsGet(OFF_CACHE,{})[code]; return c&&Number(c.shelfDays)||0; };
  const newLotOf=(t)=>({code:t.code,name:t.name,brand:t.brand,image:t.image,nutri:t.nutri,nova:t.nova,eco:t.eco,location:t.location,unit:t.unit,qty:1,shelfDays:shelfFor(t.code),newLot:true});

  // shopping list
  const addToList=(e)=>{ e.preventDefault(); const name=newItem.trim(); if(!name) return;
    const same=(i)=>i.name.toLowerCase()===name.toLowerCase();
    const listed=courses.find(same), known=items.find(same);
    if(listed) vt(()=>put({...listed,inCart:false,toBuy:(Number(listed.toBuy)||1)+(listed.inCart?0:1)}));
    else if(known) vt(()=>put({...known,id:uid(),qty:0,toBuy:1,inCart:false,expiry:"",addedAt:Date.now()})); // same product, new line on the list
    else vt(()=>put({id:uid(),name,brand:"",code:"",qty:0,toBuy:1,inCart:false,unit:"pcs",location:"Placard",expiry:"",addedAt:Date.now()}));
    setNewItem(""); buzz(10); };
  const toggleCart=(it)=>{ buzz(10); vt(()=>put({...it,inCart:!it.inCart})); };
  const setToBuy=(it,d)=>{ buzz(6); put({...it,toBuy:Math.max(1,(Number(it.toBuy)||1)+d)}); };
  const storeCart=()=>{ if(!inCart.length) return; buzz(20);
    vt(()=>inCart.forEach(it=>{ const sd=shelfFor(it.code);
      put({...it,qty:(Number(it.qty)||0)+Math.max(1,Number(it.toBuy)||1),toBuy:1,inCart:false,expiry:sd?iso(sd):"",addedAt:Date.now()}); }));
    flash(`${inCart.length} article${inCart.length>1?"s":""} rangé${inCart.length>1?"s":""} dans le stock`); };
  const step=(it,d)=>{ buzz(8);
    if((Number(it.qty)||0)+d<=0){ vt(()=>bump(it,d)); flash(`${it.name} → liste de courses`,()=>vt(()=>put(it))); }
    else bump(it,d); };
  const remove=(it)=>{ vt(()=>del(it.id)); flash(`${it.name} supprimé`,()=>vt(()=>put(it))); };
  const go=(t)=>{ if(t!==tab){ buzz(6); vt(()=>{ setTab(t); }); window.scrollTo({top:0,behavior:REDUCED?"auto":"smooth"}); } };

  const openScan=()=>{ unlockAudio(); buzz(10); setScan(true); };
  const toggleTrip=()=>{ buzz(10); if(trip) setTripSheet("basket"); else setTripSheet("store"); };
  // burst mode: every read is stored at once, product sheets fill in the background
  const burstN=useRef(0);
  const onBurst=(text)=>{
    bumpScans(); burstN.current++;
    const p=classify(text), all=itemsNow.current;
    if(!p.code){ const it={id:uid(),name:p.name||"Article",brand:p.brand||"",code:"",qty:Number(p.qty)||1,unit:p.unit||"pcs",location:p.location||"Placard",expiry:p.expiry||"",addedAt:Date.now()};
      put(it); return `＋ ${it.name}`; }
    const lots=all.filter(i=>i.code===p.code&&(Number(i.qty)||0)>0);
    if(lots.length){ const t=latestLot(lots); bump(t,1); return `+1 ${t.name}`; }
    const listed=all.find(i=>i.code===p.code);
    const base=listed?{...listed,qty:1,inCart:false,toBuy:1,addedAt:Date.now()}:{id:uid(),code:p.code,name:placeholderName(p.code),brand:"",qty:1,unit:"pcs",location:"Placard",expiry:"",addedAt:Date.now()};
    put(base);
    lookup(p.code).then(r=>{ const cur=itemsNow.current.find(x=>x.id===base.id)||base;
      const sd=Number(r.shelfDays)||0;
      put({...cur, name:cur.name===placeholderName(p.code)?(r.name||cur.name):cur.name, brand:cur.brand||r.brand||"", image:cur.image||r.image||"",
        nutri:cur.nutri||r.nutri||"", nova:cur.nova||r.nova||0, eco:cur.eco||r.eco||"", location:listed?cur.location:(r.location||cur.location),
        expiry:cur.expiry||(sd?iso(sd):"")}); });
    return listed?`${listed.name} remis en stock`:`Nouveau · ${p.code}`;
  };
  const closeScanner=()=>{ setScan(false); const n=burstN.current; burstN.current=0;
    if(n>0) flash(`${n} article${n>1?"s":""} scanné${n>1?"s":""} en rafale`); };

  const onScanned=(text)=>{
    setScan(false); burstN.current=0; bumpScans();
    const p=classify(text);
    const existing=p.code&&items.find(i=>i.code===p.code);
    const lots=p.code?items.filter(i=>i.code===p.code&&(Number(i.qty)||0)>0):[];
    if(existing && !lots.length){ // known product, currently on the shopping list: back in stock
      const sd=shelfFor(p.code); vt(()=>put({...existing,qty:1,inCart:false,toBuy:1,expiry:sd?iso(sd):"",addedAt:Date.now()}));
      flash(`${existing.name} remis en stock`); return; }
    if(existing){ const t=latestLot(lots); const nq=(Number(t.qty)||0)+1; vt(()=>bump(t,1));
      flash(`+1 ${t.name} · ${nq} ${qtyText(t)||"en stock"}`,()=>{ bump(itemsNow.current.find(x=>x.id===t.id)||{...t,qty:nq},-1); setEdit(newLotOf(t)); },"Autre date"); return; }
    if(!p.code){ setEdit({...p,scanned:true}); return; }
    setEdit({...p,scanned:true,loading:true,location:"Placard",shelfDays:0});
    lookup(p.code).then(r=>setEdit(e=> e&&e.scanned&&e.code===p.code ? {...e,...r,loading:false} : e));
  };

  const wd=new Date().toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}).replace(/\./g,"");
  const total=Math.max(1,stock.length);
  const titles={stock:"Garde-manger",soon:"À finir vite",courses:"Courses"};

  return html`<div class=${"app"+(trip?" in-trip":"")}>
    <header class="top">
      <div><div class="date">${wd}</div><h1>${titles[tab]}</h1></div>
      <div class="top-act"><button class="round ghost press" aria-label=${"Synchronisation : "+SYNC_LABEL[sync]} onClick=${()=>setSyncOpen(true)}>${I.cloud}<span class="sdot" style=${{background:SYNC_COLOR[sync]}}></span></button>
      <button class="round press" aria-label="Ajouter un article à la main" onClick=${()=>setEdit({location:place!=="Tout"?place:"Frigo"})}>${I.plus}</button></div>
    </header>

    ${tab==="stock" && html`<section class="fresh" aria-label="Fraîcheur du stock">
      <div class="fresh-top">
        <div><span class="big">${stock.length}</span><span class="big-l">article${stock.length>1?"s":""} en stock</span></div>
        ${watch>0 && html`<button class="watch press" onClick=${()=>go("soon")}><span class="dot"></span>${watch} à surveiller</button>`}
      </div>
      <div class="seg" role="img" aria-label=${`${c.ok} frais, ${c.warn} à finir sous 3 jours, ${c.bad} périmés, ${c.none} sans date`}>
        ${[["ok","var(--ok)"],["warn","var(--warn)"],["bad","var(--bad)"],["none","var(--line)"]].map(([k,col])=>html`<i key=${k} style=${{flexGrow:c[k]/total,flexBasis:0,background:col,display:c[k]?"block":"none"}}></i>`)}
      </div>
      <div class="legend">
        <span><i style=${{background:"var(--ok)"}}></i><b>${c.ok}</b> frais</span>
        <span><i style=${{background:"var(--warn)"}}></i><b>${c.warn}</b> sous 3 j</span>
        <span><i style=${{background:"var(--bad)"}}></i><b>${c.bad}</b> périmé${c.bad>1?"s":""}</span>
        <span><i style=${{background:"var(--line)"}}></i><b>${c.none}</b> sans date</span>
      </div>
    </section>`}

    <div class="tools">
      <label class="search">${I.search}<input id="search" type="search" placeholder="Chercher un produit, une marque…" value=${q} onChange=${e=>setQ(e.target.value)} aria-label="Rechercher" /></label>
      <div class="chips" role="group" aria-label="Emplacement">
        ${[{id:"Tout",c:"var(--ink)"},...PLACES].map(p=>html`<button key=${p.id} class="chip press" style=${{"--c":p.c}} aria-pressed=${place===p.id} onClick=${()=>vt(()=>setPlace(p.id))}><i></i>${p.id}</button>`)}
      </div>
    </div>


    ${tab==="courses" && html`<div class=${"trip-toggle"+(trip?" on":"")}>
        <div><b>Jour de courses</b><span>${trip?`En cours chez ${trip.store.name} · ${euros(tripTotal(trip.lines))}`:"Scannez au magasin, le total se calcule tout seul."}</span></div>
        <button class="switch press" role="switch" aria-checked=${!!trip} aria-label="Jour de courses" onClick=${toggleTrip}><i></i></button>
      </div>`}
    ${tab==="courses" && html`<form class="list-add" onSubmit=${addToList}>
        <input id="list-add" placeholder="Ajouter à la liste : lait, pain…" autocomplete="off" value=${newItem} onChange=${e=>setNewItem(e.target.value)} aria-label="Article à acheter" />
        <button class="press" type="submit" aria-label="Ajouter à la liste">${I.plus}</button>
      </form>`}
    ${tab==="courses" && inCart.length>0 && html`<button class="store-cart press" onClick=${storeCart}>${I.check} Ranger les ${inCart.length} article${inCart.length>1?"s":""} du panier</button>`}

    ${list.length===0 && html`<div class="empty">
      <div class="art">${tab==="courses"?I.cart:tab==="soon"?I.clock:I.scan}</div>
      <h3>${q||place!=="Tout"?"Rien ici":tab==="courses"?"Liste vide":tab==="soon"?"Tout est frais":"Stock vide"}</h3>
      <p>${q||place!=="Tout"?"Essayez une autre recherche ou un autre emplacement.":tab==="courses"?"Ajoutez un article ci-dessus. Un produit qui tombe à zéro arrive ici tout seul.":tab==="soon"?"Aucun produit ne périme dans les 3 prochains jours.":"Scannez un code-barres ou ajoutez un produit avec le bouton +."}</p>
    </div>`}

    ${shelves.map(([p,rows])=>html`<section class="shelf" key=${p?p.id:tab}>
      ${p && html`<h2 class="shelf-h" style=${{"--c":p.c}}><i></i>${p.id}<span>${rows.length} réf.</span></h2>`}
      <div class="cards">${rows.map((it,i)=> tab==="courses"
        ? html`<${CourseCard} key=${it.id} it=${it} i=${i} onToggle=${toggleCart} onQty=${setToBuy} onRemove=${remove} onOpen=${setEdit}/>`
        : html`<${StockCard} key=${it.id} it=${it} i=${i} lots=${it.code?lotCount[it.code]:0} onOpen=${setEdit} onStep=${step}/>`)}</div>
    </section>`)}

    ${trip && html`<${TripBar} trip=${trip} onOpen=${()=>setTripSheet("basket")} />`}
    <nav class="dock" aria-label="Navigation">
      <div class="tabbar">
        <button class="tab press" aria-current=${tab==="stock"?"page":undefined} onClick=${()=>go("stock")}>${I.shelf}Stock</button>
        <button class="tab press" aria-current=${tab==="soon"?"page":undefined} onClick=${()=>go("soon")}>${I.clock}Bientôt${watch>0 && html`<span class="badge" key=${"w"+watch}>${watch}</span>`}</button>
        <button class="fab press" aria-label="Scanner un code" onClick=${openScan}>${I.scan}</button>
        <button class="tab press" aria-current=${tab==="courses"?"page":undefined} onClick=${()=>go("courses")}>${I.cart}Courses${toBuyCount>0 && html`<span class="badge" key=${"c"+toBuyCount}>${toBuyCount}</span>`}</button>
        <button class="tab press" onClick=${()=>setEdit({location:place!=="Tout"?place:"Frigo"})}>${I.pen}Saisir</button>
      </div>
    </nav>

    ${resetToken && html`<${ResetSheet} token=${resetToken} onDone=${closeReset} />`}
    ${syncOpen && html`<${SyncSheet} store=${store} onClose=${()=>setSyncOpen(false)} />`}
    ${scan && html`<${Scanner} onResult=${onScanned} onBurst=${onBurst} onTrip=${trip?onTrip:null} trip=${trip?trip.store.name:null} paused=${!!tripLine} onClose=${closeScanner} />`}
    ${tripLine && html`<${TripLineSheet} key=${tripLine.id} line=${tripLine} onSave=${addTripLine} onClose=${()=>setTripLine(null)} />`}
    ${tripSheet==="store" && html`<${StorePicker} onStart=${startTrip} onClose=${()=>setTripSheet(null)} />`}
    ${tripSheet==="basket" && trip && html`<${BasketSheet} trip=${trip} onChange=${setTrip} onFinish=${finishTrip} onCancel=${()=>{ setTrip(null); flash("Courses annulées"); }} onClose=${()=>setTripSheet(null)} />`}
    ${edit && html`<${Editor} key=${edit.id||"new"+scanCount} initial=${edit} scanCount=${scanCount} onClose=${()=>setEdit(null)}
      onSave=${it=>{ const {_learn,...clean}=it; vt(()=>put(clean)); flash(`${clean.name} rangé · ${clean.location}`);
        if(clean.code && clean.name!==placeholderName(clean.code)){
          const data={name:clean.name,brand:clean.brand,location:clean.location,image:clean.image,nutri:clean.nutri,nova:clean.nova,eco:clean.eco};
          if(_learn>0) data.shelfDays=_learn;
          catalogSave(clean.code,data); } }} onDelete=${it=>remove(it)} />`}
    ${toast && html`<div class="toast" role="status" key=${toast.k}><span>${toast.msg}</span>${toast.undo && html`<button onClick=${()=>{toast.undo();setToast(null);}}>${toast.label}</button>`}</div>`}
  </div>`;
}
