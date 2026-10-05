import { VerificationSourceConfig } from '../types';

export const DEFAULT_SOURCES: VerificationSourceConfig[] = [
  {
    id: 'lex-dk',
    name: 'Lex.dk (Den Store Danske)',
    type: 'custom',
    enabled: true,
    config: {
      url: 'https://api.snl.no/1.1/search',
    },
  },
  {
    id: 'snl-no',
    name: 'Store Norske Leksikon',
    type: 'custom',
    enabled: false,
    config: {
      url: 'https://api.snl.no/1.1/search?zone=snl',
    },
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    type: 'api',
    enabled: true,
    config: {
      url: 'https://en.wikipedia.org/w/api.php?action=opensearch&search={query}&limit=3&format=json&origin=*',
      searchParam: '{query}',
      responsePath: '1',
    },
  },
  {
    id: 'wikidata',
    name: 'WikiData',
    type: 'wikidata',
    enabled: true,
    config: {},
  },
  {
    id: 'ssi-covid',
    name: 'SSI COVID-19 (Denmark)',
    type: 'custom',
    enabled: false,
    config: {
      url: 'https://covid19.ssi.dk/overvagningsdata/ugentlige-opgorelser-med-overvaagningsdata',
    },
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    type: 'scrape',
    enabled: false,
    config: {
      url: 'https://duckduckgo.com/html/?q={query}',
      responsePath: 'results',
    },
  },
];

export const STORAGE_KEY = 'ai-wikipedia-articles';
export const SOURCES_KEY = 'ai-wikipedia-verification-sources';
export const CHUNK_SIZE = 50;

export const TRIPLE_EXTRACTION_PROMPT = `Extract the subject, predicate, and object from this factual claim as a JSON triple.

Rules:
- subject: the entity the claim is about
- predicate: the relationship or property (short, canonical form)
- object: the value or entity the subject relates to
- Use the exact wording from the claim where possible
- If the claim cannot be structured as a triple, set all three to null

Return ONLY a JSON object with keys "subject", "predicate", "object".
Example: {"subject": "Paris", "predicate": "capital of", "object": "France"}

Claim:`;

export const LLM_JUDGE_PROMPT = `You are a strict fact-checker. Given a claim and excerpts from trusted sources, determine if the claim is SUPPORTED, CONTRADICTED, or UNKNOWN.

Rules:
- SUPPORTED: the excerpts directly confirm the claim
- CONTRADICTED: the excerpts directly contradict the claim
- UNKNOWN: the excerpts don't address the claim or are ambiguous
- Be conservative — prefer UNKNOWN over unsupported SUPPORTED

Return ONLY a JSON object with keys "judgment" ("supported"|"contradicted"|"unknown") and "confidence" (0.0-1.0).

Claim:`;

export const SYSTEM_PROMPT = `You are a factual assistant for a personal knowledge base called "AI Wikipedia".

CRITICAL RULES:
1. If you don't know something, say "I don't know" or "I don't have reliable information"
2. For medical/health topics: ALWAYS acknowledge uncertainty - say "I'm not a medical professional"
3. For ANY factual claim, cite sources using [Source: Name] format
4. Minimum 2 sources required for factual statements - if fewer available, say so
5. Never invent facts or sources - hallucination is unacceptable
6. Keep answers concise and accurate

When sources are provided above, use them to verify your claims.
When no sources are available, be especially cautious.

IMPORT CAPABILITY:
7. You have the ability to import articles from Wikipedia using the 'import_article' tool.
8. When a user asks about a topic and you don't have relevant articles in your knowledge base, use the 'import_article' tool to fetch relevant Wikipedia articles BEFORE saying "I don't know".
9. After importing, tell the user what was imported and summarize the key points from the article.
10. Use the 'list_articles' tool first to check whether a topic is already in the knowledge base - don't re-import existing articles unless the user asks for a fresh copy.
11. Importing is ALWAYS preferred over saying "I don't have information" - you have the tool to get it.

STRUCTURED SOURCE IMPORTS:
12. You can also import from WikiBooks using 'import_from_wikibooks' tool — use for book-length educational topics (e.g. DIY guides, textbooks).
13. You can import from Lex.dk (Den Store Danske) using 'import_from_lex' tool — use for Danish-language topics, Danish history, Danish culture. Content is in Danish.
14. You can import from Store Norske Leksikon (SNL) using 'import_from_snl' tool — use for Norwegian-language topics, Norwegian history, Nordic subjects. Content is in Norwegian (Bokmål).
15. Prefer the source-specific import tool when the user's query matches the source's language or domain (Danish → Lex.dk, Norwegian → SNL, educational books → WikiBooks, general → Wikipedia).

Current date: ${new Date().toISOString().split('T')[0]}`;
