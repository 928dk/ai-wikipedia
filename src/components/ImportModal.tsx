import { useState, useRef } from 'react';
import type { Article, Language, WikiBookChapter } from '../types';

function splitByHeadings(text: string): WikiBookChapter[] {
  const lines = text.split('\n');
  const chapters: WikiBookChapter[] = [];
  let currentTitle = 'Introduction';
  let currentContent: string[] = [];

  for (const line of lines) {
    const m = line.match(/^(#{2,3}|={2,})\s+(.+)/);
    if (m) {
      if (currentContent.some(l => l.trim())) {
        chapters.push({ title: currentTitle, content: currentContent.join('\n').trim() });
      }
      currentTitle = m[2].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.some(l => l.trim())) {
    chapters.push({ title: currentTitle, content: currentContent.join('\n').trim() });
  }
  return chapters;
}

export function ImportModal({ onClose, onImport, onWikiBooksImport, onFileImport, selectedLanguage }: {
  onClose: () => void;
  onImport: (titles: string[], lang?: Language) => void;
  onWikiBooksImport?: (title: string) => Promise<void>;
  onFileImport?: (articles: Article[]) => void;
  selectedLanguage: Language;
}) {
  const [tab, setTab] = useState<'wikipedia' | 'wikibooks' | 'file'>('wikipedia');
  const [titles, setTitles] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'article' | 'book'>('article');
  const [splitMode, setSplitMode] = useState<'single' | 'split'>('single');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (tab === 'wikipedia') {
      const list = titles.split('\n').map(t => t.trim()).filter(t => t);
      if (list.length === 0) return;
      setImporting(true);
      await onImport(list, selectedLanguage);
      onClose();
    } else if (tab === 'wikibooks') {
      if (!bookTitle.trim()) return;
      setImporting(true);
      if (onWikiBooksImport) await onWikiBooksImport(bookTitle.trim());
      onClose();
    } else if (tab === 'file' && file && onFileImport) {
      setImporting(true);
      try {
        const content = await file.text();
        const asType = importType === 'book' ? 'wikibook' : 'article';
        let articles: Article[] = [];

        if (file.name.endsWith('.json')) {
          const data = JSON.parse(content);
          const raw: Article[] = data.articles || (Array.isArray(data) ? data : [data]);
          articles = raw.map(a => {
            const base: Article = {
              id: Date.now() + Math.random() * Math.random(),
              title: a.title,
              type: asType,
              language: a.language,
              content: a.content,
              summary: a.summary || a.content.slice(0, 200) + (a.content.length > 200 ? '...' : ''),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              verification_status: a.verification_status || 'unverified',
              confidence_score: a.confidence_score || 0,
              citations: a.citations || null,
              images: a.images,
            };
            if (asType === 'wikibook') {
              if (a.chapters && a.chapters.length > 0) {
                base.chapters = a.chapters;
              } else if (splitMode === 'split') {
                base.chapters = splitByHeadings(a.content);
              } else {
                base.chapters = [{ title: a.title, content: a.content }];
              }
            }
            return base;
          });
        } else {
          const title = file.name.replace(/\.(txt|md)$/i, '');
          const base: Article = {
            id: Date.now() + Math.random(),
            title,
            type: asType,
            content,
            summary: content.slice(0, 200) + (content.length > 200 ? '...' : ''),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            verification_status: 'unverified',
            confidence_score: 0,
            citations: null,
          };
          if (asType === 'wikibook') {
            if (splitMode === 'split') {
              base.chapters = splitByHeadings(content);
            } else {
              base.chapters = [{ title: 'Main', content }];
            }
          }
          articles = [base];
        }

        if (articles.length > 0) {
          onFileImport(articles);
        }
      } catch (e) {
        alert('Failed to read file: ' + (e instanceof Error ? e.message : 'Unknown error'));
      }
      setImporting(false);
      onClose();
    }
  };

  const fileLabel = file ? file.name : 'Choose File';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => setTab('wikipedia')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'wikipedia'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Wikipedia
          </button>
          <button
            onClick={() => setTab('wikibooks')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'wikibooks'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            WikiBooks
          </button>
          <button
            onClick={() => setTab('file')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'file'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Import from file
          </button>
        </div>

        {tab === 'wikipedia' ? (
          <>
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Import from Wikipedia</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter article titles (one per line) to import from Wikipedia.
            </p>
            <textarea
              value={titles}
              onChange={(e) => setTitles(e.target.value)}
              placeholder="Python (programming language)&#10;Machine learning&#10;Quantum computing"
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
              disabled={importing}
            />
          </>
        ) : tab === 'wikibooks' ? (
          <>
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Import from WikiBooks</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter a WikiBook title to import with chapter navigation.
            </p>
            <input
              type="text"
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder="Linear Algebra"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
              disabled={importing}
            />
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Import from File</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Import articles from JSON export, text, or markdown files.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".json,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 transition-colors mb-4"
              disabled={importing}
            >
              {fileLabel}
            </button>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Import as</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importType"
                    checked={importType === 'article'}
                    onChange={() => setImportType('article')}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">Article</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importType"
                    checked={importType === 'book'}
                    onChange={() => setImportType('book')}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">Book</span>
                </label>
              </div>
            </div>

            {importType === 'book' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chapters</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="splitMode"
                      checked={splitMode === 'single'}
                      onChange={() => setSplitMode('single')}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">Single chapter</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="splitMode"
                      checked={splitMode === 'split'}
                      onChange={() => setSplitMode('split')}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">Split by headings</span>
                  </label>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleImport}
            disabled={importing || (tab === 'wikipedia' ? !titles.trim() : tab === 'wikibooks' ? !bookTitle.trim() : !file)}
            className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
          <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">Cancel</button>
        </div>
      </div>
    </div>
  );
}
