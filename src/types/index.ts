export type Language = 'en' | 'da' | 'de' | 'es';

export const LANGUAGES: { code: Language; flag: string; label: string }[] = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'da', flag: '🇩🇰', label: 'Dansk' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
];

export const LANGUAGE_STORAGE_KEY = 'ai-wikipedia-language';

export interface Article {
  id: number;
  title: string;
  type?: ArticleType;
  language?: Language;
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  verification_status: 'verified' | 'disputed' | 'unverified';
  confidence_score: number;
  citations: string | null;
  images?: ArticleImage[];
  chapters?: WikiBookChapter[];
  book_author?: string;
}

export interface ArticleImage {
  url: string;
  alt: string;
  caption?: string;
}

export interface WikiBookChapter {
  title: string;
  content: string;
}

export type ArticleType = 'article' | 'wikibook';

export type VerificationMethod = 'property_match' | 'llm_judgment' | 'keyword_overlap';

export interface VerificationTriple {
  subject: string;
  predicate: string;
  object: string;
}

export interface VerificationSource {
  name: string;
  url: string;
  excerpt: string;
  relevance: number;
  verification_method?: VerificationMethod;
  property_id?: string;
  property_label?: string;
}

export interface VerificationResult {
  claim: string;
  status: 'verified' | 'disputed' | 'unverified';
  sources: VerificationSource[];
  confidence: number;
}

export interface VerificationSourceConfig {
  id: string;
  name: string;
  type: 'api' | 'scrape' | 'wikidata' | 'custom';
  enabled: boolean;
  config: {
    url?: string;
    searchParam?: string;
    responsePath?: string;
    excerptPath?: string;
    relevancePath?: string;
  };
}

export interface WikipediaChunk {
  index: number;
  title_prefix: string;
  articles: { title: string; content: string }[];
}

export interface ChunkManifest {
  version: string;
  chunks: ChunkInfo[];
  total_articles: number;
  compression: string;
}

export interface ChunkInfo {
  index: number;
  filename: string;
  article_count: number;
  original_size: number;
  compressed_size: number;
}

export interface StorageStats {
  total_compressed: number;
  total_original: number;
  file_count: number;
  compression_ratio: number;
}

export type CompressionType = 'lz4' | 'zstd';

export const CHUNK_SIZE = 50;
