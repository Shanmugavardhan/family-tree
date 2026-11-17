import { Request, Response, NextFunction } from 'express';
import { PhotoService } from '../services/photo.service';
import { AppError } from '../services/errors';

export class PhotoController {
  private photoService: PhotoService;

  constructor(photoService?: PhotoService) {
    this.photoService = photoService || new PhotoService();
  }

  uploadPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      if (!req.file || !req.file.buffer) {
        res.status(400).json({
          success: false,
          data: null,
          error: {
            code: 'NO_FILE_UPLOADED',
            message: 'No photograph file was provided. Please upload an image with field name "photo".',
          },
        });
        return;
      }

      const result = await this.photoService.uploadPersonPhoto(id, req.file.buffer);
      res.status(200).json({
        success: true,
        data: result,
        error: null,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          success: false,
          data: null,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        });
        return;
      }
      next(err);
    }
  };

  getPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const includeArchived = req.query.includeArchived === 'true';

      const fileData = await this.photoService.getPersonPhoto(id, { includeArchived });
      res.setHeader('Content-Type', fileData.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(fileData.buffer);
    } catch (err: any) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          success: false,
          data: null,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        });
        return;
      }
      next(err);
    }
  };

  deletePhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.photoService.deletePersonPhoto(id);
      res.status(200).json({
        success: true,
        data: result,
        error: null,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          success: false,
          data: null,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        });
        return;
      }
      next(err);
    }
  };
}

