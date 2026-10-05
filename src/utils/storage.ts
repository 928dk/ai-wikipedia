import { Article, VerificationSourceConfig } from '../types';
import { STORAGE_KEY, SOURCES_KEY } from '../constants';

const STORAGE_VERSION = 2;

export function loadArticles(): Article[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && parsed.version && Array.isArray(parsed.articles)) return parsed.articles;
    return [];
  } catch {
    console.warn('Corrupted articles data in localStorage, resetting');
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function saveArticles(articles: Article[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, articles }));
    return true;
  } catch (e) {
    console.error('Failed to save articles:', e);
    return false;
  }
}

export function loadVerificationSources(defaultSources: VerificationSourceConfig[]): VerificationSourceConfig[] {
  const saved = localStorage.getItem(SOURCES_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return defaultSources;
    }
  }
  return defaultSources;
}

export function saveVerificationSources(sources: VerificationSourceConfig[]) {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
}
