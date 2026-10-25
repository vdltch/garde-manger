import { validGtin, isRetail } from "../domain.js";
import { REDUCED, buzz, unlockAudio, scanBeep } from "../device.js";
import { lsGet, lsSet } from "../storage.js";
import { getDetector, detectIn, decodeImageFile } from "../barcode.js";
import { I } from "./icons.js";
import { useDialogFocus } from "./focus.js";
import { useState, useEffect, useMemo, useRef, html } from "../lib.js";

/* ---------- Scanner ---------- */
export function Scanner({onResult,onBurst,onTrip,trip,paused,onClose}){
  const box=useRef(null), video=useRef(null), stream=useRef(null), done=useRef(false), timer=useRef(0), last=useRef({v:"",n:0}), lastHit=useRef({v:"",t:0});
  const [burst,setBurst]=useState(()=>lsGet("gm-burst",false)); const burstRef=useRef(burst); burstRef.current=burst;
  const cb=useRef({}); cb.current={onResult,onBurst,onTrip};
  const pausedRef=useRef(false); pausedRef.current=!!paused;
  // back from the price sheet: ignore the product still in front of the camera for a moment
  useEffect(()=>{ if(!paused) lastHit.current.t=Date.now()+1500; },[paused]);
  const [log,setLog]=useState([]); const [flashK,setFlashK]=useState(0);
  const [mode,setMode]=useState("starting"); const [err,setErr]=useState(""); const [typed,setTyped]=useState("");
  const [closing,setClosing]=useState(false); const [torch,setTorch]=useState(null); const [slow,setSlow]=useState(false);
  const stop=()=>{ done.current=true; clearTimeout(timer.current); if(stream.current) stream.current.getTracks().forEach(t=>t.stop()); };
  // returns true when scanning stops (single scan), false in burst mode (keeps scanning)
  const finish=(text)=>{ if(done.current) return true;
    if(cb.current.onTrip){
      const now=Date.now(); if(pausedRef.current || (lastHit.current.v===text && now-lastHit.current.t<1800)) return false;
      lastHit.current={v:text,t:now}; scanBeep(); buzz(50); setFlashK(k=>k+1); cb.current.onTrip(text); return false;
    }
    if(burstRef.current){
      const now=Date.now(); if(lastHit.current.v===text && now-lastHit.current.t<1800) return false; // same item still in view
      lastHit.current={v:text,t:now}; scanBeep(); buzz(50); setFlashK(k=>k+1);
      const label=cb.current.onBurst(text); setLog(l=>[{k:now,label},...l].slice(0,4)); return false;
    }
    stop(); setMode("found"); scanBeep(); buzz(70); setTimeout(()=>cb.current.onResult(text),REDUCED?0:450); return true; };
  const toggleBurst=()=>{ const v=!burstRef.current; setBurst(v); lsSet("gm-burst",v); buzz(8); };
  const close=()=>{ stop(); setClosing(true); setTimeout(onClose,REDUCED?0:200); };
  useDialogFocus(box, close);
  useEffect(()=>{
    let tick=0; const canvas=document.createElement("canvas"); const ctx=canvas.getContext("2d",{willReadFrequently:true});
    const t0=Date.now();
    const loop=async()=>{
      if(done.current) return;
      if(pausedRef.current){ timer.current=setTimeout(loop,150); return; }
      const v=video.current;
      if(v && v.readyState>=2 && v.videoWidth){
        const vw=v.videoWidth, vh=v.videoHeight, full=(tick++%3===2);
        const cw=full?vw:Math.round(vw*0.9), ch=full?vh:Math.round(vh*(vh>vw?0.42:0.62));
        const k=Math.min(1,1280/Math.max(cw,ch)); canvas.width=Math.round(cw*k); canvas.height=Math.round(ch*k);
        ctx.drawImage(v,(vw-cw)/2,(vh-ch)/2,cw,ch,0,0,canvas.width,canvas.height);
        const hits=await detectIn(canvas);
        for(const h of hits){
          const val=(h.rawValue||"").trim(); if(!val) continue;
          if(isRetail(h)){ if(validGtin(val)){ if(finish(val)) return; break; } continue; }
          if(last.current.v===val){ if(++last.current.n>=2){ if(finish(val)) return; break; } } else last.current={v:val,n:1};
        }
        if(!slow && Date.now()-t0>7000) setSlow(true);
      }
      timer.current=setTimeout(loop,60);
    };
    (async()=>{
      try{
        if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) throw new Error("no cam");
        const s=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}});
        if(done.current){ s.getTracks().forEach(t=>t.stop()); return; }
        stream.current=s; const track=s.getVideoTracks()[0];
        try{ const caps=track.getCapabilities?track.getCapabilities():{};
          if(caps.focusMode&&caps.focusMode.includes("continuous")) await track.applyConstraints({advanced:[{focusMode:"continuous"}]});
          if(caps.torch) setTorch(false); }catch(e){}
        const v=video.current; v.srcObject=s; v.setAttribute("playsinline",""); v.muted=true; await v.play().catch(()=>{});
        setMode("live"); getDetector().then(()=>{ if(!done.current) loop(); });
      }catch(e){ if(!done.current) setMode("photo"); }
    })();
    return ()=>stop();
  },[]);
  const toggleTorch=async()=>{ const t=stream.current&&stream.current.getVideoTracks()[0]; if(!t) return;
    try{ await t.applyConstraints({advanced:[{torch:!torch}]}); setTorch(!torch); buzz(8); }catch(e){} };
  const onPhoto=async(e)=>{ const f=e.target.files[0]; e.target.value=""; if(!f) return; setErr(""); setMode("reading");
    try{ const v=await decodeImageFile(f); finish(v); if(burstRef.current||cb.current.onTrip) setMode("photo"); }
    catch(x){ setMode("photo"); buzz([30,60,30]); setErr("Pas de code lisible sur cette photo. Rapprochez-vous, tenez le code bien à plat et évitez les reflets."); } };
  const msg = {starting:"Ouverture de la caméra…", live: slow?"Reculez un peu pour que le code soit net, et évitez les reflets.":"Visez le code-barres, il est lu tout seul.", photo:"Prenez le code en photo : il est lu dès que la photo est prise.", reading:"Lecture du code…", found:"Bip ! Code lu."}[mode];
  const ghost = useMemo(()=>Array.from({length:28},(_,i)=>1+((i*7)%4)),[]);
  return html`<div ref=${box} class=${"scan "+mode+(closing?" out":"")} role="dialog" aria-modal="true" aria-label="Scanner">
    <div class="scan-top"><b>Scanner</b>
      <div class="scan-tools">
        ${trip ? html`<span class="scan-chip on">${I.basket}${trip}</span>` : html`<button class=${"scan-chip press"+(burst?" on":"")} aria-pressed=${burst} onClick=${toggleBurst}>${I.burst}Rafale</button>`}
        ${torch!==null && html`<button class=${"scan-x press"+(torch?" on":"")} aria-label=${torch?"Éteindre la lampe":"Allumer la lampe"} aria-pressed=${torch} onClick=${toggleTorch}>${I.torch}</button>`}
        <button class="scan-x press" aria-label="Fermer le scanner" onClick=${close}>${I.close}</button>
      </div></div>
    <div class="stage">
      <video ref=${video} playsInline muted autoPlay hidden=${mode!=="live"&&mode!=="found"}></video>
      <div class="frame">
        ${mode!=="live"&&mode!=="found" && html`<div class="ghost-code">${ghost.map((w,i)=>html`<i key=${i} style=${{"--w":w}}></i>`)}</div>`}
        <span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span>
        <span class="laser"></span>
        ${mode==="found" && html`<span class="flash"></span>`}
        ${flashK>0 && html`<span class="flash" key=${"f"+flashK}></span>`}
      </div>
    </div>
    ${!trip && burst && log.length>0 ? html`<ul class="burst-log" aria-live="polite">${log.map((x,i)=>html`<li key=${x.k} style=${{opacity:1-i*0.22}}>${x.label}</li>`)}</ul>`
      : html`<p class=${"scan-msg"+(err?" err":"")} aria-live="polite">${err||(trip&&mode==="live"?"Scannez chaque article en le mettant dans le chariot.":burst&&mode==="live"?"Mode rafale : scannez les articles les uns après les autres, puis fermez.":msg)}</p>`}
    <div class="scan-cta">
      ${(mode==="photo"||mode==="reading") && html`<label class="cam press">${I.camera} Photographier le code
        <input id="photo" type="file" accept="image/*" capture="environment" onChange=${onPhoto} onClick=${unlockAudio} /></label>`}
      <form class="typed" onSubmit=${e=>{e.preventDefault(); const v=typed.trim(); if(v){ finish(v); setTyped(""); }}}>
        <input id="typed-code" inputmode="numeric" autocomplete="off" placeholder="Ou tapez les chiffres sous le code…" value=${typed} onChange=${e=>setTyped(e.target.value)} />
        <button class="press" type="submit">OK</button>
      </form>
    </div>
  </div>`;
}
