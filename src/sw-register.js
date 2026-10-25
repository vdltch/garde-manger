if("serviceWorker" in navigator && location.protocol==="https:"){
  addEventListener("load",function(){
    var hadController=!!navigator.serviceWorker.controller, shown=false;
    navigator.serviceWorker.register("sw.js").then(function(reg){
      var check=function(){ reg.update().catch(function(){}); };
      document.addEventListener("visibilitychange",function(){ if(document.visibilityState==="visible") check(); });
      setInterval(check,30*60*1000);
    }).catch(function(){});
    // a new version took over: offer a reload instead of silently running old code
    navigator.serviceWorker.addEventListener("controllerchange",function(){
      if(!hadController||shown) return; shown=true;
      var b=document.createElement("div"); b.className="upd"; b.setAttribute("role","status");
      b.innerHTML='<span>Nouvelle version de Garde-manger</span><button type="button">Recharger</button>';
      b.querySelector("button").onclick=function(){ location.reload(); };
      document.body.appendChild(b);
    });
  });
}
