import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Article, Language } from '../types';

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  tool_name?: string;
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}

export function useOllama() {
  const [loading, setLoading] = useState(false);

  const chat = async (
    messages: ChatMessage[],
    model = 'qwen2.5:3b',
    tools?: Tool[]
  ): Promise<ChatMessage> => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            tool_calls: m.tool_calls,
            tool_call_id: m.tool_call_id,
            tool_name: m.tool_name,
          })),
          tools,
          stream: false,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} - ${text}`);
      }
      const data = await response.json();
      return {
        role: 'assistant',
        content: data.message.content || '',
        tool_calls: data.message.tool_calls || undefined,
      };
    } catch (e) {
      throw e instanceof Error ? e : new Error('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const executeTool = async (toolCall: ToolCall, articles?: Article[], onSaveArticle?: (title: string, content: string) => void, lang?: Language): Promise<string> => {
    const { name, arguments: args } = toolCall.function;
    
    try {
      if (name === 'scrape_webpage') {
        const url = args.url as string;
        if (!url) return 'Error: URL required';
        return await invoke<string>('scrape_webpage', { url });
      }
      
      if (name === 'scrape_with_python') {
        const url = args.url as string;
        if (!url) return 'Error: URL required';
        return await invoke<string>('scrape_with_python', { url });
      }
      
      if (name === 'get_article_count') {
        const count = articles?.length;
        if (count !== undefined) return `${count} article(s) in knowledge base`;
        const result = await invoke<number>('get_article_count');
        return `${result} article(s) in compressed storage`;
      }
      
      if (name === 'list_articles') {
        if (articles && articles.length > 0) {
          return articles.map(a => `- ${a.title}`).join('\n');
        }
        return 'No articles saved yet.';
      }

      if (name === 'import_article') {
        const title = args.title as string;
        if (!title) return 'Error: title required';
        try {
          const importLang = (args.lang as Language) || lang || 'en';
          const { importFromWikipedia } = await import('../utils/importExport');
          const imported = await importFromWikipedia([title], importLang);
          if (imported.length === 0) return `Failed to import "${title}" - article not found on Wikipedia.`;
          const a = imported[0];
          if (onSaveArticle) onSaveArticle(a.title, a.content);
          const domain = { en: 'en.wikipedia.org', da: 'da.wikipedia.org', de: 'de.wikipedia.org', es: 'es.wikipedia.org' }[importLang];
          return `Imported "${a.title}" from ${domain} (${a.content.length} characters).\nSummary: ${a.summary}\nCitation: ${a.citations}`;
        } catch (e) {
          return `Error importing "${title}": ${e instanceof Error ? e.message : 'Unknown error'}`;
        }
      }

      if (name === 'search_wikibooks') {
        const query = args.query as string;
        if (!query) return 'Error: query required';
        try {
          const { searchWikiBooks } = await import('../utils/importExport');
          return await searchWikiBooks(query);
        } catch (e) {
          return `Error searching WikiBooks: ${e instanceof Error ? e.message : 'Unknown error'}`;
        }
      }

      if (name === 'import_from_wikibooks') {
        const title = args.title as string;
        if (!title) return 'Error: title required';
        try {
          const { importFromWikiBooks } = await import('../utils/importExport');
          const article = await importFromWikiBooks(title);
          if (!article) return `Failed to import "${title}" - book not found on WikiBooks or no chapters found.`;
          const chapterCount = article.chapters?.length || 0;
          article.language = lang || 'en';
          if (onSaveArticle) onSaveArticle(article.title, article.content);
          return `Imported "${article.title}" from WikiBooks (${article.content.length} characters, ${chapterCount} chapters).\nSummary: ${article.summary}\nCitation: ${article.citations}`;
        } catch (e) {
          return `Error importing WikiBook "${title}": ${e instanceof Error ? e.message : 'Unknown error'}`;
        }
      }

      if (name === 'import_from_lex') {
        const query = args.query as string;
        if (!query) return 'Error: query required';
        try {
          const { importFromLexDk } = await import('../utils/importExport');
          const article = await importFromLexDk(query);
          if (!article) return `Failed to import "${query}" from Lex.dk - article not found or license is restricted.`;
          article.language = 'da';
          if (onSaveArticle) onSaveArticle(article.title, article.content);
          return `Imported "${article.title}" from Lex.dk (${article.content.length} characters).\nSummary: ${article.summary}\nCitation: ${article.citations}`;
        } catch (e) {
          return `Error importing from Lex.dk "${query}": ${e instanceof Error ? e.message : 'Unknown error'}`;
        }
      }

      if (name === 'import_from_snl') {
        const query = args.query as string;
        if (!query) return 'Error: query required';
        try {
          const { importFromSNL } = await import('../utils/importExport');
          const article = await importFromSNL(query);
          if (!article) return `Failed to import "${query}" from SNL - article not found or license is restricted.`;
          article.language = 'da';
          if (onSaveArticle) onSaveArticle(article.title, article.content);
          return `Imported "${article.title}" from SNL (${article.content.length} characters).\nSummary: ${article.summary}\nCitation: ${article.citations}`;
        } catch (e) {
          return `Error importing from SNL "${query}": ${e instanceof Error ? e.message : 'Unknown error'}`;
        }
      }

      if (name === 'parse_document') {
        const path = args.path as string;
        const parserType = args.parser_type as string;
        if (!path || !parserType) return 'Error: path and parser_type required';
        return await invoke<string>('parse_document', { path, parserType });
      }

      if (name === 'parse_code') {
        const path = args.path as string;
        if (!path) return 'Error: path required';
        return await invoke<string>('parse_document', { path, parser_type: 'code' });
      }

      if (name === 'parse_media') {
        const path = args.path as string;
        if (!path) return 'Error: path required';
        return await invoke<string>('parse_document', { path, parser_type: 'media' });
      }

      if (name === 'parse_zip') {
        const path = args.path as string;
        if (!path) return 'Error: path required';
        return await invoke<string>('parse_document', { path, parser_type: 'zip' });
      }

      if (name === 'parse_legacy_doc') {
        const path = args.path as string;
        if (!path) return 'Error: path required';
        return await invoke<string>('parse_document', { path, parser_type: 'legacy_doc' });
      }

      return `Error: Unknown tool ${name}`;
    } catch (e) {
      return `Error executing ${name}: ${e}`;
    }
  };

  const listModels = async (): Promise<string[]> => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) return ['qwen2.5:3b'];
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || ['qwen2.5:3b'];
    } catch {
      return ['qwen2.5:3b'];
    }
  };

  return { chat, executeTool, listModels, loading };
}
