import { Router } from 'express';
import { GraphController } from '../controllers/graph.controller';

export function createGraphRoutes(graphController = new GraphController()): Router {
  const router = Router();

  router.get('/', graphController.getGraph);
  router.get('/nodes/:personId', graphController.getNode);

  return router;
}

export const graphRoutes = createGraphRoutes();
