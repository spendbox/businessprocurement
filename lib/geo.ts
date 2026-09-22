/**
 * Place data for the delivery and contact fields.
 *
 * Nigeria is seeded properly — all 36 states plus the FCT, each with its
 * real cities — because that is where the business operates. Every other
 * country falls back to free text, so nobody is ever blocked by a list
 * that does not have their town in it.
 */

export type Country = {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** International dialling prefix, with the plus. */
  dial: string;
  /** Rough national-number length, used only to help formatting hints. */
  example?: string;
};

export const DEFAULT_COUNTRY = "NG";

export const COUNTRIES: Country[] = [
  { code: "NG", name: "Nigeria", dial: "+234", example: "801 234 5678" },
  { code: "GH", name: "Ghana", dial: "+233", example: "24 123 4567" },
  { code: "KE", name: "Kenya", dial: "+254", example: "712 345678" },
  { code: "ZA", name: "South Africa", dial: "+27", example: "71 123 4567" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "BJ", name: "Benin", dial: "+229" },
  { code: "CM", name: "Cameroon", dial: "+237" },
  { code: "CI", name: "Côte d'Ivoire", dial: "+225" },
  { code: "TG", name: "Togo", dial: "+228" },
  { code: "NE", name: "Niger", dial: "+227" },
  { code: "TD", name: "Chad", dial: "+235" },
  { code: "SN", name: "Senegal", dial: "+221" },
  { code: "ML", name: "Mali", dial: "+223" },
  { code: "BF", name: "Burkina Faso", dial: "+226" },
  { code: "GN", name: "Guinea", dial: "+224" },
  { code: "SL", name: "Sierra Leone", dial: "+232" },
  { code: "LR", name: "Liberia", dial: "+231" },
  { code: "GM", name: "Gambia", dial: "+220" },
  { code: "CV", name: "Cabo Verde", dial: "+238" },
  { code: "GW", name: "Guinea-Bissau", dial: "+245" },
  { code: "MR", name: "Mauritania", dial: "+222" },
  { code: "MA", name: "Morocco", dial: "+212" },
  { code: "DZ", name: "Algeria", dial: "+213" },
  { code: "TN", name: "Tunisia", dial: "+216" },
  { code: "LY", name: "Libya", dial: "+218" },
  { code: "SD", name: "Sudan", dial: "+249" },
  { code: "ET", name: "Ethiopia", dial: "+251" },
  { code: "SO", name: "Somalia", dial: "+252" },
  { code: "DJ", name: "Djibouti", dial: "+253" },
  { code: "ER", name: "Eritrea", dial: "+291" },
  { code: "UG", name: "Uganda", dial: "+256" },
  { code: "TZ", name: "Tanzania", dial: "+255" },
  { code: "RW", name: "Rwanda", dial: "+250" },
  { code: "BI", name: "Burundi", dial: "+257" },
  { code: "CD", name: "DR Congo", dial: "+243" },
  { code: "CG", name: "Congo", dial: "+242" },
  { code: "GA", name: "Gabon", dial: "+241" },
  { code: "GQ", name: "Equatorial Guinea", dial: "+240" },
  { code: "CF", name: "Central African Republic", dial: "+236" },
  { code: "AO", name: "Angola", dial: "+244" },
  { code: "ZM", name: "Zambia", dial: "+260" },
  { code: "ZW", name: "Zimbabwe", dial: "+263" },
  { code: "MW", name: "Malawi", dial: "+265" },
  { code: "MZ", name: "Mozambique", dial: "+258" },
  { code: "BW", name: "Botswana", dial: "+267" },
  { code: "NA", name: "Namibia", dial: "+264" },
  { code: "LS", name: "Lesotho", dial: "+266" },
  { code: "SZ", name: "Eswatini", dial: "+268" },
  { code: "MG", name: "Madagascar", dial: "+261" },
  { code: "MU", name: "Mauritius", dial: "+230" },
  { code: "SC", name: "Seychelles", dial: "+248" },
  { code: "ST", name: "São Tomé and Príncipe", dial: "+239" },
  { code: "SS", name: "South Sudan", dial: "+211" },

  // Major trading partners and import routes
  { code: "CN", name: "China", dial: "+86" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "QA", name: "Qatar", dial: "+974" },
  { code: "TR", name: "Türkiye", dial: "+90" },
  { code: "GB", name: "United Kingdom", dial: "+44", example: "7400 123456" },
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "US", name: "United States", dial: "+1", example: "201 555 0123" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "BE", name: "Belgium", dial: "+32" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "PL", name: "Poland", dial: "+48" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "KR", name: "South Korea", dial: "+82" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "MY", name: "Malaysia", dial: "+60" },
  { code: "ID", name: "Indonesia", dial: "+62" },
  { code: "TH", name: "Thailand", dial: "+66" },
  { code: "VN", name: "Vietnam", dial: "+84" },
  { code: "PK", name: "Pakistan", dial: "+92" },
  { code: "BD", name: "Bangladesh", dial: "+880" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "MX", name: "Mexico", dial: "+52" },
];

