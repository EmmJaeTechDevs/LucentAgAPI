import type { Express } from "express";
import { storage } from "../storage";
import { authenticateToken } from "../middleware/auth";
import { 
  insertFarmerPlantSchema,
  insertFarmerAnswerSchema,
  insertFarmerCropSchema,
  updateFarmerCropSchema
} from "@shared/schema";
import { z } from "zod";

export function registerFarmerRoutes(app: Express): void {
  /**
   * @swagger
   * /api/farmer/plants:
   *   get:
   *     summary: Get Farmer's Plants
   *     description: Retrieve all plants selected by the authenticated farmer
   *     tags: [Farmer Plants]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Farmer's plants retrieved successfully
   *       401:
   *         description: Unauthorized - token required
   */
  app.get('/api/farmer/plants', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      const farmerPlants = await storage.getFarmerPlants(user.id);
      res.json(farmerPlants);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/plants:
   *   post:
   *     summary: Add Plant to Farmer's Farm
   *     description: Add a plant to the authenticated farmer's farm with optional details
   *     tags: [Farmer Plants]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [plantId]
   *             properties:
   *               plantId:
   *                 type: string
   *                 description: ID of the plant to add
   *                 example: "plant-123"
   *               landSize:
   *                 type: string
   *                 description: Size of land dedicated to this plant
   *                 example: "2 acres"
   *               notes:
   *                 type: string
   *                 description: Additional notes about growing this plant
   *                 example: "Located in the north field, good soil quality"
   *     responses:
   *       201:
   *         description: Plant added successfully
   *       400:
   *         description: Validation error or plant already added
   *       401:
   *         description: Unauthorized - token required
   *       403:
   *         description: Only farmers can add plants
   *       404:
   *         description: Plant not found
   */
  app.post('/api/farmer/plants', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      const validatedData = insertFarmerPlantSchema.parse({
        ...req.body,
        farmerId: user.id
      });

      const plant = await storage.getPlant(validatedData.plantId);
      if (!plant) {
        return res.status(404).json({ message: 'Plant not found' });
      }

      const existingFarmerPlants = await storage.getFarmerPlants(user.id);
      const alreadyAdded = existingFarmerPlants.some(fp => fp.plantId === validatedData.plantId);
      
      if (alreadyAdded) {
        return res.status(400).json({ message: 'Plant already added to your farm' });
      }

      const farmerPlant = await storage.addFarmerPlant(validatedData);
      res.status(201).json({ 
        message: 'Plant added to your farm successfully',
        farmerPlant 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/plants/{plantId}:
   *   delete:
   *     summary: Remove Plant from Farmer's Farm
   *     description: Remove a plant from the authenticated farmer's farm
   *     tags: [Farmer Plants]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: plantId
   *         required: true
   *         schema:
   *           type: string
   *         description: Plant ID to remove
   *     responses:
   *       200:
   *         description: Plant removed successfully
   *       401:
   *         description: Unauthorized - token required
   *       403:
   *         description: Only farmers can remove plants
   *       404:
   *         description: Plant not found in farmer's collection
   */
  app.delete('/api/farmer/plants/:plantId', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { plantId } = req.params;
      
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      await storage.removeFarmerPlant(user.id, plantId);
      res.json({ message: 'Plant removed from your farm successfully' });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/answers:
   *   get:
   *     summary: Get Farmer's Answers
   *     description: Retrieve all answers provided by the authenticated farmer for plant questions
   *     tags: [Farmer Answers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: plantId
   *         schema:
   *           type: string
   *         description: Filter answers by plant ID (optional)
   *     responses:
   *       200:
   *         description: Farmer's answers retrieved successfully
   *       401:
   *         description: Unauthorized - token required
   */
  app.get('/api/farmer/answers', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { plantId } = req.query;
      
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      const answers = await storage.getFarmerAnswers(user.id, plantId as string);
      res.json(answers);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/answers:
   *   post:
   *     summary: Submit Plant Question Answers
   *     description: Submit or update answers for plant questions
   *     tags: [Farmer Answers]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [plantId, questionId, answer]
   *             properties:
   *               plantId:
   *                 type: string
   *                 description: ID of the plant the question relates to
   *                 example: "plant-123"
   *               questionId:
   *                 type: string
   *                 description: ID of the question being answered
   *                 example: "question-456"
   *               answer:
   *                 oneOf:
   *                   - type: string
   *                     description: Single answer for text or single-choice questions
   *                   - type: array
   *                     items:
   *                       type: string
   *                     description: Multiple answers for checkbox questions
   *               customAnswer:
   *                 type: string
   *                 description: Additional details for "Others" option
   *     responses:
   *       201:
   *         description: Answer submitted successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized - token required
   *       403:
   *         description: Only farmers can submit answers
   *       404:
   *         description: Plant or question not found
   */
  app.post('/api/farmer/answers', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      const validatedData = insertFarmerAnswerSchema.parse({
        ...req.body,
        farmerId: user.id
      });

      const farmerPlants = await storage.getFarmerPlants(user.id);
      const hasPlant = farmerPlants.some(fp => fp.plantId === validatedData.plantId);
      
      if (!hasPlant) {
        return res.status(404).json({ 
          message: 'Plant not found in your farm. Please add the plant first.' 
        });
      }

      const questions = await storage.getPlantQuestions(validatedData.plantId);
      const questionExists = questions.some(q => q.id === validatedData.questionId);
      
      if (!questionExists) {
        return res.status(404).json({ message: 'Question not found for this plant' });
      }

      const answer = await storage.createFarmerAnswer(validatedData);
      res.status(201).json({ 
        message: 'Answer submitted successfully',
        answer 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/plants/questions:
   *   post:
   *     summary: Get Questions for Selected Plants
   *     description: Submit an array of plant IDs and get back all questions for those plants
   *     tags: [Farmer Plants]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [plantIds]
   *             properties:
   *               plantIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of plant IDs to get questions for
   *                 example: ["plant-tomato", "plant-maize", "plant-cassava"]
   *     responses:
   *       200:
   *         description: Questions retrieved successfully
   *       400:
   *         description: Validation error or no plants provided
   *       401:
   *         description: Unauthorized - token required
   *       403:
   *         description: Only farmers can access this endpoint
   */
  app.post('/api/farmer/plants/questions', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      const { plantIds } = req.body;
      
      if (!Array.isArray(plantIds) || plantIds.length === 0) {
        return res.status(400).json({ message: 'plantIds must be a non-empty array' });
      }

      const questionsData = [];
      
      for (const plantId of plantIds) {
        const plant = await storage.getPlant(plantId);
        if (!plant) {
          continue;
        }
        
        const questions = await storage.getPlantQuestions(plantId);
        questionsData.push({
          plantId: plant.id,
          plantName: plant.name,
          questions: questions
        });
      }

      res.json({ questions: questionsData });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/answers/bulk:
   *   post:
   *     summary: Submit Multiple Answers at Once
   *     description: Submit answers for multiple questions across different plants in a single request
   *     tags: [Farmer Answers]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [answers]
   *             properties:
   *               answers:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required: [plantId, questionId, answer]
   *                   properties:
   *                     plantId:
   *                       type: string
   *                     questionId:
   *                       type: string
   *                     answer:
   *                       oneOf:
   *                         - type: string
   *                         - type: array
   *                           items:
   *                             type: string
   *                     customAnswer:
   *                       type: string
   *     responses:
   *       200:
   *         description: All answers submitted successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized - token required
   *       403:
   *         description: Only farmers can submit answers
   */
  app.post('/api/farmer/answers/bulk', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      const { answers } = req.body;
      
      if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ message: 'answers must be a non-empty array' });
      }

      const farmerPlants = await storage.getFarmerPlants(user.id);
      const farmerPlantIds = new Set(farmerPlants.map(fp => fp.plantId));

      const results: Array<{plantId: string; questionId: string; status: string; message?: string}> = [];
      let processedCount = 0;

      for (const answerData of answers) {
        try {
          const validatedData = insertFarmerAnswerSchema.parse({
            ...answerData,
            farmerId: user.id
          });

          if (!farmerPlantIds.has(validatedData.plantId)) {
            results.push({
              plantId: answerData.plantId,
              questionId: answerData.questionId,
              status: 'skipped',
              message: 'Plant not in farmer\'s collection'
            });
            continue;
          }

          const questions = await storage.getPlantQuestions(validatedData.plantId);
          const questionExists = questions.some(q => q.id === validatedData.questionId);
          
          if (!questionExists) {
            results.push({
              plantId: answerData.plantId,
              questionId: answerData.questionId,
              status: 'skipped',
              message: 'Question not found for this plant'
            });
            continue;
          }

          await storage.createFarmerAnswer(validatedData);
          results.push({
            plantId: answerData.plantId,
            questionId: answerData.questionId,
            status: 'success'
          });
          processedCount++;

        } catch (error) {
          results.push({
            plantId: answerData.plantId,
            questionId: answerData.questionId,
            status: 'error',
            message: error instanceof z.ZodError ? 'Validation failed' : 'Failed to save answer'
          });
        }
      }

      res.json({
        message: `Processed ${processedCount} answers successfully`,
        processed: processedCount,
        results: results
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/crops:
   *   post:
   *     summary: Create or Update Farmer Crop (Idempotent)
   *     description: Create a new crop listing or update an existing one for the authenticated farmer
   *     tags: [Farmer - Crops]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [plantId, totalQuantity, unit, pricePerUnit, harvestDate, state, lga]
   *             properties:
   *               plantId:
   *                 type: string
   *                 example: "plant-maize"
   *               totalQuantity:
   *                 type: integer
   *                 minimum: 1
   *                 example: 100
   *               unit:
   *                 type: string
   *                 enum: [bags, baskets, kg]
   *                 example: "bags"
   *               pricePerUnit:
   *                 type: integer
   *                 minimum: 1
   *                 description: Price in cents
   *                 example: 5000
   *               harvestDate:
   *                 type: string
   *                 format: date-time
   *                 example: "2024-03-15T00:00:00Z"
   *               state:
   *                 type: string
   *                 example: "Lagos"
   *               lga:
   *                 type: string
   *                 example: "Ikeja"
   *               farmAddress:
   *                 type: string
   *                 example: "Plot 123, Farm Road, Ikeja"
   *               description:
   *                 type: string
   *                 example: "High-quality maize, organic farming"
   *     responses:
   *       201:
   *         description: Crop created successfully
   *       200:
   *         description: Crop updated successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  app.post('/api/farmer/crops', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const validatedData = insertFarmerCropSchema.parse(req.body);
      const crop = await storage.createFarmerCrop(user.id, validatedData);
      
      res.status(201).json({
        message: 'Crop created successfully',
        crop
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/crops:
   *   get:
   *     summary: Get Farmer's Crops (Paginated)
   *     description: Retrieve all crops for the authenticated farmer with pagination
   *     tags: [Farmer - Crops]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: page
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *     responses:
   *       200:
   *         description: Crops retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  app.get('/api/farmer/crops', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getFarmerCrops(user.id, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/crops/{cropId}:
   *   get:
   *     summary: Get Single Farmer Crop
   *     description: Retrieve a specific crop by ID for the authenticated farmer
   *     tags: [Farmer - Crops]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: cropId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Crop retrieved successfully
   *       404:
   *         description: Crop not found
   *       401:
   *         description: Unauthorized
   */
  app.get('/api/farmer/crops/:cropId', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const crop = await storage.getFarmerCrop(req.params.cropId, user.id);
      if (!crop) {
        return res.status(404).json({ message: 'Crop not found' });
      }

      res.json({ crop });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/crops/{cropId}:
   *   put:
   *     summary: Update Farmer Crop
   *     description: Update an existing crop for the authenticated farmer
   *     tags: [Farmer - Crops]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: cropId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               totalQuantity:
   *                 type: integer
   *                 minimum: 1
   *               pricePerUnit:
   *                 type: integer
   *                 minimum: 1
   *               harvestDate:
   *                 type: string
   *                 format: date-time
   *               description:
   *                 type: string
   *     responses:
   *       200:
   *         description: Crop updated successfully
   *       404:
   *         description: Crop not found
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  app.put('/api/farmer/crops/:cropId', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const validatedUpdates = updateFarmerCropSchema.parse(req.body);
      const crop = await storage.updateFarmerCrop(req.params.cropId, user.id, validatedUpdates);
      
      if (!crop) {
        return res.status(404).json({ message: 'Crop not found' });
      }

      res.json({
        message: 'Crop updated successfully',
        crop
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/crops/{cropId}:
   *   delete:
   *     summary: Delete Farmer Crop
   *     description: Delete (deactivate) a crop for the authenticated farmer
   *     tags: [Farmer - Crops]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: cropId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Crop deleted successfully
   *       404:
   *         description: Crop not found
   *       401:
   *         description: Unauthorized
   */
  app.delete('/api/farmer/crops/:cropId', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const success = await storage.deleteFarmerCrop(req.params.cropId, user.id);
      
      if (!success) {
        return res.status(404).json({ message: 'Crop not found' });
      }

      res.json({ message: 'Crop deleted successfully' });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/orders:
   *   get:
   *     summary: Get Farmer Orders (Paginated)
   *     description: Retrieve orders for the authenticated farmer's crops
   *     tags: [Farmer - Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: status
   *         in: query
   *         schema:
   *           type: string
   *           enum: [pending, confirmed, delivered, cancelled]
   *         description: Filter by order status
   *       - name: page
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *     responses:
   *       200:
   *         description: Orders retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  app.get('/api/farmer/orders', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const status = req.query.status as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getFarmerOrders(user.id, status, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/orders/{orderId}:
   *   get:
   *     summary: Get Single Farmer Order
   *     description: Retrieve a specific order by ID for the authenticated farmer
   *     tags: [Farmer - Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order retrieved successfully
   *       404:
   *         description: Order not found
   *       401:
   *         description: Unauthorized
   */
  app.get('/api/farmer/orders/:orderId', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const order = await storage.getFarmerOrder(req.params.orderId, user.id);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      res.json({ order });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/orders/{orderId}/deliver:
   *   post:
   *     summary: Mark Order as Delivered
   *     description: Mark an order as delivered by the authenticated farmer
   *     tags: [Farmer - Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order marked as delivered successfully
   *       404:
   *         description: Order not found
   *       401:
   *         description: Unauthorized
   */
  app.post('/api/farmer/orders/:orderId/deliver', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 1) {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const order = await storage.markOrderAsDelivered(req.params.orderId, user.id);
      
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      res.json({
        message: 'Order marked as delivered successfully',
        order
      });
    } catch (error) {
      next(error);
    }
  });
}
