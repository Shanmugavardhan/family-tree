import { Router } from 'express';
import { RelationshipController } from '../controllers/relationship.controller';

export function createRelationshipRoutes(
  relationshipController = new RelationshipController()
): Router {
  const router = Router();

  router.post('/', relationshipController.createRelationship);
  router.get('/', relationshipController.getAllRelationships);
  router.get('/:id', relationshipController.getRelationshipById);
  router.patch('/:id', relationshipController.updateRelationship);
  router.delete('/:id', relationshipController.deleteRelationship);

  return router;
}

export const relationshipRoutes = createRelationshipRoutes();

