import { invoke } from '@tauri-apps/api/core';
import { Article, CompressionType, ChunkInfo, ChunkManifest, WikipediaChunk, StorageStats } from '../types';
import { CHUNK_SIZE } from '../constants';

export function chunkArticles(articles: Article[]): WikipediaChunk[] {
  const chunks: WikipediaChunk[] = [];
  for (let i = 0; i < articles.length; i += CHUNK_SIZE) {
    const chunk = articles.slice(i, i + CHUNK_SIZE);
    const firstTitle = chunk[0]?.title || '';
    const prefix = firstTitle.charAt(0).toUpperCase();
    chunks.push({
      index: Math.floor(i / CHUNK_SIZE),
      title_prefix: prefix,
      articles: chunk.map(a => ({ title: a.title, content: a.content })),
    });
  }
  return chunks;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export async function compressAndSaveWikipedia(
  articles: Article[],
  compression: CompressionType
): Promise<{ saved: number; original: number; compressed: number }> {
  const chunks = chunkArticles(articles);
  const manifest: ChunkManifest = {
    version: '1.0.0',
    chunks: [],
    total_articles: articles.length,
    compression,
  };

  let totalOriginal = 0;
  let totalCompressed = 0;

  for (const chunk of chunks) {
    const info = await invoke<ChunkInfo>('save_wikipedia_chunk', {
      chunk,
      compression,
    });
    manifest.chunks.push(info);
    totalOriginal += info.original_size;
    totalCompressed += info.compressed_size;
  }

  await invoke('save_manifest', { manifest });
  return { saved: articles.length, original: totalOriginal, compressed: totalCompressed };
}

export async function getStorageStats(): Promise<StorageStats | null> {
  try {
    return await invoke<StorageStats>('get_storage_stats');
  } catch {
    return null;
  }
}
