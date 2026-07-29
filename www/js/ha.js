/*
 * ha.js — publication du road trip vers Home Assistant.
 *
 * L'app reste autonome : HA est un miroir pour le dashboard, jamais la source.
 * Ce module ne fait qu'une chose : publier des capteurs lisibles
 * (sensor.roadtrip_*) pour suivre le voyage depuis un dashboard.
 *
 * La SAUVEGARDE n'est pas ici : autobackup.js (partagé par les 6 apps) s'en
 * charge, avec ses garde-fous contre l'écrasement d'une sauvegarde pleine par
 * une sauvegarde vide. Écrire dans la même entité depuis deux formats
 * différents aurait cassé la restauration.
 */
(function (global) {
  'use strict';

  /* Même clé que autobackup.js (BACKUP_APP + '.ha') : une seule connexion HA à
     saisir, partagée par les capteurs et par la sauvegarde. */
  var CFG = 'roadtrip.ha';
  var PREFIX = 'sensor.roadtrip_';

  function cfg() {
    try { return JSON.parse(localStorage.getItem(CFG) || '{}'); } catch (e) { return {}; }
  }

  function saveCfg(url, token) {
    localStorage.setItem(CFG, JSON.stringify({
      url: (url || '').trim().replace(/\/+$/, ''),
      token: (token || '').trim(),
    }));
  }

  function enabled() {
    var c = cfg();
    return !!(c.url && c.token);
  }

  function req(path, opt) {
    var c = cfg();
    if (!c.url || !c.token) return Promise.reject(new Error('Home Assistant non configuré'));
    opt = opt || {};
    return fetch(c.url + path, {
      method: opt.method || 'GET',
      headers: {
        Authorization: 'Bearer ' + c.token,
        'Content-Type': 'application/json',
      },
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.status === 204 ? null : r.json();
    });
  }

  function ping() {
    return req('/api/').then(function (j) { return j && j.message; });
  }

  function setState(id, state, attributes) {
    return req('/api/states/' + encodeURIComponent(id), {
      method: 'POST',
      body: { state: String(state), attributes: attributes || {} },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Capteurs                                                           */
  /* ------------------------------------------------------------------ */

  function publish(s) {
    if (!enabled()) return Promise.reject(new Error('Home Assistant non configuré'));
    var M = global.Model;
    var cur = M.etapeCourante(s);
    var reste = M.joursRestants(s);
    var prevu = M.totalPrevu(s);
    var reel = M.totalReel(s);

    /* L'état d'une entité HA est limité à 255 caractères : les listes partent
       donc en attributs, l'état ne porte qu'une valeur courte. */
    var jobs = [
      setState(PREFIX + 'etape', cur ? cur.etape.ville : (M.summary(s)), {
        friendly_name: 'Road trip — étape en cours',
        icon: 'mdi:map-marker-path',
        voyage: s.titre,
        numero: cur ? cur.index + 1 : null,
        total_etapes: s.etapes.length,
        pays: cur ? cur.etape.pays : null,
        logement: cur ? cur.etape.logement : null,
        resume: M.summary(s),
        itineraire: s.etapes.map(function (e, i) {
          return (i + 1) + '. ' + e.ville + ' (' + e.nuits + ' nuit' + (e.nuits > 1 ? 's' : '') + ')';
        }),
      }),

      setState(PREFIX + 'jours_restants', reste, {
        friendly_name: 'Road trip — jours restants',
        icon: 'mdi:calendar-clock',
        unit_of_measurement: 'j',
        depart: s.depart,
        retour: M.addDays(s.depart, M.totalJours(s) - 1),
        duree_totale: M.totalJours(s),
      }),

      setState(PREFIX + 'budget', Math.round(reel), {
        friendly_name: 'Road trip — dépensé',
        icon: 'mdi:cash-multiple',
        unit_of_measurement: '€',
        prevu: Math.round(prevu),
        /* Écart positif = on dépasse le prévisionnel. */
        ecart: Math.round(reel - prevu),
        par_poste: M.CATEGORIES.map(function (c) {
          var r = M.reelParPoste(s)[c.id];
          var p = M.prevuParPoste(s)[c.id];
          return c.icon + ' ' + c.label + ' : ' + Math.round(r) + ' / ' + Math.round(p) + ' €';
        }),
      }),

      setState(PREFIX + 'distance', Math.round(M.totalKm(s)), {
        friendly_name: 'Road trip — distance totale',
        icon: 'mdi:highway',
        unit_of_measurement: 'km',
        duree_route: M.formatDuree(M.totalMinutes(s)),
        carburant_estime: Math.round(M.carburantEstime(s)),
      }),

      setState(PREFIX + 'visites', visitesFaites(s), {
        friendly_name: 'Road trip — visites faites',
        icon: 'mdi:camera-marker',
        total: visitesTotal(s),
        a_faire: aFaire(s),
      }),
    ];
    return Promise.all(jobs);
  }

  function visitesTotal(s) {
    return s.etapes.reduce(function (a, e) { return a + e.visites.length; }, 0);
  }

  function visitesFaites(s) {
    return s.etapes.reduce(function (a, e) {
      return a + e.visites.filter(function (v) { return v.fait; }).length;
    }, 0);
  }

  function aFaire(s) {
    var out = [];
    s.etapes.forEach(function (e) {
      e.visites.forEach(function (v) {
        if (!v.fait) out.push(e.ville + ' — ' + v.nom);
      });
    });
    return out.slice(0, 40);
  }

  global.HA = {
    CFG: CFG,
    PREFIX: PREFIX,
    cfg: cfg,
    saveCfg: saveCfg,
    enabled: enabled,
    ping: ping,
    publish: publish,
  };
}(window));
