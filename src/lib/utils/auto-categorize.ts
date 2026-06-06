import type { Category } from "@/lib/types";

/**
 * Lowercase + strip accents + replace non-alphanumeric with single space.
 * "UBER *PARANA" → "uber parana"
 * "99TAXI"       → "99taxi"
 * "AMAZON.COM.BR"→ "amazon com br"
 */
function norm(s: string): string {
  if (!s) return "";
  try {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  } catch {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
}

// ---------------------------------------------------------------------------
// TYPE DETECTION  (income / expense from title alone)
// ---------------------------------------------------------------------------

const INCOME_SIGNALS = [
  "salario", "salario liquido", "pagamento salario",
  "pix recebido", "pix receb", "cred pix", "credito pix",
  "ted recebida", "ted credito", "tef credito",
  "deposito", "deposito em conta",
  "transferencia recebida", "transf recebida", "transf credito",
  "rendimento", "rendimentos", "dividendo", "juros recebidos",
  "estorno", "reembolso", "devolucao", "cashback",
  "receita", "renda extra", "honorario recebido", "freelance",
  "bonus", "13 salario", "ferias", "rescisao",
  "venda", "venda marketplace", "venda mercado livre",
  "credito em conta", "lancamento credito",
];

const EXPENSE_SIGNALS = [
  "pix enviado", "pix envi", "deb pix",
  "ted enviada", "ted debito", "tef debito",
  "saque", "saque caixa", "saque 24h",
  "transferencia enviada", "transf enviada", "transf debito",
  "compra", "compra debito", "compra credito", "compra online",
  "pagamento", "pgt", "pgto",
  "fatura", "debito automatico", "debito aut",
  "anuidade", "tarifa", "taxa",
  "lancamento debito",
];

export function suggestType(title: string): "income" | "expense" | null {
  try {
    if (!title) return null;
    const t = norm(title);
    for (const sig of INCOME_SIGNALS) if (t.includes(norm(sig))) return "income";
    for (const sig of EXPENSE_SIGNALS) if (t.includes(norm(sig))) return "expense";
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CATEGORY MATCHING
// ---------------------------------------------------------------------------

interface Rule {
  /** Match as whole word (space-bounded) in the normalized transaction title */
  words?: string[];
  /** Match as substring anywhere in the normalized transaction title */
  subs?: string[];
  /** Keywords checked against the user's category names (bidirectional) */
  cats: string[];
}

const RULES: Rule[] = [
  // ── TRANSPORT / RIDESHARE ──────────────────────────────────────────────────
  {
    words: [
      "uber", "99", "cabify", "buser", "indriver", "onibus", "metro", "trem",
      "vlt", "brt", "passagem", "bilhete", "sptrans", "bus", "metrô",
      "ladydriver", "shopper",
    ],
    subs: [
      "99app", "99pop", "99taxi", "99tecnol", "99techno",
      "ubertecnol", "ubereats", "uberdo", "uberbrasil", "ubermoto",
    ],
    cats: [
      "transporte", "mobilidade", "locomocao", "uber", "taxi", "onibus",
      "corrida", "deslocamento", "veiculo", "carro", "transito", "passagem",
      "metro", "aplicativo", "rideshare",
    ],
  },

  // ── FOOD DELIVERY ──────────────────────────────────────────────────────────
  {
    words: [
      "ifood", "rappi", "loggi", "delivery", "james", "getninjas",
    ],
    subs: [
      "ifood", "rappi", "deliverymuch", "jamesdelivery", "ubereat",
    ],
    cats: [
      "alimenta", "delivery", "comida", "food", "refeicao",
      "lanches", "restaurante", "pedido",
    ],
  },

  // ── SUPERMARKET / GROCERY ──────────────────────────────────────────────────
  {
    words: [
      "mercado", "supermercado", "hipermercado", "atacado", "atacadao",
      "varejao", "feira", "hortifruti", "quitanda", "mercearia",
      "aldi", "assai", "bistek", "savegnago",
    ],
    subs: [
      "paodeacucar", "extrahiper", "minimercado", "supermercad",
      "carrefour", "atacadao",
    ],
    cats: [
      "alimenta", "mercado", "supermercado", "comida", "grocery", "mantimento",
    ],
  },

  // ── RESTAURANTS / FAST FOOD ────────────────────────────────────────────────
  // Catches: "Azeitona Culinaria Arabe", "Restaurante Italiano", etc.
  {
    words: [
      "restaurante", "lanchonete", "padaria", "pizzaria", "hamburger", "burger",
      "churrasco", "cafe", "bistro", "sorvete", "sorveteria", "acai", "tapioca",
      "sushi", "salgado", "marmita", "crepe", "pastelaria", "doceria",
      "confeitaria", "subway", "outback", "madero", "girafas", "kfc",
      // Tipos culinários comuns em nomes de restaurantes
      "culinaria", "cozinha", "gastronomia", "grill", "gourmet",
      "arabe", "japones", "italiana", "italiano", "chines", "chinesa",
      "mexicano", "mexicana", "grego", "grecia", "indiano", "tailandes",
      "peruano", "coreano", "turco", "libanes", "argentino", "nordestina",
      "baiana", "mineira", "portuguesa",
      // Tipos de estabelecimento
      "espetinho", "churrascaria", "bistrô", "taberna", "tasca",
      "cantina", "trattoria", "tratoria", "esfiharia", "esfiha",
      "kebab", "shawarma", "temaki", "yakisoba", "temakeria",
      "acaiteria", "smoothie", "sucos", "lanches",
    ],
    subs: [
      "mcdonalds", "mcdonald", "bobsburger", "bobs",
      "burguerking", "burgerking", "burgerme",
    ],
    cats: [
      "alimenta", "restaurante", "comida", "refeicao", "lanches",
      "gastronomia", "lanche",
    ],
  },

  // ── BEAUTY / PERSONAL CARE ─────────────────────────────────────────────────
  // Catches: "MI Produtos De Beleza", "Salão Da Mari", "Studio Unhas"
  {
    words: [
      "beleza", "estetica", "salao", "cabeleireiro", "cabeleireira",
      "barbearia", "barber", "manicure", "pedicure", "depilacao",
      "unhas", "maquiagem", "makeup", "spa", "nail", "lashes",
      "micropigmentacao", "sobrancelha", "botox", "harmonizacao",
      "cosmetico", "perfumaria", "perfume", "moda intima",
    ],
    subs: [
      "produtosbeleza", "beleza", "estetica", "barber",
      "naildesign", "studiounhas", "clinicaestetica",
    ],
    cats: [
      "beleza", "estetica", "cuidados", "cosmetico", "pessoal",
      "higiene", "bem estar",
    ],
  },

  // ── FUEL / GAS ─────────────────────────────────────────────────────────────
  {
    words: [
      "posto", "gasolina", "combustivel", "alcool", "etanol",
      "shell", "ipiranga",
    ],
    subs: [
      "petrobras", "brdistrib", "vibra", "alecombust",
    ],
    cats: [
      "combustivel", "transporte", "carro", "veiculo", "auto",
      "gasolina", "posto", "abastecimento",
    ],
  },

  // ── PARKING ────────────────────────────────────────────────────────────────
  {
    words: ["estacionamento", "parking", "rotativo"],
    subs: ["zonaazul", "semparar", "conectcar", "movemais", "veloe"],
    cats: [
      "estacionamento", "transporte", "carro", "parking", "vaga",
    ],
  },

  // ── STREAMING ──────────────────────────────────────────────────────────────
  {
    words: ["netflix", "spotify", "disney", "hbo", "deezer", "crunchyroll", "mubi", "tidal"],
    subs: [
      "netflix", "spotify", "globoplay", "youtubepremi", "appletv",
      "applemusic", "amazonprime", "primevideo", "starplus",
      "telecine", "looke", "paramountplus", "discoverplus",
    ],
    cats: [
      "streaming", "assinatura", "lazer", "entretenim", "subscri",
      "musica", "video", "series", "filmes",
    ],
  },

  // ── SUBSCRIPTIONS (non-streaming) ──────────────────────────────────────────
  {
    words: [
      "assinatura", "mensalidade", "adobe", "dropbox",
      "notion", "canva", "figma", "github", "chatgpt", "openai",
      "antivirus", "norton", "kaspersky", "icloud",
    ],
    subs: [
      "microsoftsubs", "microsoft365", "office365", "googledrive",
      "googleone", "googleplay",
    ],
    cats: [
      "assinatura", "subscri", "servico", "streaming", "lazer",
    ],
  },

  // ── LEISURE / EVENTS ───────────────────────────────────────────────────────
  {
    words: [
      "cinema", "teatro", "show", "ingresso", "parque",
      "museu", "zoologico", "aquario",
    ],
    subs: ["ticketmaster", "sympla", "eventbrite", "ticketfacil"],
    cats: [
      "lazer", "entretenim", "cultura", "eventos", "recreacao",
      "diversao",
    ],
  },

  // ── PHARMACY ───────────────────────────────────────────────────────────────
  {
    words: ["farmacia", "drogaria", "droga"],
    subs: [
      "ultrafarma", "panvel", "pacheco", "nissei", "raia",
      "drogasil", "onofre", "bifarma", "extrafarma", "paguemenos",
      "farmac",
    ],
    cats: [
      "saude", "farmacia", "remedios", "medicamento", "health",
    ],
  },

  // ── GYM / FITNESS ──────────────────────────────────────────────────────────
  {
    words: [
      "academia", "smartfit", "bluefit", "bodytech", "crossfit",
      "pilates", "yoga", "natacao", "boxe", "treino", "spinning",
      "musculacao", "muaythai", "funcional",
    ],
    subs: ["bioritmo", "jiujitsu", "bioativi"],
    cats: [
      "saude", "academia", "fitness", "esporte", "gym", "exercicio",
    ],
  },

  // ── HEALTH / MEDICAL ───────────────────────────────────────────────────────
  {
    words: [
      "hospital", "clinica", "dentista", "medico", "laboratorio",
      "exame", "consulta", "psicologo", "terapia", "cirurgia",
      "unimed", "hapvida", "amil", "pronto socorro",
    ],
    subs: ["notredame", "bradescosaude", "sulamerica", "prontosocc"],
    cats: [
      "saude", "medico", "health", "clinica", "consultorio",
      "odontol", "plano", "convenio",
    ],
  },

  // ── HOUSING / UTILITIES ────────────────────────────────────────────────────
  {
    words: [
      "aluguel", "condominio", "iptu", "enel", "cpfl", "cemig",
      "coelba", "celpe", "sabesp", "sanepar", "copasa", "comgas",
    ],
    subs: ["energiaelet", "gasnatural", "aguaesgoto"],
    cats: [
      "moradia", "casa", "aluguel", "condominio", "utilidades",
      "energia", "agua", "luz", "gas", "fixo", "housing",
    ],
  },

  // ── TELECOM / INTERNET ─────────────────────────────────────────────────────
  {
    words: [
      "vivo", "nextel", "algar", "celular", "telefone", "recarga", "internet",
    ],
    // "claro" e "tim" têm substrings longas pra evitar falso positivo em nomes
    subs: ["claro br", "timcelular", "tim br", "bandalarga", "fibra", "planocel"],
    cats: [
      "telefone", "telecom", "comunicacao", "internet", "celular",
      "utilidades", "plano",
    ],
  },

  // ── EDUCATION ──────────────────────────────────────────────────────────────
  {
    words: [
      "escola", "colegio", "faculdade", "universidade", "mensalidade",
      "matricula", "curso", "aula", "udemy", "coursera", "alura", "duolingo",
    ],
    subs: ["rocketseat", "livro", "apostila", "escolari"],
    cats: [
      "educacao", "escola", "aprendizado", "ensino", "estudo", "formacao",
    ],
  },

  // ── CLOTHING / FASHION ─────────────────────────────────────────────────────
  {
    words: [
      "zara", "renner", "riachuelo", "shein", "marisa",
      "netshoes", "reserva", "ellus", "decathlon", "centauro",
      "roupa", "vestuario", "calcado", "tenis", "sapato",
    ],
    subs: ["brooksfield", "lojarenner", "marisa"],
    cats: [
      "roupa", "vestuario", "moda", "fashion", "roupas", "calcado",
    ],
  },

  // ── ONLINE SHOPPING ────────────────────────────────────────────────────────
  {
    words: [
      "amazon", "shopee", "aliexpress", "kabum", "americanas", "magalu",
    ],
    subs: [
      "mercadolivre", "magazineluiza", "casasbahia", "pontofrio",
      "fastshop", "submarino", "terabyte",
    ],
    cats: [
      "compras", "online", "shopping", "eletronico", "loja",
    ],
  },

  // ── BANKING FEES ───────────────────────────────────────────────────────────
  {
    words: ["anuidade", "iof", "juros", "multa", "tarifa", "cpmf"],
    subs: ["taxaadm", "taxamanut", "tarifabanc"],
    cats: [
      "taxa", "banco", "financeiro", "cartao", "tarifa", "bancario",
    ],
  },

  // ── TRAVEL ─────────────────────────────────────────────────────────────────
  {
    words: [
      "hotel", "pousada", "hostel", "resort", "aeroporto",
      "latam", "gol", "azul",
    ],
    subs: [
      "decolar", "123milhas", "maxmilhas", "voegol", "voepass",
      "booking", "airbnb",
    ],
    cats: [
      "viagem", "turismo", "hospedagem", "hotel", "passagem", "aerea",
    ],
  },

  // ── PET ────────────────────────────────────────────────────────────────────
  {
    words: ["veterinario", "veterinaria", "racao", "cobasi", "petz"],
    subs: ["petshop", "banhotosa", "vacinapet"],
    cats: ["pet", "animal", "veterinario", "bicho", "cachorro", "gato"],
  },

  // ── INSURANCE ──────────────────────────────────────────────────────────────
  {
    words: ["seguro", "convenio", "odontologico"],
    subs: ["portoseguro", "sulamerica", "bradescoseg"],
    cats: ["seguro", "plano", "saude", "protecao"],
  },

  // ── SALARY / INCOME ────────────────────────────────────────────────────────
  {
    words: ["salario", "holerite", "freelance", "honorario", "renda", "mei"],
    subs: [],
    cats: [
      "salario", "renda", "trabalho", "receita", "income", "remuneracao",
    ],
  },
];

// ---------------------------------------------------------------------------
// CATEGORY MATCHING ENGINE
// ---------------------------------------------------------------------------

/**
 * Check if a category name semantically matches any of the given hint keywords.
 * Strategy (in order):
 *  1. Bidirectional substring: "transporte" ⊂ "transporte e mobilidade" → match
 *  2. Word-level: any word in category name starts the same as any hint word
 *  3. Reversed: hint is a prefix of the category name (covers abbreviations)
 */
function categoryMatches(catName: string, catHints: string[]): boolean {
  const cn = norm(catName);
  if (!cn) return false;

  for (const hint of catHints) {
    const h = norm(hint);
    if (!h || h.length < 3) continue;

    // 1. Direct bidirectional substring
    if (cn.includes(h) || h.includes(cn)) return true;

    // 2. Word-level match (each word ≥ 4 chars)
    const cnWords = cn.split(" ").filter((w) => w.length >= 4);
    const hWords  = h.split(" ").filter((w) => w.length >= 4);
    if (
      cnWords.some((cw) =>
        hWords.some((hw) => cw.startsWith(hw) || hw.startsWith(cw))
      )
    )
      return true;
  }
  return false;
}

/**
 * Given a transaction title and a list of categories (pre-filtered by type),
 * returns the best matching category or null.
 *
 * Algorithm:
 *  1. Rule-based: check title keywords → find matching category via hints
 *  2. Direct fallback: meaningful title words matched directly against
 *     category names (catches custom categories like "Corridas Uber")
 *
 * Wrapped in try/catch — never throws.
 */
export function suggestCategory(
  title: string,
  categories: Category[]
): Category | null {
  try {
    if (!title || !categories.length) return null;
    const t      = norm(title);
    const padded = " " + t + " ";

    // ── Phase 1: Rule-based ──────────────────────────────────────────────────
    for (const rule of RULES) {
      let matched = false;

      // a) Whole-word match (space-bounded)
      if (
        !matched &&
        rule.words?.some((w) => {
          const k = norm(w);
          return k.length > 0 && padded.includes(" " + k + " ");
        })
      )
        matched = true;

      // b) Substring match (for compound brand names like "99taxi", "mcdonalds")
      if (
        !matched &&
        rule.subs?.some((w) => {
          const k = norm(w);
          return k.length >= 3 && t.includes(k);
        })
      )
        matched = true;

      if (matched) {
        const cat = categories.find((c) =>
          categoryMatches(c.name ?? "", rule.cats)
        );
        if (cat) return cat;
      }
    }

    // ── Phase 2: Direct title → category name fallback ───────────────────────
    // Useful when user has custom categories (e.g. "Corridas", "Streaming")
    // Extract meaningful words (≥5 chars) from the title and match against names
    const titleWords = t.split(" ").filter((w) => w.length >= 5);
    for (const word of titleWords) {
      const cat = categories.find((c) => {
        const cn = norm(c.name ?? "");
        return cn.includes(word) || word.includes(cn);
      });
      if (cat) return cat;
    }

    return null;
  } catch {
    return null;
  }
}
