import { useState, useEffect } from 'react';
import { Article, VerificationSourceConfig, Language } from '../types';
import { generateWithContext } from '../utils/generation';
import { useOllama } from '../hooks/useOllama';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function GenerateModal({ 
  onClose, 
  onGenerate,
  articles,
  enabledSources,
  initialTopic,
  selectedLanguage,
}: { 
  onClose: () => void; 
  onGenerate: (title: string, content: string, citations?: string) => void;
  articles: Article[];
  enabledSources: VerificationSourceConfig[];
  initialTopic?: string;
  selectedLanguage: Language;
}) {
  const [topic, setTopic] = useState(initialTopic || '');
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [model, setModel] = useState('qwen2.5:3b');
  const [availableModels, setAvailableModels] = useState<string[]>(['qwen2.5:3b']);
  const [spinnerIdx, setSpinnerIdx] = useState(0);
  const { listModels } = useOllama();

  useEffect(() => {
    let interval: number;
    if (generating) {
      interval = window.setInterval(() => {
        setSpinnerIdx(prev => (prev + 1) % SPINNER_FRAMES.length);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [generating]);

  useEffect(() => {
    listModels().then(models => {
      setAvailableModels(models);
      if (!models.includes(model)) setModel(models[0] || 'qwen2.5:3b');
    });
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setError('');
    setStatus('Fetching verification sources...');
    
    try {
      const { content, sources } = await generateWithContext(topic, articles, enabledSources, true, model, selectedLanguage);
      
      setStatus('Generating article with sources...');
      const citations = sources.length > 0 
        ? JSON.stringify(sources.map(s => ({ source: s.name, url: s.url })))
        : undefined;
      
      onGenerate(topic, content, citations);
      onClose();
    } catch (e) {
      setError('Ollama not available. Make sure Ollama is running on localhost:11434');
    } finally {
      setGenerating(false);
      setStatus('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Generate Article with AI</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Uses Ollama locally with RAG and multi-source verification.
        </p>
        <div className="mb-4">
          <label className="text-sm text-gray-600 dark:text-gray-400">Model:</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {availableModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
          Content is cross-referenced against your knowledge base and external sources.
        </p>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a topic (e.g., Quantum Computing)"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
          disabled={generating}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
        />
        {status && <p className="text-blue-500 text-sm mb-4">{status}</p>}
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <div className="flex gap-4">
          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {generating ? `${SPINNER_FRAMES[spinnerIdx]} Generating...` : 'Generate'}
          </button>
          <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">Cancel</button>
        </div>
      </div>
    </div>
  );
}
