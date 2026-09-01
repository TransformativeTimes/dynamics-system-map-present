// ============================================================
// DashboardPage — Signal input, critical questions, diagram canvas
// ============================================================

import { useState, useCallback, useMemo } from 'react';
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
  CriticalQuestion,
  CriticalAnswer,
  AnalysisResult,
  Simulation,
  Provenance,
  Polarity,
} from '../types';

// ============================================================
// Demo data for the initial state
// ============================================================

const DEMO_VARIABLES: Variable[] = [
  { id: 'v1', name: 'Customer Demand', definition: 'Market pull for the product or service', isBoundary: false },
  { id: 'v2', name: 'Production Capacity', definition: 'Ability to meet demand at current scale', isBoundary: false },
  { id: 'v3', name: 'Price Pressure', definition: 'Downward force on pricing from competition', isBoundary: false },
  { id: 'v4', name: 'Innovation Investment', definition: 'Resources allocated to R&D and new capabilities', isBoundary: false },
  { id: 'v5', name: 'Regulatory Burden', definition: 'Compliance costs and constraints', isBoundary: true },
];

const DEMO_EDGES: Edge[] = [
  { id: 'e1', fromVariableId: 'v1', toVariableId: 'v2', polarity: 'same', delay: 'weeks', strength: 'strong', provenance: 'human_assertion', assertedBy: 'Researcher' },
  { id: 'e2', fromVariableId: 'v2', toVariableId: 'v3', polarity: 'opposite', delay: 'months', strength: 'moderate', provenance: 'model_inference' },
  { id: 'e3', fromVariableId: 'v3', toVariableId: 'v4', polarity: 'opposite', delay: 'months', strength: 'moderate', provenance: 'human_assertion', assertedBy: 'Researcher' },
  { id: 'e4', fromVariableId: 'v4', toVariableId: 'v1', polarity: 'same', delay: 'years', strength: 'strong', provenance: 'field_observation', observationCount: 3 },
  { id: 'e5', fromVariableId: 'v5', toVariableId: 'v2', polarity: 'opposite', delay: 'years', strength: 'weak', provenance: 'model_inference' },
  { id: 'e6', fromVariableId: 'v5', toVariableId: 'v4', polarity: 'opposite', delay: 'years', strength: 'moderate', provenance: 'human_assertion', assertedBy: 'Researcher' },
];

const DEMO_QUESTIONS: CriticalQuestion[] = [
  { id: 'q1', question: 'What is being held constant in this description that is not actually constant?' },
  { id: 'q2', question: 'Who or what is outside the boundary as drawn, and what would change if they were inside it?' },
  { id: 'q3', question: 'On what timescale is this claim true? What happens if you extend or compress that horizon?' },
  { id: 'q4', question: 'What would have to be true for the opposite dynamic to occur?' },
];

const DEMO_ANALYSIS: AnalysisResult = {
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
};

// ============================================================
// Helpers
// ============================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function variablesToFlowNodes(variables: Variable[]): Node[] {
  // Arrange in a circle
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

interface DashboardPageProps {
  activeThemeId: string | null;
  simulations: Simulation[];
  onSaveSimulation: (simulation: Simulation) => void;
}

