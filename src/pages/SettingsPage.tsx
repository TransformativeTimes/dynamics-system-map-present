// ============================================================
// SettingsPage — API key, model selection, theme management, export
// ============================================================

import { useState, useMemo } from 'react';
import type { AppSettings, Theme } from '../types';

interface SettingsPageProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  themes: Theme[];
  onCreateTheme: (name: string, description: string) => void;
  onArchiveTheme: (themeId: string) => void;
  onExport: () => void;
}

interface OpenRouterModel {
  id: string;
  name: string;
}

const MODEL_CACHE_KEY = 'openrouter-models-cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function loadCachedModels(): OpenRouterModel[] | null {
  try {
    const raw = localStorage.getItem(MODEL_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (Date.now() - cache.timestamp > CACHE_TTL_MS) return null;
    return cache.models as OpenRouterModel[];
  } catch {
    return null;
  }
}

function saveCachedModels(models: OpenRouterModel[]) {
  try {
    localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify({ models, timestamp: Date.now() }));
  } catch { /* quota exceeded — non-critical */ }
}

const FALLBACK_MODELS: OpenRouterModel[] = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic: Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3-opus', name: 'Anthropic: Claude 3 Opus' },
  { id: 'openai/gpt-4o', name: 'OpenAI: GPT-4o' },
  { id: 'openai/gpt-4.1', name: 'OpenAI: GPT-4.1' },
  { id: 'google/gemini-2.5-pro', name: 'Google: Gemini 2.5 Pro' },
  { id: 'google/gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash' },
  { id: 'meta-llama/llama-4-maverick', name: 'Meta: Llama 4 Maverick' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek: V3' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek: R1' },
  { id: 'qwen/qwen3-235b-a22b', name: 'Qwen: Qwen3 235B' },
];

