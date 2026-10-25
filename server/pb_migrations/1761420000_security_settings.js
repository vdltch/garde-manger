/// <reference path="../pb_data/types.d.ts" />
// Garde-manger : réglages de sécurité et de fiabilité du serveur.
migrate((app) => {
  const settings = app.settings();

  // Sauvegarde automatique chaque nuit à 3 h 30 (UTC), 14 dernières gardées dans pb_data/backups
  settings.backups.cron = "30 3 * * *";
  settings.backups.cronMaxKeep = 14;

  // Limiteur de requêtes (anti force brute sur les connexions)
  settings.rateLimits.enabled = true;

  // Derrière Nginx Proxy Manager : utiliser la vraie IP du client
  settings.trustedProxy.headers = ["X-Real-IP", "X-Forwarded-For"];
  settings.trustedProxy.useLeftmostIP = false;

  app.save(settings);

  // Sessions des comptes du foyer : 90 jours (renouvelées à chaque ouverture de l'app)
  const users = app.findCollectionByNameOrId("users");
  users.authToken.duration = 90 * 24 * 3600;
  app.save(users);
}, (app) => {
  const settings = app.settings();
  settings.backups.cron = "";
  app.save(settings);
  const users = app.findCollectionByNameOrId("users");
  users.authToken.duration = 7 * 24 * 3600;
  app.save(users);
});
