/// <reference path="../pb_data/types.d.ts" />
// Garde-manger : catalogue produits partagé par le foyer + liste de courses (quantité à acheter, panier).
migrate((app) => {
  const signedIn = "@request.auth.id != ''";
  const products = new Collection({
    type: "base",
    name: "products",
    listRule: signedIn,
    viewRule: signedIn,
    createRule: signedIn,
    updateRule: signedIn,
    deleteRule: null, // seul l'administrateur supprime une fiche du catalogue
    fields: [
      { name: "code", type: "text", required: true, max: 32 },
      { name: "name", type: "text", max: 200 },
      { name: "brand", type: "text", max: 120 },
      { name: "hint", type: "text", max: 60 },
      { name: "location", type: "text", max: 40 },
      { name: "image", type: "text", max: 600 },
      { name: "nutri", type: "text", max: 2 },
      { name: "nova", type: "number" },
      { name: "eco", type: "text", max: 2 },
      { name: "shelfDays", type: "number" },
      { name: "source", type: "text", max: 40 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_products_code ON products (code)"],
  });
  app.save(products);

  const stock = app.findCollectionByNameOrId("stock");
  stock.fields.add(new NumberField({ name: "toBuy" }));
  stock.fields.add(new BoolField({ name: "inCart" }));
  app.save(stock);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("products"));
  const stock = app.findCollectionByNameOrId("stock");
  ["toBuy", "inCart"].forEach((n) => stock.fields.removeByName(n));
  app.save(stock);
});
