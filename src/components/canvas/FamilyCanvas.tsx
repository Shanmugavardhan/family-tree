import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Node,
  Edge,
  NodeMouseHandler,
  NodeTypes,
  EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { layoutApi } from '../../services/layoutApi';
import { personApi } from '../../services/personApi';
import { FamilyLayout, PositionedEdge } from '../../types/layout';
import { PerspectiveRelationshipResult } from '../../types/relative';
import {
  convertLayoutToReactFlow,
  PersonNodeData,
  LaneBannerNodeData,
  FamilyEdgeData,
} from '../../adapters/reactFlowAdapter';
import { PersonNode } from './PersonNode';
import { CohortLaneBanner } from './CohortLaneBanner';
import { FamilyEdge } from './FamilyEdge';
import { CanvasControls } from './CanvasControls';
import { PersonDetailsDrawer } from './PersonDetailsDrawer';
import { RelationshipPathfinderModal } from './RelationshipPathfinderModal';
import { useTheme } from '../../context/ThemeContext';
import { RefreshCw, AlertCircle } from 'lucide-react';

const nodeTypes: NodeTypes = {
  personCard: PersonNode,
  laneBanner: CohortLaneBanner,
};

const edgeTypes: EdgeTypes = {
  familyEdge: FamilyEdge,
};

/**
 * BFS on undirected family graph to find shortest path of nodes and edges
 */
function findGraphPath(
  edges: PositionedEdge[],
  startId: string,
  endId: string
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  if (startId === endId) {
    return { nodeIds: new Set([startId]), edgeIds: new Set() };
  }

  const adj = new Map<string, Array<{ neighbor: string; edgeId: string }>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ neighbor: e.target, edgeId: e.id });
    adj.get(e.target)!.push({ neighbor: e.source, edgeId: e.id });
  }

  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  const parentMap = new Map<string, { prevNode: string; edgeId: string }>();

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === endId) break;

    const neighbors = adj.get(curr) || [];
    for (const { neighbor, edgeId } of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parentMap.set(neighbor, { prevNode: curr, edgeId });
        queue.push(neighbor);
      }
    }
  }

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  if (parentMap.has(endId)) {
    let curr = endId;
    nodeIds.add(curr);
    while (curr !== startId) {
      const info = parentMap.get(curr);
      if (!info) break;
      edgeIds.add(info.edgeId);
      nodeIds.add(info.prevNode);
      curr = info.prevNode;
    }
  }

  return { nodeIds, edgeIds };
}

