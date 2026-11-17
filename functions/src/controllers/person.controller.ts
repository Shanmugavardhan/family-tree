import { Request, Response, NextFunction } from 'express';
import { PersonService } from '../services/person.service';
import { AppError } from '../services/errors';

export class PersonController {
  private personService: PersonService;

  constructor(personService?: PersonService) {
    this.personService = personService || new PersonService();
  }

  createPerson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const person = await this.personService.createPerson(req.body);
      res.status(201).json({
        success: true,
        data: person,
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

  getAllPersons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;

      const persons = await this.personService.getAllPersons({ includeArchived, search });
      res.status(200).json({
        success: true,
        data: persons,
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

  getPersonById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const includeArchived = req.query.includeArchived === 'true';

      const person = await this.personService.getPersonById(id, { includeArchived });
      res.status(200).json({
        success: true,
        data: person,
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

  updatePerson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const person = await this.personService.updatePerson(id, req.body);
      res.status(200).json({
        success: true,
        data: person,
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

  archivePerson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const person = await this.personService.archivePerson(id);
      res.status(200).json({
        success: true,
        data: person,
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

  restorePerson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const person = await this.personService.restorePerson(id);
      res.status(200).json({
        success: true,
        data: person,
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
