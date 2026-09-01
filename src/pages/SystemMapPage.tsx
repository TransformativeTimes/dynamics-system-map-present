// ============================================================
// SystemMapPage — Combine saved causal loops into one system map
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge as FlowEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import VariableNode from '../components/VariableNode';
import CausalEdge from '../components/CausalEdge';
import type { Simulation, Variable, Edge } from '../types';

// ============================================================
// Types
// ============================================================

interface SystemLoop {
  id: string;
  variables: string[];
  type: 'reinforcing' | 'balancing';
  description: string;
}

interface IntegrationPoint {
  name: string;
  sourceCount: number;
  sourceSimTitles: string[];
}

interface SystemMapReport {
  summary: string;
  dynamics: string;
  mainForces: string[];
  integrationPoints: IntegrationPoint[];
  loops: SystemLoop[];
  opportunities: string[];
}

interface SystemMapPageProps {
  activeThemeId: string | null;
  simulations: Simulation[];
}

// ============================================================
// Layout helpers
// ============================================================

function mapVariablesToFlowNodes(variables: Variable[]): Node[] {
  const count = variables.length;
  const radius = Math.max(170, 120 + count * 14);
  const centerX = 430;
  const centerY = 280;

  return variables.map((v, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      id: v.id,
      type: 'variable',
      position: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
      data: { variable: v },
    };
  });
}

function mapEdgesToFlowEdges(edges: Edge[]): FlowEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.fromVariableId,
    target: e.toVariableId,
    type: 'causal',
    data: { edge: e },
  }));
}

// ============================================================
// System map generation (simulated AI synthesis)
// ============================================================

