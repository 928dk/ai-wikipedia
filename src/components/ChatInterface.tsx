import { useState, useRef, useEffect } from 'react';
import { Article, VerificationSourceConfig, Language } from '../types';
import { SyncConfig } from '../types/sync';
import { buildRAGContext } from '../utils/rag';
import { verifyWithWikipedia, verifyWithWikiData } from '../utils/verification';
import { SYSTEM_PROMPT } from '../constants';
import { useOllama, ChatMessage, Tool } from '../hooks/useOllama';

const TOOLS: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'scrape_webpage',
      description: 'Scrape and extract text content from a webpage URL. Use this to get current information from websites.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to scrape (must start with http:// or https://)' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_article_count',
      description: 'Get the number of articles saved in the local knowledge base.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_articles',
      description: 'List all article titles in the knowledge base. Use when user asks what articles are available.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'parse_document',
      description: 'Parse a document file (PDF, Word, Excel, PowerPoint, EPUB, HTML, Markdown, Text, Code, Media, ZIP, Legacy Doc) and extract content with metadata.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file' },
          parser_type: { 
            type: 'string',
            enum: ['pdf', 'docx', 'xlsx', 'pptx', 'epub', 'html', 'markdown', 'txt', 'code', 'media', 'zip', 'legacy_doc'],
            description: 'Type of file to parse'
          }
        },
        required: ['path', 'parser_type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'import_article',
      description: 'Import an article from Wikipedia into the local knowledge base. Use this when a user asks about a topic not already in the article list. Fetches the full article content from Wikipedia in the relevant language.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The exact Wikipedia article title to import (e.g. "Python (programming language)", "Machine learning")' },
          lang: { type: 'string', enum: ['en', 'da', 'de', 'es'], description: 'Optional: Wikipedia language (en=English, da=Danish, de=German, es=Spanish). Defaults to current UI language.' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_wikibooks',
      description: 'Search WikiBooks (en.wikibooks.org) for books matching a topic. Use this BEFORE import_from_wikibooks to find book titles when the user asks about a topic. Returns a list of matching book titles with descriptions.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The topic to search for on WikiBooks (e.g. "gardening", "self reliance", "programming")' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'import_from_wikibooks',
      description: 'Import a book from WikiBooks (en.wikibooks.org) with chapter structure. Use this when a user asks about a topic that is book-length or educational in nature. The book retains chapter navigation. Example: "Self Reliance" or "How to Build a Computer". Use search_wikibooks first if unsure of the exact title.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The exact WikiBooks book title to import (e.g. "Self Reliance", "How to Build a Computer")' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'import_from_lex',
      description: 'Import an article from Lex.dk (Den Store Danske — Danmarks Nationalleksikon, in Danish). Use this when a user asks about Danish topics, Danish history, Danish culture, or any subject where a Danish-language encyclopedia would be authoritative. Content is in Danish.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The topic to search for on Lex.dk (e.g. "Python", "København", "H.C. Andersen")' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'import_from_snl',
      description: 'Import an article from Store Norske Leksikon (SNL — Norway\'s national encyclopedia, in Norwegian). Use this when a user asks about Norwegian topics, Norwegian history, Nordic culture, or any subject where a Norwegian encyclopedia would be authoritative. Content is in Norwegian (Bokmål).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The topic to search for on SNL (e.g. "Python", "Oslo", "Edvard Munch")' }
        },
        required: ['query']
      }
    }
  }
];

