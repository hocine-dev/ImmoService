import { Router } from 'express';
import { questionController } from './question.controller.js';
import validate from '../../middlewares/validate.middleware.js';
import authMiddleware from '../../middlewares/auth.middleware.js';
import { createQuestionSchema } from './question.schema.js';


const routerQuest = Router();

// GET /api/questions/annonce/:annonceId - Lire les questions d'une annonce (Public)
routerQuest.get('/annonce/:annonceId', questionController.getByAnnonce);

// POST /api/questions - Poser une question (Privé - nécessite d'être connecté)
routerQuest.post(
  '/',
  authMiddleware(),
  validate(createQuestionSchema),
  questionController.create
);

// DELETE /api/questions/:id - Supprimer une question (Privé - IDOR protégé)
routerQuest.delete('/:id', authMiddleware(), questionController.delete);

export default routerQuest;