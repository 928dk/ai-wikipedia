import { Article } from '../types';

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
}

export function calculateSimilarity(query: string, doc: string): number {
  const queryTokens = new Set(tokenize(query));
  const docTokens = tokenize(doc);
  if (queryTokens.size === 0) return 0;
  
  let matches = 0;
  for (const token of docTokens) {
    if (queryTokens.has(token)) matches++;
  }
  return matches / queryTokens.size;
}

export function findRelevantArticles(query: string, articles: Article[], topK: number = 3): Article[] {
  const now = Date.now();
  const scored = articles.map(a => {
    const sim = calculateSimilarity(query, `${a.title} ${a.content}`);
    const ageDays = (now - new Date(a.updated_at).getTime()) / 86400000;
    const temporalBoost = Math.max(0.5, 1.5 - ageDays * 0.02);
    return { article: a, score: sim * temporalBoost };
  });
  return scored
    .filter(s => s.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.article);
}

export function buildRAGContext(query: string, articles: Article[]): string {
  const relevant = findRelevantArticles(query, articles);
  if (relevant.length === 0) return '';
  
  return `\n\nRelevant information from your knowledge base:\n${relevant.map((a, i) => 
    `[${i + 1}] ${a.title}\n${a.content.slice(0, 500)}${a.content.length > 500 ? '...' : ''}`
  ).join('\n\n')}\n\nUse the above information if relevant to answer the user's question.`;
}
