import React from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeMouseHandler,
  NodeTypes,
  EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { layoutApi } from '../../services/layoutApi';
import { FamilyLayout } from '../../types/layout';
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
import { RefreshCw, AlertCircle } from 'lucide-react';

const nodeTypes: NodeTypes = {
  personCard: PersonNode,
  laneBanner: CohortLaneBanner,
};

const edgeTypes: EdgeTypes = {
  familyEdge: FamilyEdge,
};

const FamilyCanvasInternal: React.FC = () => {
  const [layout, setLayout] = React.useState<FamilyLayout | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [compactLanes, setCompactLanes] = React.useState(false);
  const [showMiniMap, setShowMiniMap] = React.useState(true);

  const [selectedPersonId, setSelectedPersonId] = React.useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PersonNodeData | LaneBannerNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<FamilyEdgeData>>([]);

  const fetchLayout = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await layoutApi.getLayout({
      includeArchived,
      compactLanes,
    });

    if (res.success && res.data) {
      setLayout(res.data);
      const flowData = convertLayoutToReactFlow(res.data, {
        selectedNodeId: selectedPersonId,
      });
      setNodes(flowData.nodes);
      setEdges(flowData.edges);
    } else {
      setError(res.error?.message || 'Failed to load family tree layout');
    }
    setLoading(false);
  }, [includeArchived, compactLanes, selectedPersonId, setNodes, setEdges]);

  React.useEffect(() => {
    fetchLayout();
  }, [fetchLayout]);

  // When selection changes, update highlights
  React.useEffect(() => {
    if (!layout) return;

    const highlightedNodeIds = new Set<string>();
    const highlightedEdgeIds = new Set<string>();

    if (selectedPersonId) {
      highlightedNodeIds.add(selectedPersonId);
      // Find connected neighbors (parents, children, spouse)
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
    });

    setNodes(flowData.nodes);
    setEdges(flowData.edges);
  }, [selectedPersonId, layout, setNodes, setEdges]);

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (node.type === 'personCard') {
      setSelectedPersonId(node.id);
    }
  };

  const handlePaneClick = () => {
    setSelectedPersonId(null);
  };

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
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Floating Canvas Controls */}
      <CanvasControls
        nodes={layout?.nodes || []}
        lanes={layout?.lanes || []}
        includeArchived={includeArchived}
        onToggleIncludeArchived={setIncludeArchived}
        compactLanes={compactLanes}
        onToggleCompactLanes={setCompactLanes}
        showMiniMap={showMiniMap}
        onToggleMiniMap={() => setShowMiniMap(!showMiniMap)}
        onSelectPerson={setSelectedPersonId}
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
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#cbd5e1" />

        {showMiniMap && (
          <MiniMap
            nodeColor={getMiniMapNodeColor}
            nodeStrokeWidth={2}
            nodeBorderRadius={4}
            maskColor="rgba(241, 245, 249, 0.7)"
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
            }}
          />
        )}
      </ReactFlow>

      {/* Selected Person Details Drawer */}
      <PersonDetailsDrawer
        personId={selectedPersonId}
        onClose={() => setSelectedPersonId(null)}
        allNodes={layout?.nodes || []}
        onSelectPerson={setSelectedPersonId}
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
