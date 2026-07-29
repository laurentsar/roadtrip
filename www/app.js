/*
 * app.js — interface Road Trip.
 *
 * Un seul état `S` (voir model.js), rendu complet à chaque changement. Le
 * volume tient largement (quelques dizaines d'étapes et de dépenses) et un
 * rendu complet évite toute la classe de bugs où l'écran ne reflète plus les
 * données.
 */
(function () {
  'use strict';

  var M = window.Model;
  var S = M.load();
  var villeChoisie = null;   /* ville retenue dans les suggestions */

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function persist() {
    /* autobackup.js intercepte localStorage.setItem : la sauvegarde distante se
       programme toute seule, rien à appeler ici. */
    M.save(S);
    scheduleHaPublish();
    render();
  }

  /* Publication HA regroupée : éditer une étape déclenche plusieurs
     enregistrements d'affilée, on ne veut pas autant d'appels réseau. */
  var haTimer = null;
  function scheduleHaPublish() {
    if (!window.HA || !HA.enabled()) return;
    clearTimeout(haTimer);
    haTimer = setTimeout(function () {
      HA.publish(S).then(function () { setHaDot('ok'); }, function () { setHaDot('err'); });
    }, 4000);
  }

  function setHaDot(kind) {
    var d = $('haDot');
    if (!d) return;
    d.className = 'ha-dot' + (kind ? ' ' + kind : '');
    d.title = kind === 'ok' ? 'Home Assistant : à jour'
      : kind === 'err' ? 'Home Assistant : erreur'
        : 'Home Assistant : non configuré';
  }

  /* ------------------------------------------------------------------ */
  /* Onglets                                                            */
  /* ------------------------------------------------------------------ */
  function initTabs() {
    var tabs = document.querySelectorAll('.tab');
    Array.prototype.forEach.call(tabs, function (t) {
      t.addEventListener('click', function () {
        Array.prototype.forEach.call(tabs, function (o) { o.classList.remove('active'); });
        t.classList.add('active');
        var name = t.getAttribute('data-tab');
        Array.prototype.forEach.call(document.querySelectorAll('.tab-panel'), function (p) {
          p.classList.toggle('active', p.id === 'tab-' + name);
        });
        if (name === 'map') {
          Carte.init('map');
          Carte.refresh();
          Carte.render(S);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Recherche de ville                                                 */
  /* ------------------------------------------------------------------ */
  function initVilleSearch() {
    var input = $('villeInput');
    var box = $('villeSuggest');
    var online = null;   /* résultats Nominatim, fusionnés à la liste locale */

    function draw() {
      var q = input.value.trim();
      villeChoisie = null;
      if (!q) { box.innerHTML = ''; return; }
      var locales = Lieux.search(q, 8);
      var items = locales.concat(online || []);
      if (!items.length) {
        box.innerHTML = '<div class="suggest-empty">Aucune ville — appuie sur Entrée pour ' +
          'chercher en ligne</div>';
        return;
      }
      box.innerHTML = items.map(function (v, i) {
        return '<button type="button" class="suggest-item" data-i="' + i + '">' +
          '<b>' + esc(v.v) + '</b><span>' + esc(v.r || '') +
          (v.r ? ' · ' : '') + esc(v.p) + (v.online ? ' 🌐' : '') + '</span></button>';
      }).join('');
      Array.prototype.forEach.call(box.querySelectorAll('.suggest-item'), function (b) {
        b.addEventListener('click', function () {
          var v = items[Number(b.getAttribute('data-i'))];
          villeChoisie = v;
          input.value = v.v;
          box.innerHTML = '';
          $('villeHint').textContent = v.v + ' — ' + (v.r ? v.r + ', ' : '') + v.p;
        });
      });
    }

    input.addEventListener('input', function () { online = null; draw(); });

    /* Une seule requête Nominatim, à la validation : l'appeler à chaque frappe
       violerait leur politique d'usage et serait inutilisable en roaming. */
    input.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      $('villeHint').textContent = 'Recherche en ligne…';
      Lieux.searchOnline(q).then(function (list) {
        online = list;
        $('villeHint').textContent = list.length
          ? list.length + ' résultat(s) en ligne'
          : 'Aucun résultat en ligne (réseau ?)';
        draw();
      });
    });

    $('addEtape').addEventListener('click', addEtape);
  }

  function addEtape() {
    var input = $('villeInput');
    var nom = input.value.trim();
    if (!nom) { $('villeHint').textContent = 'Saisis une ville.'; return; }

    var v = villeChoisie || Lieux.byName(nom);
    var etape = M.normalizeEtape({
      ville: v ? v.v : nom,
      pays: v ? v.p : 'Espagne',
      lat: v ? v.lat : null,
      lon: v ? v.lon : null,
      nuits: parseInt($('nuitsInput').value, 10),
    });

    /* Distance et durée depuis l'étape précédente, proposées d'office quand
       les deux points sont connus. L'utilisateur peut corriger ensuite. */
    var prev = S.etapes[S.etapes.length - 1];
    var km = M.estimateKm(prev, etape);
    if (km != null) {
      etape.km = km;
      etape.minutes = M.estimateMinutes(km);
    }

    /* Visites suggérées : une amorce, toutes décochées et supprimables. */
    Lieux.suggestions(etape.ville).forEach(function (sug) {
      etape.visites.push({
        id: M.uid(), nom: sug.nom, prix: sug.prix || 0,
        horaires: '', notes: sug.notes || '', fait: false, lat: null, lon: null,
      });
    });

    S.etapes.push(etape);
    input.value = '';
    villeChoisie = null;
    $('villeSuggest').innerHTML = '';
    $('villeHint').textContent = 'Étape ajoutée : ' + etape.ville;
    persist();
  }

  /* ------------------------------------------------------------------ */
  /* Rendu — itinéraire                                                 */
  /* ------------------------------------------------------------------ */
  function renderStats() {
    var cur = M.etapeCourante(S);
    var cards = [
      { k: 'Étapes', v: S.etapes.length },
      { k: 'Distance', v: Math.round(M.totalKm(S)) + ' km' },
      { k: 'Route', v: M.formatDuree(M.totalMinutes(S)) },
      { k: 'Durée', v: M.totalJours(S) + ' j' },
    ];
    $('statsRow').innerHTML = cards.map(function (c) {
      return '<div class="stat"><span class="stat-v">' + esc(c.v) + '</span>' +
        '<span class="stat-k">' + esc(c.k) + '</span></div>';
    }).join('');

    $('tripTitre').innerHTML = esc(S.titre) + ' <span id="verChip" class="ver-chip"></span>';
    $('tripSub').textContent = M.summary(S) +
      (cur ? ' · ' + M.joursRestants(S) + ' j restants' : '');
    stampVersion();
  }

  function renderEtapes() {
    var host = $('etapesList');
    if (!S.etapes.length) {
      host.innerHTML = '<p class="empty">Aucune étape. Ajoute ta première ville ci-dessus.</p>';
      return;
    }
    var cur = M.etapeCourante(S);
    host.innerHTML = S.etapes.map(function (e, i) {
      var etat = !cur ? '' : i < cur.index ? 'past' : i === cur.index ? 'now' : '';
      var reste = e.visites.filter(function (v) { return !v.fait; }).length;
      return '' +
        '<article class="card etape ' + etat + '" data-i="' + i + '">' +
          '<div class="etape-head">' +
            '<span class="etape-num">' + (i + 1) + '</span>' +
            '<div class="etape-id">' +
              '<h3>' + esc(e.ville) + '</h3>' +
              '<p class="sub">' + esc(M.formatDate(M.dateArrivee(S, i))) + ' · ' +
                e.nuits + ' nuit' + (e.nuits > 1 ? 's' : '') + ' · ' + esc(e.pays) + '</p>' +
            '</div>' +
            '<div class="etape-move">' +
              '<button class="icon-btn" data-act="up" title="Monter">▲</button>' +
              '<button class="icon-btn" data-act="down" title="Descendre">▼</button>' +
            '</div>' +
          '</div>' +
          (i > 0
            ? '<p class="etape-leg">🚗 ' + Math.round(e.km) + ' km · ' + M.formatDuree(e.minutes) +
              ' depuis ' + esc(S.etapes[i - 1].ville) + '</p>'
            : '<p class="etape-leg">🏁 Point de départ</p>') +
          (e.logement ? '<p class="etape-leg">🛏️ ' + esc(e.logement) + '</p>' : '') +
          (e.visites.length
            ? '<p class="etape-leg">🎟️ ' + e.visites.length + ' visite(s), ' + reste + ' à faire</p>'
            : '') +
          '<div class="row wrap etape-actions">' +
            '<button class="btn small" data-act="edit">Modifier</button>' +
            (e.lat != null
              ? '<button class="btn small" data-act="go">🧭 Y aller</button>'
              : '') +
            '<button class="btn small danger" data-act="del">Supprimer</button>' +
          '</div>' +
        '</article>';
    }).join('');

    Array.prototype.forEach.call(host.querySelectorAll('.etape'), function (el) {
      var i = Number(el.getAttribute('data-i'));
      Array.prototype.forEach.call(el.querySelectorAll('[data-act]'), function (b) {
        b.addEventListener('click', function () { etapeAction(b.getAttribute('data-act'), i); });
      });
    });
  }

  function etapeAction(act, i) {
    var e = S.etapes[i];
    if (!e) return;
    if (act === 'del') {
      if (!confirm('Supprimer l\'étape ' + e.ville + ' ?')) return;
      S.etapes.splice(i, 1);
      recomputeLegs();
      persist();
    } else if (act === 'up' && i > 0) {
      S.etapes.splice(i - 1, 0, S.etapes.splice(i, 1)[0]);
      recomputeLegs();
      persist();
    } else if (act === 'down' && i < S.etapes.length - 1) {
      S.etapes.splice(i + 1, 0, S.etapes.splice(i, 1)[0]);
      recomputeLegs();
      persist();
    } else if (act === 'go') {
      /* geo: est compris par Maps, Waze et OsmAnd. Le paramètre q= garde le
         nom lisible dans l'app de destination. */
      window.open('geo:' + e.lat + ',' + e.lon + '?q=' + e.lat + ',' + e.lon +
        '(' + encodeURIComponent(e.ville) + ')', '_system');
    } else if (act === 'edit') {
      openEtape(i);
    }
  }

  /* Après un déplacement ou une suppression, les distances « depuis l'étape
     précédente » ne veulent plus rien dire : on les recalcule là où on peut.
     Un kilométrage saisi à la main sur une étape non concernée est conservé. */
  function recomputeLegs() {
    S.etapes.forEach(function (e, i) {
      if (i === 0) { e.km = 0; e.minutes = 0; return; }
      var km = M.estimateKm(S.etapes[i - 1], e);
      if (km != null) { e.km = km; e.minutes = M.estimateMinutes(km); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Modale d'étape                                                     */
  /* ------------------------------------------------------------------ */
  function openEtape(i) {
    var e = S.etapes[i];
    $('modalTitre').textContent = 'Étape ' + (i + 1) + ' — ' + e.ville;
    $('modalBody').innerHTML = '' +
      '<label class="stack">Ville<input id="mVille" type="text" value="' + esc(e.ville) + '" /></label>' +
      '<div class="row">' +
        '<label class="grow">Nuits<input id="mNuits" type="number" min="0" value="' + e.nuits + '" /></label>' +
        '<label class="grow">Km<input id="mKm" type="number" min="0" value="' + Math.round(e.km) + '" /></label>' +
        '<label class="grow">Minutes<input id="mMin" type="number" min="0" value="' + Math.round(e.minutes) + '" /></label>' +
      '</div>' +
      '<label class="stack">Logement<input id="mLog" type="text" value="' + esc(e.logement) + '" placeholder="Hôtel, adresse, réservation…" /></label>' +
      '<label class="stack">Notes<textarea id="mNotes" rows="3">' + esc(e.notes) + '</textarea></label>' +
      '<h3>Visites</h3>' +
      '<div id="mVisites"></div>' +
      '<div class="row"><input id="mNewVisite" type="text" placeholder="Ajouter une visite" />' +
        '<input id="mNewPrix" type="number" min="0" step="0.5" placeholder="€" class="short" />' +
        '<button id="mAddVisite" class="btn primary">+</button></div>';

    drawVisites(i);

    function commit() {
      e.ville = $('mVille').value.trim() || e.ville;
      e.nuits = Math.max(0, parseInt($('mNuits').value, 10) || 0);
      e.km = Math.max(0, parseFloat($('mKm').value) || 0);
      e.minutes = Math.max(0, parseInt($('mMin').value, 10) || 0);
      e.logement = $('mLog').value.trim();
      e.notes = $('mNotes').value;
    }
    ['mVille', 'mNuits', 'mKm', 'mMin', 'mLog', 'mNotes'].forEach(function (id) {
      $(id).addEventListener('change', function () { commit(); persist(); });
    });

    $('mAddVisite').addEventListener('click', function () {
      var nom = $('mNewVisite').value.trim();
      if (!nom) return;
      e.visites.push({
        id: M.uid(), nom: nom, prix: parseFloat($('mNewPrix').value) || 0,
        horaires: '', notes: '', fait: false, lat: null, lon: null,
      });
      $('mNewVisite').value = '';
      $('mNewPrix').value = '';
      drawVisites(i);
      persist();
    });

    $('modal').hidden = false;
  }

  function drawVisites(i) {
    var e = S.etapes[i];
    var host = $('mVisites');
    if (!host) return;
    if (!e.visites.length) {
      host.innerHTML = '<p class="hint">Aucune visite.</p>';
      return;
    }
    host.innerHTML = e.visites.map(function (v, j) {
      return '<div class="visite-row" data-j="' + j + '">' +
        '<label class="chk"><input type="checkbox" ' + (v.fait ? 'checked' : '') + ' /></label>' +
        '<input class="v-nom" type="text" value="' + esc(v.nom) + '" />' +
        '<input class="v-prix short" type="number" min="0" step="0.5" value="' + v.prix + '" />' +
        '<button class="icon-btn danger" data-del="1">✕</button>' +
        '</div>';
    }).join('');

    Array.prototype.forEach.call(host.querySelectorAll('.visite-row'), function (row) {
      var j = Number(row.getAttribute('data-j'));
      row.querySelector('input[type=checkbox]').addEventListener('change', function () {
        e.visites[j].fait = this.checked;
        persist();
      });
      row.querySelector('.v-nom').addEventListener('change', function () {
        e.visites[j].nom = this.value.trim();
        persist();
      });
      row.querySelector('.v-prix').addEventListener('change', function () {
        e.visites[j].prix = Math.max(0, parseFloat(this.value) || 0);
        persist();
      });
      row.querySelector('[data-del]').addEventListener('click', function () {
        e.visites.splice(j, 1);
        drawVisites(i);
        persist();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Budget                                                             */
  /* ------------------------------------------------------------------ */
  function renderBudget() {
    var prevu = M.totalPrevu(S), reel = M.totalReel(S);
    var ecart = reel - prevu;
    $('budgetStats').innerHTML = '' +
      stat(M.formatEuro(prevu), 'Prévu') +
      stat(M.formatEuro(reel), 'Dépensé') +
      stat((ecart > 0 ? '+' : '') + M.formatEuro(ecart), 'Écart', ecart > 0 ? 'bad' : 'good');

    var p = M.prevuParPoste(S), r = M.reelParPoste(S);
    $('budgetPrevu').innerHTML = M.CATEGORIES.map(function (c) {
      var pct = p[c.id] > 0 ? Math.min(100, Math.round(r[c.id] / p[c.id] * 100)) : 0;
      return '<div class="budget-line">' +
        '<span class="bl-cat">' + c.icon + ' ' + esc(c.label) + '</span>' +
        '<input type="number" min="0" step="10" data-cat="' + c.id + '" ' +
          'value="' + (S.budgetPrevu[c.id] != null ? S.budgetPrevu[c.id] : '') + '" ' +
          'placeholder="' + Math.round(p[c.id]) + '" />' +
        '<span class="bl-reel">' + M.formatEuro(r[c.id]) + '</span>' +
        '<span class="bar"><i style="width:' + pct + '%" class="' +
          (r[c.id] > p[c.id] ? 'over' : '') + '"></i></span>' +
        '</div>';
    }).join('');

    Array.prototype.forEach.call($('budgetPrevu').querySelectorAll('input[data-cat]'), function (inp) {
      inp.addEventListener('change', function () {
        var cat = inp.getAttribute('data-cat');
        var v = parseFloat(inp.value);
        if (isFinite(v) && v >= 0) S.budgetPrevu[cat] = v;
        else delete S.budgetPrevu[cat];   /* vide = on retourne à l'estimation */
        persist();
      });
    });

    renderDepenses();
  }

  function stat(v, k, cls) {
    return '<div class="stat"><span class="stat-v ' + (cls || '') + '">' + esc(v) + '</span>' +
      '<span class="stat-k">' + esc(k) + '</span></div>';
  }

  function renderDepenses() {
    var host = $('depensesList');
    if (!S.depenses.length) {
      host.innerHTML = '<p class="empty">Aucune dépense enregistrée.</p>';
      return;
    }
    var list = S.depenses.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
    host.innerHTML = list.map(function (d) {
      var c = M.category(d.categorie);
      var e = etapeById(d.etapeId);
      return '<div class="card dep" data-id="' + d.id + '">' +
        '<span class="dep-ico">' + c.icon + '</span>' +
        '<div class="dep-main"><b>' + esc(d.libelle || c.label) + '</b>' +
          '<span class="sub">' + esc(M.formatDate(d.date)) +
          (e ? ' · ' + esc(e.ville) : '') + '</span></div>' +
        '<span class="dep-amount">' + M.formatEuro(d.montant) + '</span>' +
        '<button class="icon-btn danger" data-del="1">✕</button>' +
        '</div>';
    }).join('');

    Array.prototype.forEach.call(host.querySelectorAll('.dep'), function (el) {
      el.querySelector('[data-del]').addEventListener('click', function () {
        var id = el.getAttribute('data-id');
        S.depenses = S.depenses.filter(function (d) { return d.id !== id; });
        persist();
      });
    });
  }

  function etapeById(id) {
    for (var i = 0; i < S.etapes.length; i++) if (S.etapes[i].id === id) return S.etapes[i];
    return null;
  }

  function initBudgetForm() {
    $('depCat').innerHTML = M.CATEGORIES.map(function (c) {
      return '<option value="' + c.id + '">' + c.icon + ' ' + esc(c.label) + '</option>';
    }).join('');
    $('depDate').value = M.todayISO();

    $('addDepense').addEventListener('click', function () {
      var montant = parseFloat($('depMontant').value);
      if (!isFinite(montant) || montant <= 0) return;
      S.depenses.push(M.normalizeDepense({
        date: $('depDate').value || M.todayISO(),
        categorie: $('depCat').value,
        libelle: $('depLibelle').value.trim(),
        montant: montant,
        etapeId: $('depEtape').value || null,
      }));
      $('depMontant').value = '';
      $('depLibelle').value = '';
      persist();
    });
  }

  function refreshEtapeSelect() {
    var cur = M.etapeCourante(S);
    var sel = $('depEtape');
    var keep = sel.value;
    sel.innerHTML = '<option value="">—</option>' + S.etapes.map(function (e, i) {
      return '<option value="' + e.id + '">' + (i + 1) + '. ' + esc(e.ville) + '</option>';
    }).join('');
    /* Pré-sélectionne l'étape du jour : c'est presque toujours celle qu'on veut
       quand on saisit une dépense sur la route. */
    sel.value = keep || (cur ? cur.etape.id : '');
  }

  /* ------------------------------------------------------------------ */
  /* Visites                                                            */
  /* ------------------------------------------------------------------ */
  function renderVisites() {
    var total = 0, faites = 0, cout = 0;
    S.etapes.forEach(function (e) {
      e.visites.forEach(function (v) {
        total++; cout += v.prix;
        if (v.fait) faites++;
      });
    });
    $('visitesStats').innerHTML =
      stat(faites + '/' + total, 'Faites') + stat(M.formatEuro(cout), 'Coût prévu');

    var host = $('visitesList');
    if (!total) {
      host.innerHTML = '<p class="empty">Aucune visite. Ouvre une étape pour en ajouter.</p>';
      return;
    }
    host.innerHTML = S.etapes.map(function (e, i) {
      if (!e.visites.length) return '';
      return '<div class="card"><h3>' + (i + 1) + '. ' + esc(e.ville) + '</h3>' +
        e.visites.map(function (v, j) {
          return '<label class="visite-item" data-i="' + i + '" data-j="' + j + '">' +
            '<input type="checkbox" ' + (v.fait ? 'checked' : '') + ' />' +
            '<span class="' + (v.fait ? 'done' : '') + '">' + esc(v.nom) + '</span>' +
            '<span class="v-price">' + (v.prix ? M.formatEuro(v.prix) : 'gratuit') + '</span>' +
            '</label>';
        }).join('') + '</div>';
    }).join('');

    Array.prototype.forEach.call(host.querySelectorAll('.visite-item'), function (el) {
      el.querySelector('input').addEventListener('change', function () {
        S.etapes[Number(el.getAttribute('data-i'))]
          .visites[Number(el.getAttribute('data-j'))].fait = this.checked;
        persist();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Réglages                                                           */
  /* ------------------------------------------------------------------ */
  function initReglages() {
    $('setTitre').value = S.titre;
    $('setDepart').value = S.depart;
    $('setConso').value = S.vehicule.conso;
    $('setPrix').value = S.vehicule.prixCarburant;

    $('setTitre').addEventListener('change', function () { S.titre = this.value.trim() || S.titre; persist(); });
    $('setDepart').addEventListener('change', function () { S.depart = this.value || S.depart; persist(); });
    $('setConso').addEventListener('change', function () {
      S.vehicule.conso = Math.max(0, parseFloat(this.value) || 0); persist();
    });
    $('setPrix').addEventListener('change', function () {
      S.vehicule.prixCarburant = Math.max(0, parseFloat(this.value) || 0); persist();
    });

    /* --- Home Assistant --- */
    $('haUrl').value = HA.cfg().url || '';
    $('haToken').value = HA.cfg().token || '';
    $('haUrl').addEventListener('change', function () { HA.saveCfg(this.value, $('haToken').value); });
    $('haToken').addEventListener('change', function () { HA.saveCfg($('haUrl').value, this.value); });

    $('haTest').addEventListener('click', function () {
      HA.saveCfg($('haUrl').value, $('haToken').value);
      $('haMsg').textContent = 'Test…';
      HA.ping().then(function (m) {
        $('haMsg').textContent = 'Connecté : ' + m;
        setHaDot('ok');
      }, function (e) {
        $('haMsg').textContent = 'Échec : ' + e.message;
        setHaDot('err');
      });
    });

    $('haPublish').addEventListener('click', function () {
      $('haMsg').textContent = 'Publication…';
      HA.publish(S).then(function () {
        $('haMsg').textContent = 'Capteurs publiés.';
        setHaDot('ok');
      }, function (e) {
        $('haMsg').textContent = 'Échec : ' + e.message;
        setHaDot('err');
      });
    });

    /* Export/import et sauvegarde automatique : panneau du module partagé.
       Il sauvegarde tout le localStorage, pas seulement le road trip, et porte
       les garde-fous contre l'écrasement d'une sauvegarde pleine par une vide. */
    if (window.AutoBackup && AutoBackup.mount) AutoBackup.mount($('backupSlot'));

    $('resetBtn').addEventListener('click', function () {
      if (!confirm('Effacer tout le road trip ? Cette action est définitive.')) return;
      S = M.blank();
      M.save(S);
      refreshAllInputs();
      render();
      $('dataMsg').textContent = 'Effacé.';
    });

    $('modalClose').addEventListener('click', function () { $('modal').hidden = true; });
  }

  /* Repasse par le chargeur pour bénéficier de la normalisation (champs
     manquants, types douteux) plutôt que de faire confiance au fichier. */
  function reloadFrom(raw) {
    var backup = localStorage.getItem(M.KEY);
    try {
      localStorage.setItem(M.KEY, JSON.stringify(raw));
      return M.load();
    } catch (e) {
      if (backup != null) localStorage.setItem(M.KEY, backup);
      throw e;
    }
  }

  function refreshAllInputs() {
    $('setTitre').value = S.titre;
    $('setDepart').value = S.depart;
    $('setConso').value = S.vehicule.conso;
    $('setPrix').value = S.vehicule.prixCarburant;
  }

  /* ------------------------------------------------------------------ */
  /* Version                                                            */
  /* ------------------------------------------------------------------ */
  function stampVersion() {
    var v = window.__APP_VERSION__ || '';
    var chip = $('verChip');
    if (chip && v) chip.textContent = 'v' + v;
    var t = $('verText');
    if (t) t.textContent = v ? 'version ' + v : 'version inconnue';
  }

  function loadVersion() {
    fetch('version.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { window.__APP_VERSION__ = j.version; stampVersion(); })
      .catch(function () { /* hors ligne : la version n'est qu'un affichage */ });
  }

  /* ------------------------------------------------------------------ */
  function render() {
    renderStats();
    renderEtapes();
    renderBudget();
    renderVisites();
    refreshEtapeSelect();
    if (document.getElementById('tab-map').classList.contains('active')) Carte.render(S);
  }

  function start() {
    initTabs();
    initVilleSearch();
    initBudgetForm();
    initReglages();
    setHaDot(HA.enabled() ? '' : null);
    if (HA.enabled()) {
      HA.ping().then(function () { setHaDot('ok'); }, function () { setHaDot('err'); });
    }
    render();
    loadVersion();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}());
