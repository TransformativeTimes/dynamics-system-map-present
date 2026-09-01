// ============================================================
// CausalEdge — Custom React Flow edge with polarity markers
// and an animated flow overlay (visible energy along each link)
// ============================================================

import { useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { Edge, Provenance } from '../types';

interface CausalEdgeData {
  edge: Edge;
}

export default function CausalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as unknown as CausalEdgeData | undefined;
  const edge = edgeData?.edge;
  const polarity = edge?.polarity ?? 'same';
  const provenance = edge?.provenance ?? 'model_inference';
  const isOpposite = polarity === 'opposite';

  const strokeColor = getProvenanceColor(provenance);
  const strokeDasharray = getProvenanceDash(provenance);
  const strokeWidth = getProvenanceWidth(provenance);

  // Unique animation name per edge to avoid keyframe collisions
  const animName = useMemo(
    () => `edge-flow-${id.replace(/[^a-zA-Z0-9]/g, '-')}`,
    [id],
  );
  const flowKeyframes = useMemo(
    () => `@keyframes ${animName} { to { stroke-dashoffset: -26; } }`,
    [animName],
  );

  return (
    <>
      {/* Injected keyframes for this edge's flowing overlay */}
      <style>{flowKeyframes}</style>

      {/* Base edge (carries the arrow marker + provenance styling) */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? 'var(--accent)' : strokeColor,
          strokeWidth: selected ? 2.5 : strokeWidth,
          strokeDasharray,
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
        markerEnd={
          selected
            ? 'url(#arrow-selected)'
            : isOpposite
              ? 'url(#arrow-opposite)'
              : 'url(#arrow-same)'
        }
      />

      {/* Animated flow overlay — marching dashes show energy flowing along the link */}
      <BaseEdge
        id={`${id}-flow`}
        path={edgePath}
        style={{
          stroke: isOpposite ? 'var(--r600)' : 'var(--g600)',
          strokeWidth: 2.5,
          strokeDasharray: '6 20',
          strokeLinecap: 'round',
          fill: 'none',
          pointerEvents: 'none',
          animation: `${animName} 1.4s linear infinite`,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          <div
            style={{
              ...styles.label,
              color: isOpposite ? 'var(--r600)' : 'var(--accent)',
              background: isOpposite ? 'var(--r100)' : 'var(--g100)',
              borderColor: isOpposite ? 'var(--r300)' : 'var(--g300)',
            }}
          >
            {isOpposite ? '−' : '+'}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function getProvenanceColor(provenance: Provenance): string {
  switch (provenance) {
    case 'field_observation':
      return 'var(--g500)';
    case 'human_assertion':
      return 'var(--n800)';
    case 'model_inference':
      return 'var(--n500)';
  }
}

function getProvenanceDash(provenance: Provenance): string {
  switch (provenance) {
    case 'field_observation':
      return 'none';
    case 'human_assertion':
      return 'none';
    case 'model_inference':
      return '6 4';
  }
}

function getProvenanceWidth(provenance: Provenance): number {
  switch (provenance) {
    case 'field_observation':
      return 2.5;
    case 'human_assertion':
      return 2;
    case 'model_inference':
      return 1.5;
  }
}

const styles: Record<string, React.CSSProperties> = {
  label: {
    fontFamily: 'var(--mono)',
    fontSize: 12,
    fontWeight: 700,
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
};