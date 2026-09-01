// ============================================================
// VariationsPanel — Five named operators for graph variation
// ============================================================

import { useState, useCallback } from 'react';
import type { Variable, Edge, VariationOperator } from '../types';

interface VariationResult {
  operator: VariationOperator;
  label: string;
  description: string;
  variables: Variable[];
  edges: Edge[];
  note: string;
}

interface VariationsPanelProps {
  variables: Variable[];
  edges: Edge[];
  onApplyVariation: (result: VariationResult) => void;
  onClose: () => void;
}

const OPERATORS: { key: VariationOperator; label: string; description: string }[] = [
  {
    key: 'boundary',
    label: 'Boundary Shift',
    description: 'Redraw wider or narrower. Names who or what was outside the previous boundary.',
  },
  {
    key: 'timescale',
    label: 'Timescale Shift',
    description: 'The same structure at 18 months and at 10 years. Loop dominance changes with horizon.',
  },
  {
    key: 'polarity',
    label: 'Polarity Inversion',
    description: 'Flip a contested edge and show what structure emerges.',
  },
  {
    key: 'actor',
    label: 'Actor Substitution',
    description: 'Redraw the map from the causal beliefs of a different stakeholder.',
  },
  {
    key: 'delay',
    label: 'Delay Stress',
    description: 'This edge took weeks. What if it takes years. Recompute delay analysis.',
  },
];

