# Garde-manger

Application web mobile (PWA) pour gérer le stock alimentaire de la maison : on scanne les codes-barres ou QR codes des produits, on suit les dates de péremption et la liste de courses se remplit toute seule.

**Ouvrir l'app :** https://vdltch.github.io/garde-manger/

## Fonctionnalités

- **Scan** de codes-barres EAN et de QR codes avec la caméra, avec un bip de caisse et un ticket qui s'imprime à l'écran.
- **Fiche produit automatique** grâce à [Open Food Facts](https://world.openfoodfacts.org) (nom et marque).
- **Ajout manuel** pour les produits sans code (fruits, légumes, restes…).
- **Quatre emplacements** : Frigo, Congélateur, Placard, Cave.
- **Anneau de fraîcheur** sur chaque produit et onglet « Bientôt » pour ce qui périme sous 3 jours.
- **Liste de courses** : un produit qui tombe à zéro y passe tout seul, « Acheté » le remet en stock.
- **Hors ligne** : l'app reste utilisable sans réseau une fois ouverte une première fois.
- Thème clair et sombre selon le réglage du téléphone.

## Installer sur le téléphone

- **iPhone (Safari)** : ouvrir l'URL → bouton Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : ouvrir l'URL → menu ⋮ → « Installer l'application ».

La caméra demande une autorisation au premier scan. Si elle est refusée, on peut aussi prendre le code en photo ou le taper.

## Données

Le stock est enregistré **sur l'appareil** (localStorage du navigateur). Il n'est pas synchronisé entre plusieurs téléphones.

## Format des QR codes

Un QR code peut contenir :

- un code EAN (ex. `3017620422003`) : le produit est recherché sur Open Food Facts ;
- du texte libre : utilisé comme nom du produit ;
- du JSON, pour pré-remplir la fiche :

```json
{ "nom": "Soupe maison", "dlc": "2026-11-02", "qty": 2, "unit": "pot", "lieu": "Congélateur" }
```

## Technique

- Un seul fichier `index.html` : React 18 + [htm](https://github.com/developit/htm) (pas de build), [ZXing](https://github.com/zxing-js/library) et l'API `BarcodeDetector` pour la lecture des codes.
- Animations en CSS (ressorts via `linear()`) et View Transitions API.
- Bip de scan synthétisé avec la Web Audio API (aucun fichier son).
- `sw.js` : service worker pour le fonctionnement hors ligne. `manifest.webmanifest` : installation en tant qu'app.

### Lancer en local

```bash
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000. Pour tester la caméra depuis un téléphone, il faut du HTTPS (GitHub Pages ou un tunnel).
