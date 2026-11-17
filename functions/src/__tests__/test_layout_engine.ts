import { runLayoutEngineTests } from '../layout/layout.test';

runLayoutEngineTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
