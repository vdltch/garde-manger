/// <reference path="../pb_data/types.d.ts" />
// Garde-manger : collection "stock" partagée par tous les comptes du foyer.
// Les comptes sont créés par l'administrateur (inscription publique désactivée).
migrate((app) => {
  const signedIn = "@request.auth.id != ''";

  const stock = new Collection({
    type: "base",
    name: "stock",
    listRule: signedIn,
    viewRule: signedIn,
    createRule: signedIn,
    updateRule: signedIn,
    deleteRule: signedIn,
    fields: [
      { name: "name", type: "text", required: true, max: 200 },
      { name: "brand", type: "text", max: 120 },
      { name: "code", type: "text", max: 64 },
      { name: "qty", type: "number" },
      { name: "unit", type: "text", max: 20 },
      { name: "location", type: "text", max: 40 },
      { name: "expiry", type: "text", max: 10 },
      { name: "addedAt", type: "number" },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_stock_code ON stock (code)"],
  });
  app.save(stock);

  const users = app.findCollectionByNameOrId("users");
  users.createRule = null;
  app.save(users);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("stock"));
  const users = app.findCollectionByNameOrId("users");
  users.createRule = "";
  app.save(users);
});
