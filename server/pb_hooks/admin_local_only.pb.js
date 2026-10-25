/// <reference path="../pb_data/types.d.ts" />
// Garde-manger : le tableau de bord admin (/_/) et la connexion superuser ne répondent
// que sur le réseau local (http://IP-DU-LXC:8090/_/), jamais via le domaine public.
// Autoriser un autre nom d'hôte : variable d'environnement PB_ADMIN_HOSTS="nom1,nom2".
routerUse((e) => {
  const path = e.request.url.path || "";
  const adminRoute = path === "/_" || path.startsWith("/_/") || path.startsWith("/api/collections/_superusers/");
  if (!adminRoute) return e.next();

  const host = String(e.request.host || "").toLowerCase().replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  const extra = String($os.getenv("PB_ADMIN_HOSTS") || "").toLowerCase().split(",").map((h) => h.trim()).filter(Boolean);
  const local =
    host === "localhost" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||          // adresse IPv4
    host.indexOf(":") !== -1 ||                        // adresse IPv6
    /\.(lan|local|home\.arpa|internal)$/.test(host) ||
    extra.indexOf(host) !== -1;
  if (local) return e.next();

  return e.json(404, { status: 404, message: "Not Found.", data: {} });
});
