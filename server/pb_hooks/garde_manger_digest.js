// Garde-manger : résumé des produits à finir, envoyé sur ntfy (appli ntfy sur iPhone/Android).
// Chargé par expiry_digest.pb.js. Réglages dans /opt/pocketbase/garde-manger.env :
//   GM_NTFY_URL=https://ntfy.sh/mon-sujet-secret   (ou votre serveur ntfy)
//   GM_NTFY_TOKEN=tk_...                            (facultatif, sujet protégé)
//   GM_DIGEST_DAYS=2                                (horizon en jours, facultatif)
module.exports = {
  send: (app, force) => {
    const url = String($os.getenv("GM_NTFY_URL") || "").trim().replace(/\/+$/, "");
    if (!url) throw new Error("not_configured");
    const m = url.match(/^(https?:\/\/[^/]+)\/([\w-]+)$/);
    if (!m) throw new Error("bad_url");

    const pad = (n) => (n < 10 ? "0" : "") + n;
    const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const now = new Date();
    const today = ymd(now);
    const days = Math.max(0, parseInt($os.getenv("GM_DIGEST_DAYS") || "2", 10) || 2);
    const limit = ymd(new Date(now.getTime() + days * 86400000));

    const recs = app.findRecordsByFilter("stock", "qty > 0 && expiry != '' && expiry <= {:lim}", "expiry", 40, 0, { lim: limit });
    if (!recs.length && !force) return 0;

    let expired = 0;
    const lines = recs.map((r) => {
      const exp = r.getString("expiry");
      const diff = Math.round((new Date(exp + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);
      let when;
      if (diff < 0) { when = "périmé depuis " + (-diff) + " j"; expired++; }
      else if (diff === 0) when = "aujourd'hui";
      else if (diff === 1) when = "demain";
      else when = "dans " + diff + " j";
      return "• " + r.getString("name") + " — " + when + " (" + r.getString("location") + ")";
    });

    const n = recs.length;
    const title = n ? (n + " produit" + (n > 1 ? "s" : "") + " à finir") : "Garde-manger : tout est frais";
    const message = n ? lines.join("\n") : "Rien ne périme dans les " + days + " prochains jours.";
    const appURL = app.settings().meta.appURL || "";
    const headers = { "Content-Type": "application/json" };
    const token = String($os.getenv("GM_NTFY_TOKEN") || "").trim();
    if (token) headers["Authorization"] = "Bearer " + token;

    const res = $http.send({
      url: m[1],
      method: "POST",
      headers: headers,
      timeout: 20,
      body: JSON.stringify({
        topic: m[2], title: title, message: message,
        tags: [expired ? "warning" : "hourglass_flowing_sand"],
        priority: expired ? 4 : 3,
        click: appURL || undefined,
      }),
    });
    if (res.statusCode < 200 || res.statusCode >= 300) throw new Error("ntfy_" + res.statusCode);
    return n;
  },
};
