import { VerificationSource, VerificationSourceConfig, VerificationResult, VerificationTriple, Language } from '../types';
import { TRIPLE_EXTRACTION_PROMPT, LLM_JUDGE_PROMPT } from '../constants';

const WIKIPEDIA_DOMAINS: Record<Language, string> = {
  en: 'en.wikipedia.org',
  da: 'da.wikipedia.org',
  de: 'de.wikipedia.org',
  es: 'es.wikipedia.org',
};

const OLLAMA_CHAT_URL = 'http://localhost:11434/api/chat';
const LITELLM_URL = 'http://localhost:4000/v1/chat/completions';

function getLiteLLMToken(): string {
  const stored = localStorage.getItem('litellm_api_token');
  return stored || '';
}

// ─── LLM helpers ────────────────────────────────────────────────────────────

async function tryOllamaChat(prompt: string, model = 'qwen2.5:3b'): Promise<string | null> {
  try {
    const resp = await fetch(OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { num_ctx: 4096 },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.message?.content ?? null;
  } catch { return null; }
}

async function tryLiteLLM(prompt: string, model = 'gemini-2.5-flash'): Promise<string | null> {
  const token = getLiteLLMToken();
  if (!token) return null;
  try {
    const resp = await fetch(LITELLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

async function tryLLM(prompt: string): Promise<string | null> {
  let text = await tryOllamaChat(prompt);
  if (!text) text = await tryLiteLLM(prompt);
  return text;
}

// ─── Triple extraction ──────────────────────────────────────────────────────

export async function extractTriple(claim: string): Promise<VerificationTriple | null> {
  const prompt = `${TRIPLE_EXTRACTION_PROMPT}\n${claim}`;
  const text = await tryLLM(prompt);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed.subject && parsed.predicate && parsed.object) {
      return { subject: parsed.subject, predicate: parsed.predicate, object: parsed.object };
    }
  } catch {}
  return null;
}

// ─── WikiData entity resolution ─────────────────────────────────────────────

const WIKIDATA_SEARCH = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&format=json&origin=*';

async function searchWikidataEntity(label: string, type?: 'property'): Promise<string | null> {
  try {
    let url = `${WIKIDATA_SEARCH}&search=${encodeURIComponent(label)}&limit=1`;
    if (type === 'property') url += '&type=property';
    const resp = await fetch(url);
    const data = await resp.json();
    const result = data.search?.[0];
    return result?.id ?? null;
  } catch { return null; }
}

export async function resolveWikidataEntity(label: string): Promise<string | null> {
  return searchWikidataEntity(label);
}

export async function resolveWikidataProperty(label: string): Promise<string | null> {
  return searchWikidataEntity(label, 'property');
}

// ─── SPARQL property verification ───────────────────────────────────────────

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

export async function verifyPropertyTriple(
  subjectQid: string,
  propertyPid: string,
  objectQid: string
): Promise<{ match: boolean; objectLabel?: string }> {
  try {
    const query = `ASK { wd:${subjectQid} wdt:${propertyPid} wd:${objectQid} }`;
    const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
    if (!resp.ok) return { match: false };
    const data = await resp.json();
    return { match: data.boolean === true };
  } catch { return { match: false }; }
}

// ─── LLM-as-judge fallback ──────────────────────────────────────────────────

export async function judgeClaimWithLLM(
  claim: string,
  excerpts: string[]
): Promise<{ judgment: 'supported' | 'contradicted' | 'unknown'; confidence: number } | null> {
  const context = excerpts.length > 0
    ? `\n\nExcerpts from trusted sources:\n${excerpts.map((e, i) => `[${i + 1}] ${e}`).join('\n')}`
    : '\n\n(No source excerpts available — use your best judgment)';
  const prompt = `${LLM_JUDGE_PROMPT}\n${claim}${context}`;
  const text = await tryLLM(prompt);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    const judgment = parsed.judgment?.toLowerCase();
    if (judgment === 'supported' || judgment === 'contradicted' || judgment === 'unknown') {
      return { judgment, confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)) };
    }
  } catch {}
  return null;
}

