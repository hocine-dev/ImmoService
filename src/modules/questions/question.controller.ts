import { Request, Response, NextFunction } from 'express';
import { questionService } from './question.service.js';
import { AppError } from '../user/user.service.js';

export const questionController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const auteurId = req.user?.id;
       console.log(req.user) 
      if (!auteurId) {
        return res.status(401).json({ status: 'fail', code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' });
      }

      // req.validated contient les données nettoyées par le middleware Zod
      const question = await questionService.createQuestion({
        ...req.body,
        auteurId,
      });

      return res.status(201).json({
        status: 'success',
        message: 'Question posée avec succès',
        data: question,
      });
    } catch (error) {
      res.json(error)
    }
  },

  async getByAnnonce(req: Request, res: Response, next: NextFunction) {
    try {
      const  annonceId  = req.params.annonceId as string;
      if (!annonceId) {
      throw new AppError( "INTERNAL_ERROR", "L'ID de l'annonce est manquant");
    }
      const questions = await questionService.getQuestionsByAnnonce(annonceId);

      return res.status(200).json({
        status: 'success',
        data: questions,
      });
    } catch (error) {
      res.json(error);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const questionId = req.params.id as string;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({ status: 'fail', code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' });
      }

      const result = await questionService.deleteQuestion(questionId, userId, userRole);

      return res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error) {
      res.json(error);
    }
  },
};