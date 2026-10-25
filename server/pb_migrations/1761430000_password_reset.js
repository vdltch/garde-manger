/// <reference path="../pb_data/types.d.ts" />
// Garde-manger : e-mail de réinitialisation en français, avec un lien qui ouvre l'app
// (le tableau de bord /_/ n'est pas joignable depuis Internet).
migrate((app) => {
  const settings = app.settings();
  settings.meta.appName = "Garde-manger";
  if (!settings.meta.appURL || /localhost|127\.0\.0\.1/.test(settings.meta.appURL)) {
    settings.meta.appURL = $os.getenv("PB_APP_URL") || "https://stock.quipaie.com";
  }
  app.save(settings);

  const users = app.findCollectionByNameOrId("users");
  users.resetPasswordTemplate.subject = "Garde-manger : choisir un nouveau mot de passe";
  users.resetPasswordTemplate.body =
    "<p>Bonjour,</p>" +
    "<p>Vous avez demandé à changer le mot de passe de votre compte Garde-manger.</p>" +
    "<p><a class=\"btn\" href=\"{APP_URL}/#reset={TOKEN}\" target=\"_blank\" rel=\"noopener\">Choisir un nouveau mot de passe</a></p>" +
    "<p>Ce lien est valable 30 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>" +
    "<p>Garde-manger</p>";
  app.save(users);
}, (app) => {});
