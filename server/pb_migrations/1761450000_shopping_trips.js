/// <reference path="../pb_data/types.d.ts" />
// Garde-manger : « Jour de courses » — prix relevés par le foyer (par magasin) et historique des courses.
migrate((app) => {
  const signedIn = "@request.auth.id != ''";
  const prices = new Collection({
    type: "base", name: "prices",
    listRule: signedIn, viewRule: signedIn, createRule: signedIn, updateRule: null, deleteRule: null,
    fields: [
      { name: "code", type: "text", max: 32 },
      { name: "name", type: "text", max: 200 },
      { name: "storeKey", type: "text", required: true, max: 120 },
      { name: "storeName", type: "text", max: 120 },
      { name: "price", type: "number", required: true, min: 0 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_prices_lookup ON prices (storeKey, code, name)"],
  });
  app.save(prices);
  const trips = new Collection({
    type: "base", name: "trips",
    listRule: signedIn, viewRule: signedIn, createRule: signedIn, updateRule: null, deleteRule: signedIn,
    fields: [
      { name: "storeName", type: "text", max: 120 },
      { name: "storeKey", type: "text", max: 120 },
      { name: "total", type: "number" },
      { name: "count", type: "number" },
      { name: "lines", type: "json", maxSize: 200000 },
      { name: "startedAt", type: "text", max: 40 },
      { name: "created", type: "autodate", onCreate: true },
    ],
  });
  app.save(trips);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("prices"));
  app.delete(app.findCollectionByNameOrId("trips"));
});
