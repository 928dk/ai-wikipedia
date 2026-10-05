import { useState } from 'react';
import { VerificationSourceConfig } from '../types';

export function SourcesModal({ sources, onClose, onUpdate }: {
  sources: VerificationSourceConfig[];
  onClose: () => void;
  onUpdate: (sources: VerificationSourceConfig[]) => void;
}) {
  const [localSources, setLocalSources] = useState(sources);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleSource = (id: string) => {
    const updated = localSources.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setLocalSources(updated);
  };

  const updateSource = (id: string, updates: Partial<VerificationSourceConfig>) => {
    const updated = localSources.map(s => s.id === id ? { ...s, ...updates } : s);
    setLocalSources(updated);
  };

  const addSource = () => {
    const newSource: VerificationSourceConfig = {
      id: `custom-${Date.now()}`,
      name: 'New Source',
      type: 'api',
      enabled: true,
      config: { url: 'https://api.example.com/verify?q={query}' },
    };
    setLocalSources([...localSources, newSource]);
    setEditingId(newSource.id);
  };

  const removeSource = (id: string) => {
    if (id.startsWith('wikipedia') || id.startsWith('wikidata')) return;
    setLocalSources(localSources.filter(s => s.id !== id));
  };

  const handleSave = () => {
    onUpdate(localSources);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Verification Sources</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enable/disable verification sources. Add custom APIs or scrapers below.
        </p>

        <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
          {localSources.map((source) => (
            <div key={source.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={source.enabled}
                    onChange={() => toggleSource(source.id)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="font-medium text-gray-900 dark:text-white">{source.name}</span>
                  <span className="text-xs text-gray-500">{source.type}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingId(editingId === source.id ? null : source.id)} className="text-blue-600 hover:underline text-sm">
                    {editingId === source.id ? 'Hide' : 'Edit'}
                  </button>
                  {!source.id.startsWith('wikipedia') && !source.id.startsWith('wikidata') && (
                    <button onClick={() => removeSource(source.id)} className="text-red-600 hover:underline text-sm">
                      Remove
                    </button>
                  )}
                </div>
              </div>
              
              {editingId === source.id && (
                <div className="mt-3 space-y-2 pl-8">
                  <input
                    type="text"
                    value={source.name}
                    onChange={(e) => updateSource(source.id, { name: e.target.value })}
                    placeholder="Source name"
                    className="w-full px-3 py-1 border rounded text-sm"
                  />
                  <input
                    type="text"
                    value={source.config.url || ''}
                    onChange={(e) => updateSource(source.id, { config: { ...source.config, url: e.target.value } })}
                    placeholder="API URL (use {query} for search)"
                    className="w-full px-3 py-1 border rounded text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Use {'{query}'} in URL for search term. Configure response parsing in code.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <button onClick={addSource} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            + Add Custom Source
          </button>
          <div className="flex-1"></div>
          <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
}
