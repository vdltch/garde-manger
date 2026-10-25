# Garde-manger

Application web mobile (PWA) pour gérer le stock alimentaire de la maison : on scanne les codes-barres ou QR codes des produits, on suit les dates de péremption et la liste de courses se remplit toute seule.

**Ouvrir l'app :** https://stock.quipaie.com/ (servie par PocketBase) — miroir : https://vdltch.github.io/garde-manger/

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

Sur téléphone, si l'app est ouverte dans un onglet, un écran explique comment l'installer selon le système et le navigateur (Safari, Chrome, Firefox, Edge, Samsung Internet, navigateurs intégrés d'Instagram/Facebook…). Sur Android, un bouton « Installer l'app » lance l'installation directement quand le navigateur le permet.

La caméra demande une autorisation au premier scan. Si elle est refusée, on peut aussi prendre le code en photo ou le taper.

## Données et synchronisation

Par défaut, le stock est enregistré **sur le téléphone** (localStorage). Pour le partager entre plusieurs téléphones du foyer, l'app se connecte à un serveur **[PocketBase](https://pocketbase.io)** auto-hébergé :

- synchronisation **en temps réel** (une modification sur un téléphone apparaît sur l'autre) ;
- **hors ligne** : les changements sont gardés en file d'attente et envoyés au retour du réseau ;
- un compte par personne, tous les comptes partagent le même stock.

### 1. Installer PocketBase (LXC Debian/Ubuntu sur Proxmox)

Créez un conteneur LXC (Debian 12, 1 cœur, 512 Mo de RAM et 2 Go de disque suffisent), puis en root :

```bash
apt-get update && apt-get install -y git
git clone https://github.com/vdltch/garde-manger && cd garde-manger/server
ADMIN_EMAIL=vous@exemple.fr ADMIN_PASSWORD='un-mot-de-passe-solide' bash install-pocketbase.sh
```

Le script installe la dernière version de PocketBase dans `/opt/pocketbase`, crée le service systemd `pocketbase` (port 8090), applique la migration `pb_migrations/` (collection `stock`, accès réservé aux comptes connectés, inscription publique désactivée) et crée le compte administrateur.

Le même script publie l'app dans `/opt/pocketbase/pb_public` : PocketBase sert l'app à la racine (`/`), l'API sur `/api/` et le tableau de bord sur `/_/`, le tout sur une seule adresse.

Pour mettre l'app à jour après un changement dans le repo :

```bash
cd ~/garde-manger/server && bash deploy-app.sh
```

### 2. Créer les comptes du foyer

Tableau de bord `http://IP-DU-LXC:8090/_/` → **Collections → users → New record** : un e-mail et un mot de passe par personne.

### 3. Exposer le serveur en HTTPS

L'app est servie en HTTPS : le navigateur refuse de parler à un serveur en HTTP. Deux options :

- **Cloudflare Tunnel** (aucun port à ouvrir sur la box) : dans le LXC, installez `cloudflared`, puis dans le tableau de bord Cloudflare Zero Trust → Networks → Tunnels, créez un tunnel avec un « Public hostname » `stock.mondomaine.fr` → `http://localhost:8090`.
- **Reverse proxy** existant (Nginx Proxy Manager, Caddy, Traefik) : un hôte `stock.mondomaine.fr` vers `http://IP-DU-LXC:8090`, avec certificat Let's Encrypt. Pensez à autoriser les connexions longues (temps réel en SSE) : pas de mise en tampon ni de délai d'expiration court.

### 4. Connecter l'app

Dans l'app, bouton **nuage** en haut → adresse `https://stock.mondomaine.fr` + e-mail et mot de passe. Le stock déjà présent sur le téléphone est envoyé sur le serveur (sauf les exemples). La pastille du bouton indique l'état : vert synchronisé, orange hors ligne, rouge session expirée.

### Sauvegarde

Toutes les données sont dans `/opt/pocketbase/pb_data`. Une sauvegarde Proxmox du conteneur suffit, ou **Settings → Backups** dans le tableau de bord PocketBase.

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
- `server/` : script d'installation PocketBase et migration de la base.
- `sw.js` : service worker pour le fonctionnement hors ligne. `manifest.webmanifest` : installation en tant qu'app.

### Lancer en local

```bash
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000. Pour tester la caméra depuis un téléphone, il faut du HTTPS (GitHub Pages ou un tunnel).
