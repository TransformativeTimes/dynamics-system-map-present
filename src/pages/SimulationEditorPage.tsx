// ============================================================
// SimulationEditorPage — Full editor for saved simulations
// ============================================================

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge as FlowEdge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import VariableNode from '../components/VariableNode';
import CausalEdge from '../components/CausalEdge';
import VariationsPanel from '../components/VariationsPanel';
import type {
  Variable,
  Edge,
  Simulation,
  Provenance,
  Polarity,
} from '../types';

// ============================================================
// Helpers
// ============================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function variablesToFlowNodes(variables: Variable[]): Node[] {
  const count = variables.length;
  const radius = 180;
  const centerX = 350;
  const centerY = 250;

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

function edgesToFlowEdges(edges: Edge[]): FlowEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.fromVariableId,
    target: e.toVariableId,
    type: 'causal',
    data: { edge: e },
  }));
}

// ============================================================
// Component
// ============================================================

interface SimulationEditorPageProps {
  simulations: Simulation[];
  onUpdateSimulation: (simulation: Simulation) => void;
}

export default function SimulationEditorPage({ simulations, onUpdateSimulation }: SimulationEditorPageProps) {
  const navigate = useNavigate();
  const { simulationId } = useParams<{ simulationId: string }>();

  const sim = simulations.find((s) => s.id === simulationId);

  // If simulation not found, redirect to library
  useEffect(() => {
    if (!sim) {
      navigate('/library');
    }
  }, [sim, navigate]);

  // Working copy of variables and edges (editable)
  const [variables, setVariables] = useState<Variable[]>(sim ? sim.variables : []);
  const [edges, setEdges] = useState<Edge[]>(sim ? sim.edges : []);
  const [hasChanges, setHasChanges] = useState(false);

  // Variations state
  const [showVariations, setShowVariations] = useState(false);
  const [variationData, setVariationData] = useState<{ variables: Variable[]; edges: Edge[] } | null>(null);

  // React Flow state — seeded from the loaded simulation
  const [nodes, setNodes, onNodesChange] = useNodesState(
    sim ? variablesToFlowNodes(sim.variables) : [],
  );
  const [edgesState, setEdgesState, onEdgesChange] = useEdgesState(
    sim ? edgesToFlowEdges(sim.edges) : [],
  );

  // Re-seed working copy and React Flow graph when the simulation changes
  useEffect(() => {
    if (sim) {
      setVariables(sim.variables);
      setEdges(sim.edges);
      setHasChanges(false);
      setNodes(variablesToFlowNodes(sim.variables));
      setEdgesState(edgesToFlowEdges(sim.edges));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim?.id, setNodes, setEdgesState]);

  // Sync graph
  const syncGraph = useCallback((vars?: Variable[], eds?: Edge[]) => {
    const v = vars ?? variables;
    const e = eds ?? edges;
    setNodes(variablesToFlowNodes(v));
    setEdgesState(edgesToFlowEdges(e));
  }, [variables, edges, setNodes, setEdgesState]);

  // Node types
  const nodeTypes = useMemo(() => ({ variable: VariableNode }), []);
  const edgeTypes = useMemo(() => ({ causal: CausalEdge }), []);

  // Mark changes
  const markChanged = useCallback(() => {
    setHasChanges(true);
  }, []);

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const newEdge: Edge = {
        id: generateId(),
        fromVariableId: connection.source,
        toVariableId: connection.target,
        polarity: 'same',
        delay: 'immediate',
        strength: 'moderate',
        provenance: 'human_assertion' as Provenance,
        assertedBy: 'You',
      };

      setEdges((prev) => [...prev, newEdge]);
      markChanged();

      setEdgesState((eds) =>
        addEdge(
          {
            ...connection,
            id: newEdge.id,
            type: 'causal',
            data: { edge: newEdge },
          },
          eds,
        ),
      );
    },
    [setEdges, setEdgesState, markChanged],
  );

  // Add a new variable node
  const addVariable = useCallback(() => {
    const name = prompt('Variable name:');
    if (!name?.trim()) return;

    const newVar: Variable = {
      id: generateId(),
      name: name.trim(),
      definition: '',
      isBoundary: false,
    };

    setVariables((prev) => [...prev, newVar]);
    markChanged();

    setNodes((nds) => [
      ...nds,
      {
        id: newVar.id,
        type: 'variable',
        position: { x: Math.random() * 400 + 50, y: Math.random() * 300 + 50 },
        data: { variable: newVar },
      },
    ]);
  }, [setNodes, markChanged]);

  // Toggle edge polarity
  const toggleEdgePolarity = useCallback(
    (edgeId: string) => {
      setEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId
            ? { ...e, polarity: (e.polarity === 'same' ? 'opposite' : 'same') as Polarity }
            : e,
        ),
      );
      markChanged();
      setEdgesState((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId || !e.data?.edge) return e;
          const edge = e.data.edge as Edge;
          return {
            ...e,
            data: {
              ...e.data,
              edge: { ...edge, polarity: (edge.polarity === 'same' ? 'opposite' : 'same') as Polarity },
            },
          };
        }),
      );
    },
    [setEdges, setEdgesState, markChanged],
  );

  // Handle edge click to toggle polarity
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: FlowEdge) => {
      toggleEdgePolarity(edge.id);
    },
    [toggleEdgePolarity],
  );

  // Save changes
  const handleSave = useCallback(() => {
    if (!sim) return;
    const updated: Simulation = {
      ...sim,
      variables,
      edges,
    };
    onUpdateSimulation(updated);
    setHasChanges(false);
  }, [sim, variables, edges, onUpdateSimulation]);

  // Reset to original
  const handleReset = useCallback(() => {
    if (!sim) return;
    setVariables(sim.variables);
    setEdges(sim.edges);
    setHasChanges(false);
    setNodes(variablesToFlowNodes(sim.variables));
    setEdgesState(edgesToFlowEdges(sim.edges));
    setVariationData(null);
    setShowVariations(false);
  }, [sim, setNodes, setEdgesState]);

  // Back to library
  const handleBack = useCallback(() => {
    navigate('/library');
  }, [navigate]);

  if (!sim) return null;

  return (
    <div style={styles.container}>
      {/* ===== LEFT PANEL: Info ===== */}
      <div style={styles.leftPanel}>
        <button style={styles.backButton} onClick={handleBack}>
          ← Back to Library
        </button>

        <div style={styles.section}>
          <div style={styles.eyebrow}>Simulation</div>
          <h2 style={styles.title}>{sim.title}</h2>
        </div>

        <div style={styles.section}>
          <div style={styles.label}>Signal</div>
          <p style={styles.text}>{sim.signalText}</p>
        </div>

        <div style={styles.section}>
          <div style={styles.label}>Critical Questions & Answers</div>
          {sim.criticalQuestions.map((q) => {
            const answer = sim.criticalAnswers.find((a) => a.questionId === q.id);
            return (
              <div key={q.id} style={styles.qaBlock}>
                <div style={styles.qaQuestion}>{q.question}</div>
                <div style={styles.qaAnswer}>
                  {answer?.answer || <span style={{ color: 'var(--n600)', fontStyle: 'italic' }}>No answer recorded</span>}
                </div>
              </div>
            );
          })}
        </div>

        {sim.analysis && (
          <>
            <div style={styles.section}>
              <div style={styles.label}>Analysis</div>
              <p style={styles.text}>{sim.analysis.generalDescription}</p>
            </div>

            <div style={styles.section}>
              <div style={styles.label}>Enablers</div>
              <ul style={styles.list}>
                {sim.analysis.enablers.map((e, i) => (
                  <li key={i} style={styles.listItem}>{e}</li>
                ))}
              </ul>
            </div>

            <div style={styles.section}>
              <div style={styles.label}>Blockers</div>
              <ul style={styles.list}>
                {sim.analysis.blockers.map((b, i) => (
                  <li key={i} style={{ ...styles.listItem, color: 'var(--r600)' }}>{b}</li>
                ))}
              </ul>
            </div>

            <div style={styles.section}>
              <div style={styles.label}>Node Explanations</div>
              {sim.analysis.nodeExplanations.map((ne) => {
                const v = variables.find((v) => v.id === ne.variableId);
                return (
                  <div key={ne.variableId} style={styles.nodeExplanation}>
                    <div style={styles.nodeName}>{v?.name ?? ne.variableId}</div>
                    <div style={styles.nodeDesc}>{ne.explanation}</div>
                  </div>
                );
              })}
            </div>

            <div style={styles.section}>
              <div style={styles.label}>Leverage Distribution</div>
              <div style={styles.leverageChart}>
                {sim.analysis.leverageDistribution.map((l) => (
                  <div key={l.level} style={styles.leverageRow}>
                    <div style={styles.leverageLabel}>{l.level}</div>
                    <div style={styles.leverageBarContainer}>
                      <div
                        style={{
                          ...styles.leverageBar,
                          width: `${(l.count / Math.max(...sim.analysis!.leverageDistribution.map((x) => x.count), 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <div style={styles.leverageCount}>{l.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div style={{ marginTop: 24 }}>
          <div style={styles.meta}>
            <span style={styles.metaItem}>{variables.length} variables</span>
            <span style={styles.metaItem}>{edges.length} edges</span>
            <span style={styles.metaItem}>
              {edges.filter((e) => e.provenance === 'field_observation').length} observed
            </span>
          </div>
          <div style={styles.meta}>
            <span style={{ ...styles.metaItem, color: 'var(--n600)' }}>
              Created {new Date(sim.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span style={{
              ...styles.metaItem,
              color: sim.status === 'promoted' ? 'var(--accent)' : 'var(--n600)',
            }}>
              {sim.status}
            </span>
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL: Editor ===== */}
      <div style={styles.rightPanel}>
        <div style={styles.canvasHeader}>
          <div style={styles.canvasTitle}>
            <span style={styles.eyebrow}>Causal Loop Diagram</span>
            {hasChanges && (
              <span style={styles.unsavedBadge}>Unsaved changes</span>
            )}
          </div>
          <div style={styles.canvasActions}>
            <button style={styles.smallButton} onClick={addVariable} title="Add variable">
              + Node
            </button>
            <button
              style={{
                ...styles.smallButton,
                ...(showVariations ? { background: 'var(--g100)', color: 'var(--accent)', borderColor: 'var(--g300)' } : {}),
              }}
              onClick={() => {
                if (showVariations) {
                  setShowVariations(false);
                  setVariationData(null);
                  syncGraph();
                } else {
                  setShowVariations(true);
                }
              }}
              title="Variations"
            >
              ◈ Variations
            </button>
            <button style={styles.smallButton} onClick={() => syncGraph()} title="Reset layout">
              ↻ Layout
            </button>
          </div>
        </div>

        {/* Save / Reset bar */}
        <div style={styles.saveBar}>
          <button
            style={{
              ...styles.secondaryButton,
              ...(!hasChanges ? styles.buttonDisabled : {}),
            }}
            onClick={handleReset}
            disabled={!hasChanges}
          >
            Reset Current Changes
          </button>
          <button
            style={{
              ...styles.primaryButton,
              ...(!hasChanges ? styles.buttonDisabled : {}),
            }}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Changes
          </button>
        </div>

        <div style={styles.canvasRow}>
          <div style={styles.canvas}>
            <ReactFlow
              nodes={variationData ? variablesToFlowNodes(variationData.variables) : nodes}
              edges={variationData ? edgesToFlowEdges(variationData.edges) : edgesState}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgeClick={onEdgeClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.3}
              maxZoom={2}
              defaultEdgeOptions={{
                type: 'causal',
              }}
              proOptions={{ hideAttribution: true }}
            >
            <Background
              variant={BackgroundVariant.Dots}
              gap={26}
              size={1}
              color="rgba(255,255,255,0.055)"
            />
            <Controls />
            <MiniMap
              nodeColor={() => 'var(--n400)'}
              maskColor="rgba(14,15,15,0.8)"
              style={{ background: 'var(--n100)' }}
            />
            <svg>
              <defs>
                <marker
                  id="arrow-same"
                  viewBox="0 0 10 10"
                  refX={9}
                  refY={5}
                  markerWidth={6}
                  markerHeight={6}
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--g500)" />
                </marker>
                <marker
                  id="arrow-opposite"
                  viewBox="0 0 10 10"
                  refX={9}
                  refY={5}
                  markerWidth={6}
                  markerHeight={6}
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--r600)" />
                </marker>
                <marker
                  id="arrow-selected"
                  viewBox="0 0 10 10"
                  refX={9}
                  refY={5}
                  markerWidth={6}
                  markerHeight={6}
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
                </marker>
              </defs>
            </svg>
            </ReactFlow>
          </div>

          {/* Variations Panel — flex sibling, slides in from right */}
          {showVariations && (
            <VariationsPanel
              variables={variables}
              edges={edges}
              onApplyVariation={(result) => {
                setVariationData({ variables: result.variables, edges: result.edges });
              }}
              onClose={() => {
                setShowVariations(false);
                setVariationData(null);
                syncGraph();
              }}
            />
          )}
        </div>

        {/* Provenance legend */}
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendLine, background: 'var(--g500)', height: 3 }} />
            <span style={styles.legendLabel}>Field observation</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendLine, background: 'var(--n800)', height: 2 }} />
            <span style={styles.legendLabel}>Human assertion</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendLine, background: 'var(--n500)', height: 1.5, borderStyle: 'dashed' }} />
            <span style={styles.legendLabel}>Model inference</span>
          </div>
        </div>
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
    width: 420,
    minWidth: 420,
    overflowY: 'auto' as const,
    borderRight: '1px solid var(--n200)',
    background: 'var(--n100)',
    padding: 24,
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    background: 'var(--bg)',
    backgroundImage: 'radial-gradient(120% 120% at 88% 8%, rgba(48,84,66,0.35) 0%, rgba(14,15,15,0) 55%)',
    backgroundSize: '100% 100%',
  },
  backButton: {
    padding: '6px 14px',
    background: 'transparent',
    color: 'var(--n800)',
    border: '1px solid var(--n400)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    cursor: 'pointer',
    marginBottom: 20,
    display: 'inline-block',
    width: 'fit-content',
  },
  section: {
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent)',
  },
  title: {
    fontFamily: 'var(--serif)',
    fontWeight: 400,
    fontSize: 24,
    lineHeight: 1.15,
    color: 'var(--text-primary)',
    textShadow: 'var(--glow)',
    margin: '4px 0 0',
  },
  label: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--n600)',
    marginBottom: 6,
  },
  text: {
    fontSize: 14,
    color: 'var(--n900)',
    lineHeight: 1.7,
    margin: 0,
  },
  qaBlock: {
    marginBottom: 10,
    padding: '8px 0',
    borderBottom: '1px solid var(--n200)',
  },
  qaQuestion: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--n1100)',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  qaAnswer: {
    fontSize: 13,
    color: 'var(--n800)',
    lineHeight: 1.5,
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
  nodeExplanation: {
    padding: '8px 0',
    borderBottom: '1px solid var(--n200)',
  },
  nodeName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--n1100)',
    marginBottom: 2,
  },
  nodeDesc: {
    fontSize: 12,
    color: 'var(--n700)',
    lineHeight: 1.5,
  },
  leverageChart: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  leverageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  leverageLabel: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--n700)',
    width: 130,
    textAlign: 'right' as const,
  },
  leverageBarContainer: {
    flex: 1,
    height: 8,
    background: 'var(--n200)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  leverageBar: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 4,
    minWidth: 4,
    transition: 'width 0.3s',
  },
  leverageCount: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    color: 'var(--accent)',
    width: 20,
  },
  meta: {
    display: 'flex',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--n600)',
  },
  canvasHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid var(--n200)',
    background: 'rgba(14,15,15,0.85)',
    backdropFilter: 'blur(8px)',
    zIndex: 10,
  },
  canvasTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  unsavedBadge: {
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--accent)',
    background: 'var(--g100)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
  },
  canvasActions: {
    display: 'flex',
    gap: 8,
  },
  saveBar: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    padding: '8px 20px',
    borderBottom: '1px solid var(--n200)',
    background: 'rgba(14,15,15,0.85)',
    backdropFilter: 'blur(8px)',
  },
  canvasRow: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    minWidth: 0,
  },
  primaryButton: {
    padding: '8px 18px',
    background: 'var(--accent)',
    color: 'var(--n100)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  secondaryButton: {
    padding: '8px 18px',
    background: 'transparent',
    color: 'var(--n900)',
    border: '1px solid var(--n400)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    cursor: 'pointer',
  },
  smallButton: {
    padding: '5px 12px',
    background: 'var(--n200)',
    color: 'var(--n900)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  legend: {
    display: 'flex',
    gap: 20,
    padding: '8px 20px',
    borderTop: '1px solid var(--n200)',
    background: 'rgba(14,15,15,0.85)',
    backdropFilter: 'blur(8px)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    width: 24,
    borderRadius: 2,
  },
  legendLabel: {
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.05em',
    color: 'var(--n600)',
    textTransform: 'uppercase' as const,
  },
};