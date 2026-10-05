export interface SyncConfig {
  enabled: boolean;
  interval_hours: number;
  news_enabled: boolean;
  random_enabled: boolean;
  lex_enabled: boolean;
  wikibooks_enabled: boolean;
  max_articles_per_sync: number;
  auto_import: boolean;
  last_sync: string | null;
}

export interface PendingArticle {
  title: string;
  source: string;
  fetched_at: string;
}
