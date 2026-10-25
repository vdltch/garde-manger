# Garde-manger

Application web mobile (PWA) pour gérer le stock alimentaire de la maison : on scanne les codes-barres ou QR codes des produits, on suit les dates de péremption et la liste de courses se remplit toute seule.

**Ouvrir l'app :** https://stock.quipaie.com/ (servie par PocketBase) — miroir : https://vdltch.github.io/garde-manger/

## Fonctionnalités

- **Scan** de codes-barres EAN et de QR codes avec la caméra, avec un bip de caisse et un ticket qui s'imprime à l'écran.
- **Fiche produit automatique** comme Yuka, grâce à [Open Food Facts](https://world.openfoodfacts.org) : nom, marque, format, photo, Nutri-Score, NOVA et Éco-score, et emplacement deviné (frigo, congélateur, placard, cave). Repli sur Open Products Facts et Open Beauty Facts pour les produits non alimentaires.
- **Lecture rapide des codes** : détecteur natif sur Android, moteur ZXing-C++ en WebAssembly sur iPhone, contrôle du chiffre de contrôle EAN pour éviter les fausses lectures, lampe torche.
- **Catalogue du foyer** : chaque fiche trouvée ou complétée à la main est enregistrée sur le serveur ; un produit inconnu d'Open Food Facts complété une fois est reconnu ensuite par tous les téléphones.
- **Date suggérée** selon le type de produit (yaourt ≈ 3 semaines, viande ≈ 3 jours, surgelé ≈ 6 mois…), et apprise à partir de vos saisies.
- **Lots** : le même produit avec des dates différentes ; au scan d'un produit déjà en stock, « Autre date » crée un nouveau lot.
- **Scan en rafale** : pour ranger un sac de courses d'un coup, chaque bip ajoute l'article, les fiches se remplissent en arrière-plan.
- **Liste de courses** : articles libres, quantité à acheter, panier à cocher en magasin, puis « Ranger » qui remet tout en stock avec une date suggérée. Partagée en direct entre téléphones.
- **Jour de courses** : un interrupteur dans l'onglet Courses. L'app trouve les magasins autour de vous (OpenStreetMap) ou vous le choisissez ; chaque article scanné va dans le panier du jour avec son prix — votre dernier prix dans ce magasin, celui du foyer, ou celui d'[Open Prices](https://prices.openfoodfacts.org) — et le total (avec budget facultatif) se calcule en direct. À la fin : un ticket de caisse, tout est rangé dans le stock, les articles de la liste sont cochés, et les prix sont mémorisés pour la prochaine fois.
- **Notifications** chaque matin des produits à finir, via [ntfy](https://ntfy.sh) (voir plus bas).
- **Ajout manuel** pour les produits sans code (fruits, légumes, restes…).
- **Quatre emplacements** : Frigo, Congélateur, Placard, Cave.
- **Anneau de fraîcheur** sur chaque produit et onglet « Bientôt » pour ce qui périme sous 3 jours.
- Un produit qui tombe à zéro passe tout seul sur la liste de courses.
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

Dans l'app, bouton **nuage** en haut → adresse `https://stock.mondomaine.fr` + e-mail et mot de passe. Le stock déjà présent sur le téléphone est envoyé sur le serveur. La pastille du bouton indique l'état : vert synchronisé, orange hors ligne, rouge session expirée.

### Sécurité et fiabilité (appliquées automatiquement)

- **Tableau de bord admin réservé au réseau local** : `/_/` et la connexion superuser renvoient 404 via le domaine public ; ils restent accessibles sur `http://IP-DU-LXC:8090/_/`. Pour autoriser un autre nom d'hôte : variable `PB_ADMIN_HOSTS` dans le service.
- **Quantités sans conflit** : les + et − sont envoyés comme incréments côté serveur, deux téléphones peuvent modifier le même produit en même temps.
- **Sauvegarde automatique** chaque nuit (3 h 30 UTC), 14 conservées dans `pb_data/backups`.
- **Sessions de 90 jours**, renouvelées à chaque ouverture de l'app.
- **Limiteur de requêtes** activé, avec la vraie IP du client derrière le reverse proxy.

- **Bibliothèques hébergées avec l'app** : `deploy-app.sh` télécharge React, htm, ZXing, barcode-detector et le moteur WebAssembly dans `pb_public/vendor/` (versions figées). Les CDN ne servent plus que de secours.
- **Mises à jour visibles** : chaque déploiement change le service worker, et l'app affiche « Nouvelle version · Recharger ».
- **Scans hors ligne** : un article scanné sans réseau peut être enregistré sans nom ; sa fiche (nom, marque, photo, scores) est complétée automatiquement au retour du réseau.

### Notifications de péremption (ntfy)

1. Installez l'appli **ntfy** (App Store / Play Store) et abonnez-vous à un sujet au nom difficile à deviner, par exemple `garde-manger-7f3k9q`.
2. Dans le LXC, éditez `/opt/pocketbase/garde-manger.env` et décommentez :
   ```
   GM_NTFY_URL=https://ntfy.sh/garde-manger-7f3k9q
   ```
   (ou l'adresse de votre propre serveur ntfy, avec `GM_NTFY_TOKEN` si le sujet est protégé). Heure d'envoi : `GM_DIGEST_CRON` (7 h, heure du serveur, par défaut).
3. `systemctl restart pocketbase`, puis dans l'app : bouton nuage → **Tester les notifications**.

### Mot de passe oublié

Dans l'app, bouton nuage → « Mot de passe oublié ? ». Il faut une messagerie configurée dans PocketBase : tableau de bord (réseau local) → **Settings → Mail settings** → activer SMTP (ex. Gmail avec un mot de passe d'application, Brevo, OVH…), puis « Send test email ». L'e-mail, en français, contient un lien qui ouvre l'app pour choisir le nouveau mot de passe. L'adresse de l'app est réglée dans **Settings → Application → Application URL** (`https://stock.quipaie.com` par défaut).

Changer le mot de passe admin :

```bash
runuser -u pocketbase -- /opt/pocketbase/pocketbase superuser upsert EMAIL 'NOUVEAU-MOT-DE-PASSE' --dir=/opt/pocketbase/pb_data
```

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

Pas d'étape de build : le navigateur charge directement des modules ES.

```
index.html            page, chargement des bibliothèques (vendor/ puis CDN en secours)
styles.css            styles et thèmes clair/sombre
src/main.js           démarrage
src/app.js            écran principal : stock, bientôt, courses, flux de scan
src/domain.js         logique pure (dates, codes EAN, catégories) — testée avec node
src/storage.js        cache local + synchro PocketBase (file d'attente, temps réel, connexion)
src/products.js       fiches produit : catalogue du foyer puis Open Food Facts
src/trip.js           jour de courses : magasins autour, prix, panier, historique
src/barcode.js        lecture des codes : BarcodeDetector, ZXing-C++ WebAssembly, ZXing JS
src/device.js         transitions, vibrations, bip du scanner
src/ui/*.js           composants (scanner, fiche, cartes, synchro, fenêtres)
src/gate.js           écran d'installation selon le téléphone et le navigateur
sw.js                 service worker (hors ligne, mises à jour)
server/               installation et déploiement PocketBase, migrations, règles serveur
tests/unit/           tests node (logique, structure des modules, rendu de chaque écran)
tests/e2e/            tests navigateur contre un vrai PocketBase (Playwright)
```

- React 18 + [htm](https://github.com/developit/htm) pour les gabarits sans JSX. Lecture des codes : API `BarcodeDetector` native, sinon [barcode-detector](https://github.com/Sec-ant/barcode-detector) (ZXing-C++ en WebAssembly), sinon [ZXing JS](https://github.com/zxing-js/library).
- Animations en CSS (ressorts via `linear()`) et View Transitions API. Bip synthétisé avec la Web Audio API.
- Accessibilité : zones tactiles de 44 px, focus gardé dans les fenêtres et rendu à la fermeture, mouvements réduits respectés.

### Tests

```bash
npm test                                   # logique, structure, rendu de chaque écran (node 22, aucune dépendance)
bash server/fetch-vendor.sh vendor         # bibliothèques pour les tests navigateur
pip install pytest playwright requests && python -m playwright install chromium
PB_BIN=/chemin/vers/pocketbase pytest tests/e2e -v
```

Les deux suites tournent sur GitHub Actions à chaque push (`.github/workflows/tests.yml`).

### Mise à jour automatique du serveur

```bash
cd ~/garde-manger/server && bash enable-auto-update.sh
```

Toutes les 10 minutes, le LXC vérifie s'il y a un nouveau commit sur `main` **dont les tests GitHub sont verts**, puis lance `deploy-app.sh`. Un commit en échec n'est jamais déployé. Journal : `journalctl -u garde-manger-update`.

### Lancer en local

```bash
bash server/fetch-vendor.sh vendor
pocketbase serve --migrationsDir=server/pb_migrations --hooksDir=server/pb_hooks --publicDir=.
```
