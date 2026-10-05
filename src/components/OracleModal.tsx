import { useState, useEffect } from 'react';
import { Article } from '../types';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const OLLAMA_URL = 'http://localhost:11434/v1/chat/completions';
const LITELLM_URL = 'http://localhost:4000/v1/chat/completions';

function buildPrompt(titles: string): string {
  return `You are a knowledge gap analyst. Given the following list of article titles from a personal wiki,
identify topics that are LIKELY missing. Look for:
1. Topics that are mentioned indirectly (e.g. an article about "World War II" implies missing "Adolf Hitler")
2. Related concepts that should have their own page
3. Obvious connections that are absent

Return ONLY a JSON array of strings, e.g. ["Topic 1", "Topic 2", ...]. No explanation.

Existing article titles:
${titles}

Missing topics:`;
}

function parseGaps(text: string): string[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === 'string').slice(0, 20);
  } catch {}
  const lines: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) lines.push(trimmed.slice(2).replace(/^"|"$/g, ''));
    else if (trimmed.startsWith('"') && trimmed.endsWith('"')) lines.push(trimmed.slice(1, -1));
  }
  return lines.filter(Boolean).slice(0, 20);
}

async function tryOllama(prompt: string): Promise<string | null> {
  try {
    const resp = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { num_ctx: 4096 },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

function getLiteLLMToken(): string {
  const stored = localStorage.getItem('litellm_api_token');
  return stored || '';
}

async function tryLiteLLM(prompt: string): Promise<string | null> {
  const token = getLiteLLMToken();
  if (!token) return null;
  try {
    const resp = await fetch(LITELLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

export function OracleModal({
  articles,
  onClose,
  onSearchTopic,
}: {
  articles: Article[];
  onClose: () => void;
  onSearchTopic: (topic: string) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [gaps, setGaps] = useState<string[]>([]);
  const [spinnerIdx, setSpinnerIdx] = useState(0);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!analyzing) return;
    const interval = window.setInterval(() => {
      setSpinnerIdx(prev => (prev + 1) % SPINNER_FRAMES.length);
    }, 100);
    return () => clearInterval(interval);
  }, [analyzing]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    setGaps([]);
    setLogs([]);

    addLog(`Building prompt from ${articles.length} articles...`);
    const titles = articles.map(a => a.title).join('\n');
    const prompt = buildPrompt(titles);
    addLog('Prompt ready, contacting Ollama (qwen2.5:3b)...');

    let text = await tryOllama(prompt);
    if (text) {
      addLog('Ollama responded successfully.');
    } else {
      addLog('Ollama unavailable, falling back to LiteLLM (gemini-2.5-flash)...');
      text = await tryLiteLLM(prompt);
      if (text) {
        addLog('LiteLLM responded successfully.');
      }
    }

    if (!text) {
      addLog('ERROR: Both models failed to respond.');
      setError('Both Ollama and LiteLLM failed to respond');
      setAnalyzing(false);
      return;
    }

    addLog('Parsing response...');
    const result = parseGaps(text);
    addLog(`Found ${result.length} potential missing topics.`);
    setGaps(result);
    setAnalyzing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">The Oracle</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Analyzes your knowledge base for missing topics and "red links" — concepts mentioned in your articles that don't have their own page yet.
        </p>

        {(analyzing || logs.length > 0) && (
          <div className="bg-gray-900 text-green-400 font-mono text-xs rounded p-3 mb-4 max-h-48 overflow-y-auto whitespace-pre-wrap">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
            {analyzing && <span>{SPINNER_FRAMES[spinnerIdx]} Analyzing...</span>}
          </div>
        )}

        {!analyzing && gaps.length === 0 && logs.length === 0 && (
          <button
            onClick={handleAnalyze}
            disabled={articles.length === 0}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 self-start"
          >
            Find Knowledge Gaps
          </button>
        )}

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm mb-4">{error}</div>
        )}

        {gaps.length > 0 && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Found {gaps.length} potential missing topics:
            </p>
            <div className="flex-1 overflow-y-auto space-y-1 mb-4 border border-gray-200 dark:border-gray-700 rounded p-1">
              {gaps.map((topic, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <span className="text-sm text-gray-900 dark:text-white truncate">{topic}</span>
                  <button
                    onClick={() => { onSearchTopic(topic); onClose(); }}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 shrink-0"
                  >
                    Create
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {!analyzing && gaps.length > 0 && (
          <button
            onClick={handleAnalyze}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 self-start mb-4"
          >
            Re-analyze
          </button>
        )}

        <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
