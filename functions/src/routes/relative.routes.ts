import { Router } from 'express';
import { RelativeController } from '../controllers/relative.controller';

export function createRelativeRoutes(relativeController = new RelativeController()): Router {
  const router = Router({ mergeParams: true });

  router.get('/', relativeController.getRelatives);
  router.get('/:id/relatives', relativeController.getRelatives);
  router.get('/:id/relationship-to/:targetId', relativeController.getRelationshipBetween);

  return router;
}

export const relativeRoutes = createRelativeRoutes();