export default function VariationsPanel({ variables, edges, onApplyVariation, onClose }: VariationsPanelProps) {
  const [selectedOperator, setSelectedOperator] = useState<VariationOperator | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeVariation, setActiveVariation] = useState<VariationResult | null>(null);

  const handleGenerate = useCallback(
    (operator: VariationOperator) => {
      setSelectedOperator(operator);
      setIsGenerating(true);

      // Simulate AI variation generation
      setTimeout(() => {
        const result = generateVariation(operator, variables, edges);
        setActiveVariation(result);
        setIsGenerating(false);
        onApplyVariation(result);
      }, 1000);
    },
    [variables, edges, onApplyVariation],
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.eyebrow}>Variations</div>
          <h3 style={styles.title}>Five Operators</h3>
        </div>
        <button style={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      <p style={styles.helpText}>
        Named operators are a method that can be taught and repeated. Each one produces a variant graph
        you can inspect and annotate.
      </p>

      <div style={styles.operatorList}>
        {OPERATORS.map((op) => (
          <button
            key={op.key}
            style={{
              ...styles.operatorButton,
              ...(selectedOperator === op.key ? styles.operatorActive : {}),
            }}
            onClick={() => handleGenerate(op.key)}
            disabled={isGenerating}
          >
            <div style={styles.operatorLabel}>{op.label}</div>
            <div style={styles.operatorDesc}>{op.description}</div>
            {isGenerating && selectedOperator === op.key && (
              <div style={styles.generating}>Generating...</div>
            )}
          </button>
        ))}
      </div>

      {activeVariation && (
        <div style={styles.result}>
          <div style={styles.resultHeader}>
            <div style={styles.eyebrow}>{activeVariation.label}</div>
          </div>
          <p style={styles.resultNote}>{activeVariation.note}</p>
          <div style={styles.resultStats}>
            <span style={styles.stat}>{activeVariation.variables.length} variables</span>
            <span style={styles.stat}>{activeVariation.edges.length} edges</span>
            <span style={styles.stat}>
              {activeVariation.edges.filter((e) => e.polarity === 'opposite').length} opposite
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Simulated variation generation
// ============================================================

function generateVariation(
  operator: VariationOperator,
  variables: Variable[],
  edges: Edge[],
): VariationResult {
  switch (operator) {
    case 'boundary':
      return generateBoundaryShift(variables, edges);
    case 'timescale':
      return generateTimescaleShift(variables, edges);
    case 'polarity':
      return generatePolarityInversion(variables, edges);
    case 'actor':
      return generateActorSubstitution(variables, edges);
    case 'delay':
      return generateDelayStress(variables, edges);
  }
}

function cloneVars(vars: Variable[]): Variable[] {
  return vars.map((v) => ({ ...v }));
}

function cloneEdges(eds: Edge[]): Edge[] {
  return eds.map((e) => ({ ...e }));
}

function generateBoundaryShift(variables: Variable[], edges: Edge[]): VariationResult {
  const newVars = cloneVars(variables);
  // Add a new external variable that was previously outside the boundary
  const newVar: Variable = {
    id: `boundary-${Date.now()}`,
    name: 'Market Structure',
    definition: 'Industry concentration, entry barriers, and competitive dynamics previously treated as fixed context',
    isBoundary: false,
  };
  newVars.push(newVar);

  const newEdges = cloneEdges(edges);
  // Connect the new variable into the graph
  if (newVars.length >= 2) {
    newEdges.push({
      id: `be-${Date.now()}`,
      fromVariableId: newVar.id,
      toVariableId: newVars[0].id,
      polarity: 'same',
      delay: 'years',
      strength: 'moderate',
      provenance: 'model_inference',
    });
  }

  return {
    operator: 'boundary',
    label: 'Boundary Shift',
    description: 'Redrawn with Market Structure inside the boundary',
    variables: newVars,
    edges: newEdges,
    note: 'Market Structure was previously treated as exogenous context. Bringing it inside the boundary reveals it as a variable the system can influence over longer timescales. The original map assumed industry structure was fixed — this variation asks what changes when it is not.',
  };
}

function generateTimescaleShift(variables: Variable[], edges: Edge[]): VariationResult {
  const newVars = cloneVars(variables);
  const newEdges = cloneEdges(edges);

  // At 10-year horizon, delays compress and new feedback emerges
  // Flip one edge polarity to show long-term reversal
  if (newEdges.length > 0) {
    const targetEdge = newEdges.find((e) => e.polarity === 'opposite');
    if (targetEdge) {
      targetEdge.polarity = 'same';
      targetEdge.delay = 'years';
    }
  }

  return {
    operator: 'timescale',
    label: 'Timescale Shift',
    description: 'Same structure at a 10-year horizon',
    variables: newVars,
    edges: newEdges,
    note: 'At a 10-year horizon, what appeared as a balancing force (opposite polarity) may become reinforcing. Price pressure, over a decade, can drive consolidation that reduces competitive intensity — the opposite of its short-term effect. Loop dominance shifts from balancing to reinforcing as the horizon extends.',
  };
}

function generatePolarityInversion(variables: Variable[], edges: Edge[]): VariationResult {
  const newVars = cloneVars(variables);
  const newEdges = cloneEdges(edges);

  // Find a human-asserted edge and flip it
  const humanEdge = newEdges.find((e) => e.provenance === 'human_assertion');
  if (humanEdge) {
    humanEdge.polarity = humanEdge.polarity === 'same' ? 'opposite' : 'same';
  }

  return {
    operator: 'polarity',
    label: 'Polarity Inversion',
    description: 'What if the contested relationship runs the other way',
    variables: newVars,
    edges: newEdges,
    note: 'Flipping a human-asserted edge reveals the structure that would hold if the researcher\'s initial judgment was reversed. This is not a correction — it is a stress test. If the map still makes sense after inversion, the original polarity may not be load-bearing. If it collapses, the original judgment was structural.',
  };
}

function generateActorSubstitution(variables: Variable[], edges: Edge[]): VariationResult {
  const newVars = cloneVars(variables);
  // Rename one variable to reflect a different stakeholder's framing
  if (newVars.length > 0) {
    newVars[0] = {
      ...newVars[0],
      name: `${newVars[0].name} (Regulator's View)`,
      definition: `How a regulator would define and measure ${newVars[0].name.toLowerCase()}`,
    };
  }

  const newEdges = cloneEdges(edges);
  // Add a new edge reflecting the stakeholder's causal belief
  if (newVars.length >= 2) {
    newEdges.push({
      id: `as-${Date.now()}`,
      fromVariableId: newVars[newVars.length - 1].id,
      toVariableId: newVars[0].id,
      polarity: 'opposite',
      delay: 'years',
      strength: 'strong',
      provenance: 'model_inference',
    });
  }

  return {
    operator: 'actor',
    label: 'Actor Substitution',
    description: 'Redrawn from a regulator\'s causal beliefs',
    variables: newVars,
    edges: newEdges,
    note: 'A regulator sees the same variables but draws different causal arrows. Where the original map shows market forces as primary, the regulator\'s map adds compliance feedback that the original actor treated as external. The disagreement between these two maps is itself a finding.',
  };
}

function generateDelayStress(variables: Variable[], edges: Edge[]): VariationResult {
  const newVars = cloneVars(variables);
  const newEdges = cloneEdges(edges);

  // Find an edge with short delay and stretch it
  const shortEdge = newEdges.find((e) => e.delay === 'immediate' || e.delay === 'weeks');
  if (shortEdge) {
    shortEdge.delay = 'years';
    shortEdge.strength = 'weak';
  }

  return {
    operator: 'delay',
    label: 'Delay Stress',
    description: 'What if the fast response takes years instead of weeks',
    variables: newVars,
    edges: newEdges,
    note: 'Stretching a fast edge to years reveals where the system depends on rapid feedback. If the response that currently takes weeks were to take years, the reinforcing loop would overshoot before the balancing loop engaged. The junction between fast and slow loops is where oscillation lives.',
  };
}

// ============================================================
// Styles
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 380,
    minWidth: 380,
    height: '100%',
    overflowY: 'auto' as const,
    borderLeft: '1px solid var(--n200)',
    background: 'var(--n100)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    pointerEvents: 'auto' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
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
    fontSize: 20,
    color: 'var(--text-primary)',
    textShadow: 'var(--glow)',
    margin: 0,
  },
  closeButton: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: 'var(--n600)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 16,
    cursor: 'pointer',
    fontFamily: 'var(--sans)',
  },
  helpText: {
    fontSize: 12,
    color: 'var(--n700)',
    lineHeight: 1.5,
    margin: 0,
  },
  operatorList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  operatorButton: {
    width: '100%',
    padding: '14px 16px',
    background: 'linear-gradient(180deg, #161717, #131414)',
    border: '1px solid var(--n200)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'border-color 0.15s, background 0.15s',
  },
  operatorActive: {
    borderColor: 'var(--accent)',
    background: 'var(--g100)',
  },
  operatorLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--n1100)',
    marginBottom: 4,
  },
  operatorDesc: {
    fontSize: 12,
    color: 'var(--n700)',
    lineHeight: 1.4,
  },
  generating: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--accent)',
    marginTop: 8,
    letterSpacing: '0.05em',
  },
  result: {
    background: 'linear-gradient(180deg, #161717, #131414)',
    border: '1px solid var(--g300)',
    borderRadius: 'var(--radius-md)',
    padding: 16,
  },
  resultHeader: {
    marginBottom: 8,
  },
  resultNote: {
    fontSize: 13,
    color: 'var(--n900)',
    lineHeight: 1.6,
    margin: '0 0 12px',
  },
  resultStats: {
    display: 'flex',
    gap: 16,
  },
  stat: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--n600)',
  },
};