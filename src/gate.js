/* Install gate: on a phone, Garde-manger is meant to run as an installed web app.
   When it is opened in a browser tab, show how to install it for this exact OS + browser.
   Plain DOM on purpose, so it works even before the app's libraries have loaded. */
(function(){
  var gate=document.getElementById("gate");
  var bip=null, installed=false;
  addEventListener("beforeinstallprompt",function(e){ e.preventDefault(); bip=e; render(); });
  addEventListener("appinstalled",function(){ installed=true; bip=null; render(); });

  var standalone = matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches || navigator.standalone===true;
  var framed=false; try{ framed = window.top!==window; }catch(e){ framed=true; }
  var ua=navigator.userAgent;
  var ios=/iPad|iPhone|iPod/.test(ua) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
  var android=/Android/i.test(ua);
  var skipped=false; try{ skipped = sessionStorage.getItem("gm-skip-install")==="1"; }catch(e){}
  if(standalone || framed || skipped || !(ios||android) || /^#reset=/.test(location.hash)) return;

  var inApp=/FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|Line\/|Twitter|TikTok|musical_ly|GSA\//i.test(ua) || (android && /; wv\)/.test(ua));
  var browser = ios ? (/CriOS/.test(ua)?"chrome":/FxiOS/.test(ua)?"firefox":/EdgiOS/.test(ua)?"edge":/OPiOS|OPT\//.test(ua)?"opera":"safari")
                    : (/SamsungBrowser/.test(ua)?"samsung":/Firefox/.test(ua)?"firefox":/EdgA/.test(ua)?"edge":/OPR|Opera/.test(ua)?"opera":"chrome");
  if(inApp) browser="inapp";

  var G={
    share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M7 10H5v11h14V10h-2"/></svg>',
    addHome:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
    dots:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    hdots:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    burger:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18.5h2"/></svg>',
    compass:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>'
  };
  var k=function(icon,label){ return '<span class="k">'+(icon?G[icon]:"")+(label?'<b>'+label+'</b>':"")+'</span>'; };

  // steps + where the browser's button sits on screen (for the pointing arrow)
  var guides={
    ios:{
      safari:{name:"Safari · iPhone", arrow:"bottom", steps:[
        "Touchez "+k("share")+" <b>Partager</b> dans la barre du bas. Sur iOS 26, il est dans le menu "+k("hdots")+".",
        "Faites défiler et touchez "+k("addHome","Sur l'écran d'accueil")+".",
        "Laissez <b>Ouvrir comme app web</b> activé, puis touchez <b>Ajouter</b>.",
        "Ouvrez <b>Garde-manger</b> depuis votre écran d'accueil."]},
      chrome:{name:"Chrome · iPhone", arrow:"top-right", steps:[
        "Touchez "+k("share")+" <b>Partager</b>, à droite de la barre d'adresse.",
        "Touchez "+k("addHome","Ajouter à l'écran d'accueil")+" (sous <b>Plus</b> s'il n'apparaît pas).",
        "Touchez <b>Ajouter</b>.",
        "Ouvrez <b>Garde-manger</b> depuis votre écran d'accueil."]},
      firefox:{name:"Firefox · iPhone", arrow:"bottom-right", steps:[
        "Touchez le menu "+k("burger")+" en bas à droite, puis "+k("share","Partager")+".",
        "Touchez "+k("addHome","Sur l'écran d'accueil")+", puis <b>Ajouter</b>.",
        "Ouvrez <b>Garde-manger</b> depuis votre écran d'accueil."]},
      edge:{name:"Edge · iPhone", arrow:"bottom", steps:[
        "Touchez "+k("hdots")+" en bas de l'écran, puis "+k("share","Partager")+".",
        "Touchez "+k("addHome","Sur l'écran d'accueil")+", puis <b>Ajouter</b>.",
        "Ouvrez <b>Garde-manger</b> depuis votre écran d'accueil."]},
      opera:{name:"Opera · iPhone", arrow:"bottom", steps:[
        "Touchez "+k("share","Partager")+" depuis le menu du navigateur.",
        "Touchez "+k("addHome","Sur l'écran d'accueil")+", puis <b>Ajouter</b>.",
        "Si l'option n'existe pas, ouvrez ce lien dans <b>Safari</b>."]},
      inapp:{name:"Navigateur intégré", arrow:"top-right", inapp:true, steps:[
        "Touchez "+k("hdots")+" ou "+k("compass")+" en haut ou en bas de l'écran.",
        "Choisissez <b>Ouvrir dans Safari</b> (ou « Ouvrir dans le navigateur »).",
        "Dans Safari, suivez les instructions d'installation qui s'afficheront."]}
    },
    android:{
      chrome:{name:"Chrome · Android", arrow:"top-right", steps:[
        "Touchez "+k("dots")+" en haut à droite.",
        "Touchez "+k("phone","Ajouter à l'écran d'accueil")+" puis <b>Installer</b>.",
        "Ouvrez <b>Garde-manger</b> depuis votre écran d'accueil."]},
      samsung:{name:"Samsung Internet", arrow:"bottom-right", steps:[
        "Touchez "+k("burger")+" en bas à droite.",
        "Touchez "+k("addHome","Ajouter la page à")+", puis <b>Écran d'accueil</b>.",
        "Ouvrez <b>Garde-manger</b> depuis votre écran d'accueil."]},
      firefox:{name:"Firefox · Android", arrow:"top-right", steps:[
        "Touchez "+k("dots")+" (en haut ou en bas à droite selon votre réglage).",
        "Touchez "+k("phone","Ajouter à l'écran d'accueil")+" puis <b>Ajouter</b>.",
        "Ouvrez <b>Garde-manger</b> depuis votre écran d'accueil."]},
      edge:{name:"Edge · Android", arrow:"bottom", steps:[
        "Touchez "+k("burger")+" en bas de l'écran.",
        "Touchez "+k("phone","Ajouter au téléphone")+" puis <b>Installer</b>.",
        "Ouvrez <b>Garde-manger</b> depuis votre écran d'accueil."]},
      opera:{name:"Opera · Android", arrow:"top-right", steps:[
        "Touchez "+k("dots")+" en haut à droite.",
        "Touchez "+k("phone","Écran d'accueil")+" puis <b>Ajouter</b>.",
        "Ouvrez <b>Garde-manger</b> depuis votre écran d'accueil."]},
      inapp:{name:"Navigateur intégré", arrow:"top-right", inapp:true, steps:[
        "Touchez "+k("dots")+" en haut à droite.",
        "Choisissez <b>Ouvrir dans Chrome</b> (ou « Ouvrir dans le navigateur »).",
        "Dans Chrome, touchez <b>Installer</b> sur l'écran qui s'affichera."]}
    }
  };
  var g=guides[ios?"ios":"android"][browser];

  function render(){
    var html='';
    if(installed){
      html='<div class="g-in"><img class="g-icon" src="icons/icon-192.png" alt="" width="84" height="84">'+
        '<h1>C\'est installé&nbsp;!</h1><p class="g-lead">Fermez cet onglet et ouvrez <b>Garde-manger</b> depuis votre écran d\'accueil.</p></div>';
    } else {
      html='<div class="g-in">'+
        '<img class="g-icon" src="icons/icon-192.png" alt="" width="84" height="84">'+
        '<span class="g-chip">'+g.name+'</span>'+
        '<h1>Installez Garde-manger</h1>'+
        '<p class="g-lead">'+(g.inapp?"Vous êtes dans le navigateur d'une autre app : il ne permet pas d'installer Garde-manger.":"L'app s'ouvrira en plein écran depuis votre écran d'accueil, avec la caméra et la synchronisation.")+'</p>'+
        (bip?'<button class="g-cta" id="g-install">Installer l\'app</button><p class="g-or">ou à la main :</p>':'')+
        '<ol class="g-steps">'+g.steps.map(function(s){ return '<li><span>'+s+'</span></li>'; }).join("")+'</ol>'+
        (g.inapp?'<button class="g-copy" id="g-copy">Copier le lien</button>':'')+
        '<button class="g-skip" id="g-skip">Continuer dans le navigateur</button>'+
      '</div>'+(bip?'':'<div class="g-arrow g-'+g.arrow+'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></div>');
    }
    gate.innerHTML=html; gate.hidden=false;
    document.documentElement.classList.add("gated");
    var b=document.getElementById("g-install");
    if(b) b.onclick=function(){ bip.prompt(); bip.userChoice.then(function(c){ if(c.outcome==="accepted"){ installed=true; } bip=null; render(); }); };
    var s=document.getElementById("g-skip");
    if(s) s.onclick=function(){ try{ sessionStorage.setItem("gm-skip-install","1"); }catch(e){} gate.hidden=true; document.documentElement.classList.remove("gated"); };
    var c=document.getElementById("g-copy");
    if(c) c.onclick=function(){
      var done=function(){ c.textContent="Lien copié"; };
      if(navigator.clipboard) navigator.clipboard.writeText(location.href).then(done,function(){ prompt("Copiez ce lien :",location.href); });
      else prompt("Copiez ce lien :",location.href);
    };
  }
  render();
})();