export const COUNTRY_NAMES = COUNTRIES.map((c) => c.name);

export function countryByName(name: string): Country | undefined {
  return COUNTRIES.find((c) => c.name === name);
}

export function dialFor(countryName: string): string {
  return countryByName(countryName)?.dial ?? "+234";
}

/* ------------------------------------------------------------------ */
/* Nigeria — every state and the FCT, with their real cities           */
/* ------------------------------------------------------------------ */

export const NIGERIA_STATES: Record<string, string[]> = {
  Abia: ["Umuahia", "Aba", "Ohafia", "Arochukwu", "Bende", "Isiala Ngwa"],
  Adamawa: ["Yola", "Jimeta", "Mubi", "Numan", "Ganye", "Gombi"],
  "Akwa Ibom": ["Uyo", "Eket", "Ikot Ekpene", "Oron", "Abak", "Ikot Abasi"],
  Anambra: ["Awka", "Onitsha", "Nnewi", "Ekwulobia", "Ihiala", "Ogidi"],
  Bauchi: ["Bauchi", "Azare", "Misau", "Jama'are", "Katagum", "Ningi"],
  Bayelsa: ["Yenagoa", "Ogbia", "Sagbama", "Brass", "Nembe", "Ekeremor"],
  Benue: ["Makurdi", "Gboko", "Otukpo", "Katsina-Ala", "Vandeikya", "Adikpo"],
  Borno: ["Maiduguri", "Biu", "Bama", "Monguno", "Dikwa", "Gwoza"],
  "Cross River": ["Calabar", "Ugep", "Ikom", "Ogoja", "Obudu", "Akamkpa"],
  Delta: ["Asaba", "Warri", "Sapele", "Ughelli", "Agbor", "Effurun", "Oleh"],
  Ebonyi: ["Abakaliki", "Afikpo", "Onueke", "Ezzamgbo", "Ishieke"],
  Edo: ["Benin City", "Auchi", "Ekpoma", "Uromi", "Igarra", "Irrua"],
  Ekiti: ["Ado-Ekiti", "Ikere-Ekiti", "Ikole-Ekiti", "Oye-Ekiti", "Efon-Alaaye"],
  Enugu: ["Enugu", "Nsukka", "Agbani", "Awgu", "Oji River", "Udi"],
  Gombe: ["Gombe", "Kumo", "Billiri", "Dukku", "Kaltungo", "Bajoga"],
  Imo: ["Owerri", "Orlu", "Okigwe", "Mbaise", "Oguta", "Mbano"],
  Jigawa: ["Dutse", "Hadejia", "Gumel", "Birnin Kudu", "Kazaure", "Ringim"],
  Kaduna: ["Kaduna", "Zaria", "Kafanchan", "Zonkwa", "Sabon Gari", "Kachia"],
  Kano: ["Kano", "Wudil", "Gaya", "Bichi", "Rano", "Dawakin Kudu"],
  Katsina: ["Katsina", "Funtua", "Daura", "Malumfashi", "Dutsin-Ma", "Kankia"],
  Kebbi: ["Birnin Kebbi", "Argungu", "Yauri", "Zuru", "Jega", "Koko"],
  Kogi: ["Lokoja", "Okene", "Idah", "Kabba", "Ankpa", "Egbe"],
  Kwara: ["Ilorin", "Offa", "Omu-Aran", "Jebba", "Lafiagi", "Patigi"],
  Lagos: [
    "Ikeja",
    "Victoria Island",
    "Lekki",
    "Ajah",
    "Apapa",
    "Surulere",
    "Yaba",
    "Ikorodu",
    "Badagry",
    "Epe",
    "Alimosho",
    "Oshodi",
    "Agege",
    "Festac",
    "Ojota",
    "Mushin",
    "Isolo",
    "Ilupeju",
    "Gbagada",
    "Magodo",
    "Ipaja",
    "Ojo",
  ],
  Nasarawa: ["Lafia", "Keffi", "Akwanga", "Karu", "Nasarawa", "Doma"],
  Niger: ["Minna", "Suleja", "Bida", "Kontagora", "Lapai", "New Bussa"],
  Ogun: ["Abeokuta", "Ijebu-Ode", "Sagamu", "Ota", "Ifo", "Ilaro", "Ayetoro"],
  Ondo: ["Akure", "Ondo", "Owo", "Ikare", "Okitipupa", "Ore"],
  Osun: ["Osogbo", "Ile-Ife", "Ilesa", "Ede", "Iwo", "Ikirun"],
  Oyo: ["Ibadan", "Ogbomoso", "Oyo", "Iseyin", "Saki", "Eruwa"],
  Plateau: ["Jos", "Bukuru", "Pankshin", "Shendam", "Barkin Ladi", "Langtang"],
  Rivers: ["Port Harcourt", "Obio-Akpor", "Bonny", "Eleme", "Okrika", "Ahoada"],
  Sokoto: ["Sokoto", "Tambuwal", "Bodinga", "Illela", "Wurno", "Gwadabawa"],
  Taraba: ["Jalingo", "Wukari", "Bali", "Takum", "Gembu", "Ibi"],
  Yobe: ["Damaturu", "Potiskum", "Gashua", "Nguru", "Geidam", "Buni Yadi"],
  Zamfara: ["Gusau", "Kaura Namoda", "Talata Mafara", "Anka", "Bungudu"],
  "Federal Capital Territory": [
    "Abuja",
    "Abuja (Central)",
    "Garki",
    "Wuse",
    "Maitama",
    "Asokoro",
    "Gwarinpa",
    "Kubwa",
    "Lugbe",
    "Nyanya",
    "Gwagwalada",
    "Kuje",
    "Jabi",
    "Utako",
    "Karu (FCT)",
  ],
};

export const NIGERIA_STATE_NAMES = Object.keys(NIGERIA_STATES).sort((a, b) =>
  a.localeCompare(b),
);

/** States for a country. Empty array means "we have no list — free text". */
export function statesFor(countryName: string): string[] {
  return countryName === "Nigeria" ? NIGERIA_STATE_NAMES : [];
}

/** Cities for a state. Empty array means "we have no list — free text". */
export function citiesFor(countryName: string, state: string): string[] {
  if (countryName !== "Nigeria") return [];
  return NIGERIA_STATES[state] ?? [];
}

/* ------------------------------------------------------------------ */
/* Vendor coverage areas                                               */
/* ------------------------------------------------------------------ */

/**
 * Where a merchant can deliver: every Nigerian state, plus the two
 * shortcuts merchants actually use.
 */
export const COVERAGE_AREAS: string[] = [
  "Nationwide (Nigeria)",
  ...NIGERIA_STATE_NAMES,
  "Import / outside Nigeria",
];
