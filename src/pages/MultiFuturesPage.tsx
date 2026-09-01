// ============================================================
// StressZonePage — Scenario Explorer + Dynamic Evolution tabs
// ============================================================

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge as FlowEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import VariableNode from '../components/VariableNode';
import CausalEdge from '../components/CausalEdge';
import AnimatedCausalEdge from '../components/AnimatedCausalEdge';
import type { Simulation, Variable, Edge } from '../types';

// ============================================================
// Types
// ============================================================

interface ScenarioAxis {
  id: string;
  label: string;
  lowLabel: string;
  highLabel: string;
}

interface ScenarioQuadrant {
  id: string;
  title: string;
  description: string;
  xPosition: 'low' | 'high';
  yPosition: 'low' | 'high';
  variables: Variable[];
  edges: Edge[];
  narrative: string;
}

interface ControlMetric {
  id: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  step: number;
  unit: string;
}

interface VariableImpact {
  variableId: string;
  scenarioId: string;
  value: number;
}

interface EvolutionState {
  variableId: string;
  values: number[];
}

interface VariableTrajectory {
  variableId: string;
  name: string;
  initial: number;
  final: number;
  peak: number;
  trough: number;
  range: number;
  direction: 'up' | 'down' | 'stable';
  values: number[];
  /** Which edges drove this variable's change the most */
  topInfluencers: { edgeId: string; from: string; polarity: string; contribution: number }[];
}

interface LoopAnalysis {
  loopId: string;
  variables: string[];
  type: 'reinforcing' | 'balancing';
  netPolarity: number;
  totalEnergy: number;
  description: string;
}

interface CausalChainStep {
  step: number;
  description: string;
}

interface EvolutionReport {
  summary: string;
  detailedAnalysis: string;
  mostChanged: string[];
  mostResistant: string[];
  connectionEnergy: { edgeId: string; from: string; to: string; energy: number; polarity: string; strength: string }[];
  trajectories: VariableTrajectory[];
  loops: LoopAnalysis[];
  causalChain: CausalChainStep[];
  plainLanguage: string;
}

// ============================================================
// Helpers
// ============================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function variablesToFlowNodes(variables: Variable[]): Node[] {
  const count = variables.length;
  const radius = 160;
  const centerX = 200;
  const centerY = 150;

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
// ScenarioCanvas — one quadrant's diagram
// ============================================================

interface ScenarioCanvasProps {
  scenario: ScenarioQuadrant;
  getImpactColor: (variableId: string, scenarioId: string) => string;
  getImpactLabel: (variableId: string, scenarioId: string) => string;
}

function ScenarioCanvas({ scenario, getImpactColor, getImpactLabel }: ScenarioCanvasProps) {
  const initialNodes = variablesToFlowNodes(scenario.variables).map((n) => ({
    ...n,
    data: {
      ...n.data,
      impactColor: getImpactColor(n.id, scenario.id),
      impactLabel: getImpactLabel(n.id, scenario.id),
    },
  }));
  const initialEdges = edgesToFlowEdges(scenario.edges);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState<FlowEdge>(initialEdges);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          impactColor: getImpactColor(n.id, scenario.id),
          impactLabel: getImpactLabel(n.id, scenario.id),
        },
      })),
    );
  }, [getImpactColor, getImpactLabel, scenario.id, setNodes]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypesMemo}
      edgeTypes={edgeTypesMemo}
      fitView
      fitViewOptions={{ padding: 0.4 }}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={0.5} color="rgba(255,255,255,0.04)" />
    </ReactFlow>
  );
}

const nodeTypesMemo = { variable: VariableNode };
const edgeTypesMemo = { causal: CausalEdge };

// ============================================================
// Scenario generators
// ============================================================

function makeVar(id: string, name: string, definition: string, isBoundary = false): Variable {
  return { id, name, definition, isBoundary };
}

function makeEdge(
  id: string, fromVariableId: string, toVariableId: string,
  polarity: 'same' | 'opposite', delay: 'weeks' | 'months' | 'years',
  strength: 'weak' | 'moderate' | 'strong',
  provenance: 'human_assertion' | 'model_inference' | 'field_observation' = 'model_inference',
): Edge {
  return { id, fromVariableId, toVariableId, polarity, delay, strength, provenance };
}

function generateScenarios(_sim: Simulation, axes: ScenarioAxis[]): ScenarioQuadrant[] {
  const xAxis = axes[0];
  const yAxis = axes[1];

  const scenarioA: ScenarioQuadrant = {
    id: 'scenario-a', title: `${xAxis.highLabel} × ${yAxis.highLabel}`,
    description: `High ${xAxis.label} × High ${yAxis.label}`, xPosition: 'high', yPosition: 'high',
    variables: [
      makeVar('a1', 'Market Dominance', 'Incumbents consolidate position through regulatory moats'),
      makeVar('a2', 'Compliance Cost', 'Rising cost of meeting regulatory requirements'),
      makeVar('a3', 'Innovation Pace', 'Steady, protected R&D investment'),
      makeVar('a4', 'New Entrant Threat', 'Low — barriers are high', true),
      makeVar('a5', 'Profit Margin', 'Healthy margins sustained by limited competition'),
    ],
    edges: [
      makeEdge('ae1', 'a1', 'a5', 'same', 'years', 'strong', 'human_assertion'),
      makeEdge('ae2', 'a2', 'a5', 'opposite', 'months', 'moderate'),
      makeEdge('ae3', 'a5', 'a3', 'same', 'years', 'moderate'),
      makeEdge('ae4', 'a3', 'a1', 'same', 'years', 'strong'),
      makeEdge('ae5', 'a4', 'a1', 'opposite', 'years', 'weak'),
      makeEdge('ae6', 'a2', 'a4', 'opposite', 'years', 'strong'),
    ],
    narrative: `When ${xAxis.label} is high and ${yAxis.label} is high, incumbents thrive behind regulatory moats. Compliance costs rise but are offset by protected margins. Innovation is steady but not urgent. The dominant loop is a virtuous cycle of market dominance → profit → innovation → more dominance.`,
  };

  const scenarioB: ScenarioQuadrant = {
    id: 'scenario-b', title: `${xAxis.lowLabel} × ${yAxis.highLabel}`,
    description: `Low ${xAxis.label} × High ${yAxis.label}`, xPosition: 'low', yPosition: 'high',
    variables: [
      makeVar('b1', 'Customer Acquisition', 'Rapid user growth in an open market'),
      makeVar('b2', 'Competitive Intensity', 'Number and aggression of rivals'),
      makeVar('b3', 'Price Erosion', 'Downward pressure on pricing from competition'),
      makeVar('b4', 'Feature Velocity', 'Speed of new feature releases'),
      makeVar('b5', 'Burn Rate', 'Cash consumption rate', true),
      makeVar('b6', 'Valuation', 'Market perception of company worth'),
    ],
    edges: [
      makeEdge('be1', 'b1', 'b6', 'same', 'months', 'strong', 'field_observation'),
      makeEdge('be2', 'b1', 'b2', 'same', 'weeks', 'strong'),
      makeEdge('be3', 'b2', 'b3', 'same', 'weeks', 'strong'),
      makeEdge('be4', 'b3', 'b4', 'same', 'months', 'moderate'),
      makeEdge('be5', 'b4', 'b1', 'same', 'months', 'strong'),
      makeEdge('be6', 'b2', 'b5', 'same', 'months', 'moderate'),
      makeEdge('be7', 'b5', 'b6', 'opposite', 'months', 'strong'),
    ],
    narrative: `Low ${xAxis.label} with high ${yAxis.label} creates a land-grab. Customer acquisition drives valuation, but also attracts competition. Price erosion forces faster feature velocity. The system runs hot — a reinforcing loop of acquisition → competition → price pressure → innovation → more acquisition. Burn rate is the hidden brake.`,
  };

  const scenarioC: ScenarioQuadrant = {
    id: 'scenario-c', title: `${xAxis.lowLabel} × ${yAxis.lowLabel}`,
    description: `Low ${xAxis.label} × Low ${yAxis.label}`, xPosition: 'low', yPosition: 'low',
    variables: [
      makeVar('c1', 'Market Contraction', 'Rate at which the addressable market shrinks'),
      makeVar('c2', 'Overcapacity', 'Excess production capability relative to demand'),
      makeVar('c3', 'Cost Cutting', 'Aggressive reduction of operational expenses'),
      makeVar('c4', 'Survivor Count', 'Number of viable competitors remaining'),
      makeVar('c5', 'Asset Prices', 'Valuation of distressed assets', true),
    ],
    edges: [
      makeEdge('ce1', 'c1', 'c2', 'same', 'months', 'strong', 'field_observation'),
      makeEdge('ce2', 'c2', 'c3', 'same', 'weeks', 'strong'),
      makeEdge('ce3', 'c3', 'c4', 'opposite', 'months', 'moderate'),
      makeEdge('ce4', 'c4', 'c2', 'opposite', 'years', 'weak'),
      makeEdge('ce5', 'c5', 'c1', 'opposite', 'years', 'weak'),
      makeEdge('ce6', 'c3', 'c5', 'opposite', 'months', 'moderate'),
    ],
    narrative: `When both ${xAxis.label} and ${yAxis.label} are low, it's a brutal selection environment. Market contraction creates overcapacity, which forces cost cutting. Cost cutting reduces the survivor count, which eventually eases overcapacity — but only after significant destruction.`,
  };

  const scenarioD: ScenarioQuadrant = {
    id: 'scenario-d', title: `${xAxis.highLabel} × ${yAxis.lowLabel}`,
    description: `High ${xAxis.label} × Low ${yAxis.label}`, xPosition: 'high', yPosition: 'low',
    variables: [
      makeVar('d1', 'Regulatory Pressure', 'Intensity of compliance and oversight demands'),
      makeVar('d2', 'Consolidation Rate', 'Speed of M&A activity in the sector'),
      makeVar('d3', 'Operational Efficiency', 'Ability to do more with less'),
      makeVar('d4', 'Lobbying Spend', 'Resources directed at shaping regulation', true),
      makeVar('d5', 'Exit Rate', 'Rate at which firms leave the market'),
    ],
    edges: [
      makeEdge('de1', 'd1', 'd5', 'same', 'months', 'strong', 'human_assertion'),
      makeEdge('de2', 'd5', 'd2', 'same', 'months', 'moderate'),
      makeEdge('de3', 'd2', 'd3', 'same', 'years', 'moderate'),
      makeEdge('de4', 'd3', 'd1', 'opposite', 'years', 'weak'),
      makeEdge('de5', 'd4', 'd1', 'opposite', 'years', 'moderate'),
      makeEdge('de6', 'd2', 'd4', 'same', 'years', 'weak'),
    ],
    narrative: `High ${xAxis.label} with low ${yAxis.label} creates a managed decline. Regulatory pressure drives exits, which accelerates consolidation. Consolidation improves operational efficiency at scale, which can eventually reduce regulatory pressure — but the feedback is slow.`,
  };

  return [scenarioA, scenarioB, scenarioC, scenarioD];
}