export default function SettingsPage({
  settings,
  onSettingsChange,
  themes,
  onCreateTheme,
  onArchiveTheme,
  onExport,
}: SettingsPageProps) {
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeDesc, setNewThemeDesc] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>(() => loadCachedModels() ?? FALLBACK_MODELS);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState('');

  const fetchModels = async () => {
    setIsFetchingModels(true);
    setModelFetchError(null);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const fetched: OpenRouterModel[] = (json.data as any[]).map((m: any) => ({
        id: m.id,
        name: m.name ?? m.id,
      }));
      // Sort: free models first, then alphabetically by name
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setModels(fetched);
      saveCachedModels(fetched);
    } catch (err: any) {
      setModelFetchError(err.message ?? 'Failed to fetch models');
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Filter models by search
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return models;
    const q = modelSearch.toLowerCase();
    return models.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [models, modelSearch]);

  const modelRoles = [
    { key: 'criticalQuestioner', label: 'Critical Questioner', desc: 'Reads the signal, produces four complexity-science questions' },
    { key: 'diagramBuilder', label: 'Diagram Builder', desc: 'Converts signal and answers into a structured causal loop diagram' },
    { key: 'variationGenerator', label: 'Variation Generator', desc: 'Applies named operators to produce variant graphs' },
    { key: 'interpreter', label: 'Interpreter', desc: 'Writes human-readable explanations of structural findings' },
  ] as const;

  const handleCreateTheme = () => {
    if (!newThemeName.trim()) return;
    onCreateTheme(newThemeName.trim(), newThemeDesc.trim());
    setNewThemeName('');
    setNewThemeDesc('');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.eyebrow}>Settings</div>
        <h2 style={styles.heading}>Configuration</h2>
      </div>

      <div style={styles.content}>
        {/* API Configuration */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>API Configuration</h3>
          <p style={styles.sectionDesc}>
            All AI calls go through OpenRouter. Enter your API key and select models for each agent role.
          </p>

          <div style={styles.fieldGroup}>
            <label style={styles.fieldLabel}>OpenRouter API Key</label>
            <div style={styles.apiKeyRow}>
              <input
                style={styles.input}
                type={showApiKey ? 'text' : 'password'}
                value={settings.openRouterApiKey}
                onChange={(e) =>
                  onSettingsChange({ ...settings, openRouterApiKey: e.target.value })
                }
                placeholder="sk-or-..."
              />
              <button
                style={styles.toggleButton}
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <div style={styles.modelHeaderRow}>
              <label style={styles.fieldLabel}>Model Selection</label>
              <button
                style={styles.refreshButton}
                onClick={fetchModels}
                disabled={isFetchingModels}
                title="Fetch latest models from OpenRouter"
              >
                {isFetchingModels ? '⟳ Refreshing...' : '⟳ Refresh from OpenRouter'}
              </button>
            </div>
            <p style={styles.fieldHint}>
              Each agent role can use a different model. Models are fetched from OpenRouter and cached for 24 hours.
              {models.length > 10 && ` ${models.length} models available.`}
            </p>
            {modelFetchError && (
              <p style={styles.errorText}>Could not refresh: {modelFetchError}. Using cached/fallback list.</p>
            )}

            <div style={styles.searchRow}>
              <input
                style={styles.searchInput}
                type="text"
                placeholder="Filter models by name or ID..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
              />
            </div>

            {modelRoles.map(({ key, label, desc }) => (
              <div key={key} style={styles.modelRow}>
                <div style={styles.modelRole}>
                  <div style={styles.modelRoleName}>{label}</div>
                  <div style={styles.modelRoleDesc}>{desc}</div>
                </div>
                <select
                  style={styles.modelSelect}
                  value={settings.modelSelections[key] ?? ''}
                  onChange={(e) =>
                    onSettingsChange({
                      ...settings,
                      modelSelections: {
                        ...settings.modelSelections,
                        [key]: e.target.value,
                      },
                    })
                  }
                >
                  <option value="">— Select a model —</option>
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        {/* Theme Management */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Theme Management</h3>
          <p style={styles.sectionDesc}>
            Themes are isolated workspaces. Variables never merge across themes.
          </p>

          <div style={styles.themeList}>
            {themes.map((theme) => (
              <div key={theme.id} style={styles.themeRow}>
                <div>
                  <div style={styles.themeName}>{theme.name}</div>
                  {theme.description && (
                    <div style={styles.themeDesc}>{theme.description}</div>
                  )}
                  <div style={styles.themeMeta}>
                    Created {new Date(theme.createdAt).toLocaleDateString('en-GB')}
                    {!theme.active && ' · Archived'}
                  </div>
                </div>
                {theme.active && (
                  <button
                    style={styles.archiveButton}
                    onClick={() => onArchiveTheme(theme.id)}
                  >
                    Archive
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={styles.createTheme}>
            <div style={styles.fieldLabel}>Create New Theme</div>
            <input
              style={styles.input}
              type="text"
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              placeholder='Theme name, e.g. "Future of Food"'
            />
            <input
              style={{ ...styles.input, marginTop: 8 }}
              type="text"
              value={newThemeDesc}
              onChange={(e) => setNewThemeDesc(e.target.value)}
              placeholder="Short description (optional)"
            />
            <button
              style={{
                ...styles.createButton,
                ...(!newThemeName.trim() ? styles.buttonDisabled : {}),
              }}
              onClick={handleCreateTheme}
              disabled={!newThemeName.trim()}
            >
              Create Theme
            </button>
          </div>
        </section>

        {/* Export */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Export</h3>
          <p style={styles.sectionDesc}>
            Export the complete graph with all provenance, observations, critical questions, and merge decisions.
            JSON plus a readable Markdown rendering. Full exit, no hesitation.
          </p>
          <button style={styles.exportButton} onClick={onExport}>
            Export All Data
          </button>
        </section>

        {/* Help Language */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Help Content Language</h3>
          <div style={styles.toggleRow}>
            <button
              style={{
                ...styles.langButton,
                ...(settings.helpLanguage === 'en' ? styles.langActive : {}),
              }}
              onClick={() => onSettingsChange({ ...settings, helpLanguage: 'en' })}
            >
              English
            </button>
            <button
              style={{
                ...styles.langButton,
                ...(settings.helpLanguage === 'pt' ? styles.langActive : {}),
              }}
              onClick={() => onSettingsChange({ ...settings, helpLanguage: 'pt' })}
            >
              Português
            </button>
          </div>
        </section>

        {/* Autosave */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Autosave</h3>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={settings.autosaveEnabled}
              onChange={(e) =>
                onSettingsChange({ ...settings, autosaveEnabled: e.target.checked })
              }
              style={styles.checkbox}
            />
            <span>Automatically save session progress</span>
          </label>
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: 'calc(100vh - 52px)',
    overflowY: 'auto' as const,
    padding: 32,
  },
  header: {
    marginBottom: 32,
  },
  eyebrow: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent)',
    marginBottom: 4,
  },
  heading: {
    fontFamily: 'var(--serif)',
    fontWeight: 400,
    fontSize: 34,
    lineHeight: 1.12,
    color: 'var(--text-primary)',
    textShadow: 'var(--glow)',
    margin: 0,
  },
  content: {
    maxWidth: 680,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 32,
  },
  section: {
    background: 'linear-gradient(180deg, #161717, #131414)',
    border: '1px solid var(--n200)',
    borderRadius: 'var(--radius-lg)',
    padding: 24,
  },
  sectionTitle: {
    fontFamily: 'var(--serif)',
    fontWeight: 400,
    fontSize: 20,
    color: 'var(--text-primary)',
    margin: '0 0 4px',
  },
  sectionDesc: {
    fontSize: 13,
    color: 'var(--n700)',
    lineHeight: 1.5,
    margin: '0 0 16px',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--n800)',
    display: 'block',
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 12,
    color: 'var(--n600)',
    margin: '0 0 10px',
  },
  apiKeyRow: {
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    background: 'var(--n100)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-body)',
    fontFamily: 'var(--mono)',
    fontSize: 13,
    outline: 'none',
  },
  toggleButton: {
    padding: '8px 14px',
    background: 'var(--n200)',
    color: 'var(--n800)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  modelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '10px 0',
    borderBottom: '1px solid var(--n200)',
  },
  modelRole: {
    minWidth: 180,
  },
  modelRoleName: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--n1100)',
  },
  modelRoleDesc: {
    fontSize: 11,
    color: 'var(--n600)',
    marginTop: 2,
  },
  modelSelect: {
    flex: 1,
    padding: '6px 10px',
    background: 'var(--n100)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-body)',
    fontFamily: 'var(--mono)',
    fontSize: 12,
    outline: 'none',
    cursor: 'pointer',
    maxWidth: 320,
  },
  modelHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  refreshButton: {
    padding: '4px 12px',
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid var(--g300)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  searchRow: {
    marginBottom: 12,
  },
  searchInput: {
    width: '100%',
    padding: '6px 10px',
    background: 'var(--n100)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-body)',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  errorText: {
    fontSize: 12,
    color: 'var(--r600)',
    margin: '0 0 10px',
    fontFamily: 'var(--mono)',
  },
  themeList: {
    marginBottom: 16,
  },
  themeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid var(--n200)',
  },
  themeName: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--n1100)',
  },
  themeDesc: {
    fontSize: 12,
    color: 'var(--n700)',
    marginTop: 2,
  },
  themeMeta: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--n500)',
    marginTop: 4,
  },
  archiveButton: {
    padding: '4px 12px',
    background: 'transparent',
    color: 'var(--n600)',
    border: '1px solid var(--n400)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--mono)',
    fontSize: 10,
    cursor: 'pointer',
  },
  createTheme: {
    padding: '16px 0 0',
    borderTop: '1px solid var(--n200)',
  },
  createButton: {
    marginTop: 12,
    padding: '8px 18px',
    background: 'var(--accent)',
    color: 'var(--n100)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  exportButton: {
    padding: '10px 20px',
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  toggleRow: {
    display: 'flex',
    gap: 8,
  },
  langButton: {
    padding: '8px 18px',
    background: 'transparent',
    color: 'var(--n700)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  langActive: {
    background: 'var(--g100)',
    color: 'var(--accent)',
    borderColor: 'var(--g300)',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    color: 'var(--n900)',
    cursor: 'pointer',
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: 'var(--accent)',
    cursor: 'pointer',
  },
};