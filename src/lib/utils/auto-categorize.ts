import type { Category } from "@/lib/types";

/** Remove diacritics safely: "Descrição" → "descricao" */
function norm(s: string): string {
  if (!s) return "";
  try {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  } catch {
    return s.toLowerCase();
  }
}

// words: keywords found in the transaction title
// hints: substrings that should match the user's category name
const RULES: Array<{ words: string[]; hints: string[] }> = [
  {
    words: ["mercado", "supermercado", "carrefour", "atacadao", "atacado", "pao de acucar", "varejao", "hortifruti", "dia ", "aldi ", "lidl "],
    hints: ["alimenta", "mercado", "supermercado", "comida", "grocery"],
  },
  {
    words: ["ifood", "rappi", "uber eats", "james delivery", "delivery much"],
    hints: ["alimenta", "delivery", "comida", "food", "refeicao"],
  },
  {
    words: ["restaurante", "lanchonete", "padaria", "pizzaria", "sushi", "hamburguer", "burger", "churrasco", "cafe ", "bistro", "pastelaria"],
    hints: ["alimenta", "restaurante", "comida", "refeicao", "lanches"],
  },
  {
    words: ["uber ", "99 ", "99pop", "cabify", "buser", "onibus", "metro ", "busao"],
    hints: ["transporte", "mobilidade", "locomocao", "transito"],
  },
  {
    words: ["posto", "gasolina", "combustivel", "shell ", "ipiranga", "petrobras", "br distribuidora"],
    hints: ["transporte", "combustivel", "carro", "veiculo", "auto"],
  },
  {
    words: ["netflix", "spotify", "amazon prime", "disney", "hbo", "globoplay", "youtube premium", "apple tv", "deezer", "crunchyroll", "mubi", "paramount"],
    hints: ["lazer", "entretenim", "streaming", "assinatura", "subscri"],
  },
  {
    words: ["cinema", "teatro", "show ", "ingresso", "ticketmaster", "sympla", "eventbrite"],
    hints: ["lazer", "entretenim", "cultura", "eventos", "show"],
  },
  {
    words: ["farmacia", "drogaria", "ultrafarma", "panvel", "pacheco", "droga"],
    hints: ["saude", "farmacia", "health", "remedios"],
  },
  {
    words: ["academia", "smartfit", "bluefit", "bodytech", "gym", "pilates", "yoga", "natacao", "futebol"],
    hints: ["saude", "academia", "fitness", "esporte", "sport"],
  },
  {
    words: ["hospital", "clinica", "dentista", "medico", "laboratorio", "exame", "consulta"],
    hints: ["saude", "medico", "health", "clinica"],
  },
  {
    words: ["aluguel", "condominio", "iptu", "energia", "enel ", "cpfl", "sabesp", "sanepar", "copasa", "gas encanado"],
    hints: ["moradia", "casa", "housing", "aluguel", "utilidades"],
  },
  {
    words: ["internet", "vivo ", "claro ", "tim ", " oi ", "nextel", "celular", "telefone"],
    hints: ["servico", "telefone", "comunicacao", "utilidades", "internet"],
  },
  {
    words: ["escola", "faculdade", "universidade", "mensalidade", "colegio", "curso", "udemy", "coursera", "alura"],
    hints: ["educacao", "escola", "aprendizado", "education"],
  },
  {
    words: ["salario", "pagamento", "freelance", "honorario", " pj ", " mei ", "renda"],
    hints: ["salario", "renda", "trabalho", "receita", "income"],
  },
  {
    words: ["seguro", "plano de saude", "convenio", "odontologico"],
    hints: ["seguro", "plano", "saude"],
  },
  {
    words: ["roupa", "vestuario", "zara", "renner", "riachuelo", "hm ", "shein"],
    hints: ["roupa", "vestuario", "moda", "compras"],
  },
  {
    words: ["amazon", "mercado livre", "magazine luiza", "americanas", "casas bahia", "shopee"],
    hints: ["compras", "online", "shopping", "eletronico"],
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
      if (rule.words.some(w => t.includes(norm(w)))) {
        const match = categories.find(c => {
          const cn = norm(c.name ?? "");
          return rule.hints.some(h => cn.includes(h) || h.includes(cn.slice(0, 5)));
        });
        if (match) return match;
      }
    }
    return null;
  } catch {
    return null;
  }
}
