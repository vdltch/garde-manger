/// <reference path="../pb_data/types.d.ts" />
// Garde-manger : photo et scores du produit récupérés par le scan (Open Food Facts).
migrate((app) => {
  const stock = app.findCollectionByNameOrId("stock");
  stock.fields.add(new TextField({ name: "image", max: 600 }));
  stock.fields.add(new TextField({ name: "nutri", max: 2 }));
  stock.fields.add(new NumberField({ name: "nova" }));
  stock.fields.add(new TextField({ name: "eco", max: 2 }));
  app.save(stock);
}, (app) => {
  const stock = app.findCollectionByNameOrId("stock");
  ["image", "nutri", "nova", "eco"].forEach((n) => stock.fields.removeByName(n));
  app.save(stock);
});