export function ChatInterface({ 
  onSaveArticle,
  articles,
  enabledSources,
  syncConfig,
  syncQueueLength,
  selectedLanguage,
}: { 
  onSaveArticle: (title: string, content: string) => void;
  articles: Article[];
  enabledSources: VerificationSourceConfig[];
  syncConfig: SyncConfig | null;
  syncQueueLength: number;
  selectedLanguage: Language;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('qwen2.5:3b');
  const [availableModels, setAvailableModels] = useState<string[]>(['qwen2.5:3b']);
  const [webVerify, setWebVerify] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { chat, executeTool, listModels } = useOllama();
  const [toolOutput, setToolOutput] = useState<string[]>([]);
  const [toolOutputVisible, setToolOutputVisible] = useState(true);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const SILENT_TOOLS = new Set(['import_from_wikibooks']);

  useEffect(() => {
    listModels().then(models => {
      setAvailableModels(models);
      if (!models.includes(model)) setModel(models[0] || 'qwen2.5:3b');
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      let ragContext = '';
      let verificationContext = '';
      
      if (webVerify || articles.length > 0) {
        ragContext = buildRAGContext(userMessage, articles);
        
        if (webVerify) {
          const allSources: any[] = [];
          for (const source of enabledSources) {
            if (!source.enabled) continue;
            try {
              if (source.id === 'wikipedia') {
                allSources.push(...await verifyWithWikipedia(userMessage, selectedLanguage));
              } else if (source.id === 'wikidata') {
                allSources.push(...await verifyWithWikiData(userMessage, selectedLanguage));
              }
            } catch (e) { console.error(`Source ${source.name} failed`); }
          }
          
          const verifiedSources = allSources.filter(s => s.relevance > 0.3);
          if (verifiedSources.length > 0) {
            verificationContext = `\n\nVerified sources:\n${verifiedSources.slice(0, 3).map((s: any) => 
  `- [${s.name}]: ${s.excerpt}\n  ${s.url}`
).join('\n')}`;
          }
        }
      }

      const langName = { en: 'English', da: 'Danish', de: 'German', es: 'Spanish' }[selectedLanguage];
      const systemMessage: ChatMessage = {
        role: 'user',
        content: `[LANGUAGE: ${langName}] CRITICAL: You MUST respond in ${langName}. All your answers, tool descriptions, and reasoning must be in ${langName}.\n\n${SYSTEM_PROMPT}${verificationContext}${ragContext}\n\nUser: ${userMessage}`
      };

      let currentMessages = [systemMessage, ...newMessages.slice(-10)];
      let maxTurns = 5;

      while (maxTurns-- > 0) {
        const response = await chat(currentMessages, model, TOOLS);
        
        if (response.tool_calls?.length) {
          const visibleCalls = response.tool_calls.filter(t => !SILENT_TOOLS.has(t.function.name));
          if (visibleCalls.length > 0) {
            const toolNames = visibleCalls.map(t => t.function.name).join(', ');
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `🔧 Using tools: ${toolNames}` 
            }]);
          }

          const toolResults: ChatMessage[] = [];
          for (const toolCall of response.tool_calls) {
            const result = await executeTool(toolCall, articles, onSaveArticle, selectedLanguage);
            toolResults.push({
              role: 'tool',
              content: result,
              tool_call_id: toolCall.id,
              tool_name: toolCall.function.name,
            });
            setToolOutput(prev => [...prev, `[${toolCall.function.name}]: ${result.slice(0, 100)}`]);
          }

          currentMessages = [...currentMessages, response, ...toolResults];
          const visibleResults = toolResults.filter(t => !SILENT_TOOLS.has(t.tool_name || ''));
          if (visibleResults.length > 0) {
            setMessages(prev => [...prev, ...visibleResults.map(t => ({ 
              role: 'assistant' as const, 
              content: `  → ${t.tool_name}: ${t.content.slice(0, 200)}${t.content.length > 200 ? '...' : ''}` 
            }))]);
          }
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: response.content }]);
          break;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connection failed';
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${msg}\n\nMake sure Ollama is running:\n  ollama serve\n  Available models: ${availableModels.join(', ')}` 
      }]);
    }
    setLoading(false);
  };

  const saveAsArticle = () => {
    const lastAssistant = messages.filter(m => m.role === 'assistant' && !m.content.startsWith('🔧')).pop();
    if (lastAssistant) {
      const title = messages.find(m => m.role === 'user')?.content.slice(0, 100) || 'AI Response';
      onSaveArticle(title, lastAssistant.content);
    }
  };

  return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-green-400 text-sm font-mono">CLI Chat</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-gray-700 text-white text-sm px-2 py-1 rounded"
          >
            {availableModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={webVerify}
              onChange={(e) => setWebVerify(e.target.checked)}
              className="rounded"
            />
            Web Verify
          </label>
          <div className="relative">
            <button
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
            >
              📄 Import File
            </button>
            {showImportMenu && (
              <div className="absolute top-8 left-0 bg-gray-800 border border-gray-700 rounded p-2 z-10 min-w-[150px]">
                {['PDF', 'Word', 'Excel', 'PowerPoint', 'Text', 'HTML', 'Markdown'].map(fmt => (
                  <button
                    key={fmt}
                    onClick={async () => {
                      setShowImportMenu(false);
                      const FORMAT_EXT: Record<string, string[]> = {
                        PDF: ['pdf'], Word: ['docx'], Excel: ['xlsx'],
                        PowerPoint: ['pptx'], Text: ['txt'],
                        HTML: ['html', 'htm'], Markdown: ['md', 'markdown'],
                      };
                      const TEXT_EXTS = new Set(['txt', 'md', 'markdown', 'html', 'htm', 'csv']);
                      const exts = FORMAT_EXT[fmt];
                      try {
                        const { open } = await import('@tauri-apps/plugin-dialog');
                        const selected = await open({
                          multiple: false,
                          filters: [{ name: fmt, extensions: exts }],
                        });
                        if (selected) setInput(`Parse this ${fmt} file: ${selected}`);
                      } catch {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = exts.map(e => '.' + e).join(',');
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;
                          if (TEXT_EXTS.has(exts[0])) {
                            const reader = new FileReader();
                            reader.onload = () => setInput(`${file.name} content:\n${reader.result}`);
                            reader.readAsText(file);
                          } else {
                            setInput(`Cannot parse ${fmt} files in browser mode. Use the desktop app.`);
                          }
                        };
                        input.click();
                      }
                    }}
                    className="block w-full text-left px-3 py-1 hover:bg-gray-700 text-sm text-gray-100"
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {messages.some(m => m.role === 'assistant' && !m.content.startsWith('🔧')) && (
          <button
            onClick={saveAsArticle}
            className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded"
          >
            Save as Article
          </button>
        )}
      </div>
      
      {toolOutput.length > 0 && (
        <div className="bg-gray-800 text-green-400 overflow-hidden">
          <div 
            className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-gray-700"
            onClick={() => setToolOutputVisible(!toolOutputVisible)}
          >
            <span className="text-xs font-mono">📜 Tool Output ({toolOutput.length})</span>
            <span className="text-xs">{toolOutputVisible ? '▼' : '▶'}</span>
          </div>
          {toolOutputVisible && (
            <div className="p-2 max-h-20 overflow-y-auto font-mono text-xs">
              {toolOutput.map((line, i) => (
                <div key={i} className="truncate">{line}</div>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div className="h-80 overflow-y-auto p-4 font-mono text-sm">
        {messages.length === 0 && (
          <div className="text-gray-500">
            <p>$ Welcome to AI CLI with Tools 🔧</p>
            <p className="text-gray-600 mt-2">Ask any question - answers use RAG from your knowledge base.</p>
            <p className="text-gray-600">Enable "Web Verify" to cross-reference with external sources.</p>
            {syncQueueLength > 0 && (
              <p className="text-blue-400 mt-2">
                📡 {syncQueueLength} article{syncQueueLength > 1 ? 's' : ''} synced from Wikipedia. Queue ready for review.
              </p>
            )}
            {syncConfig?.last_sync && (
              <p className="text-gray-500 mt-1 text-xs">
                Last nightly sync: {new Date(syncConfig.last_sync).toLocaleString()}
              </p>
            )}
            <p className="text-gray-600 mt-2">Try: "What articles are available?" or "Scrape https://example.com"</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 ${msg.role === 'user' ? 'text-blue-400' : 'text-gray-300'}`}>
            <span className="text-gray-500 mr-2">{msg.role === 'user' ? '>' : '$'}</span>
            <pre className="whitespace-pre-wrap inline">{msg.content}</pre>
          </div>
        ))}
        {loading && (
          <div className="text-yellow-400">
            <span className="mr-2">...</span>
            <span className="animate-pulse">Processing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="border-t border-gray-700">
        <div className="flex">
          <span className="bg-gray-800 px-4 py-3 text-green-400 font-mono text-sm">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything... (supports tools: scrape_webpage, list_articles)"
            disabled={loading}
            className="flex-1 bg-gray-900 text-white px-4 py-3 font-mono text-sm focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white px-6 py-3 font-mono text-sm"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
