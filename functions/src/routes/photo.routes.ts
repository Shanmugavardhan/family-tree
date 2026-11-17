import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PhotoController } from '../controllers/photo.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

function createUploadMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    upload.single('photo')(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            data: null,
            error: {
              code: 'OVERSIZED_IMAGE',
              message: 'File size exceeds the 5 MB limit.',
            },
          });
          return;
        }
        res.status(400).json({
          success: false,
          data: null,
          error: {
            code: 'UPLOAD_ERROR',
            message: err.message,
          },
        });
        return;
      } else if (err) {
        next(err);
        return;
      }
      next();
    });
  };
}

export function createPhotoRoutes(photoController = new PhotoController()): Router {
  const router = Router({ mergeParams: true });
  const uploadMiddleware = createUploadMiddleware();

  router.post('/', uploadMiddleware, photoController.uploadPhoto);
  router.get('/', photoController.getPhoto);
  router.delete('/', photoController.deletePhoto);

  return router;
}

export const photoRoutes = createPhotoRoutes();

