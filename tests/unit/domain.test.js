import { test } from "node:test";
import assert from "node:assert/strict";
import { validGtin, classify, guessPlace, guessShelf, iso, daysLeft, status, expLabel, initials, uid, ringPct, isRetail, grade } from "../../src/domain.js";

test("validGtin: real barcodes pass, typos fail", () => {
  for (const ok of ["3017620422003", "5449000000996", "036000291452", "96385074"]) assert.ok(validGtin(ok), ok);
  for (const ko of ["3017620422004", "123", "30176204220031", "abcdefghijklm", ""]) assert.ok(!validGtin(ko), ko);
});

test("classify: barcode, GS1 Digital Link, JSON label, free text", () => {
  assert.deepEqual(classify(" 3017620422003 "), { code: "3017620422003", raw: "3017620422003" });
  assert.equal(classify("https://id.gs1.org/01/03017620422003/10/LOT").code, "3017620422003");
  const j = classify('{"nom":"Soupe maison","dlc":"2026-11-02","qty":2,"unit":"pot","lieu":"Congélateur"}');
  assert.equal(j.name, "Soupe maison"); assert.equal(j.expiry, "2026-11-02"); assert.equal(j.location, "Congélateur"); assert.equal(j.qty, 2);
  assert.equal(classify("Pain de campagne").name, "Pain de campagne");
});

test("guessPlace / guessShelf from Open Food Facts categories", () => {
  assert.equal(guessPlace(["en:dairies", "en:yogurts"]), "Frigo");
  assert.equal(guessPlace(["en:frozen-foods"]), "Congélateur");
  assert.equal(guessPlace(["en:wines"]), "Cave");
  assert.equal(guessPlace(["en:pastas"]), "Placard");
  assert.equal(guessShelf(["en:yogurts"]), 21);
  assert.equal(guessShelf(["en:frozen-foods", "en:yogurts"]), 180);
  assert.equal(guessShelf(["en:uht-milks", "en:milks"]), 90);
  assert.equal(guessShelf(["en:wines"]), 0);
  assert.equal(guessShelf([]), 0);
});

test("dates: days left, status and labels", () => {
  assert.equal(daysLeft(iso(0)), 0);
  assert.equal(daysLeft(iso(5)), 5);
  assert.equal(daysLeft(""), null);
  assert.equal(status({ expiry: iso(-1) }), "bad");
  assert.equal(status({ expiry: iso(2) }), "warn");
  assert.equal(status({ expiry: iso(10) }), "ok");
  assert.equal(status({ expiry: "" }), "none");
  assert.equal(expLabel({ expiry: iso(0) }), "AUJOURD'HUI");
  assert.equal(expLabel({ expiry: iso(1) }), "DEMAIN");
  assert.equal(expLabel({ expiry: iso(4) }), "J−4");
  assert.match(expLabel({ expiry: iso(-3) }), /PÉRIMÉ · 3 J/);
  assert.equal(expLabel({ expiry: "" }), null);
  assert.equal(ringPct({ expiry: iso(14) }), 100);
  assert.ok(ringPct({ expiry: iso(1) }) < 20);
});

test("small helpers", () => {
  assert.equal(initials("Pâtes penne"), "PP");
  assert.equal(initials("Lait"), "LA");
  assert.match(uid(), /^[a-z0-9]{15}$/);
  assert.notEqual(uid(), uid());
  assert.ok(isRetail({ format: "ean_13", rawValue: "x" }));
  assert.ok(!isRetail({ format: "qr_code", rawValue: "3017620422003" }));
  assert.equal(grade("b"), "b"); assert.equal(grade("unknown"), "");
});
