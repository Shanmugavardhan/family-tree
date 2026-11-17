import { Request, Response, NextFunction } from 'express';
import { RelativeService } from '../services/relative.service';
import { RelativeCategory } from '../types/relative';
import { AppError } from '../services/errors';

const VALID_CATEGORIES: Set<string> = new Set([
  'parents',
  'children',
  'spouses',
  'siblings',
  'grandparents',
  'grandchildren',
  'great_grandparents',
  'uncles_aunts',
  'nephews_nieces',
  'cousins',
  'first_cousins_once_removed',
  'in_laws',
  'all',
]);

export class RelativeController {
  private relativeService: RelativeService;

  constructor(relativeService?: RelativeService) {
    this.relativeService = relativeService || new RelativeService();
  }

  getRelatives = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const rawType = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : 'all';

      if (!VALID_CATEGORIES.has(rawType)) {
        res.status(400).json({
          success: false,
          data: null,
          error: {
            code: 'INVALID_CATEGORY_FILTER',
            message: `Invalid type filter "${rawType}". Allowed types: parents, children, spouses, siblings, grandparents, grandchildren, great_grandparents, uncles_aunts, nephews_nieces, cousins, first_cousins_once_removed, in_laws, all`,
          },
        });
        return;
      }

      const type = rawType as RelativeCategory | 'all';
      const includeArchived = req.query.includeArchived === 'true';

      const result = await this.relativeService.getDerivedRelatives(id, { type, includeArchived });

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

  getRelationshipBetween = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const targetId = String(req.params.targetId);

      const result = await this.relativeService.calculateRelationshipBetween(id, targetId);

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
