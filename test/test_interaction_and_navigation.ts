import { convertLayoutToReactFlow } from '../src/adapters/reactFlowAdapter';
import { LayoutService } from '../functions/src/layout/layout.service';
import { RelativeService } from '../functions/src/services/relative.service';
import { PositionedEdge } from '../src/types/layout';
import * as fs from 'fs';
import * as path from 'path';

/**
 * BFS on undirected family graph to find shortest path of nodes and edges
 * (matches implementation in FamilyCanvas)
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

/**
 * Recursive Ancestor Traversal
 */
function traceAncestors(edges: PositionedEdge[], startId: string): { ancestors: Set<string>; edges: Set<string> } {
  const queue: string[] = [startId];
  const ancestors = new Set<string>([startId]);
  const ancestorEdges = new Set<string>();

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const e of edges) {
      if (e.type === 'parent_child' && e.target === curr) {
        ancestorEdges.add(e.id);
        if (!ancestors.has(e.source)) {
          ancestors.add(e.source);
          queue.push(e.source);
        }
      }
    }
  }

  return { ancestors, edges: ancestorEdges };
}

/**
 * Recursive Descendant Traversal
 */
function traceDescendants(edges: PositionedEdge[], startId: string): { descendants: Set<string>; edges: Set<string> } {
  const queue: string[] = [startId];
  const descendants = new Set<string>([startId]);
  const descendantEdges = new Set<string>();

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const e of edges) {
      if (e.type === 'parent_child' && e.source === curr) {
        descendantEdges.add(e.id);
        if (!descendants.has(e.target)) {
          descendants.add(e.target);
          queue.push(e.target);
        }
      }
    }
  }

  return { descendants, edges: descendantEdges };
}

