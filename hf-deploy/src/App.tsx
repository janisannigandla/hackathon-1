import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, FastForward, Settings, Package, Clock, MapPin, AlertTriangle, Truck, Home, Circle, Fuel, Cloud, Route } from 'lucide-react';
import { GameState, createInitialState, stepSimulation, getNextActions, calculateScore, getPlannedPaths, getShortestPathFromTo, getDistinctRoutes, getRandomPath, calculateOrderStars } from './lib/simulation';
import { motion } from 'motion/react';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function App() {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualPath, setManualPath] = useState<string[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  // New state for Decision Support System
  const [allRoutes, setAllRoutes] = useState<string[][]>([]);
  const [randomRoute, setRandomRoute] = useState<string[]>([]);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const reset = useCallback(() => {
    setState(createInitialState());
    setIsPlaying(false);
    setManualPath([]);
    setSelectedOrderId(null);
    setAllRoutes([]);
    setRandomRoute([]);
    setShowAllRoutes(false);
    setShowComparison(false);
  }, []);

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    let interval: number;
    if (isPlaying && !state.isDone) {
      interval = window.setInterval(() => {
        setState(s => {
          if (s.isDone) {
            setIsPlaying(false);
            return s;
          }
          const actions = getNextActions(s);
          return stepSimulation(s, actions);
        });
      }, speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, state.isDone, speed]);

  const handleStep = () => {
    if (!state.isDone) {
      const actions = getNextActions(state);
      setState(s => stepSimulation(s, actions));
    }
  };

  const handleNodeClick = (nodeId: string) => {
    if (!selectedOrderId) return;
    
    const warehouse = state.nodes.find(n => n.type === 'warehouse');
    if (!warehouse) return;

    const lastNodeId = manualPath.length > 0 ? manualPath[manualPath.length - 1] : warehouse.id;
    
    if (nodeId === lastNodeId && manualPath.length > 0) {
      // Remove last node
      setManualPath(prev => prev.slice(0, -1));
      return;
    }

    // Check if connected
    const isConnected = state.edges.some(e => 
      (e.from === lastNodeId && e.to === nodeId) || 
      (e.to === lastNodeId && e.from === nodeId)
    );

    if (isConnected) {
      if (manualPath.length === 0) {
        setManualPath([warehouse.id, nodeId]);
      } else {
        setManualPath(prev => [...prev, nodeId]);
      }
    }
  };

  const calculatePathMetrics = (path: string[], startNodeId: string) => {
    let distance = 0;
    let time = 0;
    let fuel = 0;
    let co2 = 0;

    let current = startNodeId;
    for (const next of path) {
      const edge = state.edges.find(e => 
        (e.from === current && e.to === next) || 
        (e.to === current && e.from === next)
      );
      if (edge) {
        distance += edge.distance;
        const constructionPenalty = edge.hasConstruction ? 50 : 0;
        const timeInc = Math.max(1, Math.round(edge.distance / 5)) + edge.trafficCongestion + constructionPenalty;
        time += timeInc;
        const fuelUsed = (edge.distance * 0.05) + (edge.trafficCongestion * 0.1) + (edge.hasConstruction ? 2 : 0);
        fuel += fuelUsed;
        co2 += fuelUsed * 2.31;
      }
      current = next;
    }
    return { distance, time, fuel, co2 };
  };

  const score = calculateScore(state);
  const plannedPaths = getPlannedPaths(state);

  const vehicle0 = state.vehicles[0];
  const aiPath = vehicle0 ? (plannedPaths[vehicle0.id] || []) : [];
  const aiPathNodes = aiPath.length > 1 ? aiPath.slice(1) : [];
  const aiMetrics = calculatePathMetrics(aiPathNodes, vehicle0?.nodeId || '');
  const manualMetrics = calculatePathMetrics(manualPath, vehicle0?.nodeId || '');

  const warehouse = state.nodes.find(n => n.type === 'warehouse');
  const selectedOrder = state.orders.find(o => o.id === selectedOrderId);
  
  const lastManualNodeId = manualPath.length > 0 ? manualPath[manualPath.length - 1] : warehouse?.id;
  const validNextNodes = new Set(
    state.edges
      .filter(e => e.from === lastManualNodeId || e.to === lastManualNodeId)
      .map(e => e.from === lastManualNodeId ? e.to : e.from)
  );

  let selectedOrderPath: string[] = [];
  let selectedOrderMetrics = null;
  
  if (selectedOrder && warehouse) {
    selectedOrderPath = getShortestPathFromTo(warehouse.id, selectedOrder.nodeId, state.nodes, state.edges);
    const selectedOrderPathNodes = selectedOrderPath.length > 1 ? selectedOrderPath.slice(1) : [];
    selectedOrderMetrics = calculatePathMetrics(selectedOrderPathNodes, warehouse.id);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Controls & Stats */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Truck className="text-indigo-400" />
              Delivery OpenEnv
            </h1>
            <p className="text-slate-400 text-sm mb-6">
              AI Agent Route Optimization Simulator
            </p>

            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={state.isDone}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors"
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  {isPlaying ? 'Pause' : 'Start AI'}
                </button>
                <button
                  onClick={handleStep}
                  disabled={state.isDone || isPlaying}
                  className="px-4 flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  title="Step Forward"
                >
                  <FastForward size={18} />
                </button>
                <button
                  onClick={reset}
                  className="px-4 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  title="Reset Environment"
                >
                  <RotateCcw size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    const pendingOrders = state.orders.filter(o => !o.delivered);
                    if (pendingOrders.length > 0) {
                      const randomOrder = pendingOrders[Math.floor(Math.random() * pendingOrders.length)];
                      setSelectedOrderId(randomOrder.id);
                      setManualPath([]);
                      setShowComparison(false);
                      setShowAllRoutes(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Package size={18} />
                  Generate Order
                </button>
                <button
                  onClick={() => {
                    if (selectedOrderId) {
                      const warehouse = state.nodes.find(n => n.type === 'warehouse');
                      const order = state.orders.find(o => o.id === selectedOrderId);
                      if (warehouse && order) {
                        const aiPath = getShortestPathFromTo(warehouse.id, order.nodeId, state.nodes, state.edges);
                        const paths = getDistinctRoutes(warehouse.id, order.nodeId, state.nodes, state.edges, aiPath, 15, 5);
                        setAllRoutes(paths);
                        setShowAllRoutes(true);
                      }
                    }
                  }}
                  disabled={!selectedOrderId}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  <Route size={18} />
                  Show All Routes
                </button>
                <button
                  onClick={() => {
                    if (selectedOrderId) {
                      const warehouse = state.nodes.find(n => n.type === 'warehouse');
                      const order = state.orders.find(o => o.id === selectedOrderId);
                      if (warehouse && order) {
                        const aiPath = getShortestPathFromTo(warehouse.id, order.nodeId, state.nodes, state.edges);
                        const randPath = getRandomPath(warehouse.id, order.nodeId, state.nodes, state.edges, aiPath);
                        setRandomRoute(randPath);
                        setShowComparison(true);
                      }
                    }
                  }}
                  disabled={!selectedOrderId}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  <MapPin size={18} />
                  Compare Routes
                </button>
              </div>
              
              {showAllRoutes && allRoutes.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-slate-400">Available Routes</h4>
                  {allRoutes.map((route, idx) => {
                    const metrics = calculatePathMetrics(route.slice(1), warehouse?.id || '');
                    return (
                      <button
                        key={idx}
                        onClick={() => setManualPath(route)}
                        className={cn(
                          "w-full flex justify-between items-center p-2 rounded border text-sm transition-colors",
                          manualPath.join(',') === route.join(',') ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                        )}
                      >
                        <span>Route {idx + 1}</span>
                        <span>{metrics.distance} km</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {showComparison && selectedOrderId && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Route size={18} className="text-indigo-400" />
                Route Comparison
              </h3>
              <p className="text-xs text-slate-400">Comparing Random, User, and AI-Optimized routes.</p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Route Type</th>
                      <th className="px-3 py-2">Distance</th>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Fuel</th>
                      <th className="px-3 py-2">CO₂</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const warehouse = state.nodes.find(n => n.type === 'warehouse');
                      const order = state.orders.find(o => o.id === selectedOrderId);
                      if (!warehouse || !order || !selectedOrderMetrics) return null;
                      
                      const randomMetrics = calculatePathMetrics(randomRoute.length > 1 ? randomRoute.slice(1) : [], warehouse.id);
                      const userMetrics = calculatePathMetrics(manualPath.length > 1 ? manualPath.slice(1) : [], warehouse.id);
                      const aiMetrics = selectedOrderMetrics;

                      const getBest = (key: 'distance' | 'time' | 'fuel' | 'co2') => {
                        const vals = [];
                        if (randomRoute.length > 0) vals.push(randomMetrics[key]);
                        if (manualPath.length > 0) vals.push(userMetrics[key]);
                        if (selectedOrderPath.length > 0) vals.push(aiMetrics[key]);
                        return Math.min(...vals);
                      };

                      const bestDist = getBest('distance');
                      const bestTime = getBest('time');
                      const bestFuel = getBest('fuel');
                      const bestCo2 = getBest('co2');

                      return (
                        <>
                          {randomRoute.length > 0 && (
                            <tr className="border-b border-slate-800">
                              <td className="px-3 py-2 font-medium text-red-400">Random Baseline</td>
                              <td className={cn("px-3 py-2", randomMetrics.distance === bestDist && "text-emerald-400 font-bold")}>{randomMetrics.distance}</td>
                              <td className={cn("px-3 py-2", randomMetrics.time === bestTime && "text-emerald-400 font-bold")}>{randomMetrics.time}</td>
                              <td className={cn("px-3 py-2", randomMetrics.fuel === bestFuel && "text-emerald-400 font-bold")}>{randomMetrics.fuel.toFixed(2)}</td>
                              <td className={cn("px-3 py-2", randomMetrics.co2 === bestCo2 && "text-emerald-400 font-bold")}>{randomMetrics.co2.toFixed(2)}</td>
                            </tr>
                          )}
                          <tr className="border-b border-slate-800">
                            <td className="px-3 py-2 font-medium text-amber-400">Your Selected Route</td>
                            <td className={cn("px-3 py-2", manualPath.length > 0 && userMetrics.distance === bestDist && "text-emerald-400 font-bold")}>{manualPath.length > 0 ? userMetrics.distance : '-'}</td>
                            <td className={cn("px-3 py-2", manualPath.length > 0 && userMetrics.time === bestTime && "text-emerald-400 font-bold")}>{manualPath.length > 0 ? userMetrics.time : '-'}</td>
                            <td className={cn("px-3 py-2", manualPath.length > 0 && userMetrics.fuel === bestFuel && "text-emerald-400 font-bold")}>{manualPath.length > 0 ? userMetrics.fuel.toFixed(2) : '-'}</td>
                            <td className={cn("px-3 py-2", manualPath.length > 0 && userMetrics.co2 === bestCo2 && "text-emerald-400 font-bold")}>{manualPath.length > 0 ? userMetrics.co2.toFixed(2) : '-'}</td>
                          </tr>
                          <tr className="border-b border-slate-800">
                            <td className="px-3 py-2 font-medium text-emerald-400">AI Best Route</td>
                            <td className={cn("px-3 py-2", aiMetrics.distance === bestDist && "text-emerald-400 font-bold")}>{aiMetrics.distance}</td>
                            <td className={cn("px-3 py-2", aiMetrics.time === bestTime && "text-emerald-400 font-bold")}>{aiMetrics.time}</td>
                            <td className={cn("px-3 py-2", aiMetrics.fuel === bestFuel && "text-emerald-400 font-bold")}>{aiMetrics.fuel.toFixed(2)}</td>
                            <td className={cn("px-3 py-2", aiMetrics.co2 === bestCo2 && "text-emerald-400 font-bold")}>{aiMetrics.co2.toFixed(2)}</td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              {manualPath.length > 0 && (
                <button 
                  onClick={() => setManualPath([])}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm transition-colors"
                >
                  Clear User Route
                </button>
              )}
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings size={18} className="text-slate-400" />
              Environment State
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <StatBox label="Time Elapsed" value={state.time} icon={<Clock size={16} className="text-blue-400" />} />
              <StatBox label="Steps Taken" value={`${state.steps} / ${state.maxSteps}`} icon={<MapPin size={16} className="text-emerald-400" />} />
              <StatBox label="Efficiency Score" value={state.deliveryEfficiencyScore.toFixed(1)} icon={<span className="text-amber-400 font-bold">R</span>} />
              <StatBox label="Grader Score" value={`${(score * 100).toFixed(0)}%`} icon={<span className="text-purple-400 font-bold">%</span>} />
              <StatBox label="Total Stars" value={state.totalStars} icon={<span className="text-yellow-400">⭐</span>} />
              <StatBox label="Avg Rating" value={`${state.averageStars.toFixed(1)} ⭐`} icon={<span className="text-yellow-400">⭐</span>} />
              <StatBox label="Fuel (L)" value={state.fuelConsumed.toFixed(1)} icon={<Fuel size={16} className="text-orange-400" />} />
              <StatBox label="CO₂ (kg)" value={state.carbonEmissions.toFixed(1)} icon={<Cloud size={16} className="text-slate-400" />} />
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-3">Orders ({state.orders.filter(o => o.delivered).length}/{state.orders.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {state.orders.map(order => {
                  const starResult = calculateOrderStars(order, state.time);
                  let starDisplay = "❌";
                  let colorClass = "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700";
                  
                  if (starResult.status === "on-time") {
                    starDisplay = "⭐⭐⭐";
                    colorClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-300";
                  } else if (starResult.status === "slightly-late") {
                    starDisplay = "⭐⭐";
                    colorClass = "bg-yellow-500/10 border-yellow-500/20 text-yellow-300";
                  } else if (starResult.status === "late") {
                    starDisplay = "❌";
                    colorClass = "bg-red-500/10 border-red-500/20 text-red-300";
                  } else if (starResult.status === "not-delivered") {
                    starDisplay = "❌";
                    colorClass = "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700";
                  }

                  return (
                  <div key={order.id} 
                    onClick={() => {
                      setSelectedOrderId(order.id === selectedOrderId ? null : order.id);
                      setManualPath([]);
                      setShowAllRoutes(false);
                      setShowComparison(false);
                      setAllRoutes([]);
                      setRandomRoute([]);
                    }}
                    className={cn(
                    "flex items-center justify-between p-2 rounded border text-sm cursor-pointer transition-colors",
                    order.id === selectedOrderId ? "ring-2 ring-indigo-500" : "",
                    colorClass
                  )}>
                    <div className="flex items-center gap-2">
                      <Package size={14} />
                      <span>{order.nodeId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.deadline && (
                        <div className="flex items-center gap-1 text-xs opacity-80">
                          <Clock size={12} />
                          {order.delivered ? order.deliveryTime : '≤ ' + order.deadline}
                        </div>
                      )}
                      <span className="ml-2">{starDisplay}</span>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {selectedOrder && selectedOrderMetrics && (
              <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-4 shadow-xl space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <MapPin size={16} className="text-indigo-400" />
                  Route Details: {selectedOrder.id}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-2 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Distance</span> 
                      <span className="font-medium">{selectedOrderMetrics.distance} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Est. Time</span> 
                      <span className="font-medium">{selectedOrderMetrics.time} mins</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Avg Speed</span> 
                      <span className="font-medium">
                        {selectedOrderMetrics.time > 0 ? (selectedOrderMetrics.distance / (selectedOrderMetrics.time / 60)).toFixed(1) : 0} km/h
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fuel</span> 
                      <span className="font-medium">{selectedOrderMetrics.fuel.toFixed(2)} L</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">CO₂</span> 
                      <span className="font-medium">{selectedOrderMetrics.co2.toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ETA</span> 
                      <span className="font-medium">t + {selectedOrderMetrics.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Graph Map */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-white">Live Simulation</h2>
              {selectedOrderId && (
                <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">
                  Click nodes to build a custom User Route
                </span>
              )}
            </div>
            {state.isDone && (
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-sm font-medium rounded-full border border-indigo-500/30">
                Episode Terminated
              </span>
            )}
          </div>
          
          <div className="flex-1 flex items-center justify-center bg-slate-950 rounded-lg border border-slate-800 overflow-hidden p-4">
            <div className="relative w-full h-full bg-slate-900 rounded-lg border border-slate-800 overflow-hidden min-h-[400px] max-w-[800px] aspect-square lg:aspect-auto">
              
              {/* Edges */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {state.edges.map(edge => {
                  const n1 = state.nodes.find(n => n.id === edge.from)!;
                  const n2 = state.nodes.find(n => n.id === edge.to)!;
                  const isConstruction = edge.hasConstruction;
                  const isHeavyTraffic = edge.trafficCongestion > 10;
                  const isTraffic = edge.trafficCongestion > 0;
                  
                  let strokeColor = '#334155';
                  if (isConstruction) strokeColor = '#f97316'; // orange
                  else if (isHeavyTraffic) strokeColor = '#ef4444'; // red
                  else if (isTraffic) strokeColor = '#f87171'; // light red
                  
                  return (
                    <line 
                      key={edge.id}
                      x1={`${n1.x}%`} 
                      y1={`${n1.y}%`} 
                      x2={`${n2.x}%`} 
                      y2={`${n2.y}%`} 
                      stroke={strokeColor} 
                      strokeWidth={isConstruction ? 4 : isHeavyTraffic ? 3 : 2}
                      strokeDasharray={isConstruction ? "8 4" : isTraffic ? "4 4" : "none"}
                      className="transition-colors duration-500 opacity-60"
                    />
                  );
                })}
              </svg>

              {/* All Possible Routes Visualization */}
              {showAllRoutes && allRoutes.map((path, pathIndex) => (
                <svg key={`all-route-${pathIndex}`} className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  {path.map((nodeId, index, arr) => {
                    if (index === 0) return null;
                    const prevNode = state.nodes.find(n => n.id === arr[index - 1]);
                    const currNode = state.nodes.find(n => n.id === nodeId);
                    if (!prevNode || !currNode) return null;
                    return (
                      <line
                        key={`all-path-${pathIndex}-${index}`}
                        x1={`${prevNode.x}%`}
                        y1={`${prevNode.y}%`}
                        x2={`${currNode.x}%`}
                        y2={`${currNode.y}%`}
                        stroke="#94a3b8"
                        strokeWidth={1}
                        className="opacity-30"
                      />
                    );
                  })}
                </svg>
              ))}

              {/* Random Route Visualization */}
              {showComparison && randomRoute.length > 1 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  {randomRoute.map((nodeId, index, arr) => {
                    if (index === 0) return null;
                    const prevNode = state.nodes.find(n => n.id === arr[index - 1]);
                    const currNode = state.nodes.find(n => n.id === nodeId);
                    if (!prevNode || !currNode) return null;
                    return (
                      <line
                        key={`random-path-${index}`}
                        x1={`${prevNode.x}%`}
                        y1={`${prevNode.y}%`}
                        x2={`${currNode.x}%`}
                        y2={`${currNode.y}%`}
                        stroke="#ef4444"
                        strokeWidth={3}
                        strokeDasharray="6 4"
                        className="opacity-80"
                      />
                    );
                  })}
                </svg>
              )}

              {/* User Route Visualization */}
              {manualPath.length > 1 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  {manualPath.map((nodeId, index, arr) => {
                    if (index === 0) return null;
                    const prevNode = state.nodes.find(n => n.id === arr[index - 1]);
                    const currNode = state.nodes.find(n => n.id === nodeId);
                    if (!prevNode || !currNode) return null;
                    return (
                      <line
                        key={`user-path-${index}`}
                        x1={`${prevNode.x}%`}
                        y1={`${prevNode.y}%`}
                        x2={`${currNode.x}%`}
                        y2={`${currNode.y}%`}
                        stroke="#eab308"
                        strokeWidth={4}
                        strokeLinecap="round"
                        className="opacity-90"
                      />
                    );
                  })}
                </svg>
              )}

              {/* AI Optimized Route Visualization */}
              {showComparison && selectedOrderPath.length > 1 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  {selectedOrderPath.map((nodeId, index, arr) => {
                    if (index === 0) return null;
                    const prevNode = state.nodes.find(n => n.id === arr[index - 1]);
                    const currNode = state.nodes.find(n => n.id === nodeId);
                    if (!prevNode || !currNode) return null;
                    return (
                      <line
                        key={`ai-path-${index}`}
                        x1={`${prevNode.x}%`}
                        y1={`${prevNode.y}%`}
                        x2={`${currNode.x}%`}
                        y2={`${currNode.y}%`}
                        stroke="#22c55e"
                        strokeWidth={6}
                        strokeLinecap="round"
                        className="opacity-80"
                      />
                    );
                  })}
                </svg>
              )}

              {/* Route Labels */}
              {showComparison && selectedOrderPath.length > 1 && (() => {
                const midIndex = Math.floor(selectedOrderPath.length / 2);
                const midNode = state.nodes.find(n => n.id === selectedOrderPath[midIndex]);
                if (!midNode) return null;
                return (
                  <div className="absolute z-20 pointer-events-none" style={{ left: `${midNode.x}%`, top: `${midNode.y}%`, transform: 'translate(-50%, -150%)' }}>
                    <div className="bg-slate-900/90 text-green-400 text-[10px] font-bold px-2 py-1 rounded border border-green-500/30 whitespace-nowrap shadow-lg">
                      AI Best Route
                    </div>
                  </div>
                );
              })()}

              {showComparison && randomRoute.length > 1 && (() => {
                const midIndex = Math.floor(randomRoute.length / 2);
                const midNode = state.nodes.find(n => n.id === randomRoute[midIndex]);
                if (!midNode) return null;
                return (
                  <div className="absolute z-20 pointer-events-none" style={{ left: `${midNode.x}%`, top: `${midNode.y}%`, transform: 'translate(-50%, 50%)' }}>
                    <div className="bg-slate-900/90 text-red-400 text-[10px] font-bold px-2 py-1 rounded border border-red-500/30 whitespace-nowrap shadow-lg">
                      Random Baseline
                    </div>
                  </div>
                );
              })()}

              {manualPath.length > 1 && (() => {
                const midIndex = Math.floor(manualPath.length / 2);
                const midNode = state.nodes.find(n => n.id === manualPath[midIndex]);
                if (!midNode) return null;
                return (
                  <div className="absolute z-20 pointer-events-none" style={{ left: `${midNode.x}%`, top: `${midNode.y}%`, transform: 'translate(10%, -50%)' }}>
                    <div className="bg-slate-900/90 text-yellow-400 text-[10px] font-bold px-2 py-1 rounded border border-yellow-500/30 whitespace-nowrap shadow-lg">
                      Your Selected Route
                    </div>
                  </div>
                );
              })()}

              {/* Nodes */}
              {state.nodes.map(node => {
                const isWarehouse = node.type === 'warehouse';
                const isCustomer = node.type === 'customer';
                const order = state.orders.find(o => o.nodeId === node.id);
                const isPending = order && !order.delivered;
                const isLate = order?.deadline && state.time > order.deadline;
                const isActiveTarget = order?.id === selectedOrderId;

                const isValidNext = selectedOrderId && validNextNodes.has(node.id);
                const isLastManual = selectedOrderId && manualPath.length > 0 && node.id === manualPath[manualPath.length - 1];

                return (
                  <div
                    key={node.id}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10",
                      selectedOrderId && (isValidNext || isLastManual) && "cursor-pointer hover:scale-125 transition-transform"
                    )}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    onClick={() => handleNodeClick(node.id)}
                  >
                    {isValidNext && <div className="absolute inset-0 rounded-full ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 animate-pulse" />}
                    {isActiveTarget && <div className="absolute inset-0 rounded-full ring-4 ring-indigo-500 ring-offset-2 ring-offset-slate-900 animate-pulse" />}
                    {isWarehouse ? (
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Home size={16} className="text-white" />
                      </div>
                    ) : isCustomer ? (
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shadow-lg",
                        isPending ? (isLate ? "bg-red-500 shadow-red-500/20" : "bg-emerald-500 shadow-emerald-500/20") : "bg-slate-700"
                      )}>
                        <Package size={12} className={isPending ? "text-white" : "text-slate-400"} />
                      </div>
                    ) : (
                      <div className="w-2 h-2 bg-slate-600 rounded-full" />
                    )}
                    {isActiveTarget && (
                      <div className="absolute top-full mt-1 whitespace-nowrap text-[10px] font-bold text-indigo-400 bg-slate-900 px-1.5 py-0.5 rounded border border-indigo-500/30">
                        Active Delivery Target
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Delivery Vehicles */}
              {state.vehicles.map(vehicle => {
                const vNode = state.nodes.find(n => n.id === vehicle.nodeId);
                if (!vNode) return null;
                return (
                  <motion.div
                    key={vehicle.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                    initial={false}
                    animate={{ left: `${vNode.x}%`, top: `${vNode.y}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 25 }}
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900"
                      style={{ backgroundColor: vehicle.color, boxShadow: `0 0 20px ${vehicle.color}80` }}
                    >
                      <Truck size={20} className="text-white" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-green-500 rounded-full"></div>
                <span className="font-bold text-green-400">AI Best Route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-yellow-500 rounded-full"></div>
                <span className="font-bold text-yellow-400">Your Selected Route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 border-t-2 border-dashed border-red-500"></div>
                <span className="font-bold text-red-400">Random Baseline</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-px bg-slate-400"></div>
                <span>All Possible Paths</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
      <div className="flex items-center gap-2 text-slate-400 mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}
