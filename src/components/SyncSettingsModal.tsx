import { useState } from 'react';
import { SyncConfig } from '../types/sync';

export function SyncSettingsModal({
  config, onClose, onSave, onTriggerSync, queueLength, onClearQueue,
}: {
  config: SyncConfig;
  onClose: () => void;
  onSave: (config: SyncConfig) => void;
  onTriggerSync: () => void;
  queueLength: number;
  onClearQueue: () => void;
}) {
  const [localConfig, setLocalConfig] = useState<SyncConfig>({ ...config });
  const [syncing, setSyncing] = useState(false);

  const handleTrigger = async () => {
    setSyncing(true);
    await onTriggerSync();
    setSyncing(false);
  };

  const lastSync = config.last_sync
    ? new Date(config.last_sync).toLocaleString()
    : 'Never';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Nightly Sync Settings</h2>

        <div className="space-y-4">
          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={localConfig.enabled}
              onChange={(e) => setLocalConfig({ ...localConfig, enabled: e.target.checked })}
              className="rounded"
            />
            Enable nightly sync
          </label>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Interval (hours)</label>
            <input
              type="number"
              min={1}
              max={168}
              value={localConfig.interval_hours}
              onChange={(e) => setLocalConfig({ ...localConfig, interval_hours: Math.max(1, parseInt(e.target.value) || 24) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={localConfig.news_enabled}
              onChange={(e) => setLocalConfig({ ...localConfig, news_enabled: e.target.checked })}
              className="rounded"
            />
            Pipe A: News/Featured articles
          </label>

          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={localConfig.random_enabled}
              onChange={(e) => setLocalConfig({ ...localConfig, random_enabled: e.target.checked })}
              className="rounded"
            />
            Pipe B: Random discovery
          </label>

          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={localConfig.lex_enabled}
              onChange={(e) => setLocalConfig({ ...localConfig, lex_enabled: e.target.checked })}
              className="rounded"
            />
            Pipe C: Lex.dk (Danish encyclopedia)
          </label>

          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={localConfig.wikibooks_enabled}
              onChange={(e) => setLocalConfig({ ...localConfig, wikibooks_enabled: e.target.checked })}
              className="rounded"
            />
            Pipe D: WikiBooks (educational books)
          </label>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Max articles per sync</label>
            <input
              type="number"
              min={1}
              max={50}
              value={localConfig.max_articles_per_sync}
              onChange={(e) => setLocalConfig({ ...localConfig, max_articles_per_sync: Math.max(1, parseInt(e.target.value) || 10) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={localConfig.auto_import}
              onChange={(e) => setLocalConfig({ ...localConfig, auto_import: e.target.checked })}
              className="rounded"
            />
            Auto-import articles when synced
          </label>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last sync: {lastSync}
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            Queue: {queueLength} articles pending
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-6">
          <div className="flex gap-2">
            <button
              onClick={() => { onSave(localConfig); onClose(); }}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTrigger}
              disabled={syncing}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Trigger Sync Now'}
            </button>
            {queueLength > 0 && (
              <button
                onClick={onClearQueue}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Clear Queue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
