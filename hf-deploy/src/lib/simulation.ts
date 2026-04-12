export type NodeType = 'warehouse' | 'customer' | 'junction';

export type MapNode = {
  id: string;
  x: number;
  y: number;
  type: NodeType;
};

export type Edge = {
  id: string;
  from: string;
  to: string;
  distance: number;
  trafficCongestion: number;
  hasConstruction?: boolean;
};

export type Order = {
  id: string;
  nodeId: string;
  deadline?: number;
  delivered: boolean;
  deliveryTime?: number;
};

export type Vehicle = {
  id: string;
  nodeId: string;
  color: string;
};

export type OrderStatus = "on-time" | "slightly-late" | "late" | "not-delivered";

export const calculateOrderStars = (order: Order, currentTime: number): { stars: number, status: OrderStatus } => {
  if (!order.delivered) {
    return { stars: 0, status: "not-delivered" };
  }
  
  const deliveryTime = order.deliveryTime!;
  const deadline = order.deadline || Infinity;
  
  if (deliveryTime <= deadline) {
    return { stars: 3, status: "on-time" };
  } else if (deliveryTime <= deadline + 10) {
    return { stars: 2, status: "slightly-late" };
  } else {
    return { stars: 0, status: "late" };
  }
};

export type GameState = {
  nodes: MapNode[];
  edges: Edge[];
  vehicles: Vehicle[];
  orders: Order[];
  time: number;
  deliveryEfficiencyScore: number;
  steps: number;
  maxSteps: number;
  isDone: boolean;
  fuelConsumed: number;
  carbonEmissions: number;
  totalStars: number;
  averageStars: number;
};

export type Action = 
  | { vehicleId: string; type: 'move'; toNodeId: string } 
  | { vehicleId: string; type: 'deliver' }
  | { vehicleId: string; type: 'idle' };

export const createInitialState = (): GameState => {
  const numNodes = 25;
  const numOrders = 8;
  const numVehicles = 2;
  const hasTraffic = true;
  const hasDeadlines = true;
  const maxSteps = 100;

  const nodes: MapNode[] = [];
  for (let i = 0; i < numNodes; i++) {
    nodes.push({
      id: `n${i}`,
      x: 5 + Math.random() * 90,
      y: 5 + Math.random() * 90,
      type: i === 0 ? 'warehouse' : i <= numOrders ? 'customer' : 'junction'
    });
  }

  const edges: Edge[] = [];
  const connected = new Set<string>([nodes[0].id]);
  
  while (connected.size < nodes.length) {
    let bestEdge: { from: MapNode; to: MapNode; dist: number } | null = null;
    let minD = Infinity;
    
    for (const id of connected) {
      const n1 = nodes.find(n => n.id === id)!;
      for (const n2 of nodes) {
        if (!connected.has(n2.id)) {
          const d = Math.hypot(n2.x - n1.x, n2.y - n1.y);
          if (d < minD) {
            minD = d;
            bestEdge = { from: n1, to: n2, dist: d };
          }
        }
      }
    }
    
    if (bestEdge) {
      connected.add(bestEdge.to.id);
      edges.push({
        id: `${bestEdge.from.id}-${bestEdge.to.id}`,
        from: bestEdge.from.id,
        to: bestEdge.to.id,
        distance: Math.round(bestEdge.dist),
        trafficCongestion: hasTraffic && Math.random() > 0.7 ? Math.floor(Math.random() * 15) + 5 : 0,
        hasConstruction: hasTraffic && Math.random() > 0.85
      });
    }
  }

  for (let i = 0; i < numNodes * 1.5; i++) {
    const n1 = nodes[Math.floor(Math.random() * numNodes)];
    const n2 = nodes[Math.floor(Math.random() * numNodes)];
    if (n1.id !== n2.id) {
      const exists = edges.some(e => (e.from === n1.id && e.to === n2.id) || (e.from === n2.id && e.to === n1.id));
      if (!exists) {
        const dist = Math.hypot(n2.x - n1.x, n2.y - n1.y);
        if (dist < 30) {
          edges.push({
            id: `${n1.id}-${n2.id}`,
            from: n1.id,
            to: n2.id,
            distance: Math.round(dist),
            trafficCongestion: hasTraffic && Math.random() > 0.7 ? Math.floor(Math.random() * 15) + 5 : 0,
            hasConstruction: hasTraffic && Math.random() > 0.85
          });
        }
      }
    }
  }

  const orders: Order[] = [];
  for (let i = 1; i <= numOrders; i++) {
    const customerNode = nodes[i];
    const dist = Math.hypot(customerNode.x - nodes[0].x, customerNode.y - nodes[0].y);
    const deadline = hasDeadlines ? Math.round(dist + Math.random() * 30 + 20) : undefined;
    
    orders.push({
      id: `order-${i}`,
      nodeId: customerNode.id,
      deadline,
      delivered: false
    });
  }

  const vehicles: Vehicle[] = [];
  const colors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b'];
  for (let i = 0; i < numVehicles; i++) {
    vehicles.push({
      id: `v${i}`,
      nodeId: nodes[0].id,
      color: colors[i % colors.length]
    });
  }

  return {
    nodes,
    edges,
    vehicles,
    orders,
    time: 0,
    deliveryEfficiencyScore: 0,
    steps: 0,
    maxSteps,
    isDone: false,
    fuelConsumed: 0,
    carbonEmissions: 0,
    totalStars: 0,
    averageStars: 0
  };
};

