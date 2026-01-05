import type { Express } from "express";
import { storage } from "../storage";

export function registerPlantsRoutes(app: Express): void {
  /**
   * @swagger
   * /api/plants:
   *   get:
   *     summary: Get All Plants
   *     description: Retrieve a list of all available plants that can be grown by farmers
   *     tags: [Plants]
   *     responses:
   *       200:
   *         description: List of plants retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     example: "plant-123"
   *                   name:
   *                     type: string
   *                     example: "Tomato"
   *                   description:
   *                     type: string
   *                     example: "Nutritious red fruit, great for cooking"
   *                   category:
   *                     type: string
   *                     example: "vegetables"
   *                   growthDuration:
   *                     type: string
   *                     example: "3-4 months"
   *                   isActive:
   *                     type: boolean
   *                     example: true
   *                   createdAt:
   *                     type: string
   *                     format: date-time
   */
  app.get('/api/plants', async (req, res, next) => {
    try {
      const plants = await storage.getPlants();
      res.json(plants);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/plants/{plantId}/questions:
   *   get:
   *     summary: Get Questions for a Plant
   *     description: Retrieve all questions and options for a specific plant
   *     tags: [Plants]
   *     parameters:
   *       - in: path
   *         name: plantId
   *         required: true
   *         schema:
   *           type: string
   *         description: Plant ID
   *         example: "plant-123"
   *     responses:
   *       200:
   *         description: Plant questions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     example: "question-456"
   *                   plantId:
   *                     type: string
   *                     example: "plant-123"
   *                   question:
   *                     type: string
   *                     example: "How do you process your tomatoes after harvest?"
   *                   questionType:
   *                     type: string
   *                     enum: [multiple_choice, checkbox, text]
   *                     example: "checkbox"
   *                   options:
   *                     type: array
   *                     items:
   *                       type: object
   *                       properties:
   *                         value:
   *                           type: string
   *                           example: "drying"
   *                         label:
   *                           type: string
   *                           example: "Sun drying"
   *                   isRequired:
   *                     type: boolean
   *                     example: true
   *                   category:
   *                     type: string
   *                     example: "processing"
   *                   orderIndex:
   *                     type: number
   *                     example: 1
   *       404:
   *         description: Plant not found
   */
  app.get('/api/plants/:plantId/questions', async (req, res, next) => {
    try {
      const { plantId } = req.params;
      
      const plant = await storage.getPlant(plantId);
      if (!plant) {
        return res.status(404).json({ message: 'Plant not found' });
      }

      const questions = await storage.getPlantQuestions(plantId);
      res.json(questions);
    } catch (error) {
      next(error);
    }
  });
}
