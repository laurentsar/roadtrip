/*
 * model.js — état du road trip et calculs dérivés.
 *
 * Un seul objet `trip` porte tout : étapes, dépenses, visites. Les totaux
 * (distance, budget, jours) ne sont JAMAIS stockés — ils se recalculent depuis
 * les étapes. Un total stocké finit toujours par diverger de ce qu'il résume.
 *
 * Pas de framework : l'app doit survivre à un téléphone sans réseau au fin fond
 * de l'Andalousie, donc tout est en JS natif et rien n'est chargé à distance.
 */
(function (global) {
  'use strict';

  var KEY = 'roadtrip.state';

  /* ------------------------------------------------------------------ */
  /* Postes de dépense                                                  */
  /* ------------------------------------------------------------------ */
  var CATEGORIES = [
    { id: 'carburant', label: 'Carburant', icon: '⛽' },
    { id: 'peage', label: 'Péages', icon: '🛣️' },
    { id: 'logement', label: 'Logement', icon: '🛏️' },
    { id: 'repas', label: 'Repas', icon: '🍽️' },
    { id: 'visite', label: 'Visites', icon: '🎟️' },
    { id: 'parking', label: 'Parking', icon: '🅿️' },
    { id: 'autre', label: 'Autre', icon: '🧾' },
  ];

  function category(id) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === id) return CATEGORIES[i];
    }
    return CATEGORIES[CATEGORIES.length - 1];
  }

  /* ------------------------------------------------------------------ */
  /* État                                                               */
  /* ------------------------------------------------------------------ */
  function blank() {
    return {
      titre: 'Road trip en Espagne',
      depart: todayISO(),
      /* Consommation et prix servent à estimer le carburant d'une étape.
         Valeurs par défaut plausibles pour une thermique ; tout est éditable. */
      vehicule: { conso: 6.5, prixCarburant: 1.75 },
      budgetPrevu: {},          /* { categorie: montant prévu } */
      etapes: [],
      depenses: [],
      version: 1,
    };
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function load() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') return blank();
    var s = blank();
    /* Fusion clé par clé : une version plus ancienne du format ne doit pas
       faire disparaître les champs ajoutés depuis. */
    Object.keys(s).forEach(function (k) {
      if (raw[k] !== undefined && raw[k] !== null) s[k] = raw[k];
    });
    s.etapes = (s.etapes || []).map(normalizeEtape);
    s.depenses = (s.depenses || []).map(normalizeDepense);
    return s;
  }

  function save(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
  }

  function normalizeEtape(e) {
    return {
      id: e.id || uid(),
      ville: e.ville || '',
      pays: e.pays || 'Espagne',
      lat: num(e.lat, null),
      lon: num(e.lon, null),
      nuits: Math.max(0, Math.round(num(e.nuits, 1))),
      /* Distance et durée depuis l'étape PRÉCÉDENTE : c'est le trajet qui mène
         ici, pas celui qui en part. La première étape a donc 0. */
      km: Math.max(0, num(e.km, 0)),
      minutes: Math.max(0, num(e.minutes, 0)),
      logement: e.logement || '',
      notes: e.notes || '',
      visites: (e.visites || []).map(function (v) {
        return {
          id: v.id || uid(),
          nom: v.nom || '',
          prix: Math.max(0, num(v.prix, 0)),
          horaires: v.horaires || '',
          notes: v.notes || '',
          fait: !!v.fait,
          lat: num(v.lat, null),
          lon: num(v.lon, null),
        };
      }),
    };
  }

  function normalizeDepense(d) {
    return {
      id: d.id || uid(),
      date: d.date || todayISO(),
      categorie: category(d.categorie).id,
      libelle: d.libelle || '',
      montant: num(d.montant, 0),
      etapeId: d.etapeId || null,
    };
  }

  function num(v, dflt) {
    var n = parseFloat(v);
    return isFinite(n) ? n : dflt;
  }

  /* ------------------------------------------------------------------ */
  /* Calculs sur l'itinéraire                                           */
  /* ------------------------------------------------------------------ */

  function totalKm(s) {
    return s.etapes.reduce(function (a, e) { return a + e.km; }, 0);
  }

  function totalMinutes(s) {
    return s.etapes.reduce(function (a, e) { return a + e.minutes; }, 0);
  }

  /* Durée du séjour = somme des nuits, + 1 jour (on part le jour J et on rentre
     le lendemain de la dernière nuit). Un trip sans nuit dure 1 jour. */
  function totalJours(s) {
    var nuits = s.etapes.reduce(function (a, e) { return a + e.nuits; }, 0);
    return nuits + 1;
  }

  /* Date d'arrivée à l'étape i : départ + nuits cumulées des étapes d'avant. */
  function dateArrivee(s, index) {
    var nuits = 0;
    for (var i = 0; i < index && i < s.etapes.length; i++) nuits += s.etapes[i].nuits;
    return addDays(s.depart, nuits);
  }

  function addDays(iso, days) {
    var p = String(iso || '').split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (isNaN(d.getTime())) return iso;
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function formatDate(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return iso || '';
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  /* Étape en cours à une date donnée. Renvoie null hors période : l'app doit
     pouvoir dire « pas encore parti » plutôt que d'inventer une étape. */
  function etapeCourante(s, iso) {
    var today = iso || todayISO();
    if (today < s.depart) return null;
    var cursor = s.depart;
    for (var i = 0; i < s.etapes.length; i++) {
      var fin = addDays(cursor, Math.max(1, s.etapes[i].nuits));
      if (today < fin) return { index: i, etape: s.etapes[i] };
      cursor = fin;
    }
    return null;
  }

  function joursRestants(s, iso) {
    var today = iso || todayISO();
    var fin = addDays(s.depart, totalJours(s) - 1);
    return Math.max(0, daysBetween(today, fin));
  }

  function daysBetween(a, b) {
    var pa = String(a).split('-'), pb = String(b).split('-');
    var da = new Date(Number(pa[0]), Number(pa[1]) - 1, Number(pa[2]));
    var db = new Date(Number(pb[0]), Number(pb[1]) - 1, Number(pb[2]));
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
    return Math.round((db - da) / 86400000);
  }

  /* ------------------------------------------------------------------ */
  /* Distances                                                          */
  /* ------------------------------------------------------------------ */

  /* Distance à vol d'oiseau (haversine), en km. Sert à PROPOSER un kilométrage
     quand les deux étapes ont des coordonnées : la route est toujours plus
     longue, d'où le facteur de sinuosité appliqué par estimateKm. */
  function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad;
    var dLon = (lon2 - lon1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /* 1.25 : rapport route/vol d'oiseau couramment observé sur autoroute en
     Europe de l'Ouest. C'est une ESTIMATION, l'utilisateur peut corriger le km
     à la main — et il le doit s'il veut un budget carburant juste. */
  var DETOUR = 1.25;

  function estimateKm(a, b) {
    if (!a || !b || a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
    return Math.round(haversine(a.lat, a.lon, b.lat, b.lon) * DETOUR);
  }

  /* Durée estimée à 95 km/h de moyenne : autoroute espagnole avec pauses. */
  function estimateMinutes(km) {
    if (km == null) return null;
    return Math.round(km / 95 * 60);
  }

  function formatDuree(minutes) {
    var m = Math.max(0, Math.round(minutes || 0));
    var h = Math.floor(m / 60);
    return h > 0 ? h + 'h' + pad(m % 60) : m + ' min';
  }

  /* ------------------------------------------------------------------ */
  /* Budget                                                             */
  /* ------------------------------------------------------------------ */

  /* Carburant estimé pour tout le trajet, d'après la conso et le prix saisis. */
  function carburantEstime(s) {
    var v = s.vehicule || {};
    var conso = num(v.conso, 0), prix = num(v.prixCarburant, 0);
    return totalKm(s) / 100 * conso * prix;
  }

  function visitesEstimees(s) {
    return s.etapes.reduce(function (a, e) {
      return a + e.visites.reduce(function (b, v) { return b + v.prix; }, 0);
    }, 0);
  }

  /* Prévu par poste : ce que l'utilisateur a saisi, sauf pour deux postes qui
     se déduisent de données déjà présentes (carburant depuis les km, visites
     depuis leurs prix). Une saisie manuelle reprend la main dessus. */
  function prevuParPoste(s) {
    var out = {};
    CATEGORIES.forEach(function (c) { out[c.id] = num(s.budgetPrevu[c.id], 0); });
    if (!s.budgetPrevu.carburant) out.carburant = carburantEstime(s);
    if (!s.budgetPrevu.visite) out.visite = visitesEstimees(s);
    return out;
  }

  function reelParPoste(s) {
    var out = {};
    CATEGORIES.forEach(function (c) { out[c.id] = 0; });
    s.depenses.forEach(function (d) { out[d.categorie] = (out[d.categorie] || 0) + d.montant; });
    return out;
  }

  function totalPrevu(s) {
    var p = prevuParPoste(s);
    return CATEGORIES.reduce(function (a, c) { return a + p[c.id]; }, 0);
  }

  function totalReel(s) {
    return s.depenses.reduce(function (a, d) { return a + d.montant; }, 0);
  }

  function formatEuro(n) {
    var v = isFinite(n) ? n : 0;
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
  }

  /* ------------------------------------------------------------------ */
  /* Résumé lisible, réutilisé par l'écran d'accueil et par Home Assistant */
  /* ------------------------------------------------------------------ */
  function summary(s) {
    var cur = etapeCourante(s);
    if (!s.etapes.length) return 'Aucune étape';
    if (!cur) {
      var fin = addDays(s.depart, totalJours(s) - 1);
      if (todayISO() < s.depart) {
        return 'Départ dans ' + daysBetween(todayISO(), s.depart) + ' j';
      }
      if (todayISO() > fin) return 'Voyage terminé';
      return s.etapes.length + ' étapes';
    }
    return 'Étape ' + (cur.index + 1) + '/' + s.etapes.length + ' — ' + cur.etape.ville;
  }

  global.Model = {
    KEY: KEY,
    CATEGORIES: CATEGORIES,
    category: category,
    blank: blank,
    load: load,
    save: save,
    uid: uid,
    todayISO: todayISO,
    addDays: addDays,
    daysBetween: daysBetween,
    formatDate: formatDate,
    normalizeEtape: normalizeEtape,
    normalizeDepense: normalizeDepense,
    totalKm: totalKm,
    totalMinutes: totalMinutes,
    totalJours: totalJours,
    dateArrivee: dateArrivee,
    etapeCourante: etapeCourante,
    joursRestants: joursRestants,
    haversine: haversine,
    estimateKm: estimateKm,
    estimateMinutes: estimateMinutes,
    formatDuree: formatDuree,
    carburantEstime: carburantEstime,
    visitesEstimees: visitesEstimees,
    prevuParPoste: prevuParPoste,
    reelParPoste: reelParPoste,
    totalPrevu: totalPrevu,
    totalReel: totalReel,
    formatEuro: formatEuro,
    summary: summary,
  };
}(window));
