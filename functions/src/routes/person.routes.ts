import { Router } from 'express';
import { PersonController } from '../controllers/person.controller';
import { RelativeController } from '../controllers/relative.controller';
import { PhotoController } from '../controllers/photo.controller';
import { createPhotoRoutes } from './photo.routes';

export function createPersonRoutes(
  personController = new PersonController(),
  relativeController = new RelativeController(),
  photoController = new PhotoController()
): Router {
  const router = Router();

  router.post('/', personController.createPerson);
  router.get('/', personController.getAllPersons);

  // Photo management routes (Milestone 2.7)
  router.use('/:id/photo', createPhotoRoutes(photoController));

  // Relative derivation routes (Milestone 2.6)
  router.get('/:id/relatives', relativeController.getRelatives);
  router.get('/:id/relationship-to/:targetId', relativeController.getRelationshipBetween);

  // Person CRUD routes (Milestone 2.4)
  router.get('/:id', personController.getPersonById);
  router.patch('/:id', personController.updatePerson);
  router.post('/:id/archive', personController.archivePerson);
  router.post('/:id/restore', personController.restorePerson);

  return router;
}

export const personRoutes = createPersonRoutes();
