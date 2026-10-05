import { Article, WikiBookChapter, Language } from '../types';

const WIKIPEDIA_DOMAINS: Record<Language, string> = {
  en: 'en.wikipedia.org',
  da: 'da.wikipedia.org',
  de: 'de.wikipedia.org',
  es: 'es.wikipedia.org',
};

export async function importFromWikipedia(titles: string[], lang?: Language): Promise<Article[]> {
  const domain = WIKIPEDIA_DOMAINS[lang || 'en'] ?? WIKIPEDIA_DOMAINS.en;
  const articles: Article[] = [];
  for (const title of titles) {
    try {
      const url = `https://${domain}/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=1&format=json&origin=*`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Wikipedia API returned ${response.status} for ${title}`);
        continue;
      }
      const data = await response.json();
      const pages = data.query?.pages || {};
      const page = Object.values(pages)[0] as { extract?: string; pageid?: number };
      if (page?.extract) {
        articles.push({
          id: Date.now() + Math.random(),
          title,
          language: lang || 'en',
          content: page.extract,
          summary: page.extract.slice(0, 200) + (page.extract.length > 200 ? '...' : ''),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          verification_status: 'verified',
          confidence_score: 0.95,
          citations: JSON.stringify([{ source: 'Wikipedia', url: `https://${domain}/?curid=${page.pageid}` }]),
        });
      }
    } catch (e) {
      console.error(`Failed to import ${title}:`, e);
    }
  }
  return articles;
}

// ─── SNL / Lex.dk shared import ─────────────────────────────────────────────

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
}

async function importFromSNLShared(query: string, zone: string): Promise<Article | null> {
  try {
    const zoneParam = zone ? `&zone=${zone}` : '';
    const searchUrl = `https://api.snl.no/1.1/search?query=${encodeURIComponent(query)}${zoneParam}`;
    const searchResp = await fetch(searchUrl);
    if (!searchResp.ok) return null;
    const searchData = await searchResp.json();
    const results = searchData.results || searchData;
    if (!Array.isArray(results) || results.length === 0) return null;

    const best = results[0];
    const title = best.title || best.headword || '';
    const articleUrl = best.url || '';
    const licenseName = best.license_name || best.license || '';

    // Only import freely-licensed articles (CC-BY-SA-3.0)
    if (licenseName !== 'fri') {
      console.warn(`Skipping "${title}" — license: ${licenseName}`);
      return null;
    }

    // Fetch full article JSON for xhtml_body
    const articleJsonUrl = `${articleUrl}.json`;
    const articleResp = await fetch(articleJsonUrl);
    let content = '';
    let authors: string[] = [];

    if (articleResp.ok) {
      const articleData = await articleResp.json();
      const body = articleData.xhtml_body || best.xhtml_body || '';
      content = stripHtml(body);
      authors = (articleData.authors || best.authors || []).map((a: any) => a.full_name || a);
    } else if (best.xhtml_body) {
      content = stripHtml(best.xhtml_body);
      authors = (best.authors || []).map((a: any) => a.full_name || a);
    }

    if (!content) return null;

    const sourceName = zone === 'lex' ? 'Lex.dk' : 'SNL';
    const citeUrl = articleUrl || `https://${zone === 'lex' ? 'lex.dk' : 'snl.no'}/${encodeURIComponent(title)}`;

    return {
      id: Date.now() + Math.random(),
      title,
      content,
      summary: content.slice(0, 200) + (content.length > 200 ? '...' : ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verification_status: 'verified',
      confidence_score: 0.9,
      citations: JSON.stringify([{ source: sourceName, url: citeUrl, authors }]),
    };
  } catch (e) {
    console.error(`Failed to import from SNL/Lex (zone=${zone}):`, e);
    return null;
  }
}

export async function importFromLexDk(query: string): Promise<Article | null> {
  return importFromSNLShared(query, 'lex');
}

export async function importFromSNL(query: string): Promise<Article | null> {
  return importFromSNLShared(query, 'snl');
}

function stripWikitext(text: string): string {
  return text
    .replace(/<noinclude>[\s\S]*?<\/noinclude>/g, '')
    .replace(/<includeonly>([\s\S]*?)<\/includeonly>/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{\{[\s\S]*?\}\}\}/g, '')
    .replace(/\{\{#[\w:]+:[\s\S]*?\}\}/g, '')
    .replace(/\{\{[\w\s]*?\|[\s\S]*?\}\}/g, '')
    .replace(/\{\{[\w\s-]+\}\}/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]|]+)\]\]/g, '$2')
    .replace(/\[\[([^\]|]+)\]\]/g, '$1')
    .replace(/'''(.*?)'''/g, '$1')
    .replace(/''(.*?)''/g, '$1')
    .replace(/<ref[\s>][\s\S]*?<\/ref>/g, '')
    .replace(/<ref[^>]*?\/>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/__\w+__/g, '')
    .replace(/#REDIRECT\s*\[\[[^\]]+\]\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchWikiBookChapters(title: string): Promise<{ chapters: WikiBookChapter[]; mainExtract: string } | null> {
  const BATCH_SIZE = 50;
  const baseUrl = 'https://en.wikibooks.org/w/api.php';

  // Fetch main book page for summary
  const mainApi = `${baseUrl}?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=1&explaintext=1&format=json&origin=*`;
  const mainResp = await fetch(mainApi);
  if (!mainResp.ok) {
    console.warn(`WikiBooks main page API returned ${mainResp.status}`);
    return null;
  }
  const mainData = await mainResp.json();
  const mainPages = mainData.query?.pages || {};
  const mainPage = Object.values(mainPages)[0] as { extract?: string; pageid?: number; title?: string } | undefined;
  if (!mainPage || mainPage.pageid === undefined || mainPage.pageid < 0) return null;
  const mainExtract = mainPage.extract || '';

  // Phase 1: Collect all subpage titles with pagination
  const allTitles: string[] = [];
  let gapcontinue = '';

  do {
    let url = `${baseUrl}?action=query&generator=allpages&gapnamespace=0&gapprefix=${encodeURIComponent(title)}/&prop=info&format=json&origin=*&gaplimit=max`;
    if (gapcontinue) {
      url += `&gapcontinue=${encodeURIComponent(gapcontinue)}`;
    }
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`WikiBooks pagination API returned ${resp.status}`);
      break;
    }
    const data = await resp.json();
    const pages = data.query?.pages || {};
    for (const p of Object.values(pages)) {
      const pageTitle = (p as any).title as string | undefined;
      if (pageTitle) {
        allTitles.push(pageTitle);
      }
    }
    gapcontinue = data.continue?.gapcontinue || '';
  } while (gapcontinue);

  const chapters: WikiBookChapter[] = [];
  const fullContent: string[] = [];

  if (allTitles.length === 0) {
    if (!mainExtract) return null;
    chapters.push({ title, content: mainExtract });
    fullContent.push(mainExtract);
    return { chapters, mainExtract };
  }

  // Phase 2: Batch-fetch chapter full content using revisions API
  for (let i = 0; i < allTitles.length; i += BATCH_SIZE) {
    const batch = allTitles.slice(i, i + BATCH_SIZE);
    const batchUrl = `${baseUrl}?action=query&titles=${batch.map(t => encodeURIComponent(t)).join('|')}&prop=revisions&rvprop=content&format=json&origin=*`;
    try {
      const batchResp = await fetch(batchUrl);
      if (!batchResp.ok) {
        console.warn(`WikiBooks batch fetch returned ${batchResp.status}`);
        continue;
      }
      const batchData = await batchResp.json();
      const batchPages = batchData.query?.pages || {};
      for (const p of Object.values(batchPages)) {
        const page = p as { title?: string; revisions?: { '*': string }[] };
        if (!page.title || !page.revisions || !page.revisions[0]?.['*']) continue;
        const raw = page.revisions[0]['*'];
        if (page.title === title || page.title === title + '/') continue;
        const chapterTitle = page.title.includes('/')
          ? page.title.split('/').slice(1).join('/')
          : page.title;
        const content = stripWikitext(raw);
        if (!content) continue;
        chapters.push({ title: chapterTitle, content });
        fullContent.push(content);
      }
    } catch (e) {
      console.warn(`WikiBooks batch fetch failed for batch ${i}-${i + batch.length}:`, e);
    }
  }

  return { chapters, mainExtract };
}

