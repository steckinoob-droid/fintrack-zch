import type { Category } from "@/lib/types";

/**
 * Normalize: lowercase + remove accents + replace ALL non-alphanumeric with space.
 * "UBER *PARANA" → "uber parana", "99TAXI" → "99taxi"
 */
function norm(s: string): string {
  if (!s) return "";
  try {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")   // strip combining accents
      .replace(/[^a-z0-9]+/g, " ")        // replace non-alphanumeric with space
      .trim();
  } catch {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
}

/**
 * Checks if `text` contains `kw` as a standalone word
 * (space-bounded on both sides, or at string start/end).
 * Handles: "UBER *TRIP" → "uber trip" matches keyword "uber" ✓
 */
function hasWord(text: string, kw: string): boolean {
  const t = " " + norm(text) + " ";
  const k = " " + norm(kw) + " ";
  return k.trim().length > 0 && t.includes(k);
}

/**
 * Checks if `text` contains `kw` as a substring anywhere.
 * Useful for brand-prefix keywords like "99taxi", "bradesco".
 */
function hasSub(text: string, kw: string): boolean {
  const t = norm(text);
  const k = norm(kw);
  return k.length > 0 && t.includes(k);
}

// ---------------------------------------------------------------------------
// TYPE DETECTION — income vs expense based on title alone
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

/**
 * Suggest transaction type from the title text alone.
 * Returns null when not confident enough to avoid wrong guesses.
 */
export function suggestType(title: string): "income" | "expense" | null {
  try {
    if (!title) return null;
    const t = norm(title);
    for (const sig of INCOME_SIGNALS) {
      if (t.includes(norm(sig))) return "income";
    }
    for (const sig of EXPENSE_SIGNALS) {
      if (t.includes(norm(sig))) return "expense";
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CATEGORY RULES
// words: keywords to look for in the transaction title (matched as words or substrings)
// hints: substrings that should match against user's category names
// wordOnly: if true, match whole word only (default false = substring match)
// ---------------------------------------------------------------------------

interface Rule {
  words: string[];
  hints: string[];
  wordOnly?: boolean;
}

const RULES: Rule[] = [
  // ── FOOD DELIVERY ──────────────────────────────────────────────────────────
  {
    words: ["ifood", "rappi", "uber eats", "ubereats", "james delivery", "delivery much",
            "loggi", "entrega", "pedido", "get ninjas"],
    hints: ["alimenta", "delivery", "comida", "food", "refeicao"],
  },
  // ── SUPERMARKET / GROCERY ──────────────────────────────────────────────────
  {
    words: ["mercado", "supermercado", "carrefour", "atacadao", "atacado",
            "pao de acucar", "extra hipermercado", "varejao", "hortifruti",
            "aldi", "lidl", "dia", "assai", "savegnago", "bistek",
            "quitanda", "verdureiro", "feira", "mini mercado", "mercearia"],
    hints: ["alimenta", "mercado", "supermercado", "comida", "grocery"],
  },
  // ── RESTAURANTS / FOOD ─────────────────────────────────────────────────────
  {
    words: ["restaurante", "rest ", "lanchonete", "padaria", "pizzaria",
            "sushi", "hamburguer", "burger", "churrasco", "cafe", "bistro",
            "pastelaria", "doceria", "confeitaria", "sorvete", "sorveteria",
            "acai", "tapioca", "crepe", "bk ", "mcdonalds", "mc donald",
            "bob s", "subway", "kfc ", "girafas", "madero", "outback",
            "coxinha", "salgado", "marmita"],
    hints: ["alimenta", "restaurante", "comida", "refeicao", "lanches"],
  },
  // ── TRANSPORT / RIDESHARE ──────────────────────────────────────────────────
  {
    words: ["uber", "99", "99pop", "99app", "99taxi", "99 tecnologia",
            "cabify", "buser", "indriver", "ladydriver",
            "onibus", "metro", "trem", "vlt", "brt", "bus", "passagem",
            "bilhete unico", "sptrans", "cartao transporte", "metrô"],
    hints: ["transporte", "mobilidade", "locomocao", "transito"],
  },
  // ── FUEL / GAS ─────────────────────────────────────────────────────────────
  {
    words: ["posto", "gasolina", "combustivel", "alcool", "etanol",
            "shell", "ipiranga", "petrobras", "br distribuidora",
            "ale combustiveis", "vibra energia"],
    hints: ["transporte", "combustivel", "carro", "veiculo", "auto"],
  },
  // ── PARKING ────────────────────────────────────────────────────────────────
  {
    words: ["estacionamento", "estacion", "parking", "rotativo",
            "zona azul", "veloe", "sem parar", "conect car", "move mais"],
    hints: ["transporte", "estacionamento", "carro", "veiculo"],
  },
  // ── STREAMING ──────────────────────────────────────────────────────────────
  {
    words: ["netflix", "spotify", "amazon prime", "prime video",
            "disney", "hbo max", "globoplay", "youtube premium",
            "apple tv", "apple music", "deezer", "crunchyroll",
            "mubi", "paramount", "star plus", "telecine", "looke",
            "claro video", "amazon music", "tidal"],
    hints: ["lazer", "entretenim", "streaming", "assinatura", "subscri"],
  },
  // ── LEISURE / EVENTS ───────────────────────────────────────────────────────
  {
    words: ["cinema", "teatro", "show", "ingresso", "ticketmaster",
            "sympla", "eventbrite", "ticketfácil", "tickets",
            "parque", "zoologico", "aquario", "museu"],
    hints: ["lazer", "entretenim", "cultura", "eventos", "show"],
  },
  // ── PHARMACY ───────────────────────────────────────────────────────────────
  {
    words: ["farmacia", "drogaria", "droga", "ultrafarma", "panvel",
            "pacheco", "nissei", "raia", "drogasil", "onofre",
            "bifarma", "extrafarma", "pague menos", "drogaria sao paulo"],
    hints: ["saude", "farmacia", "health", "remedios"],
  },
  // ── GYM / SPORTS ───────────────────────────────────────────────────────────
  {
    words: ["academia", "smartfit", "bluefit", "bodytech", "bio ritmo",
            "crossfit", "pilates", "yoga", "natacao", "futebol",
            "musculacao", "spin", "spinning", "boxe", "jiujitsu",
            "muay thai", "personal", "treino"],
    hints: ["saude", "academia", "fitness", "esporte", "sport"],
  },
  // ── HEALTH / MEDICAL ───────────────────────────────────────────────────────
  {
    words: ["hospital", "clinica", "dentista", "odontologo",
            "medico", "laboratorio", "exame", "consulta",
            "ortopedista", "oftalmo", "cardiologista", "psicólogo",
            "psicologo", "terapia", "cirurgia", "pronto socorro",
            "ubs ", "sus ", "amil ", "unimed", "hapvida",
            "notredame", "bradesco saude"],
    hints: ["saude", "medico", "health", "clinica"],
  },
  // ── HOUSING / UTILITIES ────────────────────────────────────────────────────
  {
    words: ["aluguel", "condominio", "iptu", "energia eletrica",
            "enel", "cpfl", "cemig", "coelba", "celpe", "cosern",
            "sabesp", "sanepar", "copasa", "caesb", "embasa",
            "gas encanado", "comgas", "gas natural"],
    hints: ["moradia", "casa", "housing", "aluguel", "utilidades"],
  },
  // ── TELECOM / INTERNET ─────────────────────────────────────────────────────
  {
    words: ["internet", "banda larga", "fibra",
            "vivo", "claro", "tim", "oi ", "nextel", "algar",
            "celular", "telefone", "plano celular", "recarga", "chip"],
    hints: ["servico", "telefone", "comunicacao", "utilidades", "internet"],
  },
  // ── EDUCATION ──────────────────────────────────────────────────────────────
  {
    words: ["escola", "colegio", "faculdade", "universidade",
            "mensalidade escolar", "mensalidade", "matricula",
            "curso", "aula", "udemy", "coursera", "alura",
            "rocketseat", "dio ", "duolingo", "khan", "livro",
            "apostila", "material escolar", "papelaria"],
    hints: ["educacao", "escola", "aprendizado", "education"],
  },
  // ── INCOME (salary, freelance) ─────────────────────────────────────────────
  {
    words: ["salario", "salário", "pagamento salario", "holerite",
            "freelance", "honorario", "mei", "pj ", "renda"],
    hints: ["salario", "renda", "trabalho", "receita", "income"],
  },
  // ── INSURANCE / HEALTH PLAN ────────────────────────────────────────────────
  {
    words: ["seguro", "plano de saude", "plano saude", "convenio",
            "odontologico", "seguro auto", "seguro vida",
            "porto seguro", "sulamerica", "bradesco seguros"],
    hints: ["seguro", "plano", "saude"],
  },
  // ── CLOTHING / FASHION ─────────────────────────────────────────────────────
  {
    words: ["roupa", "vestuario", "zara", "renner", "riachuelo",
            "hm", "shein", "cea", "c a", "marisa", "centauro",
            "decathlon", "netshoes", "reserva", "ellus", "brooksfield"],
    hints: ["roupa", "vestuario", "moda", "compras"],
  },
  // ── ONLINE SHOPPING ────────────────────────────────────────────────────────
  {
    words: ["amazon", "mercado livre", "magazine luiza", "magalu",
            "americanas", "casas bahia", "shopee", "aliexpress",
            "kabum", "terabyte", "ponto frio", "fast shop",
            "submarino", "carrefour market", "extra com"],
    hints: ["compras", "online", "shopping", "eletronico"],
  },
  // ── BANKING FEES / CREDIT CARD ─────────────────────────────────────────────
  {
    words: ["anuidade", "tarifa bancaria", "tarifa", "iof",
            "taxa administrativa", "taxa manutencao", "cpmf",
            "juros cartao", "multa", "cobranca"],
    hints: ["taxa", "banco", "financeiro", "cartao"],
  },
  // ── TRAVEL ─────────────────────────────────────────────────────────────────
  {
    words: ["decolar", "123milhas", "maxmilhas", "voegol", "latam", "azul",
            "voepass", "aeroporto", "passagem aerea", "hotel",
            "booking", "airbnb", "hostel", "pousada", "resort"],
    hints: ["viagem", "turismo", "lazer", "transporte"],
  },
  // ── PET ────────────────────────────────────────────────────────────────────
  {
    words: ["pet shop", "veterinario", "racao", "cobasi", "petz",
            "banho tosa", "vacina pet"],
    hints: ["pet", "animal", "saude"],
  },
];

/**
 * Given a transaction title and a list of categories (pre-filtered by type),
 * returns the best matching category or null if no match found.
 * Wrapped in try/catch — never throws.
 */
export function suggestCategory(title: string, categories: Category[]): Category | null {
  try {
    if (!title || !categories.length) return null;
    const t = norm(title);

    for (const rule of RULES) {
      const matched = rule.words.some(w => {
        const kw = norm(w);
        if (!kw) return false;
        // Word boundary check: pad with spaces
        return (" " + t + " ").includes(" " + kw + " ");
      });

      if (matched) {
        const cat = categories.find(c => {
          const cn = norm(c.name ?? "");
          return rule.hints.some(h => {
            const hn = norm(h);
            return cn.includes(hn) || hn.includes(cn.slice(0, 5));
          });
        });
        if (cat) return cat;
      }
    }
    return null;
  } catch {
    return null;
  }
}
