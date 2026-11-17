import { runGraphTransformationTests } from '../graph/graph.test';

runGraphTransformationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