// ─── Legacy: keyword overlap (last resort) ──────────────────────────────────

export function calculateRelevance(claim: string, text: string): number {
  const claimWords = new Set(claim.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const textWords = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (claimWords.size === 0) return 0;
  let matches = 0;
  for (const word of claimWords) {
    if (textWords.some(tw => tw.includes(word) || word.includes(tw))) matches++;
  }
  return matches / claimWords.size;
}

export function extractClaims(content: string): string[] {
  return content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20 && /[A-Z]/.test(s));
}

export async function verifyWithWikipedia(query: string, lang?: Language): Promise<VerificationSource[]> {
  const domain = WIKIPEDIA_DOMAINS[lang || 'en'];
  const sources: VerificationSource[] = [];
  try {
    const searchUrl = `https://${domain}/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json&origin=*`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    const titles: string[] = searchData[1] || [];

    for (const title of titles.slice(0, 2)) {
      const pageUrl = `https://${domain}/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=1&format=json&origin=*`;
      const pageResponse = await fetch(pageUrl);
      const pageData = await pageResponse.json();
      const pages = pageData.query?.pages || {};
      const page = Object.values(pages)[0] as { extract?: string; pageid?: number };
      if (page?.extract && page?.pageid) {
        sources.push({
          name: 'Wikipedia',
          url: `https://${domain}/?curid=${page.pageid}`,
          excerpt: page.extract.slice(0, 300),
          relevance: calculateRelevance(query, page.extract),
        });
      }
    }
  } catch (e) {
    console.error('Wikipedia error:', e);
  }
  return sources;
}

// ─── Legacy WikiData label search (used by ChatInterface web verify) ────────

export async function verifyWithWikiData(query: string, lang?: Language): Promise<VerificationSource[]> {
  const sources: VerificationSource[] = [];
  try {
    const keywords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 2);
    if (keywords.length > 0) {
      const langCode = lang || 'en';
      const sparqlQuery = `SELECT ?item ?itemLabel ?description WHERE { ?item rdfs:label "${keywords[0]}"@${langCode}. ?item schema:description ?description. FILTER(LANG(?description) = '${langCode}') } LIMIT 2`;
      const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparqlQuery)}`;
      const response = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
      if (response.ok) {
        const data = await response.json();
        const results = data.results?.bindings || [];
        for (const result of results) {
          sources.push({
            name: 'WikiData',
            url: result.item?.value || '',
            excerpt: result.description?.value || '',
            relevance: 0.5,
          });
        }
      }
    }
  } catch (e) {
    console.error('WikiData error:', e);
  }
  return sources;
}

// ─── Experiment: find property label for a P-ID ────────────────────────────

async function resolvePropertyLabel(pid: string): Promise<string | null> {
  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${pid}.json`;
    const resp = await fetch(url);
    const data = await resp.json();
    return data?.entities?.[pid]?.labels?.en?.value ?? null;
  } catch { return null; }
}

// ─── Main verifyClaim ───────────────────────────────────────────────────────

