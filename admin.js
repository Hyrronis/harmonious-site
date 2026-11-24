(function () {
  "use strict";
  var C = window.HC_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n) { return n.toLocaleString("fr-FR").replace(/ | /g, " ") + " FCFA"; };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var STATUS = { en_attente: "À contacter", paye: "Confirmé", annule: "Annulé" };
  var token = null, me = null, data = [];
  var TOKEN_KEY = "hc_token";
  function saveToken(t) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.clear(); } catch (e) {} }
  try { token = sessionStorage.getItem(TOKEN_KEY); } catch (e) {}

  function rpc(fn, body) {
    return fetch(C.supabaseUrl + "/rest/v1/rpc/" + fn, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: C.supabaseKey }, body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var d = t ? JSON.parse(t) : null;
        if (!r.ok) {
          var msg = (d && d.message) || "Erreur";
          if (/Session expirée/.test(msg) && fn !== "harmonious_login") { endSession(msg); }
          throw new Error(msg);
        }
        return d;
      });
    });
  }
  function endSession(msg) {
    token = null; saveToken(null);
    stopScan();
    $("#app").hidden = true; $("#login").hidden = false;
    $("#login-error").textContent = msg || "";
  }
  function start() {
    return rpc("harmonious_staff_list", { p_token: token }).then(function (d) {
      me = d.me; data = d.reservations;
      $("#me").textContent = "· " + me.name + (me.role === "admin" ? " (admin)" : "");
      $("#tab-btn-equipe").hidden = me.role !== "admin";
      $("#login").hidden = true; $("#app").hidden = false; render();
    });
  }
  $("#login-form").addEventListener("submit", function (e) {
    e.preventDefault(); $("#login-error").textContent = "";
    var f = e.target, btn = $("button", f); btn.disabled = true;
    rpc("harmonious_login", { p_username: f.username.value, p_password: f.password.value }).then(function (s) {
      token = s.token; saveToken(token);
      f.password.value = "";
      return start();
    }).catch(function (err) { $("#login-error").textContent = err.message; })
      .then(function () { btn.disabled = false; });
  });
  if (token) start().catch(function () { endSession(); });
  $("#logout").addEventListener("click", function () { rpc("harmonious_logout", { p_token: token }).catch(function () {}).then(function () { endSession(); }); });
  $("#reload").addEventListener("click", reload);
  function reload() { return rpc("harmonious_staff_list", { p_token: token }).then(function (d) { data = d.reservations; render(); }); }

  // Mon compte
  $("#pwd-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target, msg = $("#pwd-msg"); msg.style.color = ""; msg.textContent = "";
    if (f.new1.value !== f.new2.value) { msg.textContent = "Les deux nouveaux mots de passe ne correspondent pas."; return; }
    rpc("harmonious_change_password", { p_token: token, p_old: f.old.value, p_new: f.new1.value }).then(function () {
      f.reset(); msg.style.color = "var(--ok)"; msg.textContent = "Mot de passe modifié. Les autres appareils connectés ont été déconnectés.";
    }).catch(function (err) { msg.textContent = err.message; });
  });

  // Équipe (administrateurs)
  var ACT = { connexion: "Connexion", echec_connexion: "Échec de connexion", statut_paye: "Confirmé", statut_en_attente: "Remis à contacter", statut_annule: "Annulé", entree_gala: "Entrée Gala", entree_concert: "Entrée Concert", mot_de_passe_change: "Mot de passe changé", compte_cree: "Compte créé", compte_modifie: "Compte modifié" };
  function loadTeam() {
    return rpc("harmonious_staff_accounts", { p_token: token }).then(function (d) {
      $("#accounts").innerHTML = d.accounts.map(function (a) {
        return '<div class="row" style="grid-template-columns:1fr 1fr auto"><div><b>' + esc(a.name) + "</b><br><small>" + esc(a.username) + "</small></div><div>" + (a.role === "admin" ? "Administrateur" : "Équipe") + "</div><div>" +
          (a.active ? (a.locked ? '<span class="status en_attente">Bloqué 15 min</span>' : '<span class="status paye">Actif</span>') : '<span class="status annule">Désactivé</span>') + "</div></div>";
      }).join("");
      $("#audit").innerHTML = d.audit.length ? d.audit.map(function (a) {
        return '<div class="row" style="grid-template-columns:auto 1fr 1fr;padding:10px 14px"><small>' + new Date(a.at).toLocaleString("fr-FR") + "</small><div>" + esc(a.who || "?") + "</div><div>" + esc(ACT[a.action] || a.action) + (a.code ? " · <b>" + esc(a.code) + "</b>" : "") + "</div></div>";
      }).join("") : '<div class="empty">Aucune action pour le moment.</div>';
    });
  }
  $("#acc-form").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target, msg = $("#acc-msg"); msg.style.color = ""; msg.textContent = "";
    rpc("harmonious_staff_save_account", { p_token: token, p_username: f.username.value, p_name: f.elements.name.value, p_password: f.password.value, p_role: f.role.value, p_active: f.active.value === "true" })
      .then(function () { f.reset(); msg.style.color = "var(--ok)"; msg.textContent = "Compte enregistré."; return loadTeam(); })
      .catch(function (err) { msg.textContent = err.message; });
  });

  $$("[data-tab]").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      ["resa", "scan", "compte", "equipe"].forEach(function (t) { $("#tab-" + t).hidden = b.getAttribute("data-tab") !== t; });
      if (b.getAttribute("data-tab") === "equipe") loadTeam().catch(function () {});
      if (b.getAttribute("data-tab") !== "scan") stopScan();
    });
  });

  // ---------- Liste ----------
  ["#q", "#f-status", "#f-event"].forEach(function (s) { $(s).addEventListener("input", render); });
  function filtered() {
    var q = $("#q").value.trim().toLowerCase(), st = $("#f-status").value, ev = $("#f-event").value;
    return data.filter(function (r) {
      if (st && r.status !== st) return false;
      if (ev && !r.items.some(function (i) { return i.event === ev; })) return false;
      if (q && (r.full_name + " " + r.phone + " " + r.code + " " + (r.payment_ref || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function render() {
    var paid = data.filter(function (r) { return r.status === "paye"; });
    var pending = data.filter(function (r) { return r.status === "en_attente"; });
    var count = function (list, ev) { return list.reduce(function (n, r) { return n + r.items.filter(function (i) { return i.event === ev; }).reduce(function (a, i) { return a + i.persons; }, 0); }, 0); };
    var sum = function (list) { return list.reduce(function (n, r) { return n + r.total; }, 0); };
    $("#stats").innerHTML = [
      ["Confirmé", fmt(sum(paid))], ["À contacter", fmt(sum(pending))],
      ["Gala · places confirmées", count(paid, "gala")], ["Concert · places confirmées", count(paid, "concert")],
      ["Réservations", data.length]
    ].map(function (s) { return '<div class="stat"><span>' + s[0] + "</span><b>" + s[1] + "</b></div>"; }).join("");

    var list = filtered();
    if (!list.length) { $("#list").innerHTML = '<div class="empty">Aucune réservation pour le moment.</div>'; return; }
    $("#list").innerHTML = list.map(function (r) {
      var ch = r.checkins || {};
      var entered = Object.keys(ch).map(function (k) { return "Entré " + (k === "gala" ? "Gala" : "Concert"); }).join(" · ");
      return '<div class="row" data-code="' + esc(r.code) + '">' +
        '<div><span class="code">' + esc(r.code) + "</span><br><b>" + esc(r.full_name) + '</b><br><small><a href="tel:' + esc(r.phone) + '">' + esc(r.phone) + "</a>" + (r.email ? " · " + esc(r.email) : "") + "</small></div>" +
        "<div>" + r.items.map(function (i) { return i.qty + " × " + esc(i.label); }).join("<br>") + "<br><small>" + new Date(r.created_at).toLocaleString("fr-FR") + "</small></div>" +
        "<div><b>" + fmt(r.total) + "</b>" + (r.payment_ref ? "<br><small>Réf : " + esc(r.payment_ref) + "</small>" : "") + "</div>" +
        '<div class="acts"><span class="status ' + r.status + '">' + STATUS[r.status] + "</span>" + (entered ? "<small>" + entered + "</small>" : "") +
          (r.status !== "paye" ? '<button class="btn btn-gold btn-sm" data-set="paye">Confirmer</button>' : '<button class="btn btn-ghost btn-sm" data-set="en_attente">Remettre à contacter</button>') +
          (r.status !== "annule" ? '<button class="btn btn-ghost btn-sm" data-set="annule">Annuler</button>' : "") +
        "</div></div>";
    }).join("");
  }
  $("#list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-set]"); if (!b) return;
    var code = b.closest("[data-code]").getAttribute("data-code"), st = b.getAttribute("data-set");
    if (st === "annule" && !window.confirm("Annuler la réservation " + code + " ?")) return;
    b.disabled = true;
    rpc("harmonious_staff_set_status", { p_token: token, p_code: code, p_status: st }).then(function (res) {
      data = data.map(function (r) { return r.code === res.code ? res : r; }); render();
    }).catch(function (err) { alert(err.message); b.disabled = false; });
  });

  $("#export").addEventListener("click", function () {
    var head = ["Code", "Nom", "Téléphone", "E-mail", "Tickets", "Personnes", "Total FCFA", "Statut", "Entrées", "Date"];
    var rows = filtered().map(function (r) {
      return [r.code, r.full_name, r.phone, r.email || "", r.items.map(function (i) { return i.qty + " x " + i.label; }).join(" | "), r.persons, r.total,
        STATUS[r.status], Object.keys(r.checkins || {}).join(" "), new Date(r.created_at).toLocaleString("fr-FR")];
    });
    var csv = [head].concat(rows).map(function (row) { return row.map(function (v) { v = String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(";"); }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "reservations-harmonious.csv"; a.click();
  });

  // ---------- Contrôle d'entrée ----------
  var scanner = null, busy = false, lastCode = "", lastAt = 0;
  function stopScan() {}
  $("#manual-form").addEventListener("submit", function (e) { e.preventDefault(); var v = e.target.code.value.trim(); if (v) check(v); e.target.code.value = ""; });

  function showResult(cls, title, text) { $("#scan-result").innerHTML = '<div class="result ' + cls + '"><h3>' + esc(title) + "</h3><p>" + text + "</p></div>"; }
  function check(code) {
    busy = true;
    var ev = $("#scan-event").value;
    var m = String(code).toUpperCase().match(/HC-[A-Z0-9]{6}/); code = m ? m[0] : code;
    rpc("harmonious_staff_checkin", { p_token: token, p_code: code, p_event: ev }).then(function (res) {
      var r = res.reservation, who = r ? "<b>" + esc(r.full_name) + "</b> · " + esc(r.code) + "<br>" + r.items.filter(function (i) { return i.event === ev; }).map(function (i) { return i.qty + " × " + esc(i.label) + " (" + i.persons + " pers.)"; }).join("<br>") : esc(code);
      if (navigator.vibrate) navigator.vibrate(res.result === "ok" ? 80 : [80, 60, 80]);
      if (res.result === "ok") showResult("r-ok", "Entrée validée", who);
      else if (res.result === "deja_entre") showResult("r-warn", "Déjà entré", who + "<br>Cette personne a déjà été pointée à " + new Date(r.checkins[ev]).toLocaleTimeString("fr-FR"));
      else if (res.result === "non_paye") showResult("r-bad", r.status === "annule" ? "Réservation annulée" : "Non confirmé", who);
      else if (res.result === "autre_evenement") showResult("r-bad", "Mauvais événement", who + "<br>Cette réservation n'est pas valable pour cet événement.");
      else showResult("r-bad", "Code inconnu", esc(code));
      if (res.reservation) data = data.map(function (x) { return x.code === r.code ? r : x; });
    }).catch(function (err) { showResult("r-bad", "Erreur", esc(err.message)); })
      .then(function () { busy = false; });
  }
})();
