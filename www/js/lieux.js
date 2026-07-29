/*
 * lieux.js — base de villes embarquée + recherche en ligne.
 *
 * Pourquoi embarquer une liste : l'app doit pouvoir poser une étape et la
 * placer sur la carte SANS réseau. Nominatim (OpenStreetMap) ne sert que de
 * complément, quand la ville cherchée n'est pas dans la liste.
 *
 * Couverture : Espagne (l'essentiel du tourisme routier), plus les villes
 * françaises et portugaises utiles à un aller-retour depuis le sud-ouest.
 * Coordonnées = centre-ville, arrondies à 4 décimales (~10 m, largement assez
 * pour un point d'étape).
 */
(function (global) {
  'use strict';

  var VILLES = [
    /* ---------------- Espagne — Catalogne / Aragon ---------------- */
    { v: 'Barcelone', p: 'Espagne', r: 'Catalogne', lat: 41.3874, lon: 2.1686 },
    { v: 'Gérone', p: 'Espagne', r: 'Catalogne', lat: 41.9794, lon: 2.8214 },
    { v: 'Figueres', p: 'Espagne', r: 'Catalogne', lat: 42.2662, lon: 2.9622 },
    { v: 'Cadaqués', p: 'Espagne', r: 'Catalogne', lat: 42.2887, lon: 3.2779 },
    { v: 'Tarragone', p: 'Espagne', r: 'Catalogne', lat: 41.1189, lon: 1.2445 },
    { v: 'Sitges', p: 'Espagne', r: 'Catalogne', lat: 41.2371, lon: 1.8054 },
    { v: 'Lleida', p: 'Espagne', r: 'Catalogne', lat: 41.6176, lon: 0.6200 },
    { v: 'Montserrat', p: 'Espagne', r: 'Catalogne', lat: 41.5934, lon: 1.8382 },
    { v: 'Saragosse', p: 'Espagne', r: 'Aragon', lat: 41.6488, lon: -0.8891 },
    { v: 'Teruel', p: 'Espagne', r: 'Aragon', lat: 40.3456, lon: -1.1065 },
    { v: 'Jaca', p: 'Espagne', r: 'Aragon', lat: 42.5709, lon: -0.5495 },
    { v: 'Aínsa', p: 'Espagne', r: 'Aragon', lat: 42.4189, lon: 0.1382 },

    /* ---------------- Espagne — Levante ---------------- */
    { v: 'Valence', p: 'Espagne', r: 'Communauté valencienne', lat: 39.4699, lon: -0.3763 },
    { v: 'Peñíscola', p: 'Espagne', r: 'Communauté valencienne', lat: 40.3583, lon: 0.4067 },
    { v: 'Alicante', p: 'Espagne', r: 'Communauté valencienne', lat: 38.3452, lon: -0.4810 },
    { v: 'Benidorm', p: 'Espagne', r: 'Communauté valencienne', lat: 38.5342, lon: -0.1314 },
    { v: 'Dénia', p: 'Espagne', r: 'Communauté valencienne', lat: 38.8408, lon: 0.1057 },
    { v: 'Xàtiva', p: 'Espagne', r: 'Communauté valencienne', lat: 38.9873, lon: -0.5181 },
    { v: 'Murcie', p: 'Espagne', r: 'Murcie', lat: 37.9922, lon: -1.1307 },
    { v: 'Carthagène', p: 'Espagne', r: 'Murcie', lat: 37.6257, lon: -0.9966 },

    /* ---------------- Espagne — Andalousie ---------------- */
    { v: 'Séville', p: 'Espagne', r: 'Andalousie', lat: 37.3891, lon: -5.9845 },
    { v: 'Grenade', p: 'Espagne', r: 'Andalousie', lat: 37.1773, lon: -3.5986 },
    { v: 'Cordoue', p: 'Espagne', r: 'Andalousie', lat: 37.8882, lon: -4.7794 },
    { v: 'Malaga', p: 'Espagne', r: 'Andalousie', lat: 36.7213, lon: -4.4214 },
    { v: 'Ronda', p: 'Espagne', r: 'Andalousie', lat: 36.7461, lon: -5.1611 },
    { v: 'Cadix', p: 'Espagne', r: 'Andalousie', lat: 36.5271, lon: -6.2886 },
    { v: 'Jerez de la Frontera', p: 'Espagne', r: 'Andalousie', lat: 36.6850, lon: -6.1261 },
    { v: 'Tarifa', p: 'Espagne', r: 'Andalousie', lat: 36.0143, lon: -5.6044 },
    { v: 'Nerja', p: 'Espagne', r: 'Andalousie', lat: 36.7452, lon: -3.8740 },
    { v: 'Almería', p: 'Espagne', r: 'Andalousie', lat: 36.8340, lon: -2.4637 },
    { v: 'Úbeda', p: 'Espagne', r: 'Andalousie', lat: 38.0138, lon: -3.3706 },
    { v: 'Jaén', p: 'Espagne', r: 'Andalousie', lat: 37.7796, lon: -3.7849 },
    { v: 'Cabo de Gata', p: 'Espagne', r: 'Andalousie', lat: 36.7333, lon: -2.1917 },
    { v: 'Setenil de las Bodegas', p: 'Espagne', r: 'Andalousie', lat: 36.8639, lon: -5.1806 },

    /* ---------------- Espagne — Centre ---------------- */
    { v: 'Madrid', p: 'Espagne', r: 'Madrid', lat: 40.4168, lon: -3.7038 },
    { v: 'Tolède', p: 'Espagne', r: 'Castille-La Manche', lat: 39.8628, lon: -4.0273 },
    { v: 'Cuenca', p: 'Espagne', r: 'Castille-La Manche', lat: 40.0704, lon: -2.1374 },
    { v: 'Ségovie', p: 'Espagne', r: 'Castille-et-León', lat: 40.9429, lon: -4.1088 },
    { v: 'Ávila', p: 'Espagne', r: 'Castille-et-León', lat: 40.6565, lon: -4.6818 },
    { v: 'Salamanque', p: 'Espagne', r: 'Castille-et-León', lat: 40.9701, lon: -5.6635 },
    { v: 'Burgos', p: 'Espagne', r: 'Castille-et-León', lat: 42.3439, lon: -3.6969 },
    { v: 'León', p: 'Espagne', r: 'Castille-et-León', lat: 42.5987, lon: -5.5671 },
    { v: 'Valladolid', p: 'Espagne', r: 'Castille-et-León', lat: 41.6523, lon: -4.7245 },

    /* ---------------- Espagne — Nord ---------------- */
    { v: 'Saint-Sébastien', p: 'Espagne', r: 'Pays basque', lat: 43.3183, lon: -1.9812 },
    { v: 'Bilbao', p: 'Espagne', r: 'Pays basque', lat: 43.2630, lon: -2.9350 },
    { v: 'Vitoria-Gasteiz', p: 'Espagne', r: 'Pays basque', lat: 42.8467, lon: -2.6716 },
    { v: 'Pampelune', p: 'Espagne', r: 'Navarre', lat: 42.8125, lon: -1.6458 },
    { v: 'Logroño', p: 'Espagne', r: 'La Rioja', lat: 42.4650, lon: -2.4456 },
    { v: 'Santander', p: 'Espagne', r: 'Cantabrie', lat: 43.4623, lon: -3.8100 },
    { v: 'Santillana del Mar', p: 'Espagne', r: 'Cantabrie', lat: 43.3925, lon: -4.1080 },
    { v: 'Oviedo', p: 'Espagne', r: 'Asturies', lat: 43.3619, lon: -5.8494 },
    { v: 'Gijón', p: 'Espagne', r: 'Asturies', lat: 43.5322, lon: -5.6611 },
    { v: 'Picos de Europa', p: 'Espagne', r: 'Asturies', lat: 43.1975, lon: -4.8514 },
    { v: 'Saint-Jacques-de-Compostelle', p: 'Espagne', r: 'Galice', lat: 42.8805, lon: -8.5457 },
    { v: 'La Corogne', p: 'Espagne', r: 'Galice', lat: 43.3623, lon: -8.4115 },
    { v: 'Vigo', p: 'Espagne', r: 'Galice', lat: 42.2406, lon: -8.7207 },

    /* ---------------- Espagne — Îles ---------------- */
    { v: 'Palma de Majorque', p: 'Espagne', r: 'Baléares', lat: 39.5696, lon: 2.6502 },
    { v: 'Ibiza', p: 'Espagne', r: 'Baléares', lat: 38.9089, lon: 1.4328 },

    /* ---------------- Portugal (extension naturelle) ---------------- */
    { v: 'Lisbonne', p: 'Portugal', r: 'Lisbonne', lat: 38.7223, lon: -9.1393 },
    { v: 'Porto', p: 'Portugal', r: 'Nord', lat: 41.1579, lon: -8.6291 },
    { v: 'Faro', p: 'Portugal', r: 'Algarve', lat: 37.0194, lon: -7.9304 },
    { v: 'Lagos', p: 'Portugal', r: 'Algarve', lat: 37.1028, lon: -8.6733 },
    { v: 'Évora', p: 'Portugal', r: 'Alentejo', lat: 38.5714, lon: -7.9135 },

    /* ---------------- France — trajet et retour ---------------- */
    { v: 'Toulouse', p: 'France', r: 'Occitanie', lat: 43.6047, lon: 1.4442 },
    { v: 'Perpignan', p: 'France', r: 'Occitanie', lat: 42.6887, lon: 2.8948 },
    { v: 'Narbonne', p: 'France', r: 'Occitanie', lat: 43.1840, lon: 3.0035 },
    { v: 'Montpellier', p: 'France', r: 'Occitanie', lat: 43.6108, lon: 3.8767 },
    { v: 'Carcassonne', p: 'France', r: 'Occitanie', lat: 43.2130, lon: 2.3491 },
    { v: 'Bordeaux', p: 'France', r: 'Nouvelle-Aquitaine', lat: 44.8378, lon: -0.5792 },
    { v: 'Biarritz', p: 'France', r: 'Nouvelle-Aquitaine', lat: 43.4832, lon: -1.5586 },
    { v: 'Bayonne', p: 'France', r: 'Nouvelle-Aquitaine', lat: 43.4929, lon: -1.4748 },
    { v: 'Pau', p: 'France', r: 'Nouvelle-Aquitaine', lat: 43.2951, lon: -0.3708 },
    { v: 'Lourdes', p: 'France', r: 'Occitanie', lat: 43.0954, lon: -0.0458 },
    { v: 'Marseille', p: 'France', r: "Provence-Alpes-Côte d'Azur", lat: 43.2965, lon: 5.3698 },
    { v: 'Nice', p: 'France', r: "Provence-Alpes-Côte d'Azur", lat: 43.7102, lon: 7.2620 },
    { v: 'Lyon', p: 'France', r: 'Auvergne-Rhône-Alpes', lat: 45.7640, lon: 4.8357 },
    { v: 'Paris', p: 'France', r: 'Île-de-France', lat: 48.8566, lon: 2.3522 },
  ];

  /* Visites suggérées, proposées quand on crée une étape sur une de ces villes.
     Volontairement courtes : c'est une amorce, pas un guide touristique. Les
     prix sont indicatifs (tarif plein adulte constaté) et éditables. */
  var SUGGESTIONS = {
    'Barcelone': [
      { nom: 'Sagrada Família', prix: 26 },
      { nom: 'Parc Güell', prix: 10 },
      { nom: 'Casa Batlló', prix: 29 },
      { nom: 'Quartier gothique', prix: 0 },
    ],
    'Grenade': [
      { nom: 'Alhambra et Generalife', prix: 19, notes: 'Billet à réserver des semaines à l\'avance' },
      { nom: 'Quartier de l\'Albaicín', prix: 0 },
      { nom: 'Mirador San Nicolás', prix: 0 },
    ],
    'Séville': [
      { nom: 'Alcázar', prix: 15 },
      { nom: 'Cathédrale et Giralda', prix: 12 },
      { nom: 'Plaza de España', prix: 0 },
      { nom: 'Quartier de Triana', prix: 0 },
    ],
    'Cordoue': [
      { nom: 'Mosquée-cathédrale', prix: 13 },
      { nom: 'Patios de Cordoue', prix: 0 },
      { nom: 'Alcázar des rois chrétiens', prix: 5 },
    ],
    'Madrid': [
      { nom: 'Musée du Prado', prix: 15 },
      { nom: 'Palais royal', prix: 14 },
      { nom: 'Parc du Retiro', prix: 0 },
      { nom: 'Marché San Miguel', prix: 0 },
    ],
    'Valence': [
      { nom: 'Cité des arts et des sciences', prix: 38 },
      { nom: 'Marché central', prix: 0 },
      { nom: 'Plage de la Malvarrosa', prix: 0 },
    ],
    'Tolède': [
      { nom: 'Cathédrale', prix: 12 },
      { nom: 'Alcázar', prix: 5 },
      { nom: 'Vue depuis le Mirador del Valle', prix: 0 },
    ],
    'Ségovie': [
      { nom: 'Aqueduc romain', prix: 0 },
      { nom: 'Alcázar', prix: 9 },
    ],
    'Bilbao': [
      { nom: 'Musée Guggenheim', prix: 16 },
      { nom: 'Casco Viejo', prix: 0 },
    ],
    'Saint-Sébastien': [
      { nom: 'Plage de la Concha', prix: 0 },
      { nom: 'Mont Igueldo', prix: 4 },
      { nom: 'Tournée de pintxos', prix: 25 },
    ],
    'Ronda': [
      { nom: 'Puente Nuevo', prix: 0 },
      { nom: 'Arènes', prix: 9 },
    ],
    'Malaga': [
      { nom: 'Alcazaba', prix: 4 },
      { nom: 'Musée Picasso', prix: 12 },
    ],
    'Saragosse': [
      { nom: 'Basilique du Pilar', prix: 0 },
      { nom: 'Palais de l\'Aljafería', prix: 5 },
    ],
    'Saint-Jacques-de-Compostelle': [
      { nom: 'Cathédrale', prix: 0 },
      { nom: 'Musée des pèlerinages', prix: 2.4 },
    ],
  };

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /* Recherche locale : sous-chaîne sur le nom sans accent, pour que « penis »
     trouve « Peñíscola » et « segovie » trouve « Ségovie ». */
  function search(q, limit) {
    var n = normalize(q);
    if (!n) return [];
    var out = [];
    for (var i = 0; i < VILLES.length && out.length < (limit || 8); i++) {
      if (normalize(VILLES[i].v).indexOf(n) === 0) out.push(VILLES[i]);
    }
    for (var j = 0; j < VILLES.length && out.length < (limit || 8); j++) {
      if (out.indexOf(VILLES[j]) === -1 && normalize(VILLES[j].v).indexOf(n) > 0) out.push(VILLES[j]);
    }
    return out;
  }

  function byName(name) {
    var n = normalize(name);
    for (var i = 0; i < VILLES.length; i++) {
      if (normalize(VILLES[i].v) === n) return VILLES[i];
    }
    return null;
  }

  function suggestions(ville) {
    var s = SUGGESTIONS[ville];
    if (s) return s;
    /* Recherche insensible aux accents, pour une ville saisie à la main. */
    var n = normalize(ville);
    var keys = Object.keys(SUGGESTIONS);
    for (var i = 0; i < keys.length; i++) {
      if (normalize(keys[i]) === n) return SUGGESTIONS[keys[i]];
    }
    return [];
  }

  /* Recherche en ligne, pour tout ce qui n'est pas dans la liste embarquée.
     Nominatim impose une utilisation raisonnable : une requête à la validation,
     jamais à la frappe. L'appel échoue silencieusement hors réseau — la liste
     locale a déjà répondu. */
  function searchOnline(q) {
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=fr&q=' +
      encodeURIComponent(q);
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        return (list || []).map(function (it) {
          var nom = String(it.display_name || '').split(',');
          return {
            v: nom[0].trim(),
            p: nom[nom.length - 1].trim(),
            r: (nom[1] || '').trim(),
            lat: parseFloat(it.lat),
            lon: parseFloat(it.lon),
            online: true,
          };
        });
      })
      .catch(function () { return []; });
  }

  global.Lieux = {
    VILLES: VILLES,
    search: search,
    searchOnline: searchOnline,
    byName: byName,
    suggestions: suggestions,
    normalize: normalize,
  };
}(window));
