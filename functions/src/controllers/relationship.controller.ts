import { Request, Response, NextFunction } from 'express';
import { RelationshipService } from '../services/relationship.service';
import { AppError } from '../services/errors';

export class RelationshipController {
  private relationshipService: RelationshipService;

  constructor(relationshipService?: RelationshipService) {
    this.relationshipService = relationshipService || new RelationshipService();
  }

  createRelationship = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const relationship = await this.relationshipService.createRelationship(req.body);
      res.status(201).json({
        success: true,
        data: relationship,
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

  getAllRelationships = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const personId = typeof req.query.personId === 'string' ? req.query.personId : undefined;
      const relationshipType =
        typeof req.query.relationshipType === 'string' ? req.query.relationshipType : undefined;

      const relationships = await this.relationshipService.getAllRelationships({
        personId,
        relationshipType,
      });

      res.status(200).json({
        success: true,
        data: relationships,
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

  getRelationshipById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const relationship = await this.relationshipService.getRelationshipById(id);
      res.status(200).json({
        success: true,
        data: relationship,
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

  updateRelationship = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const relationship = await this.relationshipService.updateRelationship(id, req.body);
      res.status(200).json({
        success: true,
        data: relationship,
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

  deleteRelationship = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await this.relationshipService.deleteRelationship(id);
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