export async function searchWikiBooks(query: string): Promise<string> {
  try {
    const url = `https://en.wikibooks.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=0&srlimit=10&format=json&origin=*`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return `WikiBooks search returned status ${resp.status}.`;
    }
    const data = await resp.json();
    const results = data.query?.search || [];
    if (results.length === 0) return `No books found on WikiBooks for "${query}".`;
    return results.map((r: any) => {
      const snippet = r.snippet.replace(/<[^>]+>/g, '');
      return `- "${r.title}": ${snippet.slice(0, 200)}`;
    }).join('\n');
  } catch (e) {
    return `Error searching WikiBooks: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

export async function importFromWikiBooks(title: string): Promise<Article | null> {
  try {
    const result = await fetchWikiBookChapters(title);
    if (!result || result.chapters.length === 0) return null;

    const bookUrl = `https://en.wikibooks.org/wiki/${encodeURIComponent(title)}`;
    const { chapters, mainExtract } = result;

    return {
      id: Date.now() + Math.random(),
      title,
      type: 'wikibook',
      content: chapters.map(c => c.content).join('\n\n'),
      summary: (mainExtract || chapters[0]?.content || '').slice(0, 200) +
        (((mainExtract || chapters[0]?.content || '').length > 200) ? '...' : ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verification_status: 'unverified',
      confidence_score: 0,
      citations: JSON.stringify([{ source: 'WikiBooks', url: bookUrl }]),
      chapters,
    };
  } catch (e) {
    console.error(`Failed to import WikiBook ${title}:`, e);
    return null;
  }
}