export async function runInteractionAndNavigationTests(): Promise<{ passed: number; total: number }> {
  console.log('=== Running Tests for Milestone 3.5 (Person Interaction & Navigation) ===\n');
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
  const relativeService = new RelativeService();
  const canonicalLayout = await layoutService.getFamilyLayout();

  // Find key people in canonical dataset
  const shanmuga = canonicalLayout.nodes.find((n) => n.firstName === 'Shanmuga');
  const murthy = canonicalLayout.nodes.find((n) => n.firstName === 'Murthy');
  const jagannadham = canonicalLayout.nodes.find((n) => n.firstName === 'Jagannadham');
  const giri = canonicalLayout.nodes.find((n) => n.firstName === 'Giri');

  assert(!!shanmuga, 'Shanmuga node identified in layout');
  assert(!!murthy, 'Murthy (grandfather/patriarch) node identified in layout');
  assert(!!jagannadham, 'Jagannadham (father) node identified in layout');
  assert(!!giri, 'Giri (uncle) node identified in layout');

  // =========================================================================
  // Section 1: Immediate Family Highlighting Logic
  // =========================================================================
  console.log('\n--- Section 1: Immediate Family Highlighting ---');
  {
    const targetId = shanmuga!.id;
    const highlightedNodeIds = new Set<string>([targetId]);
    const highlightedEdgeIds = new Set<string>();

    for (const e of canonicalLayout.edges) {
      if (e.source === targetId) {
        highlightedNodeIds.add(e.target);
        highlightedEdgeIds.add(e.id);
      } else if (e.target === targetId) {
        highlightedNodeIds.add(e.source);
        highlightedEdgeIds.add(e.id);
      }
    }

    assert(highlightedNodeIds.has(jagannadham!.id), 'Shanmuga selection highlights father (Jagannadham)');
    assert(highlightedEdgeIds.size > 0, `Shanmuga has ${highlightedEdgeIds.size} connected immediate family edges`);

    const flowData = convertLayoutToReactFlow(canonicalLayout, {
      selectedNodeId: targetId,
      highlightedNodeIds,
      highlightedEdgeIds,
    });

    const selectedPersonNode = flowData.nodes.find((n) => n.id === targetId);
    assert(selectedPersonNode?.data.isSelected === true, 'Selected person node data has isSelected: true');

    const fatherPersonNode = flowData.nodes.find((n) => n.id === jagannadham!.id);
    assert(fatherPersonNode?.data.isHighlighted === true, 'Connected family member node data has isHighlighted: true');

    // Edge animation check
    for (const edgeId of highlightedEdgeIds) {
      const edge = flowData.edges.find((e) => e.id === edgeId);
      assert(edge?.animated === true, `Highlighted edge ${edgeId} is animated`);
    }
  }

  // =========================================================================
  // Section 2: Ancestor Exploration Traversal
  // =========================================================================
  console.log('\n--- Section 2: Ancestor Exploration Traversal ---');
  {
    const { ancestors, edges: ancestorEdges } = traceAncestors(canonicalLayout.edges, shanmuga!.id);

    assert(ancestors.has(shanmuga!.id), 'Ancestor tree contains focal person (Shanmuga)');
    assert(ancestors.has(jagannadham!.id), 'Ancestor tree contains father (Jagannadham)');
    assert(ancestors.has(murthy!.id), 'Ancestor tree contains grandfather (Satyanarayana Murthy)');
    assert(ancestorEdges.size >= 2, `Ancestor traversal discovered ${ancestorEdges.size} connecting parent-child edges`);

    // Verify Murthy (patriarch) has no ancestors
    const murthyAncestors = traceAncestors(canonicalLayout.edges, murthy!.id);
    assert(murthyAncestors.ancestors.size === 1, 'Top patriarch has exactly 1 ancestor node (himself)');
    assert(murthyAncestors.edges.size === 0, 'Top patriarch has 0 incoming parent edges');
  }

  // =========================================================================
  // Section 3: Descendant Exploration Traversal
  // =========================================================================
  console.log('\n--- Section 3: Descendant Exploration Traversal ---');
  {
    const { descendants, edges: descendantEdges } = traceDescendants(canonicalLayout.edges, murthy!.id);

    assert(descendants.has(murthy!.id), 'Descendant tree contains patriarch');
    assert(descendants.has(jagannadham!.id), 'Descendant tree contains son (Jagannadham)');
    assert(descendants.has(giri!.id), 'Descendant tree contains son (Giri)');
    assert(descendants.has(shanmuga!.id), 'Descendant tree contains grandson (Shanmuga)');
    assert(descendantEdges.size > 0, `Patriarch has ${descendantEdges.size} connecting descendant edges`);

    // Leaf person with no children has 0 descendants
    const shanmugaDescendants = traceDescendants(canonicalLayout.edges, shanmuga!.id);
    assert(shanmugaDescendants.descendants.size === 1, 'Childless person has 1 descendant node (self)');
    assert(shanmugaDescendants.edges.size === 0, 'Childless person has 0 descendant edges');
  }

  // =========================================================================
  // Section 4: Relationship Pathfinder Graph Search
  // =========================================================================
  console.log('\n--- Section 4: Relationship Pathfinder Graph Search ---');
  {
    // Path: Shanmuga -> Satyanarayana Murthy
    const pathMurthy = findGraphPath(canonicalLayout.edges, shanmuga!.id, murthy!.id);
    assert(pathMurthy.nodeIds.has(shanmuga!.id), 'Path contains source (Shanmuga)');
    assert(pathMurthy.nodeIds.has(jagannadham!.id), 'Path passes through intermediate parent (Jagannadham)');
    assert(pathMurthy.nodeIds.has(murthy!.id), 'Path reaches target (Murthy)');
    assert(pathMurthy.edgeIds.size === 2, `Expected 2 edges for 2-hop grandfather path, got ${pathMurthy.edgeIds.size}`);

    // Path: Shanmuga -> Uncle Giri
    const pathGiri = findGraphPath(canonicalLayout.edges, shanmuga!.id, giri!.id);
    assert(pathGiri.nodeIds.has(shanmuga!.id), 'Path contains source (Shanmuga)');
    assert(pathGiri.nodeIds.has(giri!.id), 'Path reaches uncle (Giri)');
    assert(pathGiri.edgeIds.size >= 2, 'Nephew-uncle path traverses parent/grandparent bridge');

    // Self-path
    const selfPath = findGraphPath(canonicalLayout.edges, shanmuga!.id, shanmuga!.id);
    assert(selfPath.nodeIds.size === 1 && selfPath.nodeIds.has(shanmuga!.id), 'Self path returns exactly 1 node');
    assert(selfPath.edgeIds.size === 0, 'Self path returns 0 edges');

    // Backend Kinship Service Integration test
    const kinship = await relativeService.calculateRelationshipBetween(shanmuga!.id, murthy!.id);
    assert(kinship.from_person.id === shanmuga!.id, 'Kinship response confirms from_person id');
    assert(kinship.to_person.id === murthy!.id, 'Kinship response confirms to_person id');
    assert(kinship.relationship.toLowerCase().includes('grandfather'), `Calculated kinship is Grandfather (got: ${kinship.relationship})`);
    assert(kinship.reverse_relationship.toLowerCase().includes('grandson'), `Calculated reverse kinship is Grandson (got: ${kinship.reverse_relationship})`);
  }

  // =========================================================================
  // Section 5: React Flow Adapter Path Highlighting & Visual Styling
  // =========================================================================
  console.log('\n--- Section 5: Path Visual Styling in React Flow Adapter ---');
  {
    const pathResult = findGraphPath(canonicalLayout.edges, shanmuga!.id, murthy!.id);

    const flowData = convertLayoutToReactFlow(canonicalLayout, {
      pathNodeIds: pathResult.nodeIds,
      pathEdgeIds: pathResult.edgeIds,
    });

    for (const nodeId of pathResult.nodeIds) {
      const node = flowData.nodes.find((n) => n.id === nodeId);
      assert(node?.data.isPathNode === true, `Path node ${nodeId} has isPathNode: true`);
    }

    const nonPathNode = flowData.nodes.find((n) => n.type === 'personCard' && !pathResult.nodeIds.has(n.id));
    assert(nonPathNode?.data.isPathNode === false, `Non-path node ${nonPathNode?.id} has isPathNode: false`);

    for (const edgeId of pathResult.edgeIds) {
      const edge = flowData.edges.find((e) => e.id === edgeId);
      assert(edge?.data?.isPathEdge === true, `Path edge ${edgeId} has isPathEdge: true`);
      assert(edge?.animated === true, `Path edge ${edgeId} has animated: true`);
      assert(edge?.style?.stroke === '#f59e0b', `Path edge ${edgeId} has amber stroke #f59e0b`);
    }
  }

  // =========================================================================
  // Section 6: Focus Mode (Isolation & Dimming)
  // =========================================================================
  console.log('\n--- Section 6: Focus Mode (Isolation & Dimming) ---');
  {
    const targetId = shanmuga!.id;
    const highlightedNodeIds = new Set<string>([targetId, jagannadham!.id]);
    const highlightedEdgeIds = new Set<string>();

    for (const e of canonicalLayout.edges) {
      if ((e.source === targetId && e.target === jagannadham!.id) ||
          (e.source === jagannadham!.id && e.target === targetId)) {
        highlightedEdgeIds.add(e.id);
      }
    }

    // 6a. Focus Mode Enabled
    const focusedFlow = convertLayoutToReactFlow(canonicalLayout, {
      selectedNodeId: targetId,
      highlightedNodeIds,
      highlightedEdgeIds,
      focusMode: true,
    });

    const focusedNode = focusedFlow.nodes.find((n) => n.id === targetId);
    assert(focusedNode?.data.isDimmed === false, 'Focal node is not dimmed');
    assert(focusedNode?.style?.opacity === 1, 'Focal node has full opacity (1)');

    const neighborNode = focusedFlow.nodes.find((n) => n.id === jagannadham!.id);
    assert(neighborNode?.data.isDimmed === false, 'Highlighted family node is not dimmed');
    assert(neighborNode?.style?.opacity === 1, 'Highlighted family node has full opacity (1)');

    const unrelatedNode = focusedFlow.nodes.find(
      (n) => n.type === 'personCard' && !highlightedNodeIds.has(n.id)
    );
    assert(!!unrelatedNode, 'Found unrelated node outside focal set');
    assert(unrelatedNode?.data.isDimmed === true, `Unrelated node ${unrelatedNode?.id} is dimmed`);
    assert(unrelatedNode?.style?.opacity === 0.2, 'Unrelated node has dimmed opacity (0.2)');

    // 6b. Focus Mode Disabled
    const normalFlow = convertLayoutToReactFlow(canonicalLayout, {
      selectedNodeId: targetId,
      highlightedNodeIds,
      highlightedEdgeIds,
      focusMode: false,
    });

    const normalUnrelated = normalFlow.nodes.find((n) => n.id === unrelatedNode?.id);
    assert(normalUnrelated?.data.isDimmed === false, 'With focusMode off, unrelated node is not dimmed');
    assert(normalUnrelated?.style?.opacity === 1, 'With focusMode off, unrelated node has opacity 1');
  }

  // =========================================================================
  // Section 7: Navigation History Stack Logic
  // =========================================================================
  console.log('\n--- Section 7: Navigation History Stack Logic ---');
  {
    // Simulate navigation: P1 -> P2 -> P3
    let history: string[] = [];
    let historyIndex = -1;

    function navigateTo(id: string) {
      history = history.slice(0, historyIndex + 1);
      history.push(id);
      historyIndex = history.length - 1;
    }

    navigateTo('id-1');
    assert(history.length === 1 && historyIndex === 0, 'First navigation pushes to stack (idx 0)');
    assert(historyIndex === 0, 'Cannot go back at initial step');

    navigateTo('id-2');
    navigateTo('id-3');
    assert(history.length === 3 && historyIndex === 2, 'Stack has 3 entries at index 2');

    // Go back
    historyIndex--;
    assert(history[historyIndex] === 'id-2', 'Back navigation returns to id-2');

    historyIndex--;
    assert(history[historyIndex] === 'id-1', 'Back navigation returns to id-1');

    // Go forward
    historyIndex++;
    assert(history[historyIndex] === 'id-2', 'Forward navigation returns to id-2');

    // Branching: navigate to id-4 while at id-2 (should drop id-3)
    navigateTo('id-4');
    assert(history.length === 3, 'Branching navigation truncates old forward history');
    assert(history[2] === 'id-4', 'Top of stack is now id-4');
    assert(historyIndex === 2, 'History index points to top');
  }

  // =========================================================================
  // Section 8: Deep-Linking URL State Simulation
  // =========================================================================
  console.log('\n--- Section 8: Deep-Linking URL State Simulation ---');
  {
    const url = new URL('http://localhost:5173/tree?personId=00000000-0000-4000-8000-000000000001');
    const personId = url.searchParams.get('personId');
    assert(personId === '00000000-0000-4000-8000-000000000001', 'Parsed personId correctly from URL');

    const pathfinderUrl = new URL(
      'http://localhost:5173/tree?fromId=00000000-0000-4000-8000-000000000001&toId=00000000-0000-4000-8000-000000000002'
    );
    assert(pathfinderUrl.searchParams.get('fromId') === '00000000-0000-4000-8000-000000000001', 'Parsed fromId correctly');
    assert(pathfinderUrl.searchParams.get('toId') === '00000000-0000-4000-8000-000000000002', 'Parsed toId correctly');
  }

  // =========================================================================
  // Section 9: Data Immutability Guarantee
  // =========================================================================
  console.log('\n--- Section 9: Canonical Data Immutability ---');
  {
    const personsFile = path.resolve(process.cwd(), 'data/persons.json');
    const relationshipsFile = path.resolve(process.cwd(), 'data/relationships.json');

    const personsData = JSON.parse(fs.readFileSync(personsFile, 'utf-8'));
    const relationshipsData = JSON.parse(fs.readFileSync(relationshipsFile, 'utf-8'));

    const persons = Array.isArray(personsData) ? personsData : personsData.persons;
    const relationships = Array.isArray(relationshipsData) ? relationshipsData : relationshipsData.relationships;

    assert(Array.isArray(persons) && persons.length === 20, `Original 20 persons preserved (actual: ${persons?.length})`);
    assert(
      Array.isArray(relationships) && relationships.length === 31,
      `Original 31 relationships preserved (actual: ${relationships?.length})`
    );
  }

  console.log(`\n======================================================`);
  console.log(`Milestone 3.5 Test Suite: ${passed}/${total} assertions passed!`);
  console.log(`======================================================\n`);

  return { passed, total };
}

// Direct execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('test_interaction_and_navigation')) {
  runInteractionAndNavigationTests().catch((err) => {
    console.error('Test run failed:', err);
    process.exit(1);
  });
}