export const stepSimulation = (state: GameState, actions: Action[]): GameState => {
  if (state.isDone) return state;

  const newState = { 
    ...state, 
    orders: state.orders.map(o => ({ ...o })),
    vehicles: state.vehicles.map(v => ({ ...v })),
    edges: state.edges.map(e => ({ ...e }))
  };

  // Dynamic traffic updates
  newState.edges.forEach(edge => {
    // 15% chance to fluctuate traffic
    if (Math.random() < 0.15) {
      const change = Math.floor(Math.random() * 7) - 3; // -3 to +3
      edge.trafficCongestion = Math.max(0, Math.min(20, edge.trafficCongestion + change));
    }
    // 3% chance for a sudden traffic jam
    if (Math.random() < 0.03) {
      edge.trafficCongestion = Math.floor(Math.random() * 10) + 10; // 10 to 19
    }
    // 3% chance to clear completely
    if (Math.random() < 0.03) {
      edge.trafficCongestion = 0;
    }
  });
  
  let maxTimeIncrement = 1;
  let scoreDelta = -0.1 * actions.length;

  const deliveredThisStep = new Set<string>();

  for (const action of actions) {
    const vehicleIndex = newState.vehicles.findIndex(v => v.id === action.vehicleId);
    if (vehicleIndex === -1) continue;
    
    const vehicle = newState.vehicles[vehicleIndex];

    if (action.type === 'move') {
      const edge = newState.edges.find(e => 
        (e.from === vehicle.nodeId && e.to === action.toNodeId) || 
        (e.to === vehicle.nodeId && e.from === action.toNodeId)
      );
      
      if (edge) {
        vehicle.nodeId = action.toNodeId;
        const constructionPenalty = edge.hasConstruction ? 50 : 0;
        const timeInc = Math.max(1, Math.round(edge.distance / 5)) + edge.trafficCongestion + constructionPenalty;
        if (timeInc > maxTimeIncrement) maxTimeIncrement = timeInc;
        
        // Calculate fuel based on distance and traffic
        const fuelUsed = (edge.distance * 0.05) + (edge.trafficCongestion * 0.1) + (edge.hasConstruction ? 2 : 0);
        newState.fuelConsumed += fuelUsed;
        newState.carbonEmissions += fuelUsed * 2.31;
      } else {
        scoreDelta -= 1;
      }
    } else if (action.type === 'deliver') {
      // Idling fuel consumption
      newState.fuelConsumed += 0.1;
      newState.carbonEmissions += 0.1 * 2.31;
      
      const orderIndex = newState.orders.findIndex(o => 
        o.nodeId === vehicle.nodeId && !o.delivered && !deliveredThisStep.has(o.id)
      );
      if (orderIndex !== -1) {
        const order = newState.orders[orderIndex];
        order.delivered = true;
        order.deliveryTime = newState.time;
        deliveredThisStep.add(order.id);
        
        const starResult = calculateOrderStars(order, newState.time);
        if (starResult.stars === 3) {
          scoreDelta += 20; // Increase score for 3-star
        } else if (starResult.stars === 2) {
          scoreDelta += 5; // Slight penalty (less than 20)
        } else {
          scoreDelta -= 10; // Strong penalty for late
        }
      } else {
        scoreDelta -= 1;
      }
    } else if (action.type === 'idle') {
      // Idling fuel consumption
      newState.fuelConsumed += 0.05;
      newState.carbonEmissions += 0.05 * 2.31;
    }
  }

  newState.time += maxTimeIncrement;
  newState.steps += 1;
  newState.deliveryEfficiencyScore += scoreDelta;

  let totalStars = 0;
  let deliveredCount = 0;
  newState.orders.forEach(o => {
    if (o.delivered) {
      totalStars += calculateOrderStars(o, newState.time).stars;
      deliveredCount++;
    }
  });
  newState.totalStars = totalStars;
  newState.averageStars = deliveredCount > 0 ? totalStars / deliveredCount : 0;

  const allDelivered = newState.orders.every(o => o.delivered);
  if (allDelivered || newState.steps >= newState.maxSteps) {
    newState.isDone = true;
    if (allDelivered) {
      newState.deliveryEfficiencyScore += 20;
    }
    // Apply penalty for missed deliveries at the end
    const missedCount = newState.orders.filter(o => !o.delivered).length;
    newState.deliveryEfficiencyScore -= missedCount * 15;
  }

  return newState;
};

