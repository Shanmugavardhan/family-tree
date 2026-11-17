import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { personRoutes } from './routes/person.routes';
import { relationshipRoutes } from './routes/relationship.routes';
import { graphRoutes } from './routes/graph.routes';

export const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

// Health check endpoint for Milestone 2.1
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'family-tree-backend',
    },
    error: null,
  });
});

// Person Management routes (Milestone 2.4)
app.use('/api/persons', personRoutes);

// Relationship Management routes (Milestone 2.5)
app.use('/api/relationships', relationshipRoutes);

// Chronological Graph Transformation routes (Milestone 3.2)
app.use('/api/graph', graphRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected server error occurred.',
    },
  });
});
