// Réglages du site — à modifier ici uniquement.
window.HC_CONFIG = {
  supabaseUrl: "https://ppkjipikcsdlbpcykmqn.supabase.co",
  supabaseKey: "sb_publishable_OWqKfeZ1z--YbJ-VSlGi6w_a_W9lo2I",

  // Numéro qui reçoit les paiements Mobile Money (À CONFIRMER par l'organisateur)
  paymentNumber: "07 77 87 75 33",
  paymentName: "AJ Group Événementiel",
  contactPhone: "07 77 87 75 33",
  whatsapp: "2250777877533",

  tickets: [
    { id: "gala_individuel", event: "gala", label: "Ticket individuel", note: "1 personne", price: 15000 },
    { id: "gala_couple", event: "gala", label: "Ticket couple", note: "2 personnes", price: 25000 },
    { id: "concert_public", event: "concert", label: "Grand public", note: "1 personne", price: 5000 },
    { id: "concert_vip", event: "concert", label: "VIP", note: "1 personne · places réservées", price: 10000 }
  ],

  events: {
    gala: {
      name: "Dîner Gala",
      date: "Jeudi 24 décembre 2026",
      time: "21h00 GMT",
      iso: "2026-12-24T21:00:00Z",
      place: "Hôtel Galaxie, Abidjan",
      buy: "https://monpassaj.com/event/diner_gala-5",
      maps: "https://www.google.com/maps/search/?api=1&query=H%C3%B4tel+Galaxie+Abidjan"
    },
    concert: {
      name: "Grand Concert",
      date: "Vendredi 25 décembre 2026",
      time: "16h00 GMT",
      iso: "2026-12-25T16:00:00Z",
      place: "Stade de l'Université Méthodiste, Cocody",
      buy: "https://monpassaj.com/event/harmonious_chorale_ghana_en_concert_live-6",
      maps: "https://www.google.com/maps/search/?api=1&query=Universit%C3%A9+M%C3%A9thodiste+de+C%C3%B4te+d%27Ivoire+Cocody+Abidjan"
    }
  },

  paymentMethods: [
    { id: "orange_money", label: "Orange Money" },
    { id: "mtn_momo", label: "MTN MoMo" },
    { id: "moov_money", label: "Moov Money" },
    { id: "wave", label: "Wave" },
    { id: "sur_place", label: "Payer au point de vente" }
  ]
};
