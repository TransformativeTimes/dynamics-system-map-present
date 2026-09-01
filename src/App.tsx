// ============================================================
// App — Root component with routing, auth, and state management
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TopBar from './components/TopBar';
import DashboardPage from './pages/DashboardPage';
import LibraryPage from './pages/LibraryPage';
import SettingsPage from './pages/SettingsPage';
import SimulationEditorPage from './pages/SimulationEditorPage';
import MultiFuturesPage from './pages/MultiFuturesPage';
import SystemMapPage from './pages/SystemMapPage';
import LoginPage from './pages/LoginPage';
import type { Theme, Simulation, AppSettings } from './types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_SETTINGS: AppSettings = {
  openRouterApiKey: '',
  modelSelections: {
    criticalQuestioner: 'anthropic/claude-3.5-sonnet',
    diagramBuilder: 'anthropic/claude-3.5-sonnet',
    variationGenerator: 'anthropic/claude-3.5-sonnet',
    interpreter: 'anthropic/claude-3.5-sonnet',
  },
  helpLanguage: 'en',
  autosaveEnabled: false,
  loginRequired: false,
  username: '',
  passwordHash: '',
};

const DEV_THEME: Theme = {
  id: 'dev-theme-001',
  name: 'Dev Test',
  description: 'Preloaded test theme for development — delete before production',
  createdAt: new Date().toISOString(),
  active: true,
};

const DEV_SIMULATION: Simulation = {
  id: 'dev-sim-001',
  themeId: 'dev-theme-001',
  title: 'Demand-Capacity Spiral',
  signalText: 'Our production capacity keeps lagging behind demand spikes, and every time we catch up, price pressure from new entrants erodes the margin we need to invest in the next cycle.',
  criticalQuestions: [
    { id: 'q1', question: 'What is being held constant in this description that is not actually constant?' },
    { id: 'q2', question: 'Who or what is outside the boundary as drawn, and what would change if they were inside it?' },
    { id: 'q3', question: 'On what timescale is this claim true? What happens if you extend or compress that horizon?' },
    { id: 'q4', question: 'What would have to be true for the opposite dynamic to occur?' },
  ],
  criticalAnswers: [
    { questionId: 'q1', answer: 'We assume market structure is fixed, but consolidation could shift competitive dynamics.', answeredBy: 'You' },
    { questionId: 'q2', answer: 'Regulatory burden is treated as external — if it moved inside the boundary, new feedback loops would emerge.', answeredBy: 'You' },
    { questionId: 'q3', answer: 'This is true at 18 months. At 10 years, consolidation may reduce competitive intensity.', answeredBy: 'You' },
    { questionId: 'q4', answer: 'If innovation investment outpaces price erosion, the reinforcing loop dominates and the spiral becomes a growth engine.', answeredBy: 'You' },
  ],
  variables: [
    { id: 'v1', name: 'Customer Demand', definition: 'Market pull for the product or service', isBoundary: false },
    { id: 'v2', name: 'Production Capacity', definition: 'Ability to meet demand at current scale', isBoundary: false },
    { id: 'v3', name: 'Price Pressure', definition: 'Downward force on pricing from competition', isBoundary: false },
    { id: 'v4', name: 'Innovation Investment', definition: 'Resources allocated to R&D and new capabilities', isBoundary: false },
    { id: 'v5', name: 'Regulatory Burden', definition: 'Compliance costs and constraints', isBoundary: true },
  ],
  edges: [
    { id: 'e1', fromVariableId: 'v1', toVariableId: 'v2', polarity: 'same', delay: 'weeks', strength: 'strong', provenance: 'human_assertion', assertedBy: 'Researcher' },
    { id: 'e2', fromVariableId: 'v2', toVariableId: 'v3', polarity: 'opposite', delay: 'months', strength: 'moderate', provenance: 'model_inference' },
    { id: 'e3', fromVariableId: 'v3', toVariableId: 'v4', polarity: 'opposite', delay: 'months', strength: 'moderate', provenance: 'human_assertion', assertedBy: 'Researcher' },
    { id: 'e4', fromVariableId: 'v4', toVariableId: 'v1', polarity: 'same', delay: 'years', strength: 'strong', provenance: 'field_observation', observationCount: 3 },
    { id: 'e5', fromVariableId: 'v5', toVariableId: 'v2', polarity: 'opposite', delay: 'years', strength: 'weak', provenance: 'model_inference' },
    { id: 'e6', fromVariableId: 'v5', toVariableId: 'v4', polarity: 'opposite', delay: 'years', strength: 'moderate', provenance: 'human_assertion', assertedBy: 'Researcher' },
  ],
  analysis: {
    generalDescription: 'This structure shows a reinforcing loop between customer demand and innovation investment, moderated by price pressure. Production capacity acts as a mediating variable. The regulatory burden sits outside the core loop as an exogenous constraint, dampening both production capacity and innovation investment. The dominant dynamic is a growth engine (R1: Demand → Capacity → Price Pressure → Innovation → Demand) that can either accelerate or stall depending on whether innovation investment keeps pace with price erosion.',
    nodeExplanations: [
      { variableId: 'v1', explanation: 'Customer Demand is the primary driver. It grows with successful innovation but can be eroded by competitive alternatives.' },
      { variableId: 'v2', explanation: 'Production Capacity mediates between demand signals and the ability to deliver. It responds to demand with a delay of weeks.' },
      { variableId: 'v3', explanation: 'Price Pressure emerges as capacity scales and competition enters. It is the balancing force in the system.' },
      { variableId: 'v4', explanation: 'Innovation Investment is the strategic lever. It feeds back into demand but with a long delay (years), creating a potential overshoot dynamic.' },
      { variableId: 'v5', explanation: 'Regulatory Burden is treated as exogenous. It constrains both capacity expansion and innovation spend, but is not itself influenced by anything in the map.' },
    ],
    enablers: [
      'Strong coupling between demand signals and production response',
      'Innovation investment creates differentiation that sustains demand',
      'The reinforcing loop can compound growth when aligned',
    ],
    blockers: [
      'Long delay between innovation investment and demand response creates risk of under-investment',
      'Price pressure can erode margins faster than innovation differentiates',
      'Regulatory burden is unmanaged — no feedback loop addresses it',
    ],
    leverageDistribution: [
      { level: 'Parameters', count: 1 },
      { level: 'Buffers', count: 0 },
      { level: 'Stock & Flow Structures', count: 1 },
      { level: 'Delays', count: 2 },
      { level: 'Balancing Loops', count: 1 },
      { level: 'Reinforcing Loops', count: 1 },
      { level: 'Information Flows', count: 0 },
      { level: 'Rules', count: 0 },
      { level: 'Self-Organization', count: 0 },
      { level: 'Goals', count: 0 },
      { level: 'Paradigms', count: 0 },
    ],
  },
  status: 'saved',
  createdAt: new Date().toISOString(),
};

