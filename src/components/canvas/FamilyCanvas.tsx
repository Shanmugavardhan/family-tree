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
  MarkerType,
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
import { StickyGenerationLabels } from './StickyGenerationLabels';
import { PersonDetailsDrawer } from './PersonDetailsDrawer';
import { RelationshipPathfinderModal } from './RelationshipPathfinderModal';
import { FloatingPersonEditModal } from './FloatingPersonEditModal';
import { FloatingAddPersonModal } from './FloatingAddPersonModal';
import { HEADER_AWARE_FIT_PADDING, CANVAS_VIEWPORT_STORAGE_KEY } from './canvasConstants';
import { useTheme } from '../../context/ThemeContext';
import { useLineage } from '../../context/LineageContext';
import { FirstTimeAccessModal } from '../lineage/FirstTimeAccessModal';
import { getParadaramiLayout, LINEAGE_PARENTS_BY_PERSON } from '../../types/lineage';
import { LineageLockNode } from './LineageLockNode';
import { RefreshCw, AlertCircle, Pencil } from 'lucide-react';

interface StoredViewport {
  x: number;
  y: number;
  zoom: number;
}

const loadStoredViewport = (): StoredViewport | null => {
  try {
    const raw = localStorage.getItem(CANVAS_VIEWPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.x === 'number' &&
      typeof parsed?.y === 'number' &&
      typeof parsed?.zoom === 'number' &&
      !isNaN(parsed.x) &&
      !isNaN(parsed.y) &&
      !isNaN(parsed.zoom) &&
      parsed.zoom > 0
    ) {
      return { x: parsed.x, y: parsed.y, zoom: parsed.zoom };
    }
  } catch {
    // ignore corrupted localStorage
  }
  return null;
};

const persistViewport = (viewport: StoredViewport) => {
  try {
    localStorage.setItem(CANVAS_VIEWPORT_STORAGE_KEY, JSON.stringify(viewport));
  } catch {
    // ignore storage errors
  }
};