export const calculateScore = (state: GameState): number => {
  const completed = state.orders.filter(o => o.delivered).length;
  const total = state.orders.length;
  if (total === 0) return 0;
  let score = completed / total;

  const lateDeliveries = state.orders.filter(o => o.delivered && o.deadline && o.deliveryTime! > o.deadline).length;
  score -= (lateDeliveries * 0.1);

  return Math.max(0, Math.min(1, score));
};

export const getPlannedPaths = (state: GameState): Record<string, string[]> => {
  const pendingOrders = state.orders.filter(o => !o.delivered);
  const paths: Record<string, string[]> = {};
  
  if (pendingOrders.length === 0) return paths;

  const unassignedOrders = new Set(pendingOrders.map(o => o.id));

  for (const vehicle of state.vehicles) {
    if (unassignedOrders.size === 0) break;

    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const q = new Set<string>();
    
    state.nodes.forEach(n => {
      dist[n.id] = Infinity;
      prev[n.id] = null;
      q.add(n.id);
    });
    dist[vehicle.nodeId] = 0;

    while (q.size > 0) {
      let u: string | null = null;
      let minD = Infinity;
      q.forEach(id => {
        if (dist[id] < minD) {
          minD = dist[id];
          u = id;
        }
      });
      if (!u) break;
      q.delete(u);

      const neighbors = state.edges.filter(e => e.from === u || e.to === u);
      neighbors.forEach(e => {
        const v = e.from === u ? e.to : e.from;
        if (q.has(v)) {
          const constructionPenalty = e.hasConstruction ? 50 : 0;
          const edgeCost = Math.max(1, Math.round(e.distance / 5)) + e.trafficCongestion + constructionPenalty;
          const alt = dist[u] + edgeCost;
          if (alt < dist[v]) {
            dist[v] = alt;
            prev[v] = u;
          }
        }
      });
    }

    let bestOrder: Order | null = null;
    let minOrderDist = Infinity;
    pendingOrders.forEach(o => {
      if (unassignedOrders.has(o.id) && dist[o.nodeId] < minOrderDist) {
        minOrderDist = dist[o.nodeId];
        bestOrder = o;
      }
    });

    if (bestOrder) {
      unassignedOrders.delete(bestOrder.id);
      
      const path: string[] = [];
      let curr: string | null = bestOrder.nodeId;
      while (curr !== null) {
        path.unshift(curr);
        if (curr === vehicle.nodeId) break;
        curr = prev[curr];
      }
      paths[vehicle.id] = path;
    }
  }
  
  return paths;
};

export const getNextActions = (state: GameState): Action[] => {
  const pendingOrders = state.orders.filter(o => !o.delivered);
  const plannedPaths = getPlannedPaths(state);
  const actions: Action[] = [];

  const deliveringNodes = new Set<string>();

  for (const vehicle of state.vehicles) {
    const orderAtNode = pendingOrders.find(o => o.nodeId === vehicle.nodeId);
    if (orderAtNode && !deliveringNodes.has(orderAtNode.nodeId)) {
      deliveringNodes.add(orderAtNode.nodeId);
      actions.push({ vehicleId: vehicle.id, type: 'deliver' });
      continue;
    }

    const path = plannedPaths[vehicle.id];
    if (path && path.length > 1) {
      actions.push({ vehicleId: vehicle.id, type: 'move', toNodeId: path[1] });
    } else {
      actions.push({ vehicleId: vehicle.id, type: 'idle' });
    }
  }

  return actions;
};

