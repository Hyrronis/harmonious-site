(function () {
  "use strict";
  var C = window.HC_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n) { return n.toLocaleString("fr-FR").replace(/ | /g, " ") + " FCFA"; };
  var STORE_KEY = "hc_last_booking";
  var store = {
    get: function () { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) {} }
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // ---------- API ----------
  function rpc(fn, body) {
    return fetch(C.supabaseUrl + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: C.supabaseKey },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var data = t ? JSON.parse(t) : null;
        if (!r.ok) throw new Error((data && data.message) || "Le service est momentanément indisponible. Réessayez.");
        return data;
      });
    }, function () { throw new Error("Pas de connexion internet. Vérifiez votre réseau et réessayez."); });
  }

  // ---------- Musique & ouverture ----------
  var music = $("#music"), soundBtn = $("#sound-toggle"), gate = $("#gate");
  function setSound(on) {
    if (on) {
      music.volume = 0.7;
      var p = music.play();
      if (p && p.catch) p.catch(function () { setSound(false); });
    } else music.pause();
    soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
    soundBtn.setAttribute("aria-label", on ? "Couper la musique" : "Activer la musique");
  }
  function openGate(withSound) {
    gate.classList.add("gone");
    document.body.classList.remove("locked");
    if (withSound) setSound(true);
    setTimeout(function () { gate.hidden = true; }, 950);
  }
  // On saute l'écran d'ouverture pour un lien direct (#reserver, #mon-ticket…)
  if (location.hash && location.hash.length > 1) { gate.hidden = true; }
  else { document.body.classList.add("locked"); $("#open-invite").focus(); }
  $("#open-invite").addEventListener("click", function () { openGate(true); });
  $("#open-silent").addEventListener("click", function () { openGate(false); });
  soundBtn.addEventListener("click", function () { setSound(music.paused); });
  music.addEventListener("ended", function () { setSound(false); });
  // La vidéo du spot coupe la musique de fond
  $(".video-frame video").addEventListener("play", function () { setSound(false); });

  $$("[data-deadline]").forEach(function (el) { el.textContent = C.paymentDeadline; });

  // ---------- Barre du haut ----------
  var topbar = $("#topbar");
  function onScroll() { topbar.classList.toggle("solid", window.scrollY > 40); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // ---------- Liens d'achat et itinéraires ----------
  $$("[data-buy]").forEach(function (a) { a.href = C.events[a.getAttribute("data-buy")].buy; });
  $$("[data-map]").forEach(function (a) { a.href = C.events[a.getAttribute("data-map")].maps; });

  // ---------- Compte à rebours ----------
  var cdEls = {}; $$("[data-cd]").forEach(function (el) { cdEls[el.getAttribute("data-cd")] = el; });
  function tick() {
    var now = Date.now(), gala = Date.parse(C.events.gala.iso), concert = Date.parse(C.events.concert.iso);
    var target = gala, label = "Le Dîner Gala commence dans";
    if (now >= gala) { target = concert; label = "Le Grand Concert commence dans"; }
    if (now >= concert) { $("#countdown").hidden = true; return; }
    $("#countdown-label").textContent = label;
    var s = Math.floor((target - now) / 1000);
    var v = { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
    for (var k in v) cdEls[k].textContent = k === "d" ? v[k] : String(v[k]).padStart(2, "0");
  }
  tick(); setInterval(tick, 1000);

  // ---------- Galerie ----------
  var lb = $("#lightbox");
  $$("#gallery button").forEach(function (b) {
    b.addEventListener("click", function () {
      $("img", lb).src = b.getAttribute("data-src");
      $("img", lb).alt = $("img", b).alt;
      lb.hidden = false;
    });
  });
  lb.addEventListener("click", function () { lb.hidden = true; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") lb.hidden = true; });

  // ---------- Réservation ----------
  var qty = {};
  C.tickets.forEach(function (t) {
    qty[t.id] = 0;
    var row = document.createElement("div");
    row.className = "ticket-row";
    row.innerHTML = '<div class="tr-info"><b>' + esc(t.label) + "</b><small>" + esc(t.note) + "</small></div>" +
      '<div class="tr-price">' + fmt(t.price) + "</div>" +
      '<div class="stepper"><button type="button" aria-label="Retirer un ticket ' + esc(t.label) + '" data-d="-1">−</button>' +
      '<output aria-live="polite">0</output><button type="button" aria-label="Ajouter un ticket ' + esc(t.label) + '" data-d="1">+</button></div>';
    $$("button", row).forEach(function (b) {
      b.addEventListener("click", function () {
        qty[t.id] = Math.max(0, Math.min(20, qty[t.id] + Number(b.getAttribute("data-d"))));
        $("output", row).textContent = qty[t.id];
        row.classList.toggle("on", qty[t.id] > 0);
        updateSummary();
      });
    });
    t._row = row;
    $('.ticket-group[data-group="' + t.event + '"] .ticket-rows').appendChild(row);
  });

  function updateSummary() {
    var total = 0, lines = [];
    C.tickets.forEach(function (t) {
      if (qty[t.id] > 0) {
        total += qty[t.id] * t.price;
        lines.push('<div class="sum-line"><span>' + qty[t.id] + " × " + esc(C.events[t.event].name) + " · " + esc(t.label) + "</span><b>" + fmt(qty[t.id] * t.price) + "</b></div>");
      }
    });
    $("#summary-lines").innerHTML = lines.length ? lines.join("") : '<p class="muted">Aucun ticket sélectionné.</p>';
    $("#total").textContent = fmt(total);
    return total;
  }

  // « Réserver ici » présélectionne un ticket de l'événement
  $$("[data-reserve]").forEach(function (a) {
    a.addEventListener("click", function () {
      var ev = a.getAttribute("data-reserve");
      var has = C.tickets.some(function (t) { return t.event === ev && qty[t.id] > 0; });
      if (!has) { var first = C.tickets.filter(function (t) { return t.event === ev; })[0]; $('[data-d="1"]', first._row).click(); }
    });
  });

  var form = $("#booking-form"), errBox = $("#form-error"), submitBtn = $("#submit-btn");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errBox.textContent = "";
    $$("input", form).forEach(function (i) { i.removeAttribute("aria-invalid"); });
    var total = updateSummary();
    var name = form.elements.name.value.trim(), phone = form.elements.phone.value.trim(), email = form.elements.email.value.trim();
    var fail = function (msg, input) { errBox.textContent = msg; if (input) { input.setAttribute("aria-invalid", "true"); input.focus(); } };
    if (!total) return fail("Choisissez au moins un ticket.");
    if (name.length < 3) return fail("Indiquez votre nom complet.", form.elements.name);
    if (phone.replace(/\D/g, "").length < 8) return fail("Indiquez un numéro de téléphone valide.", form.elements.phone);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("L'adresse e-mail semble incorrecte.", form.elements.email);
    var items = C.tickets.filter(function (t) { return qty[t.id] > 0; }).map(function (t) { return { type: t.id, qty: qty[t.id] }; });

    submitBtn.disabled = true; submitBtn.textContent = "Enregistrement…";
    rpc("harmonious_book", { p_name: name, p_phone: phone, p_email: email || null, p_items: items, p_payment_method: "sur_place" })
      .then(function (res) {
        store.set({ code: res.code, phone: res.phone });
        showTicket(res, true);
        form.reset();
        C.tickets.forEach(function (t) { qty[t.id] = 0; $("output", t._row).textContent = "0"; t._row.classList.remove("on"); });
        updateSummary();
      })
      .catch(function (err) { fail(err.message); })
      .then(function () { submitBtn.disabled = false; submitBtn.textContent = "Confirmer ma réservation"; });
  });

  // ---------- Affichage du pass ----------
  var STATUS = { en_attente: "En attente de paiement", paye: "Réservation confirmée", annule: "Réservation annulée" };

  function showTicket(r, fresh) {
    var view = $("#ticket-view");
    var events = {};
    r.items.forEach(function (i) { events[i.event] = true; });
    var evLines = Object.keys(events).map(function (k) { var e = C.events[k]; return "<dd><b>" + esc(e.name) + "</b> · " + esc(e.date) + ", " + esc(e.time) + "<br><small class='muted'>" + esc(e.place) + "</small></dd>"; });
    var items = r.items.map(function (i) { return i.qty + " × " + esc(i.label); }).join("<br>");
    var waText = encodeURIComponent("Bonjour, j'ai réservé pour Harmonious Chorale. Mon code : " + r.code + ".");
    var payBlock = "";
    if (r.status === "en_attente") {
      payBlock = '<div class="pay-steps"><h4>Et maintenant ?</h4><ol>' +
        "<li>Votre réservation est bien enregistrée sous le code <b>" + esc(r.code) + "</b>.</li>" +
        "<li>Notre équipe vous contactera au <b>" + esc(r.phone) + "</b> pour finaliser votre réservation.</li>" +
        "<li>Le paiement est à effectuer au plus tard le <b>" + esc(C.paymentDeadline) + "</b>. Passé cette date, la réservation sera annulée.</li></ol>" +
        '<p class="tiny muted" style="margin:0">Une question ? Appelez le <a href="tel:+225' + esc(C.contactPhone.replace(/\D/g, "")) + '">' + esc(C.contactPhone) + '</a> ou <a href="https://wa.me/' + C.whatsapp + "?text=" + waText + '" target="_blank" rel="noopener">écrivez sur WhatsApp</a>.</p></div>';
    }
    view.innerHTML =
      '<article class="pass" aria-labelledby="pass-title">' +
        '<div class="pass-head"><p class="eyebrow" style="color:#ffe6a8;margin:0">' + (fresh ? "Réservation enregistrée" : "Votre réservation") + "</p>" +
        '<h3 id="pass-title">Harmonious Chorale · Ghana</h3></div>' +
        '<div class="pass-body"><div class="pass-info">' +
          '<span class="status ' + r.status + '">' + STATUS[r.status] + "</span>" +
          "<dl><dt>Code</dt><dd><b style='font-family:Cinzel,serif;font-size:1.2rem;color:var(--gold2)'>" + esc(r.code) + "</b></dd>" +
          "<dt>Nom</dt><dd>" + esc(r.full_name) + "</dd>" +
          "<dt>Tickets</dt><dd>" + items + "<br><small class='muted'>" + r.persons + " personne" + (r.persons > 1 ? "s" : "") + "</small></dd>" +
          "<dt>Total</dt><dd>" + fmt(r.total) + "</dd>" +
          "<dt>Quand</dt>" + evLines.join("<dt></dt>") +
          "</dl></div>" +
        "</div>" + payBlock +
        '<div class="pass-actions">' +
          '<button class="btn btn-ghost btn-sm" id="refresh-pass">Actualiser le statut</button>' +
        "</div>" +
        (r.status === "paye" ? '<p class="tiny muted" style="padding:0 24px 22px;margin:0">Votre réservation est confirmée. Donnez votre nom ou votre code à l\'entrée.</p>' : "") +
      "</article>";
    view.hidden = false;
    $("#lookup").querySelector(".eyebrow").textContent = "Une autre réservation ?";

    $("#refresh-pass").addEventListener("click", function () { loadTicket(r.code, r.phone, true); });
    if (fresh) document.getElementById("mon-ticket").scrollIntoView({ behavior: "smooth" });
  }

  function loadTicket(code, phone, quiet) {
    return rpc("harmonious_get_ticket", { p_code: code, p_phone: phone }).then(function (res) {
      if (!res) throw new Error("Aucune réservation ne correspond à ce code et ce numéro.");
      store.set({ code: res.code, phone: res.phone });
      showTicket(res, false);
      return res;
    }).catch(function (err) { if (!quiet) throw err; });
  }

  $("#lookup-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target; $("#lookup-error").textContent = "";
    loadTicket(f.code.value.trim(), f.phone.value.trim()).then(function () {
      document.getElementById("mon-ticket").scrollIntoView({ behavior: "smooth" });
    }).catch(function (err) { $("#lookup-error").textContent = err.message; });
  });

  var last = store.get();
  if (last && last.code) loadTicket(last.code, last.phone, true);

  // ---------- Apparition au défilement ----------
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { threshold: 0.12 });
    $$(".card-invite, .event, .buy-box, .video-frame, .gallery button, .ticket-group, .booking-side .panel").forEach(function (el) { el.classList.add("reveal"); io.observe(el); });
  }
})();
