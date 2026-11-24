(function () {
  "use strict";
  var C = window.HC_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n) { return n.toLocaleString("fr-FR").replace(/ | /g, " ") + " FCFA"; };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var PAY = {}; C.paymentMethods.forEach(function (m) { PAY[m.id] = m.label; });
  var STATUS = { en_attente: "En attente", paye: "Payé", annule: "Annulé" };
  var pin = null, data = [];
  try { pin = sessionStorage.getItem("hc_pin"); } catch (e) {}

  function rpc(fn, body) {
    return fetch(C.supabaseUrl + "/rest/v1/rpc/" + fn, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: C.supabaseKey }, body: JSON.stringify(body)
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.message || "Erreur"); return d; }); });
  }

  function login(p) {
    return rpc("harmonious_admin_list", { p_pin: p }).then(function (d) {
      pin = p; try { sessionStorage.setItem("hc_pin", p); } catch (e) {}
      data = d; $("#login").hidden = true; $("#app").hidden = false; render();
    });
  }
  $("#login-form").addEventListener("submit", function (e) {
    e.preventDefault(); $("#login-error").textContent = "";
    login(e.target.pin.value).catch(function (err) { $("#login-error").textContent = err.message; });
  });
  if (pin) login(pin).catch(function () { pin = null; });
  $("#logout").addEventListener("click", function () { try { sessionStorage.removeItem("hc_pin"); } catch (e) {} location.reload(); });
  $("#reload").addEventListener("click", reload);
  function reload() { return rpc("harmonious_admin_list", { p_pin: pin }).then(function (d) { data = d; render(); }); }

  $$("[data-tab]").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      $("#tab-resa").hidden = b.getAttribute("data-tab") !== "resa";
      $("#tab-scan").hidden = b.getAttribute("data-tab") !== "scan";
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
      ["Encaissé", fmt(sum(paid))], ["En attente", fmt(sum(pending))],
      ["Gala · places payées", count(paid, "gala")], ["Concert · places payées", count(paid, "concert")],
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
        "<div><b>" + fmt(r.total) + "</b><br><small>" + esc(PAY[r.payment_method] || r.payment_method) + (r.payment_ref ? "<br>Réf : " + esc(r.payment_ref) : "") + "</small></div>" +
        '<div class="acts"><span class="status ' + r.status + '">' + STATUS[r.status] + "</span>" + (entered ? "<small>" + entered + "</small>" : "") +
          (r.status !== "paye" ? '<button class="btn btn-gold btn-sm" data-set="paye">Marquer payé</button>' : '<button class="btn btn-ghost btn-sm" data-set="en_attente">Remettre en attente</button>') +
          (r.status !== "annule" ? '<button class="btn btn-ghost btn-sm" data-set="annule">Annuler</button>' : "") +
        "</div></div>";
    }).join("");
  }
  $("#list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-set]"); if (!b) return;
    var code = b.closest("[data-code]").getAttribute("data-code"), st = b.getAttribute("data-set");
    if (st === "annule" && !window.confirm("Annuler la réservation " + code + " ?")) return;
    b.disabled = true;
    rpc("harmonious_admin_set_status", { p_pin: pin, p_code: code, p_status: st }).then(function (res) {
      data = data.map(function (r) { return r.code === res.code ? res : r; }); render();
    }).catch(function (err) { alert(err.message); b.disabled = false; });
  });

  $("#export").addEventListener("click", function () {
    var head = ["Code", "Nom", "Téléphone", "E-mail", "Tickets", "Personnes", "Total FCFA", "Paiement", "Référence", "Statut", "Entrées", "Date"];
    var rows = filtered().map(function (r) {
      return [r.code, r.full_name, r.phone, r.email || "", r.items.map(function (i) { return i.qty + " x " + i.label; }).join(" | "), r.persons, r.total,
        PAY[r.payment_method] || r.payment_method, r.payment_ref || "", STATUS[r.status], Object.keys(r.checkins || {}).join(" "), new Date(r.created_at).toLocaleString("fr-FR")];
    });
    var csv = [head].concat(rows).map(function (row) { return row.map(function (v) { v = String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(";"); }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "reservations-harmonious.csv"; a.click();
  });

  // ---------- Contrôle d'entrée ----------
  var scanner = null, busy = false, lastCode = "", lastAt = 0;
  function stopScan() { if (scanner) { scanner.stop().catch(function () {}); scanner = null; $("#scan-start").textContent = "Ouvrir la caméra"; } }
  $("#scan-start").addEventListener("click", function () {
    if (scanner) return stopScan();
    scanner = new Html5Qrcode("reader");
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, function (text) {
      var now = Date.now(); if (busy || (text === lastCode && now - lastAt < 4000)) return;
      lastCode = text; lastAt = now; check(text);
    }).then(function () { $("#scan-start").textContent = "Fermer la caméra"; })
      .catch(function () { scanner = null; showResult("r-bad", "Caméra indisponible", "Autorisez l'accès à la caméra ou saisissez le code."); });
  });
  $("#manual-form").addEventListener("submit", function (e) { e.preventDefault(); var v = e.target.code.value.trim(); if (v) check(v); e.target.code.value = ""; });

  function showResult(cls, title, text) { $("#scan-result").innerHTML = '<div class="result ' + cls + '"><h3>' + esc(title) + "</h3><p>" + text + "</p></div>"; }
  function check(code) {
    busy = true;
    var ev = $("#scan-event").value;
    var m = String(code).toUpperCase().match(/HC-[A-Z0-9]{6}/); code = m ? m[0] : code;
    rpc("harmonious_admin_checkin", { p_pin: pin, p_code: code, p_event: ev }).then(function (res) {
      var r = res.reservation, who = r ? "<b>" + esc(r.full_name) + "</b> · " + esc(r.code) + "<br>" + r.items.filter(function (i) { return i.event === ev; }).map(function (i) { return i.qty + " × " + esc(i.label) + " (" + i.persons + " pers.)"; }).join("<br>") : esc(code);
      if (navigator.vibrate) navigator.vibrate(res.result === "ok" ? 80 : [80, 60, 80]);
      if (res.result === "ok") showResult("r-ok", "Entrée validée", who);
      else if (res.result === "deja_entre") showResult("r-warn", "Déjà entré", who + "<br>Ce ticket a déjà été scanné à " + new Date(r.checkins[ev]).toLocaleTimeString("fr-FR"));
      else if (res.result === "non_paye") showResult("r-bad", r.status === "annule" ? "Réservation annulée" : "Non payé", who);
      else if (res.result === "autre_evenement") showResult("r-bad", "Mauvais événement", who + "<br>Ce ticket n'est pas valable pour cet événement.");
      else showResult("r-bad", "Ticket inconnu", esc(code));
      if (res.reservation) data = data.map(function (x) { return x.code === r.code ? r : x; });
    }).catch(function (err) { showResult("r-bad", "Erreur", esc(err.message)); })
      .then(function () { busy = false; });
  }
})();