function defaultAxes(): ScenarioAxis[] {
  return [
    { id: 'x-axis', label: 'Regulatory Environment', lowLabel: 'Light Touch', highLabel: 'Heavy Regulation' },
    { id: 'y-axis', label: 'Market Demand', lowLabel: 'Contracting', highLabel: 'Expanding' },
  ];
}

function defaultMetrics(): ControlMetric[] {
  return [
    { id: 'price-pressure', label: 'Price Pressure', min: 0, max: 100, defaultValue: 50, step: 1, unit: '%' },
    { id: 'demand-growth', label: 'Demand Growth', min: -20, max: 20, defaultValue: 0, step: 1, unit: '%' },
    { id: 'regulatory-intensity', label: 'Regulatory Intensity', min: 0, max: 100, defaultValue: 50, step: 1, unit: '%' },
    { id: 'innovation-speed', label: 'Innovation Speed', min: 0, max: 100, defaultValue: 50, step: 1, unit: '%' },
    { id: 'market-volatility', label: 'Market Volatility', min: 0, max: 100, defaultValue: 30, step: 1, unit: '%' },
    { id: 'resource-availability', label: 'Resource Availability', min: 0, max: 100, defaultValue: 60, step: 1, unit: '%' },
  ];
}

function computeImpacts(
  scenarios: ScenarioQuadrant[], _metrics: ControlMetric[], metricValues: Record<string, number>,
): VariableImpact[] {
  const impacts: VariableImpact[] = [];
  for (const scenario of scenarios) {
    for (const variable of scenario.variables) {
      let score = 0;
      const pricePressure = metricValues['price-pressure'] ?? 50;
      const demandGrowth = metricValues['demand-growth'] ?? 0;
      const regulatoryIntensity = metricValues['regulatory-intensity'] ?? 50;
      const innovationSpeed = metricValues['innovation-speed'] ?? 50;
      const volatility = metricValues['market-volatility'] ?? 30;
      const resourceAvailability = metricValues['resource-availability'] ?? 60;
      const demandBonus = scenario.yPosition === 'high' ? 0.3 : -0.3;
      const regulationPenalty = scenario.xPosition === 'high' ? -0.2 : 0.1;
      score += demandBonus + regulationPenalty;
      const name = variable.name.toLowerCase();
      if (name.includes('demand') || name.includes('acquisition') || name.includes('growth')) { score += (demandGrowth / 20) * 0.5 + (pricePressure - 50) / 100 * -0.3; }
      if (name.includes('capacity') || name.includes('production') || name.includes('overcapacity')) { score += (resourceAvailability - 50) / 100 * 0.4 + (volatility - 50) / 100 * -0.3; }
      if (name.includes('price') || name.includes('margin') || name.includes('cost') || name.includes('burn')) { score += (pricePressure - 50) / 100 * -0.5 + (volatility - 50) / 100 * 0.3; }
      if (name.includes('innovation') || name.includes('feature') || name.includes('r&d')) { score += (innovationSpeed - 50) / 100 * 0.5 + (resourceAvailability - 50) / 100 * 0.3; }
      if (name.includes('regulat') || name.includes('compliance') || name.includes('lobbying')) { score += (regulatoryIntensity - 50) / 100 * -0.6; }
      if (name.includes('competit') || name.includes('entrant') || name.includes('rival')) { score += (volatility - 50) / 100 * 0.4 + (pricePressure - 50) / 100 * 0.3; }
      if (name.includes('survivor') || name.includes('exit') || name.includes('consolidation')) { score += (demandGrowth / 20) * -0.4 + (regulatoryIntensity - 50) / 100 * 0.3; }
      if (name.includes('asset') || name.includes('valuation')) { score += (demandGrowth / 20) * 0.4 + (volatility - 50) / 100 * -0.3; }
      if (name.includes('efficiency') || name.includes('operational')) { score += (resourceAvailability - 50) / 100 * 0.3 + (innovationSpeed - 50) / 100 * 0.3; }
      score = Math.max(-1, Math.min(1, score));
      impacts.push({ variableId: variable.id, scenarioId: scenario.id, value: score });
    }
  }
  return impacts;
}

// ============================================================
// Dynamic Evolution — Simulation Engine
// ============================================================

const STRENGTH_MULTIPLIER: Record<string, number> = { weak: 0.3, moderate: 0.6, strong: 1.0 };
const TOTAL_STEPS = 60;

function runEvolutionSimulation(
  variables: Variable[],
  edges: Edge[],
  trendTargetId: string,
  trendStrength: number,
): { history: EvolutionState[]; report: EvolutionReport } {
  const initialValues: Record<string, number> = {};
  variables.forEach((v) => { initialValues[v.id] = v.isBoundary ? 50 : 50; });

  const history: EvolutionState[] = variables.map((v) => ({
    variableId: v.id,
    values: [initialValues[v.id]],
  }));

  const currentValues = { ...initialValues };

  for (let step = 1; step <= TOTAL_STEPS; step++) {
    const deltas: Record<string, number> = {};
    variables.forEach((v) => { deltas[v.id] = 0; });

    // Apply edge influences
    for (const edge of edges) {
      const sourceVal = currentValues[edge.fromVariableId];
      const strength = STRENGTH_MULTIPLIER[edge.strength] || 0.5;
      const polarity = edge.polarity === 'same' ? 1 : -1;
      const influence = (sourceVal - 50) * strength * polarity * 0.15;
      deltas[edge.toVariableId] += influence;
    }

    // Apply trend force to target variable
    deltas[trendTargetId] += trendStrength * 0.5;

    // Apply deltas with damping
    for (const v of variables) {
      if (!v.isBoundary) {
        currentValues[v.id] += deltas[v.id];
        currentValues[v.id] = Math.max(0, Math.min(100, currentValues[v.id]));
      }
    }

    // Record history
    for (const state of history) {
      state.values.push(currentValues[state.variableId]);
    }
  }

  // ---- Build enriched report ----

  const varNames: Record<string, string> = {};
  variables.forEach((v) => { varNames[v.id] = v.name; });

  // 1. Variable trajectories
  const trajectories: VariableTrajectory[] = history.map((h) => {
    const vals = h.values;
    const initial = vals[0];
    const final = vals[vals.length - 1];
    const peak = Math.max(...vals);
    const trough = Math.min(...vals);
    const range = peak - trough;
    const direction: 'up' | 'down' | 'stable' = final - initial > 2 ? 'up' : final - initial < -2 ? 'down' : 'stable';

    // Find which incoming edges contributed most to this variable's change
    const incomingEdges = edges.filter((e) => e.toVariableId === h.variableId);
    const topInfluencers = incomingEdges
      .map((e) => {
        const fromState = history.find((hs) => hs.variableId === e.fromVariableId);
        const fromRange = fromState ? Math.max(...fromState.values) - Math.min(...fromState.values) : 0;
        const contribution = fromRange * (STRENGTH_MULTIPLIER[e.strength] || 0.5);
        return {
          edgeId: e.id,
          from: varNames[e.fromVariableId] ?? e.fromVariableId,
          polarity: e.polarity,
          contribution,
        };
      })
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);

    return {
      variableId: h.variableId,
      name: varNames[h.variableId] ?? h.variableId,
      initial,
      final,
      peak,
      trough,
      range,
      direction,
      values: vals,
      topInfluencers,
    };
  });

  trajectories.sort((a, b) => b.range - a.range);

  const mostChanged = trajectories.slice(0, 2).map((t) => t.name);
  const mostResistant = trajectories.slice(-2).map((t) => t.name);

  // 2. Connection energy (with polarity and strength)
  const connectionEnergy = edges.map((e) => {
    const fromTraj = trajectories.find((t) => t.variableId === e.fromVariableId);
    const toTraj = trajectories.find((t) => t.variableId === e.toVariableId);
    const energy = Math.abs((fromTraj?.range ?? 0) * (toTraj?.range ?? 0) * (STRENGTH_MULTIPLIER[e.strength] || 0.5));
    return {
      edgeId: e.id,
      from: varNames[e.fromVariableId] ?? e.fromVariableId,
      to: varNames[e.toVariableId] ?? e.toVariableId,
      energy,
      polarity: e.polarity,
      strength: e.strength,
    };
  });
  connectionEnergy.sort((a, b) => b.energy - a.energy);

  // 3. Loop detection — find simple cycles in the graph
  const loops: LoopAnalysis[] = [];
  const adjList: Record<string, string[]> = {};
  edges.forEach((e) => {
    if (!adjList[e.fromVariableId]) adjList[e.fromVariableId] = [];
    adjList[e.fromVariableId].push(e.toVariableId);
  });

  // DFS to find cycles up to length 6
  function findCycles(start: string, current: string, visited: string[], depth: number) {
    if (depth > 6) return;
    const neighbors = adjList[current] || [];
    for (const next of neighbors) {
      if (next === start && visited.length >= 2) {
        // Found a cycle
        const cycleVars = [...visited, current];
        const cycleEdges: Edge[] = [];
        for (let i = 0; i < cycleVars.length; i++) {
          const from = cycleVars[i];
          const to = cycleVars[(i + 1) % cycleVars.length];
          const edge = edges.find((e) => e.fromVariableId === from && e.toVariableId === to);
          if (edge) cycleEdges.push(edge);
        }
        if (cycleEdges.length === cycleVars.length) {
          const netPolarity = cycleEdges.reduce((acc, e) => acc * (e.polarity === 'same' ? 1 : -1), 1);
          const totalEnergy = cycleEdges.reduce((acc, e) => {
            const ce = connectionEnergy.find((c) => c.edgeId === e.id);
            return acc + (ce?.energy ?? 0);
          }, 0);
          const type = netPolarity > 0 ? 'reinforcing' : 'balancing';
          const varNames_cycle = cycleVars.map((id) => varNames[id] ?? id);
          const loopId = `loop-${varNames_cycle.join('-')}`;
          if (!loops.find((l) => l.loopId === loopId)) {
            loops.push({
              loopId,
              variables: varNames_cycle,
              type,
              netPolarity,
              totalEnergy,
              description: type === 'reinforcing'
                ? `Reinforcing loop: ${varNames_cycle.join(' → ')}. Each variable amplifies the next, creating a self-reinforcing cycle.`
                : `Balancing loop: ${varNames_cycle.join(' → ')}. The net effect is stabilising — odd number of opposite links dampen the system.`,
            });
          }
        }
        return;
      }
      if (!visited.includes(next)) {
        findCycles(start, next, [...visited, current], depth + 1);
      }
    }
  }

  variables.forEach((v) => {
    if (!v.isBoundary) findCycles(v.id, v.id, [], 0);
  });
  loops.sort((a, b) => b.totalEnergy - a.totalEnergy);

  // 4. Causal chain — step-by-step narrative of how the trend propagated
  const targetVarName = varNames[trendTargetId] ?? trendTargetId;
  const causalChain: CausalChainStep[] = [
    { step: 1, description: `External force applied to "${targetVarName}" with strength ${trendStrength > 0 ? '+' : ''}${trendStrength}. This variable ${trendStrength > 0 ? 'increases' : 'decreases'} from its baseline of 50.` },
  ];

  // Trace downstream effects through edges
  const affectedOrder: string[] = [trendTargetId];
  const processed = new Set<string>([trendTargetId]);
  let queue = [trendTargetId];
  let stepNum = 2;

  while (queue.length > 0 && stepNum <= 8) {
    const nextQueue: string[] = [];
    for (const varId of queue) {
      const outgoing = edges.filter((e) => e.fromVariableId === varId);
      for (const edge of outgoing) {
        if (!processed.has(edge.toVariableId)) {
          processed.add(edge.toVariableId);
          affectedOrder.push(edge.toVariableId);
          nextQueue.push(edge.toVariableId);
          const fromName = varNames[edge.fromVariableId] ?? edge.fromVariableId;
          const toName = varNames[edge.toVariableId] ?? edge.toVariableId;
          const toTraj = trajectories.find((t) => t.variableId === edge.toVariableId);
          const direction = toTraj?.direction === 'up' ? 'increases' : toTraj?.direction === 'down' ? 'decreases' : 'remains stable';
          const polarityDesc = edge.polarity === 'same' ? 'directly' : 'inversely';
          causalChain.push({
            step: stepNum,
            description: `"${fromName}" ${polarityDesc} influences "${toName}" (${edge.strength} ${edge.polarity} link). "${toName}" ${direction} to ${toTraj?.final.toFixed(1) ?? '?'}.`,
          });
          stepNum++;
        }
      }
    }
    queue = nextQueue;
  }

  // 5. Detailed analysis narrative
  const topLoop = loops[0];
  const topEdge = connectionEnergy[0];
  const dominantDirection = trajectories[0]?.direction === 'up' ? 'reinforcing (positive growth)' : 'balancing (stabilising or declining)';

  const detailedAnalysis = [
    `SYSTEM EVOLUTION ANALYSIS`,
    ``,
    `The simulation applied a ${trendStrength > 0 ? 'positive' : 'negative'} force of strength ${Math.abs(trendStrength)} to "${targetVarName}" over ${TOTAL_STEPS} time steps.`,
    ``,
    `DOMINANT DYNAMIC: The system evolved toward a ${dominantDirection} pattern.`,
    ``,
    `MOST SENSITIVE VARIABLES: "${mostChanged.join('" and "')}" showed the greatest range of change, indicating high sensitivity to the applied force and the feedback structure.`,
    ``,
    `MOST RESISTANT VARIABLES: "${mostResistant.join('" and "')}" remained relatively stable, suggesting they are buffered by the system's structure or lack strong incoming connections.`,
    ``,
    topLoop ? `KEY FEEDBACK LOOP: A ${topLoop.type} loop was identified: ${topLoop.variables.join(' → ')}. ${topLoop.description} This loop carried the most energy (${topLoop.totalEnergy.toFixed(1)}) and was the primary driver of system behaviour.` : `No significant feedback loops were detected in this configuration.`,
    ``,
    topEdge ? `HIGHEST ENERGY CONNECTION: The edge from "${topEdge.from}" to "${topEdge.to}" (${topEdge.polarity}, ${topEdge.strength}) transmitted the most energy (${topEdge.energy.toFixed(1)}), acting as the primary conduit for the applied force through the system.` : '',
    ``,
    `WHAT THIS MEANS: When "${targetVarName}" is ${trendStrength > 0 ? 'pushed upward' : 'pushed downward'}, the causal structure ${trajectories[0]?.direction === 'up' ? 'amplifies' : 'dampens'} the effect through ${loops.length} feedback loops. The system ${trajectories[0]?.range > 20 ? 'is highly responsive' : 'shows moderate inertia'} to this type of intervention.`,
  ].filter(Boolean).join('\n');

  const summary = `The simulation ran for ${TOTAL_STEPS} time steps. The system evolved toward a ${dominantDirection} dynamic. The most sensitive variables were "${mostChanged.join('" and "')}", while "${mostResistant.join('" and "')}" showed the greatest resistance to change.`;

  const plainLanguage = `HOW TO READ THIS SIMULATION\n\nThis simulation shows how a causal loop system evolves over time when an external force is applied.\n\n• Each variable starts at 50 (neutral).\n• At each time step, variables influence each other through the connections (edges) in the diagram.\n• A "+" connection means when the source goes up, the target also goes up. A "−" connection means when the source goes up, the target goes down.\n• The external trend/force you defined pushes one variable in a specific direction each step.\n• Over time, you can see which variables amplify (become more positive or negative) and which resist change.\n• The animation shows variables growing (larger nodes) or shrinking (smaller nodes) as their values change.\n• The report below identifies what changed most, what resisted, which feedback loops dominated, and the step-by-step causal chain of how the force propagated.\n\nThis is a simplified system dynamics model. In reality, delays, non-linearities, and external shocks would add complexity.`;

  return {
    history,
    report: {
      summary,
      detailedAnalysis,
      mostChanged,
      mostResistant,
      connectionEnergy,
      trajectories,
      loops: loops.slice(0, 5),
      causalChain,
      plainLanguage,
    },
  };
}

// ============================================================
// DynamicEvolutionTab — the new simulation tab
// ============================================================

interface DynamicEvolutionTabProps {
  simulations: Simulation[];
}

// Layout matching the editor page
function evoVariablesToFlowNodes(variables: Variable[]): Node[] {
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

function DynamicEvolutionTab({ simulations }: DynamicEvolutionTabProps) {
  const [selectedSimId, setSelectedSimId] = useState<string | null>(null);
  const [trendText, setTrendText] = useState('');
  const [trendTargetId, setTrendTargetId] = useState<string | null>(null);
  const [trendStrength, setTrendStrength] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [evolutionData, setEvolutionData] = useState<{ history: EvolutionState[]; report: EvolutionReport } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const savedSims = simulations.filter((s) => s.status === 'saved' || s.status === 'promoted');
  const selectedSim = simulations.find((s) => s.id === selectedSimId);

  // Build flow nodes with live values during animation — nodes scale with value
  const flowNodes = useMemo(() => {
    if (!selectedSim) return [];
    const baseNodes = evoVariablesToFlowNodes(selectedSim.variables);
    if (!evolutionData) return baseNodes;

    return baseNodes.map((n) => {
      const state = evolutionData.history.find((h) => h.variableId === n.id);
      const value = state?.values[currentStep] ?? 50;
      // Scale: 0.75 at value=0, 1.0 at value=50, 1.35 at value=100
      const evoScale = 0.75 + (value / 100) * 0.6;
      const v = n.data.variable as Variable;
      // Color tint based on value: green above 50, red below 50
      const hue = value >= 50 ? 155 : 0;
      const sat = Math.abs(value - 50) * 1.2;
      const evoBorderColor = value >= 50
        ? `hsla(${hue}, ${sat}%, 45%, ${0.4 + Math.abs(value - 50) / 100 * 0.6})`
        : `hsla(${hue}, ${sat}%, 55%, ${0.4 + Math.abs(value - 50) / 100 * 0.6})`;
      return {
        ...n,
        data: {
          ...n.data,
          variable: { ...v, definition: `${v.definition} [Value: ${Math.round(value)}]` },
          evoScale,
          evoBorderColor,
        },
      };
    });
  }, [selectedSim, evolutionData, currentStep]);

  // Build flow edges with live energy data for animation
  const flowEdges = useMemo(() => {
    if (!selectedSim) return [];
    return selectedSim.edges.map((e) => {
      // Calculate edge energy from current values
      let energy = 0;
      let flowPositive = true;
      if (evolutionData) {
        const fromState = evolutionData.history.find((h) => h.variableId === e.fromVariableId);
        const toState = evolutionData.history.find((h) => h.variableId === e.toVariableId);
        const fromVal = fromState?.values[currentStep] ?? 50;
        const toVal = toState?.values[currentStep] ?? 50;
        const strengthMult = STRENGTH_MULTIPLIER[e.strength] || 0.5;
        const polarity = e.polarity === 'same' ? 1 : -1;
        // Energy = how much influence is flowing
        energy = Math.abs(fromVal - 50) * strengthMult * 1.5;
        energy = Math.min(100, energy);
        // Flow direction: positive if source is pushing target in same direction
        flowPositive = (fromVal - 50) * polarity > 0 || (toVal - 50) * polarity > 0;
      }
      return {
        id: e.id,
        source: e.fromVariableId,
        target: e.toVariableId,
        type: 'animated',
        data: { edge: e, energy, flowPositive },
      };
    });
  }, [selectedSim, evolutionData, currentStep]);

  const handleRun = () => {
    if (!selectedSim || !trendTargetId) return;
    setIsRunning(true);
    setCurrentStep(0);

    const result = runEvolutionSimulation(selectedSim.variables, selectedSim.edges, trendTargetId, trendStrength);
    setEvolutionData(result);

    let step = 0;
    intervalRef.current = setInterval(() => {
      step++;
      if (step > TOTAL_STEPS) {
        clearInterval(intervalRef.current!);
        setIsRunning(false);
        return;
      }
      setCurrentStep(step);
    }, 80);
  };

  const handleStop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setCurrentStep(0);
    setEvolutionData(null);
  };

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div style={styles.evoContainer}>
      {/* Left Panel */}
      <div style={styles.evoLeftPanel}>
        <div style={styles.section}>
          <div style={styles.eyebrow}>Dynamic Evolution</div>
          <h2 style={styles.heading}>Trend Stress Test</h2>
          <p style={styles.helpText}>
            Apply an external trend or force to a causal loop and watch how the system evolves over time.
          </p>
        </div>

        <div style={styles.section}>
          <div style={styles.label}>Select Simulation</div>
          <select style={styles.select} value={selectedSimId ?? ''} onChange={(e) => setSelectedSimId(e.target.value || null)}>
            <option value="">— Choose a saved simulation —</option>
            {savedSims.map((s) => (<option key={s.id} value={s.id}>{s.title}</option>))}
          </select>
        </div>

        {selectedSim && (
          <>
            <div style={styles.section}>
              <div style={styles.label}>External Trend / Force</div>
              <textarea
                style={styles.trendTextarea}
                placeholder="Describe the trend or force that will influence this system... e.g. 'A sudden 30% increase in raw material costs due to supply chain disruption' or 'New AI regulation doubles compliance requirements'"
                value={trendText}
                onChange={(e) => setTrendText(e.target.value)}
                rows={4}
              />
            </div>

            <div style={styles.section}>
              <div style={styles.label}>Target Variable</div>
              <select style={styles.select} value={trendTargetId ?? ''} onChange={(e) => setTrendTargetId(e.target.value || null)}>
                <option value="">— Select target variable —</option>
                {selectedSim.variables.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
              </select>
            </div>

            <div style={styles.section}>
              <div style={styles.sliderHeader}>
                <span style={styles.sliderLabel}>Force Strength</span>
                <span style={styles.sliderValue}>{trendStrength > 0 ? '+' : ''}{trendStrength}</span>
              </div>
              <input
                type="range"
                style={styles.slider}
                min={-20}
                max={20}
                step={1}
                value={trendStrength}
                onChange={(e) => setTrendStrength(Number(e.target.value))}
              />
              <div style={styles.sliderRangeLabels}>
                <span style={styles.sliderRangeLabel}>Strong Negative (-20)</span>
                <span style={styles.sliderRangeLabel}>Strong Positive (+20)</span>
              </div>
            </div>

            <div style={styles.evoButtonRow}>
              <button
                style={{ ...styles.primaryButton, ...(isRunning ? styles.buttonDisabled : {}) }}
                onClick={handleRun}
                disabled={isRunning || !trendTargetId}
              >
                {isRunning ? `Running... Step ${currentStep}/${TOTAL_STEPS}` : '▶ Run Simulation'}
              </button>
              {isRunning && (
                <button style={styles.secondaryButton} onClick={handleStop}>⏸ Stop</button>
              )}
              {evolutionData && !isRunning && (
                <button style={styles.secondaryButton} onClick={handleReset}>↺ Reset</button>
              )}
            </div>

            {isRunning && (
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${(currentStep / TOTAL_STEPS) * 100}%` }} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Right Panel */}
      <div style={styles.evoRightPanel}>
        {!selectedSim ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>◈</div>
            <h2 style={styles.emptyTitle}>Select a simulation to begin</h2>
            <p style={styles.emptyText}>Choose a saved causal loop diagram, define an external trend, and run the evolution simulation.</p>
          </div>
        ) : (
          <div style={styles.evoCanvasArea}>
            <div style={styles.evoCanvasHeader}>
              <span style={styles.evoCanvasTitle}>
                {selectedSim.title} {isRunning ? `— Step ${currentStep}/${TOTAL_STEPS}` : evolutionData ? '— Simulation Complete' : '— Ready'}
              </span>
            </div>
            <div style={styles.evoCanvas}>
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={evoNodeTypes}
                edgeTypes={evoEdgeTypes}
                fitView
                fitViewOptions={{ padding: 0.4 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                proOptions={{ hideAttribution: true }}
              >
                <Background variant={BackgroundVariant.Dots} gap={16} size={0.5} color="rgba(255,255,255,0.04)" />
              </ReactFlow>
            </div>

            {/* Report */}
            {evolutionData && !isRunning && currentStep === TOTAL_STEPS && (
              <div style={styles.reportArea}>
                <div style={styles.reportHeader}>
                  <div style={styles.eyebrow}>AI Analysis</div>
                  <h3 style={styles.reportTitle}>Evolution Report</h3>
                </div>

                {/* Detailed Analysis */}
                <div style={styles.reportSection}>
                  <div style={styles.reportLabel}>Detailed Analysis</div>
                  <pre style={styles.reportPre}>{evolutionData.report.detailedAnalysis}</pre>
                </div>

                {/* Variable Trajectories — sparkline visualization */}
                <div style={styles.reportSection}>
                  <div style={styles.reportLabel}>Variable Trajectories</div>
                  <div style={styles.trajectoryGrid}>
                    {evolutionData.report.trajectories.map((traj) => (
                      <div key={traj.variableId} style={styles.trajectoryCard}>
                        <div style={styles.trajectoryHeader}>
                          <span style={styles.trajectoryName}>{traj.name}</span>
                          <span style={{
                            ...styles.trajectoryDirection,
                            color: traj.direction === 'up' ? 'var(--accent)' : traj.direction === 'down' ? 'var(--r600)' : 'var(--n600)',
                          }}>
                            {traj.direction === 'up' ? '↑' : traj.direction === 'down' ? '↓' : '→'} {traj.initial.toFixed(0)} → {traj.final.toFixed(0)}
                          </span>
                        </div>
                        {/* Sparkline */}
                        <svg width="100%" height="32" style={{ marginTop: 4 }}>
                          <polyline
                            fill="none"
                            stroke={traj.direction === 'up' ? 'var(--accent)' : traj.direction === 'down' ? 'var(--r600)' : 'var(--n500)'}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={traj.values.map((v, i) => {
                              const x = (i / (traj.values.length - 1)) * 100;
                              const y = 28 - ((v - traj.trough) / (traj.peak - traj.trough || 1)) * 24;
                              return `${x},${y}`;
                            }).join(' ')}
                          />
                        </svg>
                        <div style={styles.trajectoryStats}>
                          <span style={styles.trajectoryStat}>Range: {traj.range.toFixed(1)}</span>
                          <span style={styles.trajectoryStat}>Peak: {traj.peak.toFixed(0)}</span>
                          <span style={styles.trajectoryStat}>Trough: {traj.trough.toFixed(0)}</span>
                        </div>
                        {traj.topInfluencers.length > 0 && (
                          <div style={styles.influencerList}>
                            <span style={styles.influencerLabel}>Driven by:</span>
                            {traj.topInfluencers.map((inf) => (
                              <span key={inf.edgeId} style={styles.influencerChip}>
                                {inf.from} ({inf.polarity === 'same' ? '+' : '−'})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feedback Loops */}
                {evolutionData.report.loops.length > 0 && (
                  <div style={styles.reportSection}>
                    <div style={styles.reportLabel}>Feedback Loops Detected</div>
                    {evolutionData.report.loops.map((loop) => (
                      <div key={loop.loopId} style={styles.loopCard}>
                        <div style={styles.loopHeader}>
                          <span style={{
                            ...styles.loopType,
                            color: loop.type === 'reinforcing' ? 'var(--accent)' : '#D4A843',
                          }}>
                            {loop.type === 'reinforcing' ? '⟳ Reinforcing' : '⇌ Balancing'}
                          </span>
                          <span style={styles.loopEnergy}>Energy: {loop.totalEnergy.toFixed(1)}</span>
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

                {/* Causal Chain */}
                <div style={styles.reportSection}>
                  <div style={styles.reportLabel}>Causal Chain — How the Force Propagated</div>
                  <div style={styles.causalChain}>
                    {evolutionData.report.causalChain.map((step) => (
                      <div key={step.step} style={styles.causalStep}>
                        <div style={styles.causalStepNum}>{step.step}</div>
                        <div style={styles.causalStepText}>{step.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Connection Energy */}
                <div style={styles.reportSection}>
                  <div style={styles.reportLabel}>Connection Energy</div>
                  {evolutionData.report.connectionEnergy.slice(0, 5).map((ce) => (
                    <div key={ce.edgeId} style={styles.energyRow}>
                      <span style={styles.energyFrom}>{ce.from}</span>
                      <span style={{
                        ...styles.energyPolarity,
                        color: ce.polarity === 'same' ? 'var(--accent)' : 'var(--r600)',
                      }}>
                        {ce.polarity === 'same' ? '+' : '−'}
                      </span>
                      <span style={styles.energyTo}>{ce.to}</span>
                      <span style={styles.energyStrength}>{ce.strength}</span>
                      <div style={styles.energyBar}>
                        <div style={{ ...styles.energyFill, width: `${Math.min(100, ce.energy * 20)}%` }} />
                      </div>
                      <span style={styles.energyValue}>{ce.energy.toFixed(1)}</span>
                    </div>
                  ))}
                </div>

                {/* Most Changed / Most Resistant */}
                <div style={styles.reportGrid}>
                  <div style={styles.reportSection}>
                    <div style={styles.reportLabel}>Most Changed</div>
                    {evolutionData.report.mostChanged.map((name) => (
                      <div key={name} style={styles.reportChip}>{name}</div>
                    ))}
                  </div>
                  <div style={styles.reportSection}>
                    <div style={styles.reportLabel}>Most Resistant</div>
                    {evolutionData.report.mostResistant.map((name) => (
                      <div key={name} style={{ ...styles.reportChip, background: 'rgba(212,168,67,0.15)', color: '#D4A843' }}>{name}</div>
                    ))}
                  </div>
                </div>

                {/* How to Read */}
                <div style={styles.reportSection}>
                  <div style={styles.reportLabel}>How to Read This Simulation</div>
                  <pre style={styles.reportPre}>{evolutionData.report.plainLanguage}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Edge types for the evolution canvas — uses animated edges
const evoNodeTypes = { variable: VariableNode };
const evoEdgeTypes = { animated: AnimatedCausalEdge };

// ============================================================
// ScenarioExplorerTab — the existing 2x2 foresight content
// ============================================================

interface ScenarioExplorerTabProps {
  simulations: Simulation[];
}

function ScenarioExplorerTab({ simulations }: ScenarioExplorerTabProps) {
  const [selectedSimId, setSelectedSimId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [axes, setAxes] = useState<ScenarioAxis[]>(defaultAxes());
  const [scenarios, setScenarios] = useState<ScenarioQuadrant[]>([]);
  const [metrics, setMetrics] = useState<ControlMetric[]>(defaultMetrics());
  const [metricValues, setMetricValues] = useState<Record<string, number>>({});
  const [impacts, setImpacts] = useState<VariableImpact[]>([]);
  const [newMetricLabel, setNewMetricLabel] = useState('');
  const [newMetricMin, setNewMetricMin] = useState(0);
  const [newMetricMax, setNewMetricMax] = useState(100);
  const [newMetricDefault, setNewMetricDefault] = useState(50);
  const [newMetricUnit, setNewMetricUnit] = useState('%');
  const [showMetricForm, setShowMetricForm] = useState(false);

  const savedSims = simulations.filter((s) => s.status === 'saved' || s.status === 'promoted');
  const selectedSim = simulations.find((s) => s.id === selectedSimId);

  const handleAxisChange = (axisId: string, field: 'label' | 'lowLabel' | 'highLabel', value: string) => {
    setAxes((prev) => prev.map((a) => (a.id === axisId ? { ...a, [field]: value } : a)));
  };

  const handleAiProposeAxes = () => {
    if (!selectedSim) return;
    const signalWords = selectedSim.signalText.toLowerCase();
    let xLabel = 'Regulatory Environment', xLow = 'Light Touch', xHigh = 'Heavy Regulation';
    let yLabel = 'Market Demand', yLow = 'Contracting', yHigh = 'Expanding';
    if (signalWords.includes('technology') || signalWords.includes('innovation') || signalWords.includes('digital')) { xLabel = 'Technology Adoption'; xLow = 'Slow Adoption'; xHigh = 'Rapid Disruption'; }
    if (signalWords.includes('price') || signalWords.includes('cost') || signalWords.includes('margin')) { yLabel = 'Cost Structure'; yLow = 'Deflationary'; yHigh = 'Inflationary'; }
    if (signalWords.includes('talent') || signalWords.includes('workforce') || signalWords.includes('skill')) { xLabel = 'Talent Availability'; xLow = 'Scarce'; xHigh = 'Abundant'; }
    if (signalWords.includes('global') || signalWords.includes('geopolitic') || signalWords.includes('trade')) { yLabel = 'Geopolitical Stability'; yLow = 'Fragmented'; yHigh = 'Cooperative'; }
    setAxes([{ id: 'x-axis', label: xLabel, lowLabel: xLow, highLabel: xHigh }, { id: 'y-axis', label: yLabel, lowLabel: yLow, highLabel: yHigh }]);
  };

  const handleGenerate = useCallback(() => {
    if (!selectedSim) return;
    setIsGenerating(true);
    setTimeout(() => {
      const newScenarios = generateScenarios(selectedSim, axes);
      const initialValues: Record<string, number> = {};
      metrics.forEach((m) => { initialValues[m.id] = m.defaultValue; });
      setScenarios(newScenarios);
      setMetricValues(initialValues);
      setImpacts(computeImpacts(newScenarios, metrics, initialValues));
      setIsGenerating(false);
    }, 1500);
  }, [selectedSim, axes, metrics]);

  const handleMetricChange = useCallback((metricId: string, value: number) => {
    const newValues = { ...metricValues, [metricId]: value };
    setMetricValues(newValues);
    setImpacts(computeImpacts(scenarios, metrics, newValues));
  }, [metricValues, scenarios, metrics]);

  const handleAddMetric = () => {
    if (!newMetricLabel.trim()) return;
    const id = generateId();
    const newMetric: ControlMetric = { id, label: newMetricLabel.trim(), min: newMetricMin, max: newMetricMax, defaultValue: newMetricDefault, step: 1, unit: newMetricUnit };
    const updated = [...metrics, newMetric];
    setMetrics(updated);
    setMetricValues((prev) => ({ ...prev, [id]: newMetricDefault }));
    if (scenarios.length > 0) setImpacts(computeImpacts(scenarios, updated, { ...metricValues, [id]: newMetricDefault }));
    setNewMetricLabel('');
    setShowMetricForm(false);
  };

  const handleDeleteMetric = (metricId: string) => {
    const updated = metrics.filter((m) => m.id !== metricId);
    setMetrics(updated);
    const newValues = { ...metricValues };
    delete newValues[metricId];
    setMetricValues(newValues);
    if (scenarios.length > 0) setImpacts(computeImpacts(scenarios, updated, newValues));
  };

  const getImpactColor = (variableId: string, scenarioId: string): string => {
    const impact = impacts.find((i) => i.variableId === variableId && i.scenarioId === scenarioId);
    if (!impact) return 'var(--n500)';
    if (impact.value > 0.15) return 'var(--accent)';
    if (impact.value < -0.15) return 'var(--r600)';
    return '#D4A843';
  };

  const getImpactLabel = (variableId: string, scenarioId: string): string => {
    const impact = impacts.find((i) => i.variableId === variableId && i.scenarioId === scenarioId);
    if (!impact) return '—';
    if (impact.value > 0.15) return 'Positive';
    if (impact.value < -0.15) return 'Negative';
    return 'Neutral';
  };

  return (
    <div style={styles.container}>
      <div style={styles.leftPanel}>
        <div style={styles.section}>
          <div style={styles.eyebrow}>Scenario Explorer</div>
          <h2 style={styles.heading}>2×2 Scenario Explorer</h2>
          <p style={styles.helpText}>Define two critical uncertainty axes, then generate four unique causal loop diagrams — one per quadrant.</p>
        </div>
        <div style={styles.section}>
          <div style={styles.label}>Select Simulation</div>
          <select style={styles.select} value={selectedSimId ?? ''} onChange={(e) => setSelectedSimId(e.target.value || null)}>
            <option value="">— Choose a saved simulation —</option>
            {savedSims.map((s) => (<option key={s.id} value={s.id}>{s.title}</option>))}
          </select>
        </div>
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.label}>Critical Uncertainty Axes</div>
            <button style={styles.aiButton} onClick={handleAiProposeAxes} disabled={!selectedSim}>AI Propose</button>
          </div>
          {axes.map((axis) => (
            <div key={axis.id} style={styles.axisEditor}>
              <div style={styles.axisEditorLabel}>{axis.id === 'x-axis' ? 'X-Axis (horizontal)' : 'Y-Axis (vertical)'}</div>
              <input style={styles.axisInput} placeholder="Axis name" value={axis.label} onChange={(e) => handleAxisChange(axis.id, 'label', e.target.value)} />
              <div style={styles.axisPoles}>
                <input style={styles.axisPoleInput} placeholder="Low end" value={axis.lowLabel} onChange={(e) => handleAxisChange(axis.id, 'lowLabel', e.target.value)} />
                <span style={styles.axisPoleArrow}>→</span>
                <input style={styles.axisPoleInput} placeholder="High end" value={axis.highLabel} onChange={(e) => handleAxisChange(axis.id, 'highLabel', e.target.value)} />
              </div>
            </div>
          ))}
        </div>
        {selectedSim && (
          <button style={{ ...styles.primaryButton, ...(isGenerating ? styles.buttonDisabled : {}) }} onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generating Scenarios...' : 'Generate 2×2 Scenarios'}
          </button>
        )}
        {scenarios.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.label}>Reality Controls</div>
              <button style={styles.addButton} onClick={() => setShowMetricForm(!showMetricForm)}>{showMetricForm ? 'Cancel' : '+ Add Metric'}</button>
            </div>
            <p style={styles.helpTextSmall}>Adjust real-world conditions. All four scenarios respond simultaneously.</p>
            {showMetricForm && (
              <div style={styles.metricForm}>
                <input style={styles.metricFormInput} placeholder="Metric name" value={newMetricLabel} onChange={(e) => setNewMetricLabel(e.target.value)} />
                <div style={styles.metricFormRow}>
                  <input style={styles.metricFormSmall} type="number" placeholder="Min" value={newMetricMin} onChange={(e) => setNewMetricMin(Number(e.target.value))} />
                  <input style={styles.metricFormSmall} type="number" placeholder="Max" value={newMetricMax} onChange={(e) => setNewMetricMax(Number(e.target.value))} />
                  <input style={styles.metricFormSmall} type="number" placeholder="Default" value={newMetricDefault} onChange={(e) => setNewMetricDefault(Number(e.target.value))} />
                  <input style={{ ...styles.metricFormSmall, width: 50 }} placeholder="Unit" value={newMetricUnit} onChange={(e) => setNewMetricUnit(e.target.value)} />
                </div>
                <button style={styles.addMetricButton} onClick={handleAddMetric}>Add Metric</button>
              </div>
            )}
            {metrics.map((metric) => (
              <div key={metric.id} style={styles.sliderGroup}>
                <div style={styles.sliderHeader}>
                  <span style={styles.sliderLabel}>{metric.label}</span>
                  <span style={styles.sliderValue}>{metricValues[metric.id] ?? metric.defaultValue}{metric.unit}</span>
                </div>
                <div style={styles.sliderRow}>
                  <input type="range" style={styles.slider} min={metric.min} max={metric.max} step={metric.step} value={metricValues[metric.id] ?? metric.defaultValue} onChange={(e) => handleMetricChange(metric.id, Number(e.target.value))} />
                  <button style={styles.deleteMetricButton} onClick={() => handleDeleteMetric(metric.id)} title="Remove metric">×</button>
                </div>
              </div>
            ))}
            <button style={styles.secondaryButton} onClick={() => {
              const resetValues: Record<string, number> = {};
              metrics.forEach((m) => { resetValues[m.id] = m.defaultValue; });
              setMetricValues(resetValues);
              setImpacts(computeImpacts(scenarios, metrics, resetValues));
            }}>Reset Controls</button>
          </div>
        )}
      </div>
      <div style={styles.rightPanel}>
        {scenarios.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>◈</div>
            <h2 style={styles.emptyTitle}>Define axes and generate scenarios</h2>
            <p style={styles.emptyText}>Select a simulation, customize the two critical uncertainty axes (or use AI Propose), then generate four unique causal loop diagrams.</p>
          </div>
        ) : (
          <div style={styles.gridContainer}>
            <div style={styles.yAxisWrapper}>
              <div style={styles.yAxisLabel}>
                <div style={styles.axisHighLabel}>{axes[1]?.highLabel}</div>
                <div style={styles.axisName}>{axes[1]?.label}</div>
                <div style={styles.axisLowLabel}>{axes[1]?.lowLabel}</div>
              </div>
            </div>
            <div style={styles.gridWithXAxis}>
              <div style={styles.gridContent}>
                <div style={styles.gridRow}>
                  <div style={styles.quadrant}>
                    <div style={styles.quadrantHeader}><div style={styles.scenarioTitle}>{scenarios[1]?.title}</div><div style={styles.scenarioDesc}>{scenarios[1]?.description}</div></div>
                    <div style={styles.miniCanvas}><ScenarioCanvas key={scenarios[1]?.id} scenario={scenarios[1]} getImpactColor={getImpactColor} getImpactLabel={getImpactLabel} /></div>
                    <div style={styles.narrative}>{scenarios[1]?.narrative}</div>
                    <div style={styles.impactSummary}>{scenarios[1]?.variables.map((v) => { const color = getImpactColor(v.id, scenarios[1].id); const label = getImpactLabel(v.id, scenarios[1].id); return (<div key={v.id} style={styles.impactBadge}><div style={{ ...styles.impactDot, background: color }} /><span style={styles.impactVarName}>{v.name}</span><span style={{ ...styles.impactText, color }}>{label}</span></div>); })}</div>
                  </div>
                  <div style={styles.quadrant}>
                    <div style={styles.quadrantHeader}><div style={styles.scenarioTitle}>{scenarios[0]?.title}</div><div style={styles.scenarioDesc}>{scenarios[0]?.description}</div></div>
                    <div style={styles.miniCanvas}><ScenarioCanvas key={scenarios[0]?.id} scenario={scenarios[0]} getImpactColor={getImpactColor} getImpactLabel={getImpactLabel} /></div>
                    <div style={styles.narrative}>{scenarios[0]?.narrative}</div>
                    <div style={styles.impactSummary}>{scenarios[0]?.variables.map((v) => { const color = getImpactColor(v.id, scenarios[0].id); const label = getImpactLabel(v.id, scenarios[0].id); return (<div key={v.id} style={styles.impactBadge}><div style={{ ...styles.impactDot, background: color }} /><span style={styles.impactVarName}>{v.name}</span><span style={{ ...styles.impactText, color }}>{label}</span></div>); })}</div>
                  </div>
                </div>
                <div style={styles.gridRow}>
                  <div style={styles.quadrant}>
                    <div style={styles.quadrantHeader}><div style={styles.scenarioTitle}>{scenarios[2]?.title}</div><div style={styles.scenarioDesc}>{scenarios[2]?.description}</div></div>
                    <div style={styles.miniCanvas}><ScenarioCanvas key={scenarios[2]?.id} scenario={scenarios[2]} getImpactColor={getImpactColor} getImpactLabel={getImpactLabel} /></div>
                    <div style={styles.narrative}>{scenarios[2]?.narrative}</div>
                    <div style={styles.impactSummary}>{scenarios[2]?.variables.map((v) => { const color = getImpactColor(v.id, scenarios[2].id); const label = getImpactLabel(v.id, scenarios[2].id); return (<div key={v.id} style={styles.impactBadge}><div style={{ ...styles.impactDot, background: color }} /><span style={styles.impactVarName}>{v.name}</span><span style={{ ...styles.impactText, color }}>{label}</span></div>); })}</div>
                  </div>
                  <div style={styles.quadrant}>
                    <div style={styles.quadrantHeader}><div style={styles.scenarioTitle}>{scenarios[3]?.title}</div><div style={styles.scenarioDesc}>{scenarios[3]?.description}</div></div>
                    <div style={styles.miniCanvas}><ScenarioCanvas key={scenarios[3]?.id} scenario={scenarios[3]} getImpactColor={getImpactColor} getImpactLabel={getImpactLabel} /></div>
                    <div style={styles.narrative}>{scenarios[3]?.narrative}</div>
                    <div style={styles.impactSummary}>{scenarios[3]?.variables.map((v) => { const color = getImpactColor(v.id, scenarios[3].id); const label = getImpactLabel(v.id, scenarios[3].id); return (<div key={v.id} style={styles.impactBadge}><div style={{ ...styles.impactDot, background: color }} /><span style={styles.impactVarName}>{v.name}</span><span style={{ ...styles.impactText, color }}>{label}</span></div>); })}</div>
                  </div>
                </div>
              </div>
              <div style={styles.xAxisLabel}>
                <div style={styles.axisLowLabel}>{axes[0]?.lowLabel}</div>
                <div style={styles.axisName}>{axes[0]?.label}</div>
                <div style={styles.axisHighLabel}>{axes[0]?.highLabel}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Page — tabbed layout
// ============================================================

interface MultiFuturesPageProps {
  simulations: Simulation[];
}

export default function MultiFuturesPage({ simulations }: MultiFuturesPageProps) {
  const [activeTab, setActiveTab] = useState<'explorer' | 'evolution'>('explorer');

  return (
    <div style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div style={styles.tabBar}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'explorer' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('explorer')}
        >
          Scenario Explorer
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'evolution' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('evolution')}
        >
          Dynamic Evolution
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'explorer' ? (
          <ScenarioExplorerTab simulations={simulations} />
        ) : (
          <DynamicEvolutionTab simulations={simulations} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  // Tab bar
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--n200)',
    background: 'var(--n100)',
    padding: '0 20px',
    gap: 0,
    flexShrink: 0,
  },
  tab: {
    padding: '12px 24px',
    background: 'transparent',
    color: 'var(--n700)',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: 'var(--accent)',
    borderBottomColor: 'var(--accent)',
  },

  // Shared
  container: { display: 'flex', height: '100%', overflow: 'hidden' },
  leftPanel: { width: 340, minWidth: 340, overflowY: 'auto' as const, borderRight: '1px solid var(--n200)', background: 'var(--n100)', padding: 24 },
  rightPanel: { flex: 1, display: 'flex', background: 'var(--bg)', overflow: 'hidden' },
  section: { marginBottom: 24 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  eyebrow: { fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--accent)' },
  heading: { fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 24, lineHeight: 1.15, color: 'var(--text-primary)', textShadow: 'var(--glow)', margin: '4px 0 0' },
  helpText: { fontSize: 13, color: 'var(--n700)', lineHeight: 1.5, margin: '8px 0 0' },
  helpTextSmall: { fontSize: 11, color: 'var(--n600)', lineHeight: 1.4, margin: '0 0 12px' },
  label: { fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--n600)' },
  select: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'var(--n200)', border: '1px solid var(--n300)', borderRadius: 'var(--radius-md)', color: 'var(--text-body)', fontFamily: 'var(--sans)', fontSize: 14, outline: 'none', cursor: 'pointer', marginTop: 8 },
  aiButton: { padding: '4px 12px', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--g300)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.05em', cursor: 'pointer' },
  axisEditor: { marginTop: 12, padding: '10px 12px', background: 'var(--n200)', borderRadius: 'var(--radius-md)', border: '1px solid var(--n300)', overflow: 'hidden' },
  axisEditorLabel: { fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--n600)', marginBottom: 6 },
  axisInput: { width: '100%', boxSizing: 'border-box', padding: '6px 10px', background: 'var(--n100)', border: '1px solid var(--n300)', borderRadius: 'var(--radius-sm)', color: 'var(--text-body)', fontFamily: 'var(--sans)', fontSize: 13, outline: 'none', marginBottom: 6 },
  axisPoles: { display: 'flex', alignItems: 'center', gap: 6 },
  axisPoleInput: { flex: 1, boxSizing: 'border-box', minWidth: 0, padding: '5px 8px', background: 'var(--n100)', border: '1px solid var(--n300)', borderRadius: 'var(--radius-sm)', color: 'var(--text-body)', fontFamily: 'var(--sans)', fontSize: 12, outline: 'none' },
  axisPoleArrow: { color: 'var(--n500)', fontSize: 14, flexShrink: 0 },
  primaryButton: { width: '100%', padding: '10px 20px', background: 'var(--accent)', color: 'var(--n100)', border: 'none', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s', marginBottom: 24 },
  secondaryButton: { width: '100%', padding: '8px 16px', background: 'transparent', color: 'var(--n800)', border: '1px solid var(--n400)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--sans)', fontSize: 12, cursor: 'pointer', marginTop: 8 },
  addButton: { padding: '4px 10px', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--g300)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.05em', cursor: 'pointer' },
  buttonDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  metricForm: { padding: '10px 12px', background: 'var(--n200)', borderRadius: 'var(--radius-md)', border: '1px solid var(--n300)', marginBottom: 12, overflow: 'hidden' },
  metricFormInput: { width: '100%', boxSizing: 'border-box', padding: '6px 10px', background: 'var(--n100)', border: '1px solid var(--n300)', borderRadius: 'var(--radius-sm)', color: 'var(--text-body)', fontFamily: 'var(--sans)', fontSize: 13, outline: 'none', marginBottom: 6 },
  metricFormRow: { display: 'flex', gap: 6, marginBottom: 8 },
  metricFormSmall: { flex: 1, boxSizing: 'border-box', minWidth: 0, padding: '5px 6px', background: 'var(--n100)', border: '1px solid var(--n300)', borderRadius: 'var(--radius-sm)', color: 'var(--text-body)', fontFamily: 'var(--mono)', fontSize: 11, outline: 'none' },
  addMetricButton: { width: '100%', padding: '6px 12px', background: 'var(--accent)', color: 'var(--n100)', border: 'none', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  sliderGroup: { marginBottom: 16 },
  sliderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sliderLabel: { fontSize: 12, fontWeight: 500, color: 'var(--n900)' },
  sliderValue: { fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' },
  sliderRow: { display: 'flex', alignItems: 'center', gap: 6 },
  slider: { flex: 1, height: 4, WebkitAppearance: 'none', appearance: 'none' as const, background: 'var(--n300)', borderRadius: 2, outline: 'none', cursor: 'pointer' },
  deleteMetricButton: { width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--n600)', border: '1px solid var(--n300)', borderRadius: 'var(--radius-sm)', fontSize: 14, cursor: 'pointer', flexShrink: 0, padding: 0, lineHeight: 1 },
  sliderRangeLabels: { display: 'flex', justifyContent: 'space-between', marginTop: 4 },
  sliderRangeLabel: { fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--n500)' },

  // 2x2 Grid
  gridContainer: { flex: 1, display: 'flex', flexDirection: 'row' as const, padding: 16, gap: 0, position: 'relative' as const },
  yAxisWrapper: { width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  yAxisLabel: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'space-between', gap: 8, writingMode: 'vertical-rl' as const, transform: 'rotate(180deg)', height: '100%', maxHeight: 400, alignSelf: 'center' },
  gridWithXAxis: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 0 },
  gridContent: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 2 },
  gridRow: { flex: 1, display: 'flex', gap: 2 },
  quadrant: { flex: 1, display: 'flex', flexDirection: 'column' as const, background: 'linear-gradient(180deg, #161717, #131414)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' },
  quadrantHeader: { padding: '10px 14px', borderBottom: '1px solid var(--n200)', background: 'rgba(14,15,15,0.6)' },
  scenarioTitle: { fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 400, color: 'var(--text-primary)', textShadow: 'var(--glow)' },
  scenarioDesc: { fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.05em', color: 'var(--n600)', marginTop: 2 },
  miniCanvas: { flex: 1, minHeight: 200, width: '100%' },
  narrative: { padding: '8px 14px', fontSize: 11, color: 'var(--n700)', lineHeight: 1.5, borderTop: '1px solid var(--n200)', background: 'rgba(14,15,15,0.4)' },
  impactSummary: { display: 'flex', flexWrap: 'wrap' as const, gap: 4, padding: '8px 14px', borderTop: '1px solid var(--n200)', background: 'rgba(14,15,15,0.3)' },
  impactBadge: { display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--n100)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--n200)' },
  impactDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  impactVarName: { fontSize: 10, color: 'var(--n800)', fontWeight: 500 },
  impactText: { fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.05em', textTransform: 'uppercase' as const },
  axisName: { fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--n600)', textAlign: 'center' as const },
  axisHighLabel: { fontSize: 10, color: 'var(--n800)', fontFamily: 'var(--sans)' },
  axisLowLabel: { fontSize: 10, color: 'var(--n800)', fontFamily: 'var(--sans)' },
  xAxisLabel: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 4px', gap: 8, flexShrink: 0 },
  emptyState: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, padding: 40, textAlign: 'center' as const },
  emptyIcon: { fontSize: 48, color: 'var(--n500)', opacity: 0.5 },
  emptyTitle: { fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 24, color: 'var(--text-primary)', textShadow: 'var(--glow)', margin: 0 },
  emptyText: { fontSize: 14, color: 'var(--n600)', maxWidth: 400, lineHeight: 1.6 },

  // Dynamic Evolution
  evoContainer: { display: 'flex', height: '100%', overflow: 'hidden' },
  evoLeftPanel: { width: 340, minWidth: 340, overflowY: 'auto' as const, borderRight: '1px solid var(--n200)', background: 'var(--n100)', padding: 24 },
  evoRightPanel: { flex: 1, display: 'flex', flexDirection: 'column' as const, background: 'var(--bg)', overflow: 'hidden' },
  evoCanvasArea: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  evoCanvasHeader: { padding: '10px 20px', borderBottom: '1px solid var(--n200)', background: 'var(--n100)', flexShrink: 0 },
  evoCanvasTitle: { fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--text-primary)', textShadow: 'var(--glow)' },
  evoCanvas: { flex: 1, minHeight: 300 },
  evoButtonRow: { display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 16 },
  trendTextarea: {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    background: 'var(--n200)', border: '1px solid var(--n300)', borderRadius: 'var(--radius-md)',
    color: 'var(--text-body)', fontFamily: 'var(--sans)', fontSize: 13, outline: 'none',
    resize: 'vertical' as const, marginTop: 8, lineHeight: 1.5,
  },
  progressBar: { width: '100%', height: 4, background: 'var(--n300)', borderRadius: 2, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: '100%', background: 'var(--accent)', transition: 'width 0.08s linear' },

  // Report
  reportArea: { borderTop: '1px solid var(--n200)', background: 'var(--n100)', padding: 24, overflowY: 'auto' as const, maxHeight: '45%', flexShrink: 0 },
  reportHeader: { marginBottom: 20 },
  reportTitle: { fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 20, color: 'var(--text-primary)', textShadow: 'var(--glow)', margin: '4px 0 0' },
  reportSection: { marginBottom: 20 },
  reportLabel: { fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--n600)', marginBottom: 8 },
  reportText: { fontSize: 14, color: 'var(--n900)', lineHeight: 1.6 },
  reportGrid: { display: 'flex', gap: 24, marginBottom: 20 },
  reportChip: { display: 'inline-block', padding: '4px 12px', background: 'rgba(111,212,160,0.12)', color: 'var(--accent)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--mono)', fontSize: 11, marginRight: 6, marginBottom: 4 },
  energyRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  energyFrom: { fontSize: 12, color: 'var(--n800)', minWidth: 100 },
  energyArrow: { color: 'var(--n500)', fontSize: 12 },
  energyTo: { fontSize: 12, color: 'var(--n800)', minWidth: 100 },
  energyBar: { flex: 1, height: 6, background: 'var(--n300)', borderRadius: 3, overflow: 'hidden' },
  energyFill: { height: '100%', background: 'var(--accent)', borderRadius: 3 },
  reportPre: { fontSize: 12, color: 'var(--n700)', lineHeight: 1.7, whiteSpace: 'pre-wrap' as const, fontFamily: 'var(--sans)', background: 'var(--n200)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--n300)' },

  // Trajectory cards
  trajectoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 },
  trajectoryCard: { padding: '12px 14px', background: 'var(--n200)', borderRadius: 'var(--radius-md)', border: '1px solid var(--n300)' },
  trajectoryHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  trajectoryName: { fontSize: 13, fontWeight: 600, color: 'var(--n900)' },
  trajectoryDirection: { fontFamily: 'var(--mono)', fontSize: 11 },
  trajectoryStats: { display: 'flex', gap: 12, marginTop: 6 },
  trajectoryStat: { fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--n600)' },
  influencerList: { marginTop: 8, display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', gap: 4 },
  influencerLabel: { fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--n500)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  influencerChip: { padding: '2px 6px', background: 'rgba(111,212,160,0.08)', color: 'var(--accent)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--mono)', fontSize: 9 },

  // Loop cards
  loopCard: { padding: '12px 14px', background: 'var(--n200)', borderRadius: 'var(--radius-md)', border: '1px solid var(--n300)', marginBottom: 10 },
  loopHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  loopType: { fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em' },
  loopEnergy: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--n600)' },
  loopPath: { fontSize: 12, color: 'var(--n800)', marginBottom: 6, lineHeight: 1.6 },
  loopVar: { fontWeight: 600, color: 'var(--n900)' },
  loopArrow: { color: 'var(--n500)' },
  loopDesc: { fontSize: 11, color: 'var(--n700)', lineHeight: 1.5, margin: 0 },

  // Causal chain
  causalChain: { display: 'flex', flexDirection: 'column' as const, gap: 0 },
  causalStep: { display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--n200)' },
  causalStepNum: { width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: 'var(--n100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, flexShrink: 0 },
  causalStepText: { fontSize: 12, color: 'var(--n800)', lineHeight: 1.5, flex: 1 },

  // Energy row extras
  energyPolarity: { fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, width: 16, textAlign: 'center' as const, flexShrink: 0 },
  energyStrength: { fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--n500)', textTransform: 'uppercase' as const, width: 50, flexShrink: 0 },
  energyValue: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--n600)', width: 40, textAlign: 'right' as const, flexShrink: 0 },
};
