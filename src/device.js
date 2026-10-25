// Phone feedback: view transitions, vibration, scanner beep.


export const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Motion helpers ---------- */
export const vt = (fn) => {
  if(!REDUCED && document.startViewTransition){ document.startViewTransition(()=>ReactDOM.flushSync(fn)); }
  else fn();
};
export const buzz = (p) => { try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} };

/* ---------- Sound: supermarket scanner beep, synthesised ---------- */
export let AC=null;
export function unlockAudio(){
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==="suspended") AC.resume();
    const b=AC.createBuffer(1,1,22050), s=AC.createBufferSource(); s.buffer=b; s.connect(AC.destination); s.start(0);
  }catch(e){}
}
export function scanBeep(){
  try{
    if(!AC) unlockAudio(); if(!AC) return;
    const t=AC.currentTime+0.01, out=AC.createGain();
    out.gain.setValueAtTime(0.0001,t); out.gain.exponentialRampToValueAtTime(0.32,t+0.006);
    out.gain.setValueAtTime(0.32,t+0.13); out.gain.exponentialRampToValueAtTime(0.0001,t+0.17);
    const lp=AC.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=5200; lp.Q.value=0.7;
    out.connect(lp); lp.connect(AC.destination);
    const a=AC.createOscillator(); a.type="square"; a.frequency.setValueAtTime(1975,t);
    const ga=AC.createGain(); ga.gain.value=0.35; a.connect(ga); ga.connect(out);
    const b=AC.createOscillator(); b.type="sine"; b.frequency.setValueAtTime(1975*2,t);
    const gb=AC.createGain(); gb.gain.value=0.12; b.connect(gb); gb.connect(out);
    a.start(t); b.start(t); a.stop(t+0.19); b.stop(t+0.19);
  }catch(e){}
}
