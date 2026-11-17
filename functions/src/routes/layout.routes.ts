import { Router } from 'express';
import { LayoutController } from '../controllers/layout.controller';

export function createLayoutRoutes(layoutController = new LayoutController()): Router {
  const router = Router();

  router.get('/', layoutController.getLayout);

  return router;
}

export const layoutRoutes = createLayoutRoutes();
