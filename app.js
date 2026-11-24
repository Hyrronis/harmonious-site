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
  // La vidéo du spot coupe la musique de fond
  $(".video-frame video").addEventListener("play", function () { setSound(false); });

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

  $("#paylist").innerHTML = C.paymentMethods.map(function (m, i) {
    return '<label class="pay' + (m.id === "sur_place" ? " wide" : "") + '"><input type="radio" name="pay" value="' + m.id + '"' + (i === 0 ? " checked" : "") + "><span>" + esc(m.label) + "</span></label>";
  }).join("");

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
    var pay = (form.querySelector('input[name="pay"]:checked') || {}).value;
    var items = C.tickets.filter(function (t) { return qty[t.id] > 0; }).map(function (t) { return { type: t.id, qty: qty[t.id] }; });

    submitBtn.disabled = true; submitBtn.textContent = "Enregistrement…";
    rpc("harmonious_book", { p_name: name, p_phone: phone, p_email: email || null, p_items: items, p_payment_method: pay })
      .then(function (res) {
        store.set({ code: res.code, phone: res.phone });
        showTicket(res, true);
        form.reset();
        C.tickets.forEach(function (t) { qty[t.id] = 0; $("output", t._row).textContent = "0"; t._row.classList.remove("on"); });
        $('input[name="pay"]', form).checked = true;
        updateSummary();
      })
      .catch(function (err) { fail(err.message); })
      .then(function () { submitBtn.disabled = false; submitBtn.textContent = "Confirmer ma réservation"; });
  });

  // ---------- Affichage du pass ----------
  var payLabel = function (id) { var m = C.paymentMethods.filter(function (x) { return x.id === id; })[0]; return m ? m.label : id; };
  var STATUS = { en_attente: "Paiement en attente", paye: "Ticket confirmé", annule: "Réservation annulée" };

  function qrDataUrl(text) {
    var qr = qrcode(0, "M"); qr.addData(text); qr.make();
    return qr.createDataURL(8, 2);
  }

  function showTicket(r, fresh) {
    var view = $("#ticket-view");
    var events = {};
    r.items.forEach(function (i) { events[i.event] = true; });
    var evLines = Object.keys(events).map(function (k) { var e = C.events[k]; return "<dd><b>" + esc(e.name) + "</b> · " + esc(e.date) + ", " + esc(e.time) + "<br><small class='muted'>" + esc(e.place) + "</small></dd>"; });
    var items = r.items.map(function (i) { return i.qty + " × " + esc(i.label); }).join("<br>");
    var waText = encodeURIComponent("Bonjour, j'ai réservé pour Harmonious Chorale. Code : " + r.code + " · Montant : " + fmt(r.total) + ". Voici ma preuve de paiement :");
    var payBlock = "";
    if (r.status === "en_attente") {
      if (r.payment_method === "sur_place") {
        payBlock = '<div class="pay-steps"><h4>Pour finaliser</h4><ol>' +
          "<li>Contactez l'organisation au <b>" + esc(C.contactPhone) + "</b> pour régler votre ticket.</li>" +
          "<li>Donnez votre code <b>" + esc(r.code) + "</b> et payez <b>" + fmt(r.total) + "</b>.</li>" +
          "<li>Votre pass devient valide dès que le paiement est enregistré.</li></ol>" +
          '<a class="btn btn-ghost btn-sm" href="https://wa.me/' + C.whatsapp + "?text=" + waText + '" target="_blank" rel="noopener">Écrire sur WhatsApp</a></div>';
      } else {
        payBlock = '<div class="pay-steps"><h4>Payez pour valider votre ticket</h4><ol>' +
          "<li>Envoyez <b>" + fmt(r.total) + "</b> par <b>" + esc(payLabel(r.payment_method)) + "</b> au <span class='pay-number'>" + esc(C.paymentNumber) + "</span> (" + esc(C.paymentName) + ").</li>" +
          "<li>Indiquez votre code <b>" + esc(r.code) + "</b> en motif si possible.</li>" +
          "<li>Saisissez ci-dessous la référence de la transaction reçue par SMS.</li></ol>" +
          (r.payment_ref ? "<p>Référence envoyée : <b>" + esc(r.payment_ref) + "</b>. Nous vérifions votre paiement.</p>" :
            '<form class="ref-form" id="ref-form"><input name="ref" required placeholder="Référence de transaction" maxlength="80" aria-label="Référence de transaction"><button class="btn btn-gold btn-sm" type="submit">Envoyer</button></form><p class="form-error" id="ref-error" role="alert"></p>') +
          '<p class="tiny muted" style="margin:.8rem 0 0">Besoin d\'aide ? <a href="https://wa.me/' + C.whatsapp + "?text=" + waText + '" target="_blank" rel="noopener">Envoyez votre preuve sur WhatsApp</a>.</p></div>';
      }
    }
    view.innerHTML =
      '<article class="pass" aria-labelledby="pass-title">' +
        '<div class="pass-head"><p class="eyebrow" style="color:#ffe6a8;margin:0">' + (fresh ? "Réservation enregistrée" : "Votre pass") + "</p>" +
        '<h3 id="pass-title">Harmonious Chorale · Ghana</h3></div>' +
        '<div class="pass-body"><div class="pass-info">' +
          '<span class="status ' + r.status + '">' + STATUS[r.status] + "</span>" +
          "<dl><dt>Code</dt><dd><b style='font-family:Cinzel,serif;font-size:1.2rem;color:var(--gold2)'>" + esc(r.code) + "</b></dd>" +
          "<dt>Nom</dt><dd>" + esc(r.full_name) + "</dd>" +
          "<dt>Tickets</dt><dd>" + items + "<br><small class='muted'>" + r.persons + " personne" + (r.persons > 1 ? "s" : "") + "</small></dd>" +
          "<dt>Total</dt><dd>" + fmt(r.total) + "</dd>" +
          "<dt>Quand</dt>" + evLines.join("<dt></dt>") +
          "</dl></div>" +
          '<div class="pass-qr' + (r.status === "paye" ? "" : " dim") + '"><img src="' + qrDataUrl(r.code) + '" alt="QR code du ticket ' + esc(r.code) + '"><small>' + esc(r.code) + "</small></div>" +
        "</div>" + payBlock +
        '<div class="pass-actions">' +
          '<button class="btn btn-ghost btn-sm" id="refresh-pass">Actualiser le statut</button>' +
          '<button class="btn btn-ghost btn-sm" id="save-pass">Enregistrer l\'image du ticket</button>' +
        "</div>" +
        (r.status === "paye" ? '<p class="tiny muted" style="padding:0 24px 22px;margin:0">Présentez ce QR code à l\'entrée. Une capture d\'écran suffit.</p>' :
          r.status === "en_attente" ? '<p class="tiny muted" style="padding:0 24px 22px;margin:0">Le QR code sera accepté à l\'entrée une fois le paiement confirmé.</p>' : "") +
      "</article>";
    view.hidden = false;
    $("#lookup").querySelector(".eyebrow").textContent = "Une autre réservation ?";

    var refForm = $("#ref-form");
    if (refForm) refForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = $("button", refForm); btn.disabled = true;
      rpc("harmonious_submit_payment", { p_code: r.code, p_phone: r.phone, p_ref: refForm.ref.value })
        .then(function (res) { showTicket(res, false); })
        .catch(function (err) { $("#ref-error").textContent = err.message; btn.disabled = false; });
    });
    $("#refresh-pass").addEventListener("click", function () { loadTicket(r.code, r.phone, true); });
    $("#save-pass").addEventListener("click", function () { downloadPass(r); });
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

  // ---------- Image du ticket ----------
  function downloadPass(r) {
    var W = 1080, H = 1500, c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#2b120c"); g.addColorStop(1, "#120806");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = "#b8141f"; x.fillRect(0, 0, W, 260);
    var kc = ["#e3b24f", "#111", "#1d7a3e", "#111", "#b8141f", "#111"], kw = [18, 4, 12, 4, 18, 4];
    for (var px = 0, i = 0; px < W; i++) { x.fillStyle = kc[i % 6]; x.fillRect(px, 260, kw[i % 6] * 1.5, 18); px += kw[i % 6] * 1.5; }
    x.textAlign = "center"; x.fillStyle = "#ffe6a8"; x.font = "600 30px Montserrat, sans-serif";
    x.fillText("AJ GROUP ÉVÉNEMENTIEL PRÉSENTE", W / 2, 90);
    x.fillStyle = "#fff"; x.font = "italic 900 74px Montserrat, sans-serif";
    x.fillText("HARMONIOUS CHORALE", W / 2, 180);
    x.fillStyle = "#f6d58a"; x.font = "italic 900 48px Montserrat, sans-serif"; x.fillText("GHANA", W / 2, 235);
    var img = new Image();
    img.onload = function () {
      x.fillStyle = "#fff"; x.fillRect(W / 2 - 230, 330, 460, 460);
      x.drawImage(img, W / 2 - 210, 350, 420, 420);
      x.fillStyle = "#f6d58a"; x.font = "800 64px Cinzel, serif"; x.fillText(r.code, W / 2, 880);
      x.fillStyle = r.status === "paye" ? "#3fbf6d" : r.status === "annule" ? "#e2514a" : "#f0a63a";
      x.font = "800 34px Montserrat, sans-serif"; x.fillText(STATUS[r.status].toUpperCase(), W / 2, 940);
      x.fillStyle = "#f7ecd6"; x.font = "700 40px Montserrat, sans-serif"; x.fillText(r.full_name, W / 2, 1020);
      x.font = "500 32px Montserrat, sans-serif"; x.fillStyle = "#c9b59a";
      var y = 1080;
      r.items.forEach(function (it) { x.fillText(it.qty + " × " + it.label, W / 2, y); y += 46; });
      x.fillText("Total : " + fmt(r.total), W / 2, y + 10);
      x.font = "500 28px Montserrat, sans-serif";
      x.fillText("Présentez ce QR code à l'entrée · Infos : " + C.contactPhone, W / 2, H - 60);
      var a = document.createElement("a");
      a.download = "ticket-harmonious-" + r.code + ".png"; a.href = c.toDataURL("image/png"); a.click();
    };
    img.src = qrDataUrl(r.code);
  }

  // ---------- Apparition au défilement ----------
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { threshold: 0.12 });
    $$(".card-invite, .event, .buy-box, .video-frame, .gallery button, .ticket-group, .booking-side .panel").forEach(function (el) { el.classList.add("reveal"); io.observe(el); });
  }
})();
