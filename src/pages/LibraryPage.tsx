// ============================================================
// LibraryPage — All saved simulations for the active theme
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Simulation } from '../types';

interface LibraryPageProps {
  activeThemeId: string | null;
  simulations: Simulation[];
  onPromoteSimulation: (simulationId: string) => void;
}

export default function LibraryPage({ activeThemeId, simulations, onPromoteSimulation }: LibraryPageProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'saved' | 'promoted'>('all');
  const [search, setSearch] = useState('');

  const handleViewDetails = (simId: string) => {
    navigate(`/editor/${simId}`);
  };

  if (!activeThemeId) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>+</div>
        <h2 style={styles.emptyTitle}>Create your first theme</h2>
        <p style={styles.emptyText}>
          A theme is a workspace for a research area. Create one to start building causal loop diagrams.
        </p>
      </div>
    );
  }

  const themeSimulations = simulations.filter((s) => s.themeId === activeThemeId);

  const filtered = themeSimulations
    .filter((s) => {
      if (filter === 'saved') return s.status === 'saved';
      if (filter === 'promoted') return s.status === 'promoted';
      return true;
    })
    .filter((s) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.signalText.toLowerCase().includes(q) ||
        s.criticalQuestions.some((cq) => cq.question.toLowerCase().includes(q)) ||
        s.criticalAnswers.some((ca) => ca.answer.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Causal Loop Dynamics</div>
          <h2 style={styles.heading}>Simulation Library</h2>
        </div>
        <div style={styles.headerRight}>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search signals, questions, answers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={styles.filters}>
        <button
          style={{ ...styles.filterButton, ...(filter === 'all' ? styles.filterActive : {}) }}
          onClick={() => setFilter('all')}
        >
          All ({themeSimulations.length})
        </button>
        <button
          style={{ ...styles.filterButton, ...(filter === 'saved' ? styles.filterActive : {}) }}
          onClick={() => setFilter('saved')}
        >
          Saved ({themeSimulations.filter((s) => s.status === 'saved').length})
        </button>
        <button
          style={{ ...styles.filterButton, ...(filter === 'promoted' ? styles.filterActive : {}) }}
          onClick={() => setFilter('promoted')}
        >
          Promoted ({themeSimulations.filter((s) => s.status === 'promoted').length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.noResults}>
          <p style={styles.noResultsText}>
            {themeSimulations.length === 0
              ? 'No simulations yet. Go to the Dashboard to create your first causal loop diagram.'
              : 'No simulations match your filter.'}
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((sim) => (
            <div key={sim.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>{sim.title}</div>
                <div style={{
                  ...styles.statusBadge,
                  ...(sim.status === 'promoted' ? styles.statusPromoted : {}),
                }}>
                  {sim.status}
                </div>
              </div>

              <div style={styles.cardDate}>
                {new Date(sim.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>

              <div style={styles.signalPreview}>{sim.signalText}</div>

              <div style={styles.meta}>
                <span style={styles.metaItem}>{sim.variables.length} variables</span>
                <span style={styles.metaItem}>{sim.edges.length} edges</span>
                <span style={styles.metaItem}>
                  {sim.edges.filter((e) => e.provenance === 'field_observation').length} observed
                </span>
              </div>

              {sim.criticalQuestions.length > 0 && (
                <div style={styles.questionsPreview}>
                  {sim.criticalQuestions.slice(0, 2).map((q) => (
                    <div key={q.id} style={styles.questionLine}>{q.question}</div>
                  ))}
                  {sim.criticalQuestions.length > 2 && (
                    <div style={styles.moreLine}>+{sim.criticalQuestions.length - 2} more questions</div>
                  )}
                </div>
              )}

              <div style={styles.cardActions}>
                {sim.status === 'saved' && (
                  <button
                    style={styles.promoteButton}
                    onClick={() => onPromoteSimulation(sim.id)}
                  >
                    Promote to Map
                  </button>
                )}
                <button
                  style={styles.viewButton}
                  onClick={() => handleViewDetails(sim.id)}
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerRight: {
    display: 'flex',
    gap: 12,
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
  searchInput: {
    padding: '8px 14px',
    background: 'var(--n200)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-body)',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    width: 280,
    outline: 'none',
  },
  filters: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
  },
  filterButton: {
    padding: '6px 16px',
    background: 'transparent',
    color: 'var(--n700)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  filterActive: {
    background: 'var(--g100)',
    color: 'var(--accent)',
    borderColor: 'var(--g300)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: 16,
  },
  card: {
    background: 'linear-gradient(180deg, #161717, #131414)',
    border: '1px solid var(--n200)',
    borderRadius: 'var(--radius-lg)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--n1100)',
    fontFamily: 'var(--serif)',
    lineHeight: 1.2,
    flex: 1,
  },
  cardDate: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.08em',
    color: 'var(--n600)',
    textTransform: 'uppercase' as const,
  },
  statusBadge: {
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--n200)',
    color: 'var(--n700)',
    flexShrink: 0,
  },
  statusPromoted: {
    background: 'var(--g100)',
    color: 'var(--accent)',
  },
  signalPreview: {
    fontSize: 14,
    color: 'var(--n900)',
    lineHeight: 1.6,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  },
  meta: {
    display: 'flex',
    gap: 16,
  },
  metaItem: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--n600)',
  },
  questionsPreview: {
    borderTop: '1px solid var(--n200)',
    paddingTop: 10,
  },
  questionLine: {
    fontSize: 12,
    color: 'var(--n700)',
    lineHeight: 1.5,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  moreLine: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--n500)',
  },
  cardActions: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  promoteButton: {
    padding: '6px 14px',
    background: 'var(--accent)',
    color: 'var(--n100)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  viewButton: {
    padding: '6px 14px',
    background: 'transparent',
    color: 'var(--n800)',
    border: '1px solid var(--n400)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 12,
    cursor: 'pointer',
  },
  noResults: {
    display: 'flex',
    justifyContent: 'center',
    padding: 60,
  },
  noResultsText: {
    fontSize: 14,
    color: 'var(--n600)',
    textAlign: 'center' as const,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - 52px)',
    gap: 16,
    padding: 40,
    textAlign: 'center' as const,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    border: '2px dashed var(--n400)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    color: 'var(--n500)',
    fontFamily: 'var(--serif)',
  },
  emptyTitle: {
    fontFamily: 'var(--serif)',
    fontWeight: 400,
    fontSize: 28,
    color: 'var(--text-primary)',
    textShadow: 'var(--glow)',
    margin: 0,
  },
  emptyText: {
    fontSize: 15,
    color: 'var(--n700)',
    maxWidth: 420,
    lineHeight: 1.6,
  },
};