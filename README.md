# Road Trip 🚐

Organiser un road trip — pensé pour l'Espagne, utilisable partout. PWA + APK
Android, données sur le téléphone, capteurs Home Assistant en option.

## Ce que fait l'app

| Onglet | Contenu |
|---|---|
| **Itinéraire** | Étapes ordonnées, nuits par étape, distance et temps de route entre chaque, logement, notes. Dates d'arrivée calculées. Bouton *Y aller* qui ouvre Maps/Waze. |
| **Carte** | Tout le trajet tracé, marqueurs numérotés colorés selon l'avancement (fait / en cours / à venir). |
| **Budget** | Prévisionnel par poste et dépenses réelles, avec l'écart. Carburant et visites se déduisent des données déjà saisies. |
| **Visites** | Ce qu'il y a à voir par étape, coché au fur et à mesure. Suggestions pré-remplies pour 14 villes espagnoles. |
| **Réglages** | Véhicule, connexion Home Assistant, sauvegarde. |

## Ce qui marche sans réseau

Tout, sauf le fond de carte. Les ~80 villes d'Espagne, France et Portugal sont
**embarquées avec leurs coordonnées** : on peut construire un itinéraire complet
et le voir tracé en étant hors couverture. Seules les tuiles OpenStreetMap et la
recherche d'une ville absente de la liste (Nominatim) demandent du réseau.

C'est délibéré : en roaming, une app de voyage qui exige une connexion pour
afficher son propre itinéraire ne sert à rien.

## Les estimations, et leur marge

Quand deux étapes ont des coordonnées, l'app propose une distance et une durée :

- **distance** = vol d'oiseau × 1,25, le rapport route/direct courant sur
  autoroute en Europe de l'Ouest ;
- **durée** = distance ÷ 95 km/h, autoroute espagnole avec pauses.

**Ce facteur unique se trompe sur les reliefs.** Mesuré sur un trajet réel :

| Trajet | Estimé | Réel | Écart |
|---|---|---|---|
| Toulouse → Barcelone | 317 km | ~390 km | −19 % (Pyrénées) |
| Barcelone → Valence | 379 km | ~350 km | +8 % |
| Valence → Grenade | 474 km | ~500 km | −5 % |

Sur du plat, c'est bon à 10 % près ; sur un passage de montagne, ça sous-estime
nettement. **Le kilométrage est éditable étape par étape** — et il faut le
corriger si on veut un budget carburant juste, puisque c'est lui qui le calcule.

Un vrai calcul d'itinéraire routier demanderait une API de routage (OSRM,
GraphHopper) : dépendance réseau au moment où on prépare le voyage, quota à
gérer, et le calcul ne servirait qu'une fois par étape. Le choix a été de rester
autonome et d'assumer une estimation corrigeable.

## Home Assistant (optionnel)

Renseigner l'URL et un jeton longue durée dans *Réglages* publie cinq capteurs :

| Entité | État | Attributs utiles |
|---|---|---|
| `sensor.roadtrip_etape` | ville en cours | itinéraire complet, logement, n° d'étape |
| `sensor.roadtrip_jours_restants` | jours | dates de départ et de retour |
| `sensor.roadtrip_budget` | € dépensés | prévu, écart, détail par poste |
| `sensor.roadtrip_distance` | km | durée de route, carburant estimé |
| `sensor.roadtrip_visites` | visites faites | total, liste de ce qui reste |

La **sauvegarde** passe par `autobackup.js`, le module partagé des autres apps
(entité `sensor.roadtrip_sauvegarde`) : mêmes garde-fous contre l'écrasement
d'une sauvegarde pleine par une sauvegarde vide. La connexion HA est la même que
pour les capteurs, saisie une seule fois.

⚠️ Un état posé via `/api/states` **n'est pas persistant** côté HA : il disparaît
au redémarrage. L'app republie au lancement.

## Build

L'APK est construit par GitHub Actions à chaque push sur `main` (voir
`.github/workflows/build-apk.yml`) et publié en Release. La clé de signature vit
dans `~/app-kit/keys/roadtrip.p12` et **uniquement** en secrets Actions
(`ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`) — jamais dans le dépôt.

Pour changer de version, modifier les **cinq** endroits :
`package.json`, `android/app/build.gradle` (`versionName` + `versionCode`),
`www/version.json`, `window.APP_VERSION` dans `www/index.html`, et `CACHE` dans
`www/sw.js` (sinon l'ancienne coquille survit dans le cache).

Icônes : `python3 tools_gen_icon.py --android`.

## Données et vie privée

Tout est dans le `localStorage` du téléphone. Aucun compte, aucun serveur.
Les seules requêtes sortantes sont les tuiles OpenStreetMap, la recherche
Nominatim si on l'utilise, l'API GitHub pour la vérification de mise à jour, et
Home Assistant si on l'a configuré.

Fond de carte © contributeurs OpenStreetMap.