export async function verifyClaim(
  claim: string,
  _sources?: VerificationSourceConfig[],
  lang?: Language
): Promise<VerificationResult> {
  const allSources: VerificationSource[] = [];

  // Phase 1: Try triple extraction + WikiData property verification
  const triple = await extractTriple(claim);
  if (triple) {
    const [subjectQid, propertyPid, objectQid] = await Promise.all([
      resolveWikidataEntity(triple.subject),
      resolveWikidataProperty(triple.predicate),
      resolveWikidataEntity(triple.object),
    ]);

    if (subjectQid && propertyPid && objectQid) {
      const result = await verifyPropertyTriple(subjectQid, propertyPid, objectQid);
      const propertyLabel = await resolvePropertyLabel(propertyPid);

      if (result.match) {
        allSources.push({
          name: 'WikiData',
          url: `https://www.wikidata.org/wiki/${subjectQid}`,
          excerpt: `Property ${propertyLabel || propertyPid}: ${triple.subject} → ${triple.object}`,
          relevance: 0.95,
          verification_method: 'property_match',
          property_id: propertyPid,
          property_label: propertyLabel || undefined,
        });
      } else {
        allSources.push({
          name: 'WikiData',
          url: `https://www.wikidata.org/wiki/${subjectQid}`,
          excerpt: `No property match for ${triple.subject} → ${propertyLabel || propertyPid} → ${triple.object}`,
          relevance: 0.3,
          verification_method: 'property_match',
          property_id: propertyPid,
          property_label: propertyLabel || undefined,
        });
      }
    } else {
      // Entities not resolvable — fall through to LLM
      const excerpts = await getWikipediaExcerpts(claim, lang);
      if (excerpts.length > 0) {
        const judgment = await judgeClaimWithLLM(claim, excerpts);
        if (judgment) {
          const rel = judgment.judgment === 'supported' ? 0.85
            : judgment.judgment === 'contradicted' ? 0.15 : 0.5;
          allSources.push({
            name: 'Wikipedia (LLM)',
            url: '',
            excerpt: `LLM judgment: ${judgment.judgment}`,
            relevance: rel * judgment.confidence,
            verification_method: 'llm_judgment',
          });
        }
      }
    }
  }

  // Phase 2: Wikipedia excerpts + LLM judgment (no triple, or triple incomplete)
  if (allSources.length === 0) {
    const excerpts = await getWikipediaExcerpts(claim, lang);
    if (excerpts.length > 0) {
      const judgment = await judgeClaimWithLLM(claim, excerpts);
      if (judgment) {
        const rel = judgment.judgment === 'supported' ? 0.85
          : judgment.judgment === 'contradicted' ? 0.15 : 0.5;
        allSources.push({
          name: 'Wikipedia (LLM)',
          url: '',
          excerpt: `LLM judgment: ${judgment.judgment}`,
          relevance: rel * judgment.confidence,
          verification_method: 'llm_judgment',
        });
      }
    }
  }

  // Phase 3: Legacy keyword overlap (last resort)
  if (allSources.length === 0) {
    const legacy = await verifyWithWikipedia(claim, lang);
    for (const s of legacy) {
      s.verification_method = 'keyword_overlap';
    }
    allSources.push(...legacy);
  }

  // Determine status
  const verified = allSources.filter(s => s.relevance > 0.5).length;
  const disputed = allSources.filter(s => s.relevance > 0.2 && s.relevance <= 0.5).length;
  const confidence = allSources.reduce((sum, s) => sum + s.relevance, 0) / (allSources.length || 1);

  let status: 'verified' | 'disputed' | 'unverified' = 'unverified';
  if (disputed > verified) status = 'disputed';
  else if (verified > 0) status = 'verified';

  return { claim, status, sources: allSources, confidence };
}

// ─── Helper: get Wikipedia page excerpts ────────────────────────────────────

async function getWikipediaExcerpts(query: string, lang?: Language): Promise<string[]> {
  const domain = WIKIPEDIA_DOMAINS[lang || 'en'];
  const excerpts: string[] = [];
  try {
    const searchUrl = `https://${domain}/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json&origin=*`;
    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();
    const titles: string[] = searchData[1] || [];

    for (const title of titles.slice(0, 2)) {
      const pageUrl = `https://${domain}/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=1&format=json&origin=*`;
      const pageResp = await fetch(pageUrl);
      const pageData = await pageResp.json();
      const pages = pageData.query?.pages || {};
      const page = Object.values(pages)[0] as { extract?: string; pageid?: number } | undefined;
      if (page?.extract) {
        excerpts.push(page.extract.slice(0, 500));
      }
    }
  } catch {}
  return excerpts;
}