const nodeTypes: NodeTypes = {
  personCard: PersonNode,
  laneBanner: CohortLaneBanner,
  lineageLockNode: LineageLockNode,
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
  const { activeLineageId, isFirstTimeLocked, expandedLineagePersonId, isParadaramiUnlocked } = useLineage();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setCenter, fitView, setViewport } = useReactFlow();

  const initialSavedViewport = React.useMemo(() => loadStoredViewport(), []);
  const saveViewportTimerRef = React.useRef<any>(null);

  const [layout, setLayout] = React.useState<FamilyLayout | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [compactLanes, setCompactLanes] = React.useState(false);
  
  // Requirement 9: MiniMap visible strictly during zoom activity only
  const [isZooming, setIsZooming] = React.useState(false);
  const lastZoomRef = React.useRef<number | null>(null);
  const zoomTimerRef = React.useRef<any>(null);

  const handleZoomActivity = React.useCallback(() => {
    setIsZooming(true);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => {
      setIsZooming(false);
    }, 1800);
  }, []);

  const handleSaveViewport = React.useCallback((viewport: { x: number; y: number; zoom: number }) => {
    if (
      typeof viewport?.x === 'number' &&
      typeof viewport?.y === 'number' &&
      typeof viewport?.zoom === 'number' &&
      !isNaN(viewport.x) &&
      !isNaN(viewport.y) &&
      !isNaN(viewport.zoom) &&
      viewport.zoom > 0
    ) {
      persistViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
    }
  }, []);

  const handleCanvasMove = React.useCallback(
    (_event: any, viewport: { x: number; y: number; zoom: number }) => {
      if (lastZoomRef.current !== null && Math.abs(viewport.zoom - lastZoomRef.current) > 0.001) {
        handleZoomActivity();
      }
      lastZoomRef.current = viewport.zoom;

      // Debounced save during active dragging or mouse scrolling
      if (saveViewportTimerRef.current) clearTimeout(saveViewportTimerRef.current);
      saveViewportTimerRef.current = setTimeout(() => {
        handleSaveViewport(viewport);
      }, 300);
    },
    [handleZoomActivity, handleSaveViewport]
  );

  const handleCanvasMoveEnd = React.useCallback(
    (_event: any, viewport: { x: number; y: number; zoom: number }) => {
      if (saveViewportTimerRef.current) clearTimeout(saveViewportTimerRef.current);
      handleSaveViewport(viewport);
    },
    [handleSaveViewport]
  );

  // Milestone 3.5: Person Interaction & Exploration states
  const [selectedPersonId, setSelectedPersonId] = React.useState<string | null>(null);
  const [focusMode, setFocusMode] = React.useState(false);

  // Active Highlighted Path (Pathfinder / Ancestor / Descendant)
  const [pathNodeIds, setPathNodeIds] = React.useState<Set<string>>(new Set());
  const [pathEdgeIds, setPathEdgeIds] = React.useState<Set<string>>(new Set());
  const [activePathSummary, setActivePathSummary] = React.useState<string | null>(null);
  const [activePathResult, setActivePathResult] = React.useState<PerspectiveRelationshipResult | null>(null);

  // Pathfinder Modal State
  const [isPathfinderOpen, setIsPathfinderOpen] = React.useState(false);
  const [pathfinderSourceId, setPathfinderSourceId] = React.useState<string | null>(null);

  // Floating Person Edit Window State
  const [editingPersonId, setEditingPersonId] = React.useState<string | null>(null);

  // Requirement 5: Floating Add Member Window State
  const [isAddMemberOpen, setIsAddMemberOpen] = React.useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PersonNodeData | LaneBannerNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<FamilyEdgeData>>([]);

  const isInitialLoadRef = React.useRef(true);

  // Helper to select person
  const selectPerson = React.useCallback(
    (personId: string | null, _pushToHistory?: boolean) => {
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
    },
    [setSearchParams]
  );

  const fetchLayout = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    // Dynamic lineage handling: Paradarami lineage layout vs Konukuru canonical layout
    if (activeLineageId === 'paradarami') {
      const paraLayout = getParadaramiLayout();
      setLayout(paraLayout);
      setLoading(false);
      return;
    }

    const res = await layoutApi.getLayout({
      includeArchived,
      compactLanes,
      inferGenerations: true,
    });

    if (res.success && res.data) {
      setLayout(res.data);
    } else {
      setError(res.error?.message || 'Failed to load family tree layout');
    }
    setLoading(false);
  }, [activeLineageId, includeArchived, compactLanes]);

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
    } else if (initialSavedViewport) {
      // Requirement 2: Restore user's saved navigation position and zoom level
      setViewport(initialSavedViewport, { duration: 0 });
    } else {
      // First-time visit: Focus directly on family member cards with header-aware padding (Requirement 1)
      const personNodeRefs = layout.nodes.map((n) => ({ id: n.id }));
      setTimeout(() => {
        fitView({
          nodes: personNodeRefs,
          padding: HEADER_AWARE_FIT_PADDING,
          duration: 700,
          maxZoom: 1.35,
          minZoom: 0.85,
        });
      }, 150);
    }
  }, [layout, searchParams, selectPerson, setCenter, fitView, setViewport, initialSavedViewport]);

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
      onEditPerson: (id: string) => setEditingPersonId(id),
    });

    const finalNodes: Node<any>[] = [...flowData.nodes];
    const finalEdges: Edge<any>[] = [...flowData.edges];

    // Requirement 1: View lineage directly on the map (no separate window), showing ONLY father and mother
    if (expandedLineagePersonId && LINEAGE_PARENTS_BY_PERSON[expandedLineagePersonId]) {
      const lineageInfo = LINEAGE_PARENTS_BY_PERSON[expandedLineagePersonId];
      const targetPersonNode = finalNodes.find(
        (n) => n.id === expandedLineagePersonId || n.data?.personId === expandedLineagePersonId
      );

      if (targetPersonNode) {
        const baseX = targetPersonNode.position.x;
        const baseY = targetPersonNode.position.y;
        // Parents in preceding generation lane above target
        const parentsY = baseY - 440;
        const fatherX = baseX - 140;
        const motherX = baseX + 140;
        const lockY = baseY - 660;

        const fatherNode: Node<PersonNodeData> = {
          id: lineageInfo.father.id,
          type: 'personCard',
          position: { x: fatherX, y: parentsY },
          style: {
            width: 190,
            height: 160,
          },
          data: {
            id: lineageInfo.father.id,
            personId: lineageInfo.father.id,
            firstName: lineageInfo.father.firstName,
            middleName: lineageInfo.father.middleName ?? null,
            lastName: lineageInfo.father.lastName,
            birthDate: null,
            birthYear: lineageInfo.father.birthYear ?? null,
            generationId: 'silent',
            generationName: 'Silent Generation',
            generationOrder: 2,
            photoPath: null,
            gender: lineageInfo.father.gender,
            isLiving: lineageInfo.father.isLiving,
            isArchived: false,
            isSelected: selectedPersonId === lineageInfo.father.id,
            isHighlighted: false,
            isPathNode: false,
            isDimmed: false,
            onEdit: (id: string) => setEditingPersonId(id),
          },
          draggable: false,
          selectable: true,
        };

        const motherNode: Node<PersonNodeData> = {
          id: lineageInfo.mother.id,
          type: 'personCard',
          position: { x: motherX, y: parentsY },
          style: {
            width: 190,
            height: 160,
          },
          data: {
            id: lineageInfo.mother.id,
            personId: lineageInfo.mother.id,
            firstName: lineageInfo.mother.firstName,
            middleName: lineageInfo.mother.middleName ?? null,
            lastName: lineageInfo.mother.lastName,
            birthDate: null,
            birthYear: lineageInfo.mother.birthYear ?? null,
            generationId: 'silent',
            generationName: 'Silent Generation',
            generationOrder: 2,
            photoPath: null,
            gender: lineageInfo.mother.gender,
            isLiving: lineageInfo.mother.isLiving,
            isArchived: false,
            isSelected: selectedPersonId === lineageInfo.mother.id,
            isHighlighted: false,
            isPathNode: false,
            isDimmed: false,
            onEdit: (id: string) => setEditingPersonId(id),
          },
          draggable: false,
          selectable: true,
        };

        const lockNode: Node<any> = {
          id: `${lineageInfo.lineageId}-ancestry-lock`,
          type: 'lineageLockNode',
          position: { x: baseX + 52, y: lockY },
          data: {
            lineageId: lineageInfo.lineageId,
            lineageName: lineageInfo.lineageName,
            isUnlocked: isParadaramiUnlocked,
          },
          draggable: false,
          selectable: false,
        };

        // Spouse edge between father and mother
        const spouseEdge: Edge<FamilyEdgeData> = {
          id: `edge-maternal-spouse-${lineageInfo.father.id}-${lineageInfo.mother.id}`,
          source: lineageInfo.father.id,
          target: lineageInfo.mother.id,
          sourceHandle: 'spouse-right',
          targetHandle: 'spouse-left',
          type: 'familyEdge',
          style: { stroke: '#D18B91', strokeWidth: 2 },
          data: { edgeType: 'spouse' },
        };

        // Parent-child edge down to target person
        const childEdge: Edge<FamilyEdgeData> = {
          id: `edge-maternal-child-${lineageInfo.father.id}-${targetPersonNode.id}`,
          source: lineageInfo.father.id,
          target: targetPersonNode.id,
          sourceHandle: 'parent-bottom',
          targetHandle: 'child-top',
          type: 'familyEdge',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: '#A94747',
          },
          style: { stroke: '#A94747', strokeWidth: 2 },
          data: { edgeType: 'parent_child' },
        };

        // Ancestry connecting edge from lock node down to father
        const lockEdge: Edge<FamilyEdgeData> = {
          id: `edge-maternal-lock-${lineageInfo.father.id}`,
          source: `${lineageInfo.lineageId}-ancestry-lock`,
          target: lineageInfo.father.id,
          sourceHandle: 'parent-bottom',
          targetHandle: 'child-top',
          type: 'familyEdge',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: isParadaramiUnlocked ? '#10b981' : '#ef4444',
          },
          style: {
            stroke: isParadaramiUnlocked ? '#10b981' : '#ef4444',
            strokeWidth: 2,
            strokeDasharray: '4 4',
          },
          data: { edgeType: 'parent_child' },
        };

        finalNodes.push(fatherNode, motherNode, lockNode);
        finalEdges.push(spouseEdge, childEdge, lockEdge);
      }
    }

    setNodes(finalNodes);
    setEdges(finalEdges);
  }, [
    selectedPersonId,
    focusMode,
    pathNodeIds,
    pathEdgeIds,
    layout,
    expandedLineagePersonId,
    isParadaramiUnlocked,
    setNodes,
    setEdges,
  ]);

  // Smoothly center on expanded lineage parents when toggled on the map
  const prevExpandedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (expandedLineagePersonId && expandedLineagePersonId !== prevExpandedRef.current && layout) {
      const target = layout.nodes.find(
        (n) => n.id === expandedLineagePersonId || n.personId === expandedLineagePersonId
      );
      if (target) {
        setCenter(target.x + target.width / 2, target.y - 200, {
          duration: 650,
          zoom: 1.0,
        });
      }
    }
    prevExpandedRef.current = expandedLineagePersonId;
  }, [expandedLineagePersonId, layout, setCenter]);

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

      // Smoothly fit view to highlight all ancestors (Requirement 1: Header-aware padding)
      setTimeout(() => {
        const nodesToFit = Array.from(ancestors).map((id) => ({ id }));
        fitView({ nodes: nodesToFit, padding: HEADER_AWARE_FIT_PADDING, duration: 800, maxZoom: 1.35 });
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

      // Smoothly fit view to highlight all descendants (Requirement 1: Header-aware padding)
      setTimeout(() => {
        const nodesToFit = Array.from(descendants).map((id) => ({ id }));
        fitView({ nodes: nodesToFit, padding: HEADER_AWARE_FIT_PADDING, duration: 800, maxZoom: 1.35 });
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

      // Smoothly fit view to path nodes (Requirement 1: Header-aware boundary and padding)
      if (pathData.nodeIds.size > 0) {
        setTimeout(() => {
          const nodesToFit = Array.from(pathData.nodeIds).map((id) => ({ id }));
          fitView({ nodes: nodesToFit, padding: HEADER_AWARE_FIT_PADDING, duration: 800, maxZoom: 1.35 });
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
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', backgroundColor: isDark ? '#101318' : '#fcf9f2' }}>
      {/* Blurred Viewport during first-time locked state (Requirement 5) */}
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          filter: isFirstTimeLocked ? 'blur(16px) brightness(0.65)' : 'none',
          transition: 'filter 0.35s ease-out',
          pointerEvents: isFirstTimeLocked ? 'none' : 'auto',
        }}
      >
        {/* Sticky Noble Generation Labels (Requirement 4: Sticky on left, no box) */}
        <StickyGenerationLabels lanes={layout?.lanes || []} />

      {/* Header Canvas Controls Portal (Requirements 5 & 8: Search & Actions in Header) */}
      <CanvasControls
        nodes={layout?.nodes || []}
        includeArchived={includeArchived}
        onToggleIncludeArchived={setIncludeArchived}
        compactLanes={compactLanes}
        onToggleCompactLanes={setCompactLanes}
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
        focusMode={focusMode}
        onToggleFocusMode={setFocusMode}
        onOpenPathfinder={() => handleOpenPathfinder()}
        activePathSummary={activePathSummary}
        onClearActivePath={handleClearPath}
        onZoomActivity={handleZoomActivity}
      />

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMove={handleCanvasMove}
        onMoveEnd={handleCanvasMoveEnd}
        defaultViewport={initialSavedViewport || undefined}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodesDraggable={false} // Strictly locked to chronological coordinates
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.2}
        maxZoom={4.0}
        zoomOnScroll={true} // Mouse scroll zooms in and out
        panOnScroll={false} // Mouse scroll does not pan
        panOnDrag={true} // Navigation is ONLY using click and drag
        zoomOnPinch={true}
        preventScrolling={true}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color={isDark ? '#252E3A' : '#cbd5e1'} />

        {/* MiniMap: Automatically visible ONLY during zoom activity (Requirement 9) */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            borderRadius: 12,
            overflow: 'hidden',
            opacity: isZooming ? 1 : 0,
            pointerEvents: isZooming ? 'auto' : 'none',
            transform: isZooming ? 'scale(1)' : 'scale(0.92)',
            transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 40,
            boxShadow: isDark
              ? '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(212, 175, 55, 0.3)'
              : '0 8px 25px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(197, 155, 39, 0.3)',
          }}
        >
          <MiniMap
            nodeColor={getMiniMapNodeColor}
            nodeStrokeWidth={2}
            nodeBorderRadius={4}
            maskColor={isDark ? 'rgba(8, 10, 15, 0.8)' : 'rgba(252, 248, 238, 0.8)'}
            style={{
              position: 'relative',
              bottom: 0,
              right: 0,
              backgroundColor: isDark ? '#111622' : '#fcf8ee',
            }}
          />
        </div>
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
        onEditPerson={(id) => setEditingPersonId(id)}
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

      {/* Floating Person Edit Window on the Canvas */}
      <FloatingPersonEditModal
        isOpen={!!editingPersonId}
        personId={editingPersonId}
        onClose={() => setEditingPersonId(null)}
        onSaveSuccess={(_updatedPerson) => {
          fetchLayout();
        }}
      />

      {/* Requirement 5: Square floating button on screen with pencil icon for adding a member */}
      <button
        onClick={() => setIsAddMemberOpen(true)}
        className="canvas-floating-add-btn"
        title="Add Family Member"
        aria-label="Add Family Member"
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: '#161c26',
          border: '1.5px solid #D6B15C',
          color: '#D6B15C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.75), 0 0 14px rgba(214, 177, 92, 0.3)',
          cursor: 'pointer',
          zIndex: 40,
          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.backgroundColor = '#1d2634';
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.85), 0 0 18px rgba(214, 177, 92, 0.45)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = '#161c26';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.75), 0 0 14px rgba(214, 177, 92, 0.3)';
        }}
      >
        <Pencil size={22} />
      </button>

      {/* Requirement 5: Floating Add Member Window on the Canvas */}
      <FloatingAddPersonModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onSaveSuccess={(_createdPerson) => {
          fetchLayout();
        }}
      />
      </div>

      {/* Requirement 5: First-Time Access Code Modal (Blurred background until family code entered) */}
      <FirstTimeAccessModal />
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
