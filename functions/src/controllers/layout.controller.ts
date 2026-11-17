import { Request, Response, NextFunction } from 'express';
import { LayoutService } from '../layout/layout.service';
import { AppError } from '../services/errors';

export class LayoutController {
  private layoutService: LayoutService;

  constructor(layoutService?: LayoutService) {
    this.layoutService = layoutService || new LayoutService();
  }

  getLayout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const compactLanes = req.query.compactLanes === 'true';

      const customConfig: Record<string, any> = {};
      if (req.query.compactLanes !== undefined) {
        customConfig.compactLanes = compactLanes;
      }
      if (typeof req.query.nodeWidth === 'string') {
        const w = parseInt(req.query.nodeWidth, 10);
        if (!isNaN(w) && w > 0) customConfig.nodeWidth = w;
      }
      if (typeof req.query.nodeHeight === 'string') {
        const h = parseInt(req.query.nodeHeight, 10);
        if (!isNaN(h) && h > 0) customConfig.nodeHeight = h;
      }
      if (typeof req.query.horizontalSpacing === 'string') {
        const s = parseInt(req.query.horizontalSpacing, 10);
        if (!isNaN(s) && s > 0) customConfig.horizontalSpacing = s;
      }

      const layout = await this.layoutService.getFamilyLayout(
        { includeArchived },
        customConfig
      );

      res.status(200).json({
        success: true,
        data: layout,
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