export default function DashboardPage({ activeThemeId, simulations: _simulations, onSaveSimulation }: DashboardPageProps) {
  // Session state
  const [signalTitle, setSignalTitle] = useState('');
  const [signalText, setSignalText] = useState('');
  const [step, setStep] = useState<'signal' | 'questions' | 'analysis'>('signal');
  const [questions, setQuestions] = useState<CriticalQuestion[]>([]);
  const [answers, setAnswers] = useState<CriticalAnswer[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Graph state
  const [variables, setVariables] = useState<Variable[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  // Variations state
  const [showVariations, setShowVariations] = useState(false);
  const [variationData, setVariationData] = useState<{ variables: Variable[]; edges: Edge[] } | null>(null);

  // React Flow state
  const initialNodes = useMemo(() => variablesToFlowNodes(variables), [variables]);
  const initialEdges = useMemo(() => edgesToFlowEdges(edges), [edges]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edgesState, setEdgesState, onEdgesChange] = useEdgesState(initialEdges);

  // Sync React Flow state when variables/edges change
  const syncGraph = useCallback((vars?: Variable[], eds?: Edge[]) => {
    const v = vars ?? variables;
    const e = eds ?? edges;
    setNodes(variablesToFlowNodes(v));
    setEdgesState(edgesToFlowEdges(e));
  }, [variables, edges, setNodes, setEdgesState]);

  // Node types
  const nodeTypes = useMemo(() => ({ variable: VariableNode }), []);
  const edgeTypes = useMemo(() => ({ causal: CausalEdge }), []);

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
    [setEdges, setEdgesState],
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

    // Add to flow
    setNodes((nds) => [
      ...nds,
      {
        id: newVar.id,
        type: 'variable',
        position: { x: Math.random() * 400 + 50, y: Math.random() * 300 + 50 },
        data: { variable: newVar },
      },
    ]);
  }, [setNodes]);

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
    [setEdges, setEdgesState],
  );

  // Handle edge click to toggle polarity
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: FlowEdge) => {
      toggleEdgePolarity(edge.id);
    },
    [toggleEdgePolarity],
  );

  // Generate questions (simulated AI)
  const generateQuestions = useCallback(() => {
    if (!signalText.trim()) return;
    setIsGenerating(true);

    // Simulate AI delay
    setTimeout(() => {
      setQuestions(DEMO_QUESTIONS);
      setAnswers(DEMO_QUESTIONS.map((q) => ({ questionId: q.id, answer: '', answeredBy: 'You' })));
      setStep('questions');
      setIsGenerating(false);
    }, 1200);
  }, [signalText]);

  // Generate diagram (simulated AI)
  const generateDiagram = useCallback(() => {
    setIsGenerating(true);

    setTimeout(() => {
      setVariables(DEMO_VARIABLES);
      setEdges(DEMO_EDGES);
      setAnalysis(DEMO_ANALYSIS);
      // Pass data directly — React hasn't flushed setVariables/setEdges yet
      setNodes(variablesToFlowNodes(DEMO_VARIABLES));
      setEdgesState(edgesToFlowEdges(DEMO_EDGES));
      setStep('analysis');
      setIsGenerating(false);
    }, 1500);
  }, [setNodes, setEdgesState]);

  // Save simulation
  const handleSave = useCallback(() => {
    if (!activeThemeId) return;

    const simulation: Simulation = {
      id: generateId(),
      themeId: activeThemeId,
      title: signalTitle || 'Untitled Signal',
      signalText,
      criticalQuestions: questions,
      criticalAnswers: answers,
      variables,
      edges,
      analysis,
      status: 'saved',
      createdAt: new Date().toISOString(),
    };

    onSaveSimulation(simulation);
    // Reset
    setSignalTitle('');
    setSignalText('');
    setQuestions([]);
    setAnswers([]);
    setVariables([]);
    setEdges([]);
    setAnalysis(null);
    setNodes([]);
    setEdgesState([]);
    setStep('signal');
  }, [activeThemeId, signalTitle, signalText, questions, answers, variables, edges, analysis, onSaveSimulation, setNodes, setEdgesState]);

  // Discard
  const handleDiscard = useCallback(() => {
    setSignalTitle('');
    setSignalText('');
    setQuestions([]);
    setAnswers([]);
    setVariables([]);
    setEdges([]);
    setAnalysis(null);
    setNodes([]);
    setEdgesState([]);
    setStep('signal');
  }, [setNodes, setEdgesState]);

  // Update answer
  const updateAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) =>
      prev.map((a) => (a.questionId === questionId ? { ...a, answer } : a)),
    );
  }, []);

  // ============================================================
  // Render
  // ============================================================

  if (!activeThemeId) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>+</div>
        <h2 style={styles.emptyTitle}>Create your first theme</h2>
        <p style={styles.emptyText}>
          A theme is a workspace for a research area — like "Future of Food" or "Urban Mobility".
          Create one to start building causal loop diagrams.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ===== LEFT PANEL ===== */}
      <div style={styles.leftPanel}>
        {/* Step 1: Signal Input */}
        {step === 'signal' && (
          <div style={styles.section}>
            <div style={styles.eyebrow}>01 · Signal</div>
            <h2 style={styles.heading}>What are you seeing?</h2>
            <p style={styles.helpText}>
              Give your signal a title and describe the trend, dynamic, or pattern you are observing.
            </p>
            <input
              style={styles.titleInput}
              value={signalTitle}
              onChange={(e) => setSignalTitle(e.target.value)}
              placeholder="Signal title (e.g., Demand-Capacity Spiral)"
            />
            <textarea
              style={styles.textarea}
              value={signalText}
              onChange={(e) => setSignalText(e.target.value)}
              placeholder="e.g., Our production capacity keeps lagging behind demand spikes, and every time we catch up, price pressure from new entrants erodes the margin we need to invest in the next cycle..."
              rows={8}
            />
            <button
              style={{
                ...styles.primaryButton,
                ...(!signalText.trim() ? styles.buttonDisabled : {}),
              }}
              onClick={generateQuestions}
              disabled={!signalText.trim() || isGenerating}
            >
              {isGenerating ? 'Analysing...' : 'Generate Critical Questions'}
            </button>
          </div>
        )}

        {/* Step 2: Critical Questions */}
        {step === 'questions' && (
          <div style={styles.section}>
            <div style={styles.eyebrow}>02 · Critical Questions</div>
            <h2 style={styles.heading}>Four questions to expand the frame</h2>
            <p style={styles.helpText}>
              Answer each question. Your answers determine what the diagram captures. Divergent answers from different team members are preserved, not averaged.
            </p>

            {questions.map((q) => {
              const answer = answers.find((a) => a.questionId === q.id);
              return (
                <div key={q.id} style={styles.questionCard}>
                  <div style={styles.questionText}>{q.question}</div>
                  <textarea
                    style={styles.answerInput}
                    value={answer?.answer ?? ''}
                    onChange={(e) => updateAnswer(q.id, e.target.value)}
                    placeholder="Your answer..."
                    rows={3}
                  />
                </div>
              );
            })}

            <div style={styles.buttonRow}>
              <button style={styles.secondaryButton} onClick={() => setStep('signal')}>
                Back
              </button>
              <button
                style={{
                  ...styles.primaryButton,
                  ...(isGenerating ? styles.buttonDisabled : {}),
                }}
                onClick={generateDiagram}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating Diagram...' : 'Generate Causal Loop Diagram'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Analysis */}
        {step === 'analysis' && analysis && (
          <div style={styles.section}>
            <div style={styles.eyebrow}>03 · Analysis</div>
            <h2 style={styles.heading}>Structure</h2>
            <p style={styles.analysisText}>{analysis.generalDescription}</p>

            <h3 style={styles.subheading}>Node Explanations</h3>
            {analysis.nodeExplanations.map((ne) => {
              const v = variables.find((v) => v.id === ne.variableId);
              return (
                <div key={ne.variableId} style={styles.nodeExplanation}>
                  <div style={styles.nodeName}>{v?.name ?? ne.variableId}</div>
                  <div style={styles.nodeDesc}>{ne.explanation}</div>
                </div>
              );
            })}

            <h3 style={styles.subheading}>Enablers</h3>
            <ul style={styles.list}>
              {analysis.enablers.map((e, i) => (
                <li key={i} style={styles.listItem}>{e}</li>
              ))}
            </ul>

            <h3 style={styles.subheading}>Blockers</h3>
            <ul style={styles.list}>
              {analysis.blockers.map((b, i) => (
                <li key={i} style={{ ...styles.listItem, color: 'var(--r600)' }}>{b}</li>
              ))}
            </ul>

            <h3 style={styles.subheading}>Leverage Distribution</h3>
            <div style={styles.leverageChart}>
              {analysis.leverageDistribution.map((l) => (
                <div key={l.level} style={styles.leverageRow}>
                  <div style={styles.leverageLabel}>{l.level}</div>
                  <div style={styles.leverageBarContainer}>
                    <div
                      style={{
                        ...styles.leverageBar,
                        width: `${(l.count / Math.max(...analysis.leverageDistribution.map((x) => x.count), 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <div style={styles.leverageCount}>{l.count}</div>
                </div>
              ))}
            </div>

            <div style={styles.buttonRow}>
              <button style={styles.dangerButton} onClick={handleDiscard}>
                Discard
              </button>
              <button style={styles.primaryButton} onClick={handleSave}>
                Save to Library
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== RIGHT PANEL: Diagram Canvas ===== */}
      <div style={styles.rightPanel}>
        <div style={styles.canvasHeader}>
          <div style={styles.canvasTitle}>
            <span style={styles.eyebrow}>Causal Loop Diagram</span>
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
  canvasActions: {
    display: 'flex',
    gap: 8,
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
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
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
    margin: 0,
  },
  subheading: {
    fontFamily: 'var(--serif)',
    fontWeight: 400,
    fontSize: 18,
    color: 'var(--text-primary)',
    margin: '20px 0 8px',
  },
  helpText: {
    fontSize: 13,
    color: 'var(--n700)',
    lineHeight: 1.5,
    margin: 0,
  },
  titleInput: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--n200)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-body)',
    fontFamily: 'var(--sans)',
    fontSize: 14,
    fontWeight: 600,
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    background: 'var(--n200)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-body)',
    fontFamily: 'var(--sans)',
    fontSize: 14,
    lineHeight: 1.6,
    resize: 'vertical' as const,
    transition: 'border-color 0.15s',
    outline: 'none',
  },
  questionCard: {
    background: 'linear-gradient(180deg, #161717, #131414)',
    border: '1px solid var(--n200)',
    borderRadius: 'var(--radius-md)',
    padding: 16,
  },
  questionText: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--n1100)',
    lineHeight: 1.5,
    marginBottom: 10,
  },
  answerInput: {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--n100)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-body)',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    lineHeight: 1.5,
    resize: 'vertical' as const,
    outline: 'none',
  },
  primaryButton: {
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
  secondaryButton: {
    padding: '10px 20px',
    background: 'transparent',
    color: 'var(--n900)',
    border: '1px solid var(--n400)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 14,
    cursor: 'pointer',
  },
  dangerButton: {
    padding: '10px 20px',
    background: 'transparent',
    color: 'var(--r600)',
    border: '1px solid var(--r400)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--sans)',
    fontSize: 14,
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
  buttonRow: {
    display: 'flex',
    gap: 12,
    marginTop: 8,
  },
  analysisText: {
    fontSize: 14,
    color: 'var(--n900)',
    lineHeight: 1.7,
  },
  nodeExplanation: {
    padding: '10px 0',
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