function generateSystemMap(
  sims: Simulation[],
): { variables: Variable[]; edges: Edge[]; report: SystemMapReport } {
  // 1. Merge variables by normalised name (shared variables become one node)
  const nameToId = new Map<string, string>();
  const sourceMap = new Map<string, { display: string; titles: Set<string>, isBoundary: boolean }>();
  const variables: Variable[] = [];

  for (const sim of sims) {
    for (const v of sim.variables) {
      const key = v.name.trim().toLowerCase();
      if (!nameToId.has(key)) {
        const id = `map-${variables.length}`;
        nameToId.set(key, id);
        sourceMap.set(key, { display: v.name.trim(), titles: new Set(), isBoundary: v.isBoundary });
        variables.push({
          id,
          name: v.name.trim(),
          definition: v.definition,
          isBoundary: v.isBoundary,
        });
      }
      sourceMap.get(key)!.titles.add(sim.title);
    }
  }

  // 2. Merge edges, deduplicating same (from, to, polarity)
  const edgeKeySet = new Set<string>();
  const edges: Edge[] = [];

  for (const sim of sims) {
    for (const e of sim.edges) {
      const fromVar = sim.variables.find((v) => v.id === e.fromVariableId);
      const toVar = sim.variables.find((v) => v.id === e.toVariableId);
      if (!fromVar || !toVar) continue;

      const fromId = nameToId.get(fromVar.name.trim().toLowerCase());
      const toId = nameToId.get(toVar.name.trim().toLowerCase());
      if (!fromId || !toId || fromId === toId) continue;

      const key = `${fromId}|${toId}|${e.polarity}`;
      if (edgeKeySet.has(key)) continue;
      edgeKeySet.add(key);

      edges.push({
        id: `me-${edges.length}`,
        fromVariableId: fromId,
        toVariableId: toId,
        polarity: e.polarity,
        delay: e.delay,
        strength: e.strength,
        provenance: 'model_inference',
      });
    }
  }

  // 3. Integration points — variables appearing in more than one source diagram
  const integrationPoints: IntegrationPoint[] = [];
  sourceMap.forEach((info) => {
    if (info.titles.size > 1) {
      integrationPoints.push({
        name: info.display,
        sourceCount: info.titles.size,
        sourceSimTitles: [...info.titles],
      });
    }
  });
  integrationPoints.sort((a, b) => b.sourceCount - a.sourceCount);

  // 4. Degree analysis — drivers (out) and hubs (in)
  const outDegree: Record<string, number> = {};
  const inDegree: Record<string, number> = {};
  variables.forEach((v) => { outDegree[v.id] = 0; inDegree[v.id] = 0; });
  edges.forEach((e) => {
    outDegree[e.fromVariableId] = (outDegree[e.fromVariableId] ?? 0) + 1;
    inDegree[e.toVariableId] = (inDegree[e.toVariableId] ?? 0) + 1;
  });

  const drivers = variables
    .map((v) => ({ name: v.name, count: outDegree[v.id] ?? 0 }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  const hubs = variables
    .map((v) => ({ name: v.name, count: inDegree[v.id] ?? 0 }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  // 5. Loop detection — simple cycles in the merged graph
  const idToName: Record<string, string> = {};
  const adj: Record<string, string[]> = {};
  variables.forEach((v) => { idToName[v.id] = v.name; adj[v.id] = []; });
  edges.forEach((e) => { if (!adj[e.fromVariableId]) adj[e.fromVariableId] = []; adj[e.fromVariableId].push(e.toVariableId); });

  const loops: SystemLoop[] = [];
  const seenLoopKeys = new Set<string>();

  const findCycles = (start: string, current: string, path: string[], depth: number) => {
    if (depth > 8) return;
    const neighbors = adj[current] ?? [];
    for (const next of neighbors) {
      if (next === start && path.length >= 2) {
        const cycleVars = [...path];
        const cycleEdges: Edge[] = [];
        for (let i = 0; i < cycleVars.length; i++) {
          const from = cycleVars[i];
          const to = cycleVars[(i + 1) % cycleVars.length];
          const ed = edges.find((e) => e.fromVariableId === from && e.toVariableId === to);
          if (ed) cycleEdges.push(ed);
        }
        if (cycleEdges.length === cycleVars.length) {
          const net = cycleEdges.reduce((acc, e) => acc * (e.polarity === 'same' ? 1 : -1), 1);
          const type: 'reinforcing' | 'balancing' = net > 0 ? 'reinforcing' : 'balancing';
          const names = cycleVars.map((id) => idToName[id] ?? id);
          const canonical = [...names].sort().join('→');
          if (!seenLoopKeys.has(canonical)) {
            seenLoopKeys.add(canonical);
            loops.push({
              id: `loop-${loops.length}`,
              variables: names,
              type,
              description:
                type === 'reinforcing'
                  ? `Reinforcing loop: ${names.join(' → ')} — each part amplifies the next, creating a self-reinforcing cycle.`
                  : `Balancing loop: ${names.join(' → ')} — an odd number of negative links stabilises the system.`,
            });
          }
        }
        return;
      }
      if (!path.includes(next)) {
        findCycles(start, next, [...path, next], depth + 1);
      }
    }
  };

  variables.forEach((v) => {
    if (!v.isBoundary) findCycles(v.id, v.id, [v.id], 1);
  });
  loops.sort((a, b) => b.variables.length - a.variables.length);

  // 6. Build report
  const reinforcingCount = loops.filter((l) => l.type === 'reinforcing').length;
  const balancingCount = loops.filter((l) => l.type === 'balancing').length;

  const mainForces: string[] = [];
  loops.slice(0, 3).forEach((l) => {
    mainForces.push(
      l.type === 'reinforcing'
        ? `Reinforcing driver: ${l.variables.join(' → ')}`
        : `Balancing force: ${l.variables.join(' → ')}`,
    );
  });
  drivers.slice(0, 2).forEach((d) => {
    mainForces.push(`${d.name} is a high-leverage driver influencing ${d.count} other forces`);
  });
  hubs.slice(0, 2).forEach((h) => {
    mainForces.push(`${h.name} is a convergence point receiving ${h.count} influences`);
  });

  const dynamics = [
    `The combined map contains ${variables.length} variables and ${edges.length} connections, synthesised from ${sims.length} causal loop diagram${sims.length === 1 ? '' : 's'}.`,
    loops.length > 0
      ? `${reinforcingCount} reinforcing and ${balancingCount} balancing loop${loops.length === 1 ? '' : 's'} were detected across the merged structure.`
      : 'No closed feedback loops were detected in the merged structure.',
    integrationPoints.length > 0
      ? `${integrationPoints.length} variable${integrationPoints.length === 1 ? '' : 's'} act as integration points, appearing across multiple source diagrams and binding them into a single system.`
      : 'No shared variables were found — the selected diagrams are structurally independent.',
  ].join(' ');

  const summary =
    `This system map is a synthesis of ${sims.length} causal loop diagram${sims.length === 1 ? '' : 's'}: ${sims.map((s) => `"${s.title}"`).join(', ')}. ` +
    (loops.length > 0
      ? `The dominant structure is ${reinforcingCount >= balancingCount ? 'growth-oriented, with reinforcing loops as the primary engine' : 'stabilising, with balancing loops constraining runaway dynamics'}.`
      : `The structure is primarily linear, with forces flowing through a chain of influence.`);

  const opportunities: string[] = [];
  drivers.slice(0, 2).forEach((d) => {
    opportunities.push(`Intervene on "${d.name}" — it influences ${d.count} variables, so a small change propagates widely.`);
  });
  hubs.slice(0, 2).forEach((h) => {
    opportunities.push(`Treat "${h.name}" as a regulating point — ${h.count} forces converge here, making it a natural place to stabilise the system.`);
  });
  const boundaryVars = variables.filter((v) => v.isBoundary);
  boundaryVars.slice(0, 2).forEach((b) => {
    opportunities.push(`"${b.name}" is treated as exogenous — a candidate for boundary expansion: what feedback would appear if it were brought inside the map?`);
  });
  if (reinforcingCount > 0) {
    opportunities.push('The reinforcing loops are growth engines. The innovation opportunity is to find the balancing loop that keeps them from running out of control.');
  }
  if (integrationPoints.length > 0) {
    opportunities.push(`Integration point "${integrationPoints[0].name}" links ${integrationPoints[0].sourceCount} diagrams — reframing it in one system shifts all of them at once.`);
  }

  return { variables, edges, report: { summary, dynamics, mainForces, integrationPoints, loops, opportunities } };
}

// ============================================================
// Component
// ============================================================

export default function SystemMapPage({ activeThemeId, simulations }: SystemMapPageProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<SystemMapReport | null>(null);

  const themeSims = simulations.filter(
    (s) => s.themeId === activeThemeId && (s.status === 'saved' || s.status === 'promoted'),
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edgesState, setEdgesState, onEdgesChange] = useEdgesState<FlowEdge>([]);

  const nodeTypes = useMemo(() => ({ variable: VariableNode }), []);
  const edgeTypes = useMemo(() => ({ causal: CausalEdge }), []);

  const toggleSelection = useCallback((simId: string) => {
    setSelectedIds((prev) =>
      prev.includes(simId) ? prev.filter((id) => id !== simId) : [...prev, simId],
    );
  }, []);

  const handleGenerate = useCallback(() => {
    if (selectedIds.length === 0) return;
    const selectedSims = simulations.filter((s) => selectedIds.includes(s.id));
    if (selectedSims.length === 0) return;

    setIsGenerating(true);
    // Simulated AI synthesis delay
    setTimeout(() => {
      const result = generateSystemMap(selectedSims);
      setNodes(mapVariablesToFlowNodes(result.variables));
      setEdgesState(mapEdgesToFlowEdges(result.edges));
      setReport(result.report);
      setIsGenerating(false);
    }, 1200);
  }, [selectedIds, simulations, setNodes, setEdgesState]);

  if (!activeThemeId) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>⇄</div>
        <h2 style={styles.emptyTitle}>Create your first theme</h2>
        <p style={styles.emptyText}>
          A theme is a workspace for a research area. Create one and save causal loop diagrams to
          begin building a system map.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ===== LEFT PANEL: simulation selection ===== */}
      <div style={styles.leftPanel}>
        <div style={styles.section}>
          <div style={styles.eyebrow}>System Map</div>
          <h2 style={styles.heading}>Synthesise the theme</h2>
          <p style={styles.helpText}>
            Select the saved causal loop diagrams you want to combine. The AI merges their
            variables and forces into a single system map.
          </p>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span style={styles.label}>Saved Causal Loops</span>
            <span style={styles.countBadge}>{selectedIds.length} selected</span>
          </div>

          {themeSims.length === 0 ? (
            <p style={styles.noSims}>
              No saved diagrams in this theme yet. Create and save one on the Dashboard first.
            </p>
          ) : (
            <div style={styles.simList}>
              {themeSims.map((sim) => {
                const isSelected = selectedIds.includes(sim.id);
                return (
                  <label key={sim.id} style={{ ...styles.simCard, ...(isSelected ? styles.simCardActive : {}) }}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={isSelected}
                      onChange={() => toggleSelection(sim.id)}
                    />
                    <div style={styles.simInfo}>
                      <div style={styles.simTitle}>{sim.title}</div>
                      <div style={styles.simMeta}>
                        {sim.variables.length} variables · {sim.edges.length} edges
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {themeSims.length > 1 && (
            <div style={styles.selectionRow}>
              <button
                style={styles.selectAllButton}
                onClick={() =>
                  setSelectedIds(selectedIds.length === themeSims.length ? [] : themeSims.map((s) => s.id))
                }
              >
                {selectedIds.length === themeSims.length ? 'Clear all' : 'Select all'}
              </button>
            </div>
          )}
        </div>

        <button
          style={{
            ...styles.primaryButton,
            ...(selectedIds.length === 0 || isGenerating ? styles.buttonDisabled : {}),
          }}
          onClick={handleGenerate}
          disabled={selectedIds.length === 0 || isGenerating}
        >
          {isGenerating
            ? 'Synthesising...'
            : selectedIds.length === 1
              ? 'Generate Map'
              : `Generate Map (${selectedIds.length} loops)`}
        </button>
      </div>

      {/* ===== RIGHT PANEL: canvas + report ===== */}
      <div style={styles.rightPanel}>
        <div style={styles.canvasHeader}>
          <span style={styles.canvasTitle}>System Map</span>
          <span style={styles.canvasMeta}>
            {nodes.length > 0 ? `${nodes.length} variables · ${edgesState.length} connections` : '—'}
          </span>
        </div>

        <div style={styles.canvas}>
          {nodes.length === 0 ? (
            <div style={styles.canvasEmpty}>
              <div style={styles.canvasEmptyIcon}>◈</div>
              <p style={styles.canvasEmptyText}>
                Select causal loops on the left and press “Generate Map” to synthesise the system.
              </p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edgesState}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.3}
              maxZoom={2}
              defaultEdgeOptions={{ type: 'causal' }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.05)" />
              <Controls />
              <MiniMap
                nodeColor={() => 'var(--n400)'}
                maskColor="rgba(14,15,15,0.8)"
                style={{ background: 'var(--n100)' }}
              />
              <svg>
                <defs>
                  <marker id="arrow-same" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--g500)" />
                  </marker>
                  <marker id="arrow-opposite" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--r600)" />
                  </marker>
                  <marker id="arrow-selected" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
                  </marker>
                </defs>
              </svg>
            </ReactFlow>
          )}
        </div>

        {/* ===== Report below canvas ===== */}
        {report && (
          <div style={styles.reportArea}>
            <div style={styles.reportHeader}>
              <div style={styles.eyebrow}>AI Analysis</div>
              <h3 style={styles.reportTitle}>System Synthesis Report</h3>
            </div>

            <div style={styles.reportSection}>
              <div style={styles.reportLabel}>Summary</div>
              <p style={styles.reportText}>{report.summary}</p>
            </div>

            <div style={styles.reportSection}>
              <div style={styles.reportLabel}>Dynamics</div>
              <p style={styles.reportText}>{report.dynamics}</p>
            </div>

            {report.mainForces.length > 0 && (
              <div style={styles.reportSection}>
                <div style={styles.reportLabel}>Main Forces</div>
                <ul style={styles.list}>
                  {report.mainForces.map((f, i) => (
                    <li key={i} style={styles.listItem}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.loops.length > 0 && (
              <div style={styles.reportSection}>
                <div style={styles.reportLabel}>Feedback Loops Detected</div>
                {report.loops.map((loop) => (
                  <div key={loop.id} style={styles.loopCard}>
                    <div style={styles.loopHeader}>
                      <span
                        style={{
                          ...styles.loopType,
                          color: loop.type === 'reinforcing' ? 'var(--accent)' : '#D4A843',
                        }}
                      >
                        {loop.type === 'reinforcing' ? '⟳ Reinforcing' : '⇌ Balancing'}
                      </span>
                    </div>
                    <div style={styles.loopPath}>
                      {loop.variables.map((v, i) => (
                        <span key={i}>
                          <span style={styles.loopVar}>{v}</span>
                          {i < loop.variables.length - 1 && <span style={styles.loopArrow}> → </span>}
                        </span>
                      ))}
                    </div>
                    <p style={styles.loopDesc}>{loop.description}</p>
                  </div>
                ))}
              </div>
            )}

            {report.integrationPoints.length > 0 && (
              <div style={styles.reportSection}>
                <div style={styles.reportLabel}>Integration Points</div>
                {report.integrationPoints.map((ip) => (
                  <div key={ip.name} style={styles.integrationCard}>
                    <div style={styles.integrationName}>{ip.name}</div>
                    <div style={styles.integrationMeta}>
                      Appears in {ip.sourceCount} diagrams: {ip.sourceSimTitles.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {report.opportunities.length > 0 && (
              <div style={styles.reportSection}>
                <div style={styles.reportLabel}>Opportunities for Innovation</div>
                <ul style={styles.list}>
                  {report.opportunities.map((o, i) => (
                    <li key={i} style={{ ...styles.listItem, color: 'var(--accent)' }}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: 'calc(100vh - 52px)',
    overflow: 'hidden',
  },
  leftPanel: {
    width: 340,
    minWidth: 340,
    overflowY: 'auto' as const,
    borderRight: '1px solid var(--n200)',
    background: 'var(--n100)',
    padding: 24,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 0,
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'var(--bg)',
    overflow: 'hidden',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eyebrow: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent)',
  },
  heading: {
    fontFamily: 'var(--serif)',
    fontWeight: 400,
    fontSize: 24,
    lineHeight: 1.15,
    color: 'var(--text-primary)',
    textShadow: 'var(--glow)',
    margin: '4px 0 8px',
  },
  helpText: {
    fontSize: 13,
    color: 'var(--n700)',
    lineHeight: 1.5,
    margin: 0,
  },
  label: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--n600)',
  },
  countBadge: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--accent)',
    background: 'var(--g100)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--g300)',
  },
  noSims: {
    fontSize: 13,
    color: 'var(--n600)',
    lineHeight: 1.5,
  },
  simList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  simCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    background: 'linear-gradient(180deg, #161717, #131414)',
    border: '1px solid var(--n200)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  simCardActive: {
    borderColor: 'var(--accent)',
    background: 'var(--g100)',
  },
  checkbox: {
    marginTop: 3,
    accentColor: 'var(--accent)',
    cursor: 'pointer',
  },
  simInfo: {
    flex: 1,
  },
  simTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--n1100)',
    lineHeight: 1.3,
  },
  simMeta: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--n600)',
    marginTop: 3,
  },
  selectionRow: {
    marginTop: 12,
  },
  selectAllButton: {
    padding: '4px 12px',
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid var(--g300)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
  primaryButton: {
    width: '100%',
    padding: '10px 20px',
    background: 'var(--accent)',
    color: 'var(--n100)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  canvasHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid var(--n200)',
    background: 'var(--n100)',
    flexShrink: 0,
  },
  canvasTitle: {
    fontFamily: 'var(--serif)',
    fontSize: 16,
    color: 'var(--text-primary)',
    textShadow: 'var(--glow)',
  },
  canvasMeta: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--n600)',
  },
  canvas: {
    flex: 1,
    minHeight: 0,
    position: 'relative' as const,
  },
  canvasEmpty: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  canvasEmptyIcon: {
    fontSize: 42,
    color: 'var(--n500)',
    opacity: 0.5,
  },
  canvasEmptyText: {
    fontSize: 14,
    color: 'var(--n600)',
    maxWidth: 360,
    textAlign: 'center' as const,
    lineHeight: 1.6,
  },
  reportArea: {
    borderTop: '1px solid var(--n200)',
    background: 'var(--n100)',
    padding: 20,
    overflowY: 'auto' as const,
    maxHeight: '42%',
    flexShrink: 0,
  },
  reportHeader: {
    marginBottom: 16,
  },
  reportTitle: {
    fontFamily: 'var(--serif)',
    fontWeight: 400,
    fontSize: 20,
    color: 'var(--text-primary)',
    textShadow: 'var(--glow)',
    margin: '4px 0 0',
  },
  reportSection: {
    marginBottom: 18,
  },
  reportLabel: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--n600)',
    marginBottom: 8,
  },
  reportText: {
    fontSize: 13,
    color: 'var(--n900)',
    lineHeight: 1.6,
    margin: 0,
  },
  list: {
    margin: 0,
    paddingLeft: 18,
  },
  listItem: {
    fontSize: 13,
    color: 'var(--n900)',
    marginBottom: 6,
    lineHeight: 1.5,
  },
  loopCard: {
    padding: '12px 14px',
    background: 'var(--n200)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--n300)',
    marginBottom: 10,
  },
  loopHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  loopType: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
  loopPath: {
    fontSize: 12,
    color: 'var(--n800)',
    marginBottom: 6,
    lineHeight: 1.6,
  },
  loopVar: {
    fontWeight: 600,
    color: 'var(--n900)',
  },
  loopArrow: {
    color: 'var(--n500)',
  },
  loopDesc: {
    fontSize: 11,
    color: 'var(--n700)',
    lineHeight: 1.5,
    margin: 0,
  },
  integrationCard: {
    padding: '10px 14px',
    background: 'var(--g100)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--g300)',
    marginBottom: 8,
  },
  integrationName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--n1100)',
  },
  integrationMeta: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--n600)',
    marginTop: 3,
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
    fontSize: 48,
    color: 'var(--n500)',
    opacity: 0.5,
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