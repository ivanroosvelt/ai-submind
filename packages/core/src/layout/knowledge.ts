import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import type { LayoutPoint } from "./flowchart.js";

/**
 * Layout de fuerzas del grafo de conocimiento (decisión #69). Las relaciones
 * entre notas no son jerárquicas: con rangos (dagre) una arista cruza muchos
 * niveles y el grafo se vuelve una franja de líneas largas. Con fuerzas, lo
 * relacionado queda cerca; cada grupo (la carpeta de la nota) tira hacia su
 * propio centro, así las carpetas se leen como regiones.
 *
 * Determinista: posiciones iniciales fijas y número fijo de ticks, sin
 * animación; d3-force usa un generador con semilla propia.
 */

export interface KnowledgeLayoutNode {
  id: string;
  width: number;
  height: number;
  group: string;
}

export interface KnowledgeLayoutEdge {
  from: string;
  to: string;
}

export interface PlacedNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacedGroup {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KnowledgeLayout {
  width: number;
  height: number;
  nodes: Map<string, PlacedNode>;
  /** Una polilínea por arista, en el orden recibido, recortada al borde de cada nodo. */
  edges: LayoutPoint[][];
  /** Solo con más de un grupo: la caja de cada uno, para dibujar la región. */
  groups: PlacedGroup[];
}

const MARGIN = 40;
const TICKS = 400;
const LINK_DISTANCE = 140;
const CHARGE = -900;
const GROUP_PULL = 0.3;
// Un enlace entre carpetas tira poco: si tirara como uno interno, las
// regiones se mezclarían en un solo bloque.
const LINK_STRENGTH_INNER = 0.6;
const LINK_STRENGTH_CROSS = 0.02;
const GROUP_PADDING = 28;
// Aire entre dos regiones vecinas.
const GROUP_GAP = 24;
// Separación entre aristas paralelas de un mismo par (dos tipos de relación).
const PARALLEL_GAP = 16;

interface SimNode extends SimulationNodeDatum {
  id: string;
  width: number;
  height: number;
  group: string;
}

/** Punto del borde del rectángulo centrado en `node` en la dirección de `toward`. */
function clip(node: PlacedNode, toward: LayoutPoint): LayoutPoint {
  const dx = toward.x - node.x;
  const dy = toward.y - node.y;
  if (dx === 0 && dy === 0) return { x: node.x, y: node.y };
  const scale = Math.min(
    dx === 0 ? Infinity : node.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : node.height / 2 / Math.abs(dy)
  );
  return { x: node.x + dx * scale, y: node.y + dy * scale };
}

/** La caja de un grupo de nodos, con el margen de la región. */
function boxOf(members: SimNode[]): { left: number; top: number; right: number; bottom: number } {
  return {
    left: Math.min(...members.map((node) => node.x! - node.width / 2)) - GROUP_PADDING,
    top: Math.min(...members.map((node) => node.y! - node.height / 2)) - GROUP_PADDING,
    right: Math.max(...members.map((node) => node.x! + node.width / 2)) + GROUP_PADDING,
    bottom: Math.max(...members.map((node) => node.y! + node.height / 2)) + GROUP_PADDING,
  };
}

/**
 * Las fuerzas acercan carpetas muy relacionadas hasta mezclarlas: se separan
 * las regiones que se solapan moviendo cada grupo entero, por el eje de menor
 * solape, hasta que no quede ninguno (o se agoten las vueltas).
 */
function separateGroups(nodes: SimNode[]): void {
  const groups = [...new Set(nodes.map((node) => node.group))].map((name) => nodes.filter((node) => node.group === name));
  for (let round = 0; round < 100; round++) {
    let moved = false;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = boxOf(groups[i]);
        const b = boxOf(groups[j]);
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;
        const horizontal = overlapX < overlapY;
        const sign = horizontal
          ? Math.sign(b.left + b.right - a.left - a.right) || 1
          : Math.sign(b.top + b.bottom - a.top - a.bottom) || 1;
        const shift = ((horizontal ? overlapX : overlapY) + GROUP_GAP) / 2;
        for (const node of groups[i]) horizontal ? (node.x! -= sign * shift) : (node.y! -= sign * shift);
        for (const node of groups[j]) horizontal ? (node.x! += sign * shift) : (node.y! += sign * shift);
      }
    }
    if (!moved) return;
  }
}

const round = (value: number) => Math.round(value * 10) / 10;

export function layoutKnowledge(nodes: KnowledgeLayoutNode[], edges: KnowledgeLayoutEdge[]): KnowledgeLayout {
  if (nodes.length === 0) return { width: 0, height: 0, nodes: new Map(), edges: [], groups: [] };

  // Centros de grupo en una grilla aproximadamente cuadrada, escalada por el tamaño de cada grupo.
  const groupNames = [...new Set(nodes.map((node) => node.group))];
  const sizes = new Map(groupNames.map((name) => [name, nodes.filter((node) => node.group === name).length]));
  const columns = Math.ceil(Math.sqrt(groupNames.length));
  const cell = LINK_DISTANCE * 1.6 * Math.sqrt(Math.max(...sizes.values()));
  const centers = new Map(
    groupNames.map((name, index) => [name, { x: (index % columns) * cell, y: Math.floor(index / columns) * cell }])
  );

  // Inicio en espiral (phyllotaxis) alrededor del centro del grupo: determinista y sin solapes.
  const seen = new Map<string, number>();
  const simNodes: SimNode[] = nodes.map((node) => {
    const k = seen.get(node.group) ?? 0;
    seen.set(node.group, k + 1);
    const center = centers.get(node.group)!;
    const radius = 40 * Math.sqrt(k + 0.5);
    const angle = k * Math.PI * (3 - Math.sqrt(5));
    return { ...node, x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });
  const byId = new Map(simNodes.map((node) => [node.id, node]));
  const links = edges
    .filter((edge) => edge.from !== edge.to && byId.has(edge.from) && byId.has(edge.to))
    .map((edge) => ({ source: edge.from, target: edge.to, cross: byId.get(edge.from)!.group !== byId.get(edge.to)!.group }));

  const simulation = forceSimulation(simNodes)
    .force(
      "link",
      forceLink<SimNode, { source: string; target: string; cross: boolean }>(links)
        .id((node) => node.id)
        .distance(LINK_DISTANCE)
        .strength((link) => (link.cross ? LINK_STRENGTH_CROSS : LINK_STRENGTH_INNER))
    )
    .force("charge", forceManyBody().strength(CHARGE))
    .force("collide", forceCollide<SimNode>((node) => Math.hypot(node.width, node.height) / 2 + 8).iterations(2))
    .force("x", forceX<SimNode>((node) => centers.get(node.group)!.x).strength(GROUP_PULL))
    .force("y", forceY<SimNode>((node) => centers.get(node.group)!.y).strength(GROUP_PULL))
    .stop();
  simulation.tick(TICKS);
  if (groupNames.length > 1) separateGroups(simNodes);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of simNodes) {
    minX = Math.min(minX, node.x! - node.width / 2);
    minY = Math.min(minY, node.y! - node.height / 2);
    maxX = Math.max(maxX, node.x! + node.width / 2);
    maxY = Math.max(maxY, node.y! + node.height / 2);
  }
  const multiGroup = groupNames.length > 1;
  const pad = multiGroup ? GROUP_PADDING + MARGIN : MARGIN;
  const placed = new Map<string, PlacedNode>(
    simNodes.map((node) => [
      node.id,
      { x: round(node.x! - minX + pad), y: round(node.y! - minY + pad), width: node.width, height: node.height },
    ])
  );

  // Aristas rectas; las paralelas de un mismo par se curvan hacia lados alternos.
  const parallel = new Map<string, number>();
  const edgePoints = edges.map((edge) => {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (!from || !to || from === to) return [];
    const key = [edge.from, edge.to].sort().join("\n");
    const k = parallel.get(key) ?? 0;
    parallel.set(key, k + 1);
    const offset = k === 0 ? 0 : Math.ceil(k / 2) * PARALLEL_GAP * (k % 2 === 1 ? 1 : -1);
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const mid = {
      x: (from.x + to.x) / 2 + (-(to.y - from.y) / length) * offset,
      y: (from.y + to.y) / 2 + ((to.x - from.x) / length) * offset,
    };
    const start = clip(from, offset === 0 ? to : mid);
    const end = clip(to, offset === 0 ? from : mid);
    const points = offset === 0 ? [start, end] : [start, mid, end];
    return points.map((point) => ({ x: round(point.x), y: round(point.y) }));
  });

  const groups: PlacedGroup[] = [];
  if (multiGroup) {
    for (const name of groupNames) {
      const members = nodes.filter((node) => node.group === name).map((node) => placed.get(node.id)!);
      const left = Math.min(...members.map((node) => node.x - node.width / 2)) - GROUP_PADDING;
      const top = Math.min(...members.map((node) => node.y - node.height / 2)) - GROUP_PADDING;
      const right = Math.max(...members.map((node) => node.x + node.width / 2)) + GROUP_PADDING;
      const bottom = Math.max(...members.map((node) => node.y + node.height / 2)) + GROUP_PADDING;
      groups.push({ name, x: round(left), y: round(top), width: round(right - left), height: round(bottom - top) });
    }
  }

  return {
    width: Math.ceil(maxX - minX + pad * 2),
    height: Math.ceil(maxY - minY + pad * 2),
    nodes: placed,
    edges: edgePoints,
    groups,
  };
}
