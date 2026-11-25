const fs = require('fs');
const path = require('path');
const { GraphService } = require('../functions/lib/graph/graph.service.js');
const { LayoutService } = require('../functions/lib/layout/layout.service.js');
const { RelativeService } = require('../functions/lib/services/relative.service.js');
const { LocalJsonFamilyRepository } = require('../functions/lib/repositories/local-json.repository.js');

async function main() {
  const repo = new LocalJsonFamilyRepository();
  const graphService = new GraphService(repo);
  const layoutService = new LayoutService();
  const relativeService = new RelativeService(repo);

  const publicDataDir = path.resolve(__dirname, '../public/data');
  fs.mkdirSync(publicDataDir, { recursive: true });

  // 1. Pre-calculate deterministic layouts for both lineages (full timeline, with kinship generation inference enabled)
  const konuGraph = await graphService.buildFamilyGraph({ lineage: 'konukuru' });
  const konuLayout = layoutService.calculateLayout(konuGraph, { compactLanes: false, inferGenerations: true });
  fs.writeFileSync(path.join(publicDataDir, 'layout-konukuru.json'), JSON.stringify(konuLayout, null, 2));

  const paraGraph = await graphService.buildFamilyGraph({ lineage: 'paradarami' });
  const paraLayout = layoutService.calculateLayout(paraGraph, { compactLanes: false, inferGenerations: true });
  fs.writeFileSync(path.join(publicDataDir, 'layout-paradarami.json'), JSON.stringify(paraLayout, null, 2));

  // 2. Export canonical persons and relationships
  const persons = await repo.getAllPersons(true);
  fs.writeFileSync(path.join(publicDataDir, 'persons.json'), JSON.stringify({ persons }, null, 2));

  const relationships = await repo.getAllRelationships();
  fs.writeFileSync(path.join(publicDataDir, 'relationships.json'), JSON.stringify({ relationships }, null, 2));

  // 3. Pre-calculate relative derivations for all persons
  const relativesMap = {};
  for (const p of persons) {
    const derived = await relativeService.getDerivedRelatives(p.id, { includeArchived: true });
    relativesMap[p.id] = derived;
  }
  fs.writeFileSync(path.join(publicDataDir, 'relatives.json'), JSON.stringify(relativesMap, null, 2));

  console.log('✓ Successfully generated all static assets in public/data');
}

main().catch((err) => {
  console.error('Failed to generate static data:', err);
  process.exit(1);
});
