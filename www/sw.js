/* Road Trip — service worker. Met en cache la coquille de l'app pour qu'elle
   démarre sans réseau : c'est le point clé d'une app de voyage, où le roaming
   est cher et la couverture aléatoire.

   Ne sont JAMAIS mises en cache :
   - les tuiles OpenStreetMap (volume, et leur politique d'usage) ;
   - Nominatim et l'API GitHub, qui doivent toujours répondre frais ou échouer.

   Penser à changer CACHE à chaque version, sinon l'ancienne coquille survit. */
const CACHE = 'roadtrip-v1.0';
const SHELL = [
  'index.html', 'styles.css', 'app.js',
  'js/model.js', 'js/lieux.js', 'js/ha.js', 'js/carte.js',
  'update-check.js', 'autobackup.js',
  'manifest.webmanifest', 'version.json',
  'img/icon-192.png', 'img/icon-512.png',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-icon-2x.png',
  'vendor/leaflet/images/marker-shadow.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.endsWith('tile.openstreetmap.org') ||
      url.hostname.endsWith('nominatim.openstreetmap.org') ||
      url.hostname.includes('api.github.com')) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