const FamilyCanvasInternal: React.FC = () => {
  const { isDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setCenter, fitView } = useReactFlow();

  const [layout, setLayout] = React.useState<FamilyLayout | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [compactLanes, setCompactLanes] = React.useState(false);
  const [showMiniMap, setShowMiniMap] = React.useState(true);

  // Milestone 3.5: Person Interaction & Exploration states
  const [selectedPersonId, setSelectedPersonId] = React.useState<string | null>(null);
  const [focusMode, setFocusMode] = React.useState(false);

  // Navigation History Stack
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);

  // Active Highlighted Path (Pathfinder / Ancestor / Descendant)
  const [pathNodeIds, setPathNodeIds] = React.useState<Set<string>>(new Set());
  const [pathEdgeIds, setPathEdgeIds] = React.useState<Set<string>>(new Set());
  const [activePathSummary, setActivePathSummary] = React.useState<string | null>(null);
  const [activePathResult, setActivePathResult] = React.useState<PerspectiveRelationshipResult | null>(null);

  // Pathfinder Modal State
  const [isPathfinderOpen, setIsPathfinderOpen] = React.useState(false);
  const [pathfinderSourceId, setPathfinderSourceId] = React.useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PersonNodeData | LaneBannerNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<FamilyEdgeData>>([]);

  const isInitialLoadRef = React.useRef(true);

  // Helper to select person and manage navigation history
  const selectPerson = React.useCallback(
    (personId: string | null, pushToHistory = true) => {
      setSelectedPersonId(personId);

      // Update URL query params cleanly
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (personId) {
            next.set('personId', personId);
          } else {
            next.delete('personId');
          }
          return next;
        },
        { replace: true }
      );

      if (personId && pushToHistory) {
        setHistory((prev) => {
          const newHistory = prev.slice(0, historyIndex + 1);
          newHistory.push(personId);
          return newHistory;
        });
        setHistoryIndex((prev) => prev + 1);
      }
    },
    [historyIndex, setSearchParams]
  );

  // Navigation History actions
  const handleGoBack = React.useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevId = history[prevIndex];
      setHistoryIndex(prevIndex);
      selectPerson(prevId, false);

      if (layout) {
        const targetNode = layout.nodes.find((n) => n.id === prevId);
        if (targetNode) {
          setCenter(targetNode.x + targetNode.width / 2, targetNode.y + targetNode.height / 2, {
            duration: 600,
            zoom: 1.35,
          });
        }
      }
    }
  }, [historyIndex, history, layout, selectPerson, setCenter]);

  const handleGoForward = React.useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextId = history[nextIndex];
      setHistoryIndex(nextIndex);
      selectPerson(nextId, false);

      if (layout) {
        const targetNode = layout.nodes.find((n) => n.id === nextId);
        if (targetNode) {
          setCenter(targetNode.x + targetNode.width / 2, targetNode.y + targetNode.height / 2, {
            duration: 600,
            zoom: 1.35,
          });
        }
      }
    }
  }, [historyIndex, history, layout, selectPerson, setCenter]);

  const fetchLayout = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await layoutApi.getLayout({
      includeArchived,
      compactLanes,
    });

    if (res.success && res.data) {
      setLayout(res.data);
    } else {
      setError(res.error?.message || 'Failed to load family tree layout');
    }
    setLoading(false);
  }, [includeArchived, compactLanes]);

  React.useEffect(() => {
    fetchLayout();
  }, [fetchLayout]);

  // Deep-linking URL parameter handler on initial layout load
  React.useEffect(() => {
    if (!layout || !isInitialLoadRef.current) return;
    isInitialLoadRef.current = false;

    const urlPersonId = searchParams.get('personId');
    const urlFromId = searchParams.get('fromId');
    const urlToId = searchParams.get('toId');

    if (urlFromId && urlToId) {
      // Auto-trigger pathfinding if both fromId and toId are in URL
      (async () => {
        const res = await personApi.getRelationshipTo(urlFromId, urlToId);
        if (res.success && res.data) {
          handleApplyPath(res.data, urlFromId, urlToId);
        }
      })();
    } else if (urlPersonId) {
      const targetNode = layout.nodes.find((n) => n.id === urlPersonId);
      if (targetNode) {
        selectPerson(urlPersonId, true);
        setTimeout(() => {
          setCenter(targetNode.x + targetNode.width / 2, targetNode.y + targetNode.height / 2, {
            duration: 800,
            zoom: 1.35,
          });
        }, 150);
      }
    } else {
      // Default: Focus directly on family member cards at a closer, readable zoom level
      const personNodeRefs = layout.nodes.map((n) => ({ id: n.id }));
      setTimeout(() => {
        fitView({
          nodes: personNodeRefs,
          padding: 0.1,
          duration: 700,
          maxZoom: 1.35,
          minZoom: 0.85,
        });
      }, 150);
    }
  }, [layout, searchParams, selectPerson, setCenter, fitView]);

  // When selection, focusMode, or active path changes, recalculate React Flow nodes/edges
  React.useEffect(() => {
    if (!layout) return;

    const highlightedNodeIds = new Set<string>();
    const highlightedEdgeIds = new Set<string>();

    if (selectedPersonId) {
      highlightedNodeIds.add(selectedPersonId);
      // Find connected immediate neighbors (parents, children, spouse)
      for (const e of layout.edges) {
        if (e.source === selectedPersonId) {
          highlightedNodeIds.add(e.target);
          highlightedEdgeIds.add(e.id);
        } else if (e.target === selectedPersonId) {
          highlightedNodeIds.add(e.source);
          highlightedEdgeIds.add(e.id);
        }
      }
    }

    const flowData = convertLayoutToReactFlow(layout, {
      selectedNodeId: selectedPersonId,
      highlightedNodeIds,
      highlightedEdgeIds,
      pathNodeIds,
      pathEdgeIds,
      focusMode,
    });

    setNodes(flowData.nodes);
    setEdges(flowData.edges);
  }, [selectedPersonId, focusMode, pathNodeIds, pathEdgeIds, layout, setNodes, setEdges]);

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (node.type === 'personCard') {
      selectPerson(node.id, true);
    }
  };

  const handlePaneClick = () => {
    selectPerson(null, false);
  };

  // Ancestor Exploration Traversal
  const handleTraceAncestors = React.useCallback(
    (personId: string) => {
      if (!layout) return;

      const queue: string[] = [personId];
      const ancestors = new Set<string>([personId]);
      const ancestorEdges = new Set<string>();

      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const e of layout.edges) {
          // In parent_child edge, source is parent, target is child
          if (e.type === 'parent_child' && e.target === curr) {
            ancestorEdges.add(e.id);
            if (!ancestors.has(e.source)) {
              ancestors.add(e.source);
              queue.push(e.source);
            }
          }
        }
      }

      const focalPerson = layout.nodes.find((n) => n.id === personId);
      const name = focalPerson ? `${focalPerson.firstName} ${focalPerson.lastName || ''}`.trim() : 'Person';
      const count = ancestors.size - 1;

      setPathNodeIds(ancestors);
      setPathEdgeIds(ancestorEdges);
      setActivePathSummary(`Ancestors of ${name} (${count} direct ${count === 1 ? 'ancestor' : 'ancestors'} traced)`);
      setActivePathResult(null);

      // Smoothly fit view to highlight all ancestors
      setTimeout(() => {
        const nodesToFit = Array.from(ancestors).map((id) => ({ id }));
        fitView({ nodes: nodesToFit, padding: 0.12, duration: 800, maxZoom: 1.35 });
      }, 100);
    },
    [layout, fitView]
  );

  // Descendant Exploration Traversal
  const handleTraceDescendants = React.useCallback(
    (personId: string) => {
      if (!layout) return;

      const queue: string[] = [personId];
      const descendants = new Set<string>([personId]);
      const descendantEdges = new Set<string>();

      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const e of layout.edges) {
          // In parent_child edge, source is parent, target is child
          if (e.type === 'parent_child' && e.source === curr) {
            descendantEdges.add(e.id);
            if (!descendants.has(e.target)) {
              descendants.add(e.target);
              queue.push(e.target);
            }
          }
        }
      }

      const focalPerson = layout.nodes.find((n) => n.id === personId);
      const name = focalPerson ? `${focalPerson.firstName} ${focalPerson.lastName || ''}`.trim() : 'Person';
      const count = descendants.size - 1;

      setPathNodeIds(descendants);
      setPathEdgeIds(descendantEdges);
      setActivePathSummary(`Descendants of ${name} (${count} direct ${count === 1 ? 'descendant' : 'descendants'} traced)`);
      setActivePathResult(null);

      // Smoothly fit view to highlight all descendants
      setTimeout(() => {
        const nodesToFit = Array.from(descendants).map((id) => ({ id }));
        fitView({ nodes: nodesToFit, padding: 0.12, duration: 800, maxZoom: 1.35 });
      }, 100);
    },
    [layout, fitView]
  );

  // Apply Relationship Pathfinder Result
  const handleApplyPath = React.useCallback(
    (result: PerspectiveRelationshipResult, sourceId: string, targetId: string) => {
      if (!layout) return;

      const pathData = findGraphPath(layout.edges, sourceId, targetId);

      setPathNodeIds(pathData.nodeIds);
      setPathEdgeIds(pathData.edgeIds);
      setActivePathResult(result);
      setActivePathSummary(`${result.from_person.full_name} is ${result.relationship} to ${result.to_person.full_name}`);

      // Smoothly fit view to path nodes
      if (pathData.nodeIds.size > 0) {
        setTimeout(() => {
          const nodesToFit = Array.from(pathData.nodeIds).map((id) => ({ id }));
          fitView({ nodes: nodesToFit, padding: 0.12, duration: 800, maxZoom: 1.35 });
        }, 100);
      }
    },
    [layout, fitView]
  );

  // Clear Active Path highlighting
  const handleClearPath = React.useCallback(() => {
    setPathNodeIds(new Set());
    setPathEdgeIds(new Set());
    setActivePathSummary(null);
    setActivePathResult(null);
  }, []);

  // Open Pathfinder Modal
  const handleOpenPathfinder = React.useCallback((sourceId?: string) => {
    setPathfinderSourceId(sourceId || selectedPersonId || null);
    setIsPathfinderOpen(true);
  }, [selectedPersonId]);

  // MiniMap node color customization based on cohort
  const getMiniMapNodeColor = (node: Node) => {
    if (node.type === 'laneBanner') return 'transparent';
    const genId = (node.data as PersonNodeData)?.generationId;
    switch (genId) {
      case 'silent':
        return '#475569';
      case 'baby_boomers':
        return '#0d9488';
      case 'gen_x':
        return '#2563eb';
      case 'millennials':
        return '#7c3aed';
      case 'gen_z':
        return '#059669';
      case 'gen_alpha':
        return '#ea580c';
      case 'gen_beta':
        return '#e11d48';
      default:
        return '#94a3b8';
    }
  };

  if (loading && !layout) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          backgroundColor: '#f8fafc',
        }}
      >
        <RefreshCw size={36} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#334155' }}>
          Calculating Chronological Layout...
        </div>
      </div>
    );
  }

  if (error && !layout) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          backgroundColor: '#f8fafc',
          padding: 24,
        }}
      >
        <AlertCircle size={42} color="#e11d48" />
        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
          Unable to Load Family Tree
        </div>
        <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 400 }}>{error}</p>
        <button
          onClick={fetchLayout}
          style={{
            padding: '8px 18px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            borderRadius: 8,
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', backgroundColor: isDark ? '#0b0f19' : '#f8fafc' }}>
      {/* Floating Canvas Controls with Navigation, Focus, and Pathfinder */}
      <CanvasControls
        nodes={layout?.nodes || []}
        lanes={layout?.lanes || []}
        includeArchived={includeArchived}
        onToggleIncludeArchived={setIncludeArchived}
        compactLanes={compactLanes}
        onToggleCompactLanes={setCompactLanes}
        showMiniMap={showMiniMap}
        onToggleMiniMap={() => setShowMiniMap(!showMiniMap)}
        onSelectPerson={(id) => {
          selectPerson(id, true);
          if (layout) {
            const targetNode = layout.nodes.find((n) => n.id === id);
            if (targetNode) {
              setCenter(targetNode.x + targetNode.width / 2, targetNode.y + targetNode.height / 2, {
                duration: 800,
                zoom: 1.35,
              });
            }
          }
        }}
        canGoBack={historyIndex > 0}
        canGoForward={historyIndex < history.length - 1}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        focusMode={focusMode}
        onToggleFocusMode={setFocusMode}
        onOpenPathfinder={() => handleOpenPathfinder()}
        activePathSummary={activePathSummary}
        onClearActivePath={handleClearPath}
      />

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodesDraggable={false} // Strictly locked to chronological coordinates
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.2}
        maxZoom={4.0}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color={isDark ? '#334155' : '#cbd5e1'} />

        {showMiniMap && (
          <MiniMap
            nodeColor={getMiniMapNodeColor}
            nodeStrokeWidth={2}
            nodeBorderRadius={4}
            maskColor={isDark ? 'rgba(11, 15, 25, 0.75)' : 'rgba(241, 245, 249, 0.7)'}
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              borderRadius: 12,
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.5)' : '0 4px 14px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
            }}
          />
        )}
      </ReactFlow>

      {/* Selected Person Details Drawer with Kinship actions */}
      <PersonDetailsDrawer
        personId={selectedPersonId}
        onClose={() => selectPerson(null, false)}
        allNodes={layout?.nodes || []}
        onSelectPerson={(id) => {
          selectPerson(id, true);
          if (layout) {
            const targetNode = layout.nodes.find((n) => n.id === id);
            if (targetNode) {
              setCenter(targetNode.x + targetNode.width / 2, targetNode.y + targetNode.height / 2, {
                duration: 800,
                zoom: 1.35,
              });
            }
          }
        }}
        onTraceAncestors={handleTraceAncestors}
        onTraceDescendants={handleTraceDescendants}
        onOpenPathfinder={(sourceId) => handleOpenPathfinder(sourceId)}
      />

      {/* Relationship Pathfinder Modal */}
      <RelationshipPathfinderModal
        isOpen={isPathfinderOpen}
        onClose={() => setIsPathfinderOpen(false)}
        allNodes={layout?.nodes || []}
        initialSourceId={pathfinderSourceId}
        onApplyPath={handleApplyPath}
        onClearPath={handleClearPath}
        activeResult={activePathResult}
      />
    </div>
  );
};

export const FamilyCanvas: React.FC = () => {
  return (
    <ReactFlowProvider>
      <FamilyCanvasInternal />
    </ReactFlowProvider>
  );
};
