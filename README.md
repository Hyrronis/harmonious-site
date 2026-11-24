# Site Harmonious Chorale · Ghana (Noël 2026, Abidjan)

Site statique (HTML/CSS/JS, sans build). Réservations enregistrées dans Supabase (projet ZIKOS, schéma privé `harmonious`, fonctions `public.harmonious_*`).

- `index.html` : ouverture en musique, programme, liens d'achat MonPass AJ, spot, galerie, réservation, pass QR.
- `admin.html` : espace organisateur (liste, validation des paiements, export CSV, contrôle d'entrée par scan QR).
- `config.js` : numéros, prix, liens d'achat, moyens de paiement.

Test local : `python3 -m http.server` dans ce dossier.
