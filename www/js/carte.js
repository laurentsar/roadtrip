/*
 * carte.js — carte Leaflet du road trip.
 *
 * Les tuiles OpenStreetMap viennent du réseau : hors ligne, la carte reste
 * grise mais les marqueurs et le tracé s'affichent quand même (ils sont
 * dessinés côté client). L'app ne dépend donc jamais de la carte pour être
 * utilisable — c'est un confort, pas le support des données.
 *
 * Leaflet est vendoré dans www/vendor : aucun CDN, l'APK doit fonctionner
 * sans autoriser de domaine tiers pour le code.
 */
(function (global) {
  'use strict';

  var map = null;
  var layer = null;   /* tout ce qu'on redessine à chaque rendu */
  var ready = false;

  function init(elId) {
    if (map || !global.L) return map;
    var el = document.getElementById(elId);
    if (!el) return null;

    map = global.L.map(el, { zoomControl: true, attributionControl: true });
    global.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    /* Vue par défaut : la péninsule ibérique, cadrée pour qu'un trip vide ne
       s'ouvre pas au milieu de l'Atlantique. */
    map.setView([40.0, -3.5], 5);
    layer = global.L.layerGroup().addTo(map);
    ready = true;
    return map;
  }

  /* Leaflet mesure le conteneur à la création. Si l'onglet Carte était caché,
     la taille vaut 0 et la carte s'affiche en tuiles grises jusqu'à ce qu'on
     la force à se remesurer. */
  function refresh() {
    if (map) setTimeout(function () { map.invalidateSize(); }, 60);
  }

  function marker(lat, lon, label, color) {
    var icon = global.L.divIcon({
      className: 'trip-pin',
      html: '<span style="background:' + color + '">' + label + '</span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    return global.L.marker([lat, lon], { icon: icon });
  }

  function render(state) {
    if (!ready) return;
    layer.clearLayers();

    var pts = [];
    state.etapes.forEach(function (e, i) {
      if (e.lat == null || e.lon == null) return;
      pts.push([e.lat, e.lon]);
      var couleur = etapeCouleur(state, i);
      var m = marker(e.lat, e.lon, String(i + 1), couleur);
      m.bindPopup(
        '<b>' + escapeHtml(e.ville) + '</b><br>' +
        e.nuits + ' nuit' + (e.nuits > 1 ? 's' : '') +
        (e.km ? '<br>' + Math.round(e.km) + ' km depuis l\'étape précédente' : '') +
        (e.logement ? '<br>🛏️ ' + escapeHtml(e.logement) : '')
      );
      m.addTo(layer);

      /* Les visites géolocalisées : petits points, pour ne pas noyer les
         numéros d'étape qui portent la lecture de l'itinéraire. */
      e.visites.forEach(function (v) {
        if (v.lat == null || v.lon == null) return;
        global.L.circleMarker([v.lat, v.lon], {
          radius: 5, color: '#f5b301', fillColor: '#f5b301', fillOpacity: 0.9, weight: 1,
        }).bindPopup('<b>' + escapeHtml(v.nom) + '</b><br>' + escapeHtml(e.ville)).addTo(layer);
      });
    });

    if (pts.length > 1) {
      global.L.polyline(pts, { color: '#38bdf8', weight: 3, opacity: 0.85 }).addTo(layer);
    }
    if (pts.length) {
      map.fitBounds(global.L.latLngBounds(pts).pad(0.25));
    }
  }

  /* Vert = étape passée, bleu = en cours, gris = à venir. Le repère visuel le
     plus utile en voyage, c'est « où j'en suis ». */
  function etapeCouleur(state, i) {
    var cur = global.Model.etapeCourante(state);
    if (!cur) return '#64748b';
    if (i < cur.index) return '#22c55e';
    if (i === cur.index) return '#38bdf8';
    return '#64748b';
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  global.Carte = { init: init, render: render, refresh: refresh };
}(window));
