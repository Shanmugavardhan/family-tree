import { convertLayoutToReactFlow } from '../src/adapters/reactFlowAdapter';
import { FamilyLayout } from '../src/types/layout';
import { LayoutService } from '../functions/src/layout/layout.service';
import { MarkerType } from '@xyflow/react';

export async function runReactFlowAdapterTests(): Promise<{ passed: number; total: number }> {
  console.log('=== Running Tests for Milestone 3.4 (Interactive Canvas & React Flow Adapter) ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${desc}`);
      process.exit(1);
    }
    passed++;
    console.log(`✓ PASS: ${desc}`);
  }

  const layoutService = new LayoutService();
  const canonicalLayout = await layoutService.getFamilyLayout();

  // =========================================================================
  // Section 1: Canonical Layout Transformation to React Flow
  // =========================================================================
  console.log('\n--- Section 1: React Flow Adapter Conversion ---');
  const flowData = convertLayoutToReactFlow(canonicalLayout);

  assert(Array.isArray(flowData.nodes), 'Adapter returns nodes array');
  assert(Array.isArray(flowData.edges), 'Adapter returns edges array');
  assert(flowData.width >= 1400, 'Canvas width is set to at least 1400');
  assert(flowData.height === canonicalLayout.height, 'Canvas height matches layout height');

  // Node separation: Person cards vs Lane banners
  const personNodes = flowData.nodes.filter((n) => n.type === 'personCard');
  const laneBannerNodes = flowData.nodes.filter((n) => n.type === 'laneBanner');

  assert(personNodes.length === 14, `Expected exactly 14 person cards, got ${personNodes.length}`);
  assert(laneBannerNodes.length === canonicalLayout.lanes.length, `Expected ${canonicalLayout.lanes.length} lane banners, got ${laneBannerNodes.length}`);

  // =========================================================================
  // Section 2: Strict Coordinate Locking & Immutability
  // =========================================================================
  console.log('\n--- Section 2: Strict Coordinate Locking ---');
  const allLocked = personNodes.every((n) => n.draggable === false);
  assert(allLocked, 'All person card nodes strictly have draggable: false (positions locked)');

  const bannersLocked = laneBannerNodes.every((n) => n.draggable === false && n.selectable === false);
  assert(bannersLocked, 'All lane banners strictly have draggable: false and selectable: false');

  // Verify coordinates are preserved 1:1 without alteration
  for (const pNode of personNodes) {
    const layoutNode = canonicalLayout.nodes.find((n) => n.id === pNode.id);
    assert(!!layoutNode, `Node ${pNode.id} exists in layout source`);
    assert(pNode.position.x === layoutNode!.x, `Node ${pNode.id} preserves exact X coordinate (${pNode.position.x})`);
    assert(pNode.position.y === layoutNode!.y, `Node ${pNode.id} preserves exact Y coordinate (${pNode.position.y})`);
  }

  // =========================================================================
  // Section 3: Person Card Data Contracts
  // =========================================================================
  console.log('\n--- Section 3: Person Card Data Contracts ---');
  const jagannadham = personNodes.find((n) => n.data.firstName === 'Jagannadham');
  assert(!!jagannadham, 'Found Jagannadham card');
  assert(jagannadham?.data.birthYear === 1972, 'Jagannadham card has birthYear 1972');
  assert(jagannadham?.data.generationId === 'gen_x', 'Jagannadham card has generationId gen_x');
  assert(jagannadham?.data.generationName === 'Generation X', 'Jagannadham card has generationName Generation X');
  assert(jagannadham?.data.isLiving === true, 'Jagannadham card has isLiving true');
  assert(jagannadham?.data.isSelected === false, 'Default isSelected is false');
  assert(jagannadham?.data.isHighlighted === false, 'Default isHighlighted is false');

  const murthy = personNodes.find((n) => n.data.firstName === 'Murthy');
  assert(!!murthy, 'Found Murthy card');
  assert(murthy?.data.birthYear === null, 'Murthy card has birthYear null (Unknown)');
  assert(murthy?.data.generationId === null, 'Murthy card has generationId null');
  assert(murthy?.data.isLiving === false, 'Murthy card has isLiving false (Deceased)');

  // =========================================================================
  // Section 4: Edge Categorization and Distinct Visual Styles
  // =========================================================================
  console.log('\n--- Section 4: Edge Categorization & Visual Styles ---');
  assert(flowData.edges.length === 21, `Expected 21 React Flow edges, got ${flowData.edges.length}`);

  const parentEdges = flowData.edges.filter((e) => e.data?.edgeType === 'parent_child');
  const spouseEdges = flowData.edges.filter((e) => e.data?.edgeType === 'spouse');

  assert(parentEdges.length === 17, `Expected 17 parent-child edges, got ${parentEdges.length}`);
  assert(spouseEdges.length === 4, `Expected 4 spouse edges, got ${spouseEdges.length}`);

  // Parent-child edges have vertical handles & arrow markers
  for (const pe of parentEdges) {
    assert(pe.sourceHandle === 'parent-bottom', 'Parent edge connects from parent-bottom handle');
    assert(pe.targetHandle === 'child-top', 'Parent edge connects to child-top handle');
    assert(pe.type === 'familyEdge', 'Parent edge uses custom familyEdge type');
    assert(pe.markerEnd !== undefined, 'Parent edge has directional markerEnd');
  }

  // Spouse edges have horizontal handles and no directional arrow
  for (const se of spouseEdges) {
    assert(se.sourceHandle === 'spouse-right', 'Spouse edge connects from spouse-right handle');
    assert(se.targetHandle === 'spouse-left', 'Spouse edge connects to spouse-left handle');
    assert(se.markerEnd === undefined, 'Spouse edge has no directional arrow marker');
  }

  // =========================================================================
  // Section 5: Interactive Selection & Connected Neighbor Highlighting
  // =========================================================================
  console.log('\n--- Section 5: Selection & Neighbor Highlighting ---');
  const selectedId = jagannadham!.id;
  const highlightedData = convertLayoutToReactFlow(canonicalLayout, {
    selectedNodeId: selectedId,
    highlightedNodeIds: new Set([selectedId, murthy!.id]),
    highlightedEdgeIds: new Set(['edge-pc-867842c1-b8a2-45ad-8d9c-89150e68eb16-b19dee44-9906-4c46-84b6-70d2fa70a5b5']),
  });

  const selectedJag = highlightedData.nodes.find((n) => n.id === selectedId);
  assert(selectedJag?.data.isSelected === true, 'Selected card has isSelected: true');
  assert(selectedJag?.data.isHighlighted === true, 'Selected card has isHighlighted: true');

  const highlightedMurthy = highlightedData.nodes.find((n) => n.id === murthy!.id);
  assert(highlightedMurthy?.data.isHighlighted === true, 'Neighbor Murthy has isHighlighted: true');

  // Verify connected edge is animated and highlighted
  const connectedEdge = highlightedData.edges.find((e) => e.source === murthy!.id && e.target === selectedId);
  assert(connectedEdge?.data?.isHighlighted === true, 'Connected parent-child edge is highlighted');
  assert(connectedEdge?.animated === true, 'Highlighted parent-child edge has animated: true');
  assert(connectedEdge?.zIndex === 20, 'Highlighted edge elevated to zIndex 20');

  // =========================================================================
  // Section 6: Empty Layout Handling
  // =========================================================================
  console.log('\n--- Section 6: Empty Layout Handling ---');
  const emptyLayout: FamilyLayout = {
    nodes: [],
    edges: [],
    lanes: [],
    width: 1200,
    height: 800,
    metadata: {
      totalNodes: 0,
      totalEdges: 0,
      totalLanes: 0,
      width: 1200,
      height: 800,
      calculatedAt: '',
    },
  };
  const emptyFlow = convertLayoutToReactFlow(emptyLayout);
  assert(emptyFlow.nodes.length === 0, 'Empty layout produces 0 nodes without throwing');
  assert(emptyFlow.edges.length === 0, 'Empty layout produces 0 edges without throwing');

  console.log(`\n🎉 All ${passed}/${total} assertions for Milestone 3.4 PASSED!`);
  return { passed, total };
}

runReactFlowAdapterTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
