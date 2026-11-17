import { FamilyGraph, FamilyGraphNode } from '../graph/graph.types';
import { GraphService } from '../graph/graph.service';
import { GenerationService } from '../generations/generation.service';
import {
  PositionedNode,
  PositionedEdge,
  CohortLane,
  FamilyLayout,
} from './layout.types';
import { LayoutConfig, mergeLayoutConfig } from './layout.config';
import { validateFamilyLayout } from './layout.validator';

interface LayoutUnit {
  id: string;
  nodes: FamilyGraphNode[];
  width: number;
  x: number;
  desiredX: number;
}

export class LayoutService {
  private graphService: GraphService;
  private generationService: GenerationService;

  constructor(graphService?: GraphService, generationService?: GenerationService) {
    this.graphService = graphService || new GraphService();
    this.generationService = generationService || new GenerationService();
  }

  /**
   * Calculates deterministic coordinates and cohort lanes for a given FamilyGraph.
   *
   * Core Guarantees:
   * 1. Fixed Y coordinate per birth-cohort generation.
   * 2. Dedicated lane for unknown birth dates.
   * 3. Zero bounding box overlaps between person cards.
   * 4. Multi-parent and multi-spouse support without data loss.
   * 5. 100% preservation of all nodes and valid edges.
   * 6. Strictly deterministic coordinates for identical graph inputs.
   */
  calculateLayout(graph: FamilyGraph, customConfig?: Partial<LayoutConfig>): FamilyLayout {
    const config = mergeLayoutConfig(customConfig);

    if (!graph || !graph.nodes) {
      return {
        nodes: [],
        edges: [],
        lanes: [],
        width: config.minCanvasWidth,
        height: config.minCanvasHeight,
        metadata: {
          totalNodes: 0,
          totalEdges: 0,
          totalLanes: 0,
          width: config.minCanvasWidth,
          height: config.minCanvasHeight,
          calculatedAt: new Date().toISOString(),
        },
      };
    }

    // 1. Group nodes by generationOrder (null for unknown birth date)
    const cohortNodesMap = new Map<number | null, FamilyGraphNode[]>();
    for (const node of graph.nodes) {
      const order = node.generationOrder !== null && Number.isInteger(node.generationOrder)
        ? node.generationOrder
        : null;
      if (!cohortNodesMap.has(order)) {
        cohortNodesMap.set(order, []);
      }
      cohortNodesMap.get(order)!.push(node);
    }

    // 2. Build ordered lane list
    const standardDefs = this.generationService.getGenerationDefinitions();
    const laneDefinitions: Array<{
      id: string;
      name: string;
      order: number | null;
      startYear?: number;
      endYear?: number;
      backgroundColor?: string;
      textColor?: string;
    }> = [];

    if (config.compactLanes) {
      // Only include non-empty cohorts
      const existingOrders = Array.from(cohortNodesMap.keys());
      const knownOrders = existingOrders.filter((o): o is number => o !== null).sort((a, b) => a - b);
      for (const order of knownOrders) {
        const def = standardDefs.find((d) => d.order === order);
        laneDefinitions.push({
          id: def?.id || `gen_order_${order}`,
          name: def?.name || `Generation (Order ${order})`,
          order,
          startYear: def?.startYear,
          endYear: def?.endYear,
          backgroundColor: def?.backgroundColor,
          textColor: def?.textColor,
        });
      }
      if (cohortNodesMap.has(null)) {
        const unknownLane = {
          id: 'unknown_birth_year',
          name: 'Birth Year Unknown',
          order: null,
          backgroundColor: '#64748b',
          textColor: '#ffffff',
        };
        if (config.unknownLanePlacement === 'top') {
          laneDefinitions.unshift(unknownLane);
        } else {
          laneDefinitions.push(unknownLane);
        }
      }
    } else {
      // Standard fixed slots for all defined generations
      for (const def of standardDefs) {
        laneDefinitions.push({
          id: def.id,
          name: def.name,
          order: def.order,
          startYear: def.startYear,
          endYear: def.endYear,
          backgroundColor: def.backgroundColor,
          textColor: def.textColor,
        });
      }
      const unknownLane = {
        id: 'unknown_birth_year',
        name: 'Birth Year Unknown',
        order: null,
        backgroundColor: '#64748b',
        textColor: '#ffffff',
      };
      if (config.unknownLanePlacement === 'top') {
        laneDefinitions.unshift(unknownLane);
      } else {
        laneDefinitions.push(unknownLane);
      }
    }

    // Assign fixed Y coordinates to each lane
    const lanes: CohortLane[] = [];
    const laneYMap = new Map<number | null, { laneY: number; nodeY: number; lane: CohortLane }>();

    let currentLaneY = config.laneMarginY;
    for (const lDef of laneDefinitions) {
      const nodeCount = (cohortNodesMap.get(lDef.order) || []).length;
      const lane: CohortLane = {
        id: lDef.id,
        name: lDef.name,
        order: lDef.order,
        y: currentLaneY,
        height: config.laneHeight,
        nodeCount,
        startYear: lDef.startYear,
        endYear: lDef.endYear,
        backgroundColor: lDef.backgroundColor,
        textColor: lDef.textColor,
      };

      const nodeY = currentLaneY + (config.laneHeight - config.nodeHeight) / 2;
      laneYMap.set(lDef.order, { laneY: currentLaneY, nodeY, lane });
      lanes.push(lane);

      currentLaneY += config.laneHeight + config.laneGap;
    }

    // 3. Adjacency maps for barycenter alignment
    const parentIdsByChild = new Map<string, string[]>();
    const childIdsByParent = new Map<string, string[]>();
    const sameCohortSpousesByNode = new Map<string, string[]>();

    const nodeCohortMap = new Map<string, number | null>();
    for (const node of graph.nodes) {
      nodeCohortMap.set(node.id, node.generationOrder ?? null);
    }

    for (const edge of graph.edges) {
      if (edge.type === 'parent_child') {
        // source is parent, target is child
        if (!parentIdsByChild.has(edge.target)) parentIdsByChild.set(edge.target, []);
        parentIdsByChild.get(edge.target)!.push(edge.source);

        if (!childIdsByParent.has(edge.source)) childIdsByParent.set(edge.source, []);
        childIdsByParent.get(edge.source)!.push(edge.target);
      } else if (edge.type === 'spouse') {
        const c1 = nodeCohortMap.get(edge.source);
        const c2 = nodeCohortMap.get(edge.target);
        if (c1 === c2) {
          if (!sameCohortSpousesByNode.has(edge.source)) sameCohortSpousesByNode.set(edge.source, []);
          sameCohortSpousesByNode.get(edge.source)!.push(edge.target);

          if (!sameCohortSpousesByNode.has(edge.target)) sameCohortSpousesByNode.set(edge.target, []);
          sameCohortSpousesByNode.get(edge.target)!.push(edge.source);
        }
      }
    }

    // 4. Form LayoutUnits (grouping same-cohort spouses together)
    const laneUnitsMap = new Map<number | null, LayoutUnit[]>();

    for (const [order, nodesInCohort] of cohortNodesMap.entries()) {
      const visited = new Set<string>();
      const units: LayoutUnit[] = [];

      // Sort nodes in cohort deterministically prior to grouping
      const sortedCohortNodes = [...nodesInCohort].sort((a, b) => {
        if (a.birthYear !== null && b.birthYear !== null && a.birthYear !== b.birthYear) {
          return a.birthYear - b.birthYear;
        }
        return a.id.localeCompare(b.id);
      });

      for (const node of sortedCohortNodes) {
        if (visited.has(node.id)) continue;

        // BFS/cluster same-cohort spouses
        const unitNodes: FamilyGraphNode[] = [];
        const queue = [node];
        visited.add(node.id);

        while (queue.length > 0) {
          const current = queue.shift()!;
          unitNodes.push(current);

          const spouses = sameCohortSpousesByNode.get(current.id) || [];
          for (const spId of spouses) {
            if (!visited.has(spId)) {
              visited.add(spId);
              const spNode = sortedCohortNodes.find((n) => n.id === spId);
              if (spNode) {
                queue.push(spNode);
              }
            }
          }
        }

        const width =
          unitNodes.length * config.nodeWidth +
          Math.max(0, unitNodes.length - 1) * config.spouseSpacing;

        units.push({
          id: `unit_${unitNodes.map((n) => n.id).join('_')}`,
          nodes: unitNodes,
          width,
          x: config.laneMarginX,
          desiredX: config.laneMarginX,
        });
      }

      laneUnitsMap.set(order, units);
    }

    // Helper map of current positioned node centers for barycenter alignment
    const nodeCenterMap = new Map<string, number>();

    const updateNodeCenters = (units: LayoutUnit[]) => {
      for (const u of units) {
        let offsetX = u.x;
        for (const n of u.nodes) {
          nodeCenterMap.set(n.id, offsetX + config.nodeWidth / 2);
          offsetX += config.nodeWidth + config.spouseSpacing;
        }
      }
    };

    // Helper to position units in a lane left-to-right without overlap
    const positionUnitsInLane = (units: LayoutUnit[]) => {
      let currentX = config.laneMarginX;
      for (const u of units) {
        u.x = Math.max(u.desiredX, currentX);
        currentX = u.x + u.width + config.horizontalSpacing;
      }
      updateNodeCenters(units);
    };

    // Initial placement pass
    for (const laneDef of laneDefinitions) {
      const units = laneUnitsMap.get(laneDef.order);
      if (!units || units.length === 0) continue;
      positionUnitsInLane(units);
    }

    // 5. Multi-Pass Barycenter Refinement
    // Pass A: Top-Down (align children under parents)
    for (const laneDef of laneDefinitions) {
      const units = laneUnitsMap.get(laneDef.order);
      if (!units || units.length === 0) continue;

      for (const u of units) {
        let parentCenterSum = 0;
        let parentCount = 0;

        for (const n of u.nodes) {
          const parents = parentIdsByChild.get(n.id) || [];
          for (const pId of parents) {
            if (nodeCenterMap.has(pId)) {
              parentCenterSum += nodeCenterMap.get(pId)!;
              parentCount++;
            }
          }
        }

        if (parentCount > 0) {
          const avgParentCenter = parentCenterSum / parentCount;
          u.desiredX = avgParentCenter - u.width / 2;
        }
      }

      // Sort units by desiredX with deterministic tie-breaker
      units.sort((a, b) => {
        if (Math.abs(a.desiredX - b.desiredX) > 0.001) {
          return a.desiredX - b.desiredX;
        }
        return a.id.localeCompare(b.id);
      });

      positionUnitsInLane(units);
    }

    // Pass B: Bottom-Up (align parents above children)
    for (let i = laneDefinitions.length - 1; i >= 0; i--) {
      const laneDef = laneDefinitions[i];
      const units = laneUnitsMap.get(laneDef.order);
      if (!units || units.length === 0) continue;

      for (const u of units) {
        let childCenterSum = 0;
        let childCount = 0;

        for (const n of u.nodes) {
          const children = childIdsByParent.get(n.id) || [];
          for (const cId of children) {
            if (nodeCenterMap.has(cId)) {
              childCenterSum += nodeCenterMap.get(cId)!;
              childCount++;
            }
          }
        }

        if (childCount > 0) {
          const avgChildCenter = childCenterSum / childCount;
          u.desiredX = avgChildCenter - u.width / 2;
        }
      }

      units.sort((a, b) => {
        if (Math.abs(a.desiredX - b.desiredX) > 0.001) {
          return a.desiredX - b.desiredX;
        }
        return a.id.localeCompare(b.id);
      });

      positionUnitsInLane(units);
    }

    // Pass C: Final Top-Down normalization to lock coordinates
    for (const laneDef of laneDefinitions) {
      const units = laneUnitsMap.get(laneDef.order);
      if (!units || units.length === 0) continue;

      for (const u of units) {
        let parentCenterSum = 0;
        let parentCount = 0;

        for (const n of u.nodes) {
          const parents = parentIdsByChild.get(n.id) || [];
          for (const pId of parents) {
            if (nodeCenterMap.has(pId)) {
              parentCenterSum += nodeCenterMap.get(pId)!;
              parentCount++;
            }
          }
        }

        if (parentCount > 0) {
          const avgParentCenter = parentCenterSum / parentCount;
          u.desiredX = avgParentCenter - u.width / 2;
        }
      }

      units.sort((a, b) => {
        if (Math.abs(a.desiredX - b.desiredX) > 0.001) {
          return a.desiredX - b.desiredX;
        }
        return a.id.localeCompare(b.id);
      });

      positionUnitsInLane(units);
    }

    // 6. Build Positioned Nodes & Edges
    const positionedNodes: PositionedNode[] = [];
    let maxLayoutX = 0;
    let maxLayoutY = 0;

    for (const [order, units] of laneUnitsMap.entries()) {
      const laneInfo = laneYMap.get(order);
      if (!laneInfo) continue;

      for (const u of units) {
        let nodeX = u.x;
        for (const n of u.nodes) {
          const pNode: PositionedNode = {
            id: n.id,
            x: Math.round(nodeX),
            y: Math.round(laneInfo.nodeY),
            width: config.nodeWidth,
            height: config.nodeHeight,
            generationId: n.generationId,
            generationOrder: n.generationOrder,

            // Metadata carried over from FamilyGraphNode
            personId: n.personId,
            firstName: n.firstName,
            middleName: n.middleName,
            lastName: n.lastName,
            birthDate: n.birthDate,
            birthYear: n.birthYear,
            generationName: n.generationName,
            photoPath: n.photoPath,
            isLiving: n.isLiving,
            isArchived: n.isArchived,
          };

          positionedNodes.push(pNode);

          maxLayoutX = Math.max(maxLayoutX, pNode.x + pNode.width);
          maxLayoutY = Math.max(maxLayoutY, pNode.y + pNode.height);

          nodeX += config.nodeWidth + config.spouseSpacing;
        }
      }
    }

    // Map positioned edges 1:1 preserving every valid edge
    const positionedEdges: PositionedEdge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      parentType: e.parentType,
    }));

    // Deterministic sort of output nodes and edges
    positionedNodes.sort((a, b) => a.id.localeCompare(b.id));
    positionedEdges.sort((a, b) => a.id.localeCompare(b.id));

    const totalWidth = Math.max(config.minCanvasWidth, maxLayoutX + config.laneMarginX);
    const totalHeight = Math.max(
      config.minCanvasHeight,
      currentLaneY - config.laneGap + config.laneMarginY
    );

    const layout: FamilyLayout = {
      nodes: positionedNodes,
      edges: positionedEdges,
      lanes,
      width: totalWidth,
      height: totalHeight,
      metadata: {
        totalNodes: positionedNodes.length,
        totalEdges: positionedEdges.length,
        totalLanes: lanes.length,
        width: totalWidth,
        height: totalHeight,
        calculatedAt: new Date().toISOString(),
      },
    };

    // Validate layout before returning
    validateFamilyLayout(layout);

    return layout;
  }

  /**
   * Builds the graph from repository data and returns its calculated layout.
   */
  async getFamilyLayout(
    buildOptions?: Parameters<GraphService['buildFamilyGraph']>[0],
    customConfig?: Partial<LayoutConfig>
  ): Promise<FamilyLayout> {
    const graph = await this.graphService.buildFamilyGraph(buildOptions);
    return this.calculateLayout(graph, customConfig);
  }
}
