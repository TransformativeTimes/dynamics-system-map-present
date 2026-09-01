// ============================================================
// VariableNode — Custom React Flow node for causal loop variables
// ============================================================

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Variable } from '../types';

interface VariableNodeData {
  variable: Variable;
  isSelected?: boolean;
  impactColor?: string;
  impactLabel?: string;
  /** Scale factor for Dynamic Evolution animation (1.0 = normal) */
  evoScale?: number;
  /** Border color override for Dynamic Evolution */
  evoBorderColor?: string;
}

export default function VariableNode({ data, selected }: NodeProps) {
  const { variable, impactColor, impactLabel, evoScale, evoBorderColor } = data as unknown as VariableNodeData;
  const isBoundary = variable.isBoundary;
  const hasImpact = impactColor && impactLabel;
  const scale = evoScale ?? 1;

  return (
    <div
      className="cld-node"
      style={{
        ...styles.node,
        ...(selected ? styles.selected : {}),
        ...(isBoundary ? styles.boundary : {}),
        ...(hasImpact && !evoBorderColor ? { borderColor: impactColor, borderWidth: 2 } : {}),
        ...(evoBorderColor ? { borderColor: evoBorderColor, borderWidth: 2, boxShadow: `0 0 18px ${evoBorderColor}` } : {}),
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        transition: 'transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      {/* Handles on all four sides — any point can be entry or exit */}
      <Handle type="target" position={Position.Top} id="top" style={styles.handle} />
      <Handle type="source" position={Position.Top} id="top-source" style={{ ...styles.handle, opacity: 0 }} />
      <Handle type="target" position={Position.Right} id="right" style={styles.handle} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ ...styles.handle, opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} id="bottom" style={styles.handle} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ ...styles.handle, opacity: 0 }} />
      <Handle type="target" position={Position.Left} id="left" style={styles.handle} />
      <Handle type="source" position={Position.Left} id="left-source" style={{ ...styles.handle, opacity: 0 }} />

      <div style={styles.label}>
        {hasImpact && (
          <span style={{ ...styles.impactDot, background: impactColor }} />
        )}
        {variable.name}
      </div>
      {variable.definition && (
        <div style={styles.definition}>{variable.definition}</div>
      )}
      {isBoundary && <div style={styles.boundaryTag}>exogenous</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  node: {
    minWidth: 140,
    maxWidth: 220,
    padding: '12px 16px',
    background: 'linear-gradient(180deg, rgba(26,28,28,0.78), rgba(20,21,21,0.78))',
    backdropFilter: 'blur(10px) saturate(140%)',
    WebkitBackdropFilter: 'blur(10px) saturate(140%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 'var(--radius-md)',
    cursor: 'grab',
    fontFamily: 'var(--sans)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
    transition: 'border-color 0.18s, box-shadow 0.18s, filter 0.18s',
  },
  selected: {
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 1px rgba(111, 212, 160, 0.5), 0 0 22px rgba(111, 212, 160, 0.35), 0 8px 24px rgba(0,0,0,0.45)',
  },
  boundary: {
    borderStyle: 'dashed',
    borderColor: 'rgba(124, 134, 142, 0.6)',
    background: 'linear-gradient(180deg, rgba(26,28,28,0.55), rgba(20,21,21,0.55))',
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--n1200)',
    lineHeight: 1.3,
    textAlign: 'center' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  impactDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  definition: {
    fontSize: 11,
    color: 'var(--n700)',
    marginTop: 4,
    lineHeight: 1.4,
    textAlign: 'center' as const,
  },
  boundaryTag: {
    fontFamily: 'var(--mono)',
    fontSize: 8,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--n600)',
    marginTop: 6,
    textAlign: 'center' as const,
  },
  handle: {
    width: 8,
    height: 8,
    background: 'var(--n500)',
    border: '2px solid var(--n200)',
    borderRadius: '50%',
  },
};