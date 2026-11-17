import { Request, Response, NextFunction } from 'express';
import { GraphService } from '../graph/graph.service';
import { AppError, NotFoundError } from '../services/errors';

export class GraphController {
  private graphService: GraphService;

  constructor(graphService?: GraphService) {
    this.graphService = graphService || new GraphService();
  }

  getGraph = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const graph = await this.graphService.buildFamilyGraph({ includeArchived });

      res.status(200).json({
        success: true,
        data: graph,
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

  getNode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const personId = String(req.params.personId);
      const includeArchived = req.query.includeArchived === 'true';

      const node = await this.graphService.getFamilyGraphNode(personId, { includeArchived });
      if (!node) {
        throw new NotFoundError('PERSON_NOT_FOUND', `Graph node for person with ID "${personId}" was not found.`);
      }

      res.status(200).json({
        success: true,
        data: node,
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
