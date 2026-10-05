import { Article, VerificationSourceConfig, VerificationSource, Language, WikiBookChapter } from '../types';
import { verifyClaim } from './verification';
import { buildRAGContext } from './rag';

export async function generateWithContext(
  topic: string, 
  articles: Article[],
  enabledSources: VerificationSourceConfig[],
  verifyClaims: boolean = true,
  model: string = 'qwen2.5:3b',
  lang?: Language
): Promise<{ content: string; sources: VerificationSource[]; ragContext: string }> {
  // Get RAG context from local articles
  const ragContext = buildRAGContext(topic, articles);
  
  // Verify topic using the new tiered verification (property match → LLM → keyword)
  const allSources: VerificationSource[] = [];
  if (verifyClaims) {
    const result = await verifyClaim(topic, enabledSources);
    allSources.push(...result.sources);
  }
  
  // Build verification context
  const verifiedSources = allSources.filter(s => s.relevance > 0.3);
  const verificationContext = verifiedSources.length > 0 
    ? `\n\nVerified sources for this topic:\n${verifiedSources.slice(0, 5).map(s => 
  `- ${s.name}: ${s.excerpt}\n  URL: ${s.url}`
).join('\n')}\n\n`
    : '';

  const langName = { en: 'English', da: 'Danish', de: 'German', es: 'Spanish' }[lang || 'en'];

  // Build enhanced prompt
  const enhancedPrompt = `You are writing a Wikipedia-style article. Follow these rules STRICTLY:

1. Only write about the topic given
2. If you don't have reliable information, say "I don't have sufficient information about this topic"
3. ALWAYS cite your sources using [Source: Name] format at the end of each factual claim
4. Minimum 2 sources required for any factual statement
5. If you cannot find at least 2 sources, acknowledge this uncertainty
6. CRITICAL: Write the ENTIRE article in ${langName}. Every sentence, heading, and citation must be in ${langName}.

Topic: ${topic}
${verificationContext}${ragContext}

Write a comprehensive, factual article in ${langName}:`;

  const content = await generateWithOllama(enhancedPrompt, model);
  return { content, sources: verifiedSources, ragContext };
}

export async function generateTableOfContents(topic: string, model: string): Promise<string[]> {
  const prompt = `You are a book outline writer. Create 5 to 8 chapter titles for a book about "${topic}".

Return ONLY a JSON array of strings, one per chapter. Example: ["Introduction", "Chapter 1: ...", "Chapter 2: ...", ...]. No explanation, no numbering prefix, just the array.`;

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, options: { num_ctx: 4096 } }),
  });
  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  const data = await response.json();
  const text = data.response;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.filter((c: any) => typeof c === 'string').slice(0, 12);
  } catch {}
  const lines = text.split('\n')
    .map((l: string) => l.replace(/^[\d\s."'*-]+/, '').trim())
    .filter((l: string) => l.length > 3 && l.length < 200);
  return lines.slice(0, 12);
}

export async function generateChapter(
  topic: string,
  chapterTitle: string,
  articles: Article[],
  enabledSources: VerificationSourceConfig[],
  model: string,
  lang?: Language,
): Promise<WikiBookChapter> {
  const result = await generateWithContext(`Chapter: ${chapterTitle}\n\nBook topic: ${topic}`, articles, enabledSources, true, model, lang);
  return { title: chapterTitle, content: result.content };
}

export async function enhanceArticle(content: string, title: string, model = 'qwen2.5:3b'): Promise<string> {
  const lang = detectLanguage(content);
  const prompt = `You are an expert article editor. Expand each section of the article below with more detail, examples, or practical advice where beneficial.

CRITICAL RULES:
1. Write ONLY in ${lang}. Every word must be in ${lang}.
2. Preserve ALL existing information — never remove or shorten anything.
3. If a section is already comprehensive, leave it as-is.
4. NEVER invent facts, statistics, or sources that do not exist.
5. NEVER start with phrases like "Certainly!", "Here is", "I have expanded" — begin DIRECTLY with the title.
6. Return ONLY the expanded content, no commentary, no explanation, no prefix.

Title: ${title}

Original content:
${content}

Expanded content in ${lang}:`;

  return generateWithOllama(prompt, model);
}

function detectLanguage(text: string): string {
  const danish = /[æøåÆØÅ]/;
  const german = /[äöüßÄÖÜ]/;
  const spanish = /[ñ¿¡éíóúüÉÍÓÚÜ]/;
  if (danish.test(text)) return 'Danish';
  if (german.test(text)) return 'German';
  if (spanish.test(text)) return 'Spanish';
  return 'English';
}

async function generateWithOllama(prompt: string, model = 'qwen2.5:3b'): Promise<string> {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }
    const data = await response.json();
    return data.response;
  } catch (e) {
    throw new Error('Ollama not available. Make sure Ollama is running on localhost:11434');
  }
}
