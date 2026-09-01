// ============================================================
// AnimatedCausalEdge — Edge with animated flow particles
// Shows data/energy flowing along connections during simulation
// ============================================================

import { useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { Edge } from '../types';

interface AnimatedCausalEdgeData {
  edge: Edge;
  /** Current energy value (0–100) driving thickness and particle speed */
  energy?: number;
  /** Whether flow is currently positive (green) or negative (red) */
  flowPositive?: boolean;
}

export default function AnimatedCausalEdge({
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

  const edgeData = data as unknown as AnimatedCausalEdgeData | undefined;
  const edge = edgeData?.edge;
  const energy = edgeData?.energy ?? 0;
  const flowPositive = edgeData?.flowPositive ?? true;
  const polarity = edge?.polarity ?? 'same';
  const isOpposite = polarity === 'opposite';

  // Energy drives visual properties
  const clampedEnergy = Math.max(0, Math.min(100, energy));
  const energyRatio = clampedEnergy / 100;

  // Stroke width: 1.5 base + up to 4 extra based on energy
  const strokeWidth = 1.5 + energyRatio * 4;

  // Color: green for positive flow, red for negative, intensity based on energy
  const baseHue = flowPositive ? 155 : 0;
  const saturation = 40 + energyRatio * 50;
  const lightness = 45 + energyRatio * 15;
  const strokeColor = selected
    ? 'var(--accent)'
    : `hsl(${baseHue}, ${saturation}%, ${lightness}%)`;

  // Particle animation: dasharray creates moving segments
  const dashLength = 8 + energyRatio * 16;
  const gapLength = 20 - energyRatio * 10;
  const strokeDasharray = `${dashLength} ${gapLength}`;

  // Speed of flow animation
  const animDuration = 2.0 - energyRatio * 1.5; // faster with more energy

  // Glow for high-energy edges
  const hasGlow = energyRatio > 0.5;

  // Unique animation name per edge to avoid conflicts
  const animName = `flow-${id.replace(/[^a-zA-Z0-9]/g, '-')}`;

  // Inject keyframes for this specific edge
  const keyframes = useMemo(() => {
    const totalDash = dashLength + gapLength;
    return `@keyframes ${animName} { to { stroke-dashoffset: -${totalDash}; } }`;
  }, [animName, dashLength, gapLength]);

  return (
    <>
      {/* Inject unique keyframes */}
      <style>{keyframes}</style>

      {/* Glow layer for high-energy edges */}
      {hasGlow && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            stroke: strokeColor,
            strokeWidth: strokeWidth + 6,
            strokeDasharray,
            opacity: 0.15,
            filter: `blur(4px)`,
            animation: `${animName} ${animDuration}s linear infinite`,
          }}
        />
      )}

      {/* Main edge with animated dash */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          animation: `${animName} ${animDuration}s linear infinite`,
          transition: 'stroke 0.3s, stroke-width 0.3s',
        }}
        markerEnd={
          selected
            ? 'url(#arrow-selected)'
            : isOpposite
              ? 'url(#arrow-opposite)'
              : 'url(#arrow-same)'
        }
      />

      {/* Polarity label */}
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
              opacity: 0.85,
            }}
          >
            {isOpposite ? '−' : '+'}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  label: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    border: '1px solid',
    fontFamily: 'var(--mono)',
    lineHeight: 1,
  },
};