/// <reference path="../pb_data/types.d.ts" />
// Garde-manger : notification quotidienne des produits à finir (ntfy).
// Heure : GM_DIGEST_CRON dans garde-manger.env (format cron, heure du serveur), 7 h par défaut.
cronAdd("garde-manger-peremption", String($os.getenv("GM_DIGEST_CRON") || "0 7 * * *"), () => {
  if (!$os.getenv("GM_NTFY_URL")) return;
  try { require(`${__hooks}/garde_manger_digest.js`).send($app, false); }
  catch (err) { $app.logger().error("Garde-manger : notification non envoyée", "error", String(err)); }
});

// Bouton « Tester les notifications » de l'app
routerAdd("POST", "/api/garde-manger/notify-test", (e) => {
  try {
    const n = require(`${__hooks}/garde_manger_digest.js`).send(e.app, true);
    return e.json(200, { sent: true, count: n });
  } catch (err) {
    const code = String(err && err.message || err);
    const msg = code.indexOf("not_configured") >= 0 ? "Notifications non configurées sur le serveur (GM_NTFY_URL)."
      : code.indexOf("bad_url") >= 0 ? "GM_NTFY_URL invalide : attendu https://serveur/sujet."
      : "Envoi impossible vers ntfy (" + code + ").";
    return e.json(400, { sent: false, message: msg });
  }
}, $apis.requireAuth("users"));