export const getShortestPathFromTo = (startNodeId: string, endNodeId: string, nodes: MapNode[], edges: Edge[]): string[] => {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set<string>();

  for (const node of nodes) {
    dist[node.id] = Infinity;
    prev[node.id] = null;
    unvisited.add(node.id);
  }
  dist[startNodeId] = 0;

  while (unvisited.size > 0) {
    let u: string | null = null;
    let minDist = Infinity;
    for (const nodeId of unvisited) {
      if (dist[nodeId] < minDist) {
        minDist = dist[nodeId];
        u = nodeId;
      }
    }

    if (u === null || u === endNodeId) break;
    unvisited.delete(u);

    const neighbors = edges.filter(e => e.from === u || e.to === u);
    for (const edge of neighbors) {
      const v = edge.from === u ? edge.to : edge.from;
      if (unvisited.has(v)) {
        // Construction adds a massive penalty, traffic adds normal penalty
        const constructionPenalty = edge.hasConstruction ? 50 : 0;
        const alt = dist[u] + edge.distance + (edge.trafficCongestion * 2) + constructionPenalty;
        if (alt < dist[v]) {
          dist[v] = alt;
          prev[v] = u;
        }
      }
    }
  }

  const path: string[] = [];
  let curr: string | null = endNodeId;
  if (prev[curr] !== null || curr === startNodeId) {
    while (curr !== null) {
      path.unshift(curr);
      curr = prev[curr];
    }
  }
  return path;
};

export const getDistinctRoutes = (start: string, end: string, nodes: MapNode[], edges: Edge[], aiPath: string[], maxDepth = 15, count = 5): string[][] => {
  const paths: string[][] = [];
  
  const dfs = (current: string, path: string[], visited: Set<string>) => {
    if (path.length > maxDepth) return;
    if (paths.length >= count * 10) return; // limit search space
    if (current === end) {
      paths.push([...path]);
      return;
    }
    
    const neighbors = edges
      .filter(e => e.from === current || e.to === current)
      .map(e => e.from === current ? e.to : e.from);
      
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        path.push(neighbor);
        dfs(neighbor, path, visited);
        path.pop();
        visited.delete(neighbor);
      }
    }
  };
  
  dfs(start, [start], new Set([start]));
  
  const distinct: string[][] = [];
  const aiPathStr = aiPath.join(',');
  
  for (const p of paths.sort((a, b) => a.length - b.length)) {
    if (distinct.length >= count) break;
    const pStr = p.join(',');
    if (pStr === aiPathStr) continue;
    
    const isDifferent = distinct.every(d => {
      const set1 = new Set(p);
      const set2 = new Set(d);
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      return (intersection.size / union.size) < 0.8;
    });
    
    if (isDifferent || distinct.length === 0) {
      distinct.push(p);
    }
  }
  
  // If we don't have enough distinct, just add any that are not identical
  if (distinct.length < count) {
    for (const p of paths) {
      if (distinct.length >= count) break;
      const pStr = p.join(',');
      if (pStr !== aiPathStr && !distinct.some(d => d.join(',') === pStr)) {
        distinct.push(p);
      }
    }
  }
  
  return distinct;
};

export const getRandomPath = (start: string, end: string, nodes: MapNode[], edges: Edge[], aiPath: string[], maxAttempts = 100): string[] => {
  const aiPathStr = aiPath.join(',');
  for (let i = 0; i < maxAttempts; i++) {
    const path: string[] = [start];
    const visited = new Set([start]);
    let current = start;
    
    while (current !== end && path.length < 20) {
      const neighbors = edges
        .filter(e => e.from === current || e.to === current)
        .map(e => e.from === current ? e.to : e.from)
        .filter(n => !visited.has(n));
        
      if (neighbors.length === 0) break;
      
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      visited.add(next);
      path.push(next);
      current = next;
      
      if (current === end) {
        if (path.join(',') !== aiPathStr) {
          return path;
        } else {
          break; // Try again
        }
      }
    }
  }
  return []; // Return empty if failed
};