// ===========================================================
// LocalStorage persistence keys
// ===========================================================

const LS_THEMES = 'cld-themes';
const LS_SIMULATIONS = 'cld-simulations';
const LS_SETTINGS = 'cld-settings';
const LS_AUTH_SESSION = 'cld-auth-session';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Returns settings with API key redacted */
function sanitizeSettingsForStorage(s: AppSettings): AppSettings {
  return {
    ...s,
    openRouterApiKey: s.openRouterApiKey ? '[PRESERVED_IN_SESSION]' : '',
    passwordHash: s.passwordHash ? '[PRESERVED]' : '',
  };
}

/** Restores API key and password hash from in-memory version if the stored copy is redacted */
function restoreSecrets(stored: AppSettings, memory: AppSettings): AppSettings {
  const result = { ...stored };
  if (stored.openRouterApiKey === '[PRESERVED_IN_SESSION]') {
    result.openRouterApiKey = memory.openRouterApiKey;
  }
  if (stored.passwordHash === '[PRESERVED]') {
    result.passwordHash = memory.passwordHash;
  }
  return result;
}

// ===========================================================
// SHA-256 helper (subtle crypto, no external deps)
// ===========================================================

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function App() {
  // ---- Initialize from localStorage (if autosave was on), else dev defaults ----
  const [themes, setThemes] = useState<Theme[]>(() => {
    const stored = loadFromStorage<Theme[]>(LS_THEMES, []);
    return stored.length > 0 ? stored : [DEV_THEME];
  });
  const [simulations, setSimulations] = useState<Simulation[]>(() => {
    const stored = loadFromStorage<Simulation[]>(LS_SIMULATIONS, []);
    return stored.length > 0 ? stored : [DEV_SIMULATION];
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = loadFromStorage<AppSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    return restoreSecrets(stored, DEFAULT_SETTINGS);
  });

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return loadFromStorage<boolean>(LS_AUTH_SESSION, false);
  });
  const [authError, setAuthError] = useState<string | null>(null);

  // Keep a ref to settings so the autosave effect always reads the latest autosaveEnabled
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const activeThemeId = themes.find((t) => t.active)?.id ?? null;

  // ---- Autosave: persist to localStorage whenever data changes (if enabled) ----
  useEffect(() => {
    if (!settingsRef.current.autosaveEnabled) return;
    try {
      localStorage.setItem(LS_THEMES, JSON.stringify(themes));
      localStorage.setItem(LS_SIMULATIONS, JSON.stringify(simulations));
      localStorage.setItem(LS_SETTINGS, JSON.stringify(sanitizeSettingsForStorage(settings)));
    } catch { /* quota exceeded — non-critical */ }
  }, [themes, simulations, settings]);

  // ---- Auth handlers ----

  const handleLogin = useCallback(async (username: string, password: string) => {
    setAuthError(null);
    if (!settings.loginRequired) {
      setIsAuthenticated(true);
      localStorage.setItem(LS_AUTH_SESSION, 'true');
      return;
    }
    if (username !== settings.username) {
      setAuthError('Invalid username or password');
      return;
    }
    const hash = await sha256(password);
    if (hash !== settings.passwordHash) {
      setAuthError('Invalid username or password');
      return;
    }
    setIsAuthenticated(true);
    localStorage.setItem(LS_AUTH_SESSION, 'true');
  }, [settings]);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem(LS_AUTH_SESSION);
    setAuthError(null);
  }, []);

  // ---- Decide if login is required ----
  const needsLogin = settings.loginRequired && !isAuthenticated;

  // ---- Handlers ----

  const handleCreateTheme = useCallback((name?: string, description?: string) => {
    const themeName = name ?? prompt('Theme name:');
    if (!themeName?.trim()) return;

    const newTheme: Theme = {
      id: generateId(),
      name: themeName.trim(),
      description: description ?? '',
      createdAt: new Date().toISOString(),
      active: true,
    };

    setThemes((prev) => [...prev, newTheme]);
  }, []);

  const handleThemeChange = useCallback((themeId: string) => {
    setThemes((prev) =>
      prev.map((t) => ({ ...t, active: t.id === themeId })),
    );
  }, []);

  const handleArchiveTheme = useCallback((themeId: string) => {
    setThemes((prev) =>
      prev.map((t) => (t.id === themeId ? { ...t, active: false } : t)),
    );
  }, []);

  const handleSaveSimulation = useCallback((simulation: Simulation) => {
    setSimulations((prev) => [...prev, simulation]);
  }, []);

  const handlePromoteSimulation = useCallback((simulationId: string) => {
    setSimulations((prev) =>
      prev.map((s) =>
        s.id === simulationId ? { ...s, status: 'promoted' as const } : s,
      ),
    );
  }, []);

  const handleUpdateSimulation = useCallback((simulation: Simulation) => {
    setSimulations((prev) =>
      prev.map((s) => (s.id === simulation.id ? simulation : s)),
    );
  }, []);

  const handleSettingsChange = useCallback((newSettings: AppSettings) => {
    setSettings((prev) => {
      // Preserve secrets in memory — the stored copy is redacted
      return {
        ...newSettings,
        openRouterApiKey: newSettings.openRouterApiKey || prev.openRouterApiKey,
        passwordHash: newSettings.passwordHash || prev.passwordHash,
      };
    });
  }, []);

  const handleExport = useCallback(() => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      themes,
      simulations,
      settings: {
        ...settings,
        openRouterApiKey: '[REDACTED]',
        passwordHash: '[REDACTED]',
      },
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `causal-loop-dynamics-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [themes, simulations, settings]);

  return (
    <BrowserRouter>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {needsLogin ? (
          <LoginPage
            onLogin={handleLogin}
            error={authError}
          />
        ) : (
          <>
            <TopBar
              themes={themes.filter((t) => t.active)}
              activeThemeId={activeThemeId}
              onThemeChange={handleThemeChange}
              onCreateTheme={handleCreateTheme}
            />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Routes>
                <Route
                  path="/"
                  element={
                    <DashboardPage
                      activeThemeId={activeThemeId}
                      simulations={simulations}
                      onSaveSimulation={handleSaveSimulation}
                    />
                  }
                />
                <Route
                  path="/library"
                  element={
                    <LibraryPage
                      activeThemeId={activeThemeId}
                      simulations={simulations}
                      onPromoteSimulation={handlePromoteSimulation}
                    />
                  }
                />
                <Route
                  path="/editor/:simulationId"
                  element={
                    <SimulationEditorPage
                      simulations={simulations}
                      onUpdateSimulation={handleUpdateSimulation}
                    />
                  }
                />
                <Route
                  path="/multi-futures"
                  element={
                    <MultiFuturesPage
                      simulations={simulations}
                    />
                  }
                />
                <Route
                  path="/system-map"
                  element={
                    <SystemMapPage
                      activeThemeId={activeThemeId}
                      simulations={simulations}
                    />
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <SettingsPage
                      settings={settings}
                      onSettingsChange={handleSettingsChange}
                      themes={themes}
                      onCreateTheme={handleCreateTheme}
                      onArchiveTheme={handleArchiveTheme}
                      onExport={handleExport}
                      onLogout={handleLogout}
                    />
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </>
        )}
      </div>
    </BrowserRouter>
  );
}