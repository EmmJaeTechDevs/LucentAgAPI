import type { Express } from "express";
import { storage } from "../storage";
import { authenticateToken } from "../middleware/auth";
import { 
  insertCropOrderSchema,
  insertCropNotificationSchema,
  cropSearchSchema
} from "@shared/schema";
import { z } from "zod";

export function registerBuyerRoutes(app: Express): void {
  /**
   * @swagger
   * /api/buyer/crops/search:
   *   get:
   *     summary: Search Available Crops
   *     description: Search for available crops with filters
   *     tags: [Buyer - Browse]
   *     parameters:
   *       - name: query
   *         in: query
   *         schema:
   *           type: string
   *         description: Search query (crop name or description)
   *       - name: plantCategory
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by plant category ID
   *       - name: state
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by state
   *       - name: lga
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by LGA
   *       - name: minPrice
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 0
   *         description: Minimum price per unit (in cents)
   *       - name: maxPrice
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 0
   *         description: Maximum price per unit (in cents)
   *       - name: unit
   *         in: query
   *         schema:
   *           type: string
   *           enum: [bags, baskets, kg]
   *         description: Filter by unit type
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
   *       400:
   *         description: Invalid search parameters
   */
  app.get('/api/buyer/crops/search', async (req, res, next) => {
    try {
      const searchParams = cropSearchSchema.parse({
        ...req.query,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        minPrice: req.query.minPrice ? parseInt(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseInt(req.query.maxPrice as string) : undefined,
      });

      const result = await storage.searchAvailableCrops(searchParams);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid search parameters', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/buyer/crops/available:
   *   get:
   *     summary: Get Available Crops for Sale
   *     description: Get all crops that are currently available for purchase (already harvested)
   *     tags: [Buyer - Browse]
   *     parameters:
   *       - name: plantCategory
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by plant category ID
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
   *         description: Available crops retrieved successfully
   */
  app.get('/api/buyer/crops/available', async (req, res, next) => {
    try {
      const plantCategory = req.query.plantCategory as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getAvailableCropsByCategory(plantCategory, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/buyer/crops/soon-ready:
   *   get:
   *     summary: Get Soon-to-be-Harvested Crops
   *     description: Get crops that are not yet ready for harvest but will be soon
   *     tags: [Buyer - Browse]
   *     parameters:
   *       - name: plantCategory
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by plant category ID
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
   *         description: Soon-to-be-ready crops retrieved successfully
   */
  app.get('/api/buyer/crops/soon-ready', async (req, res, next) => {
    try {
      const plantCategory = req.query.plantCategory as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getSoonToBeHarvestedCrops(plantCategory, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/buyer/orders:
   *   post:
   *     summary: Place Crop Order
   *     description: Place an order for a crop as an authenticated buyer
   *     tags: [Buyer - Orders]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [cropId, quantityOrdered, deliveryAddress, deliveryState, deliveryLga]
   *             properties:
   *               cropId:
   *                 type: string
   *                 example: "crop-123"
   *               quantityOrdered:
   *                 type: integer
   *                 minimum: 1
   *                 example: 10
   *               deliveryFee:
   *                 type: integer
   *                 minimum: 0
   *                 default: 0
   *                 description: Delivery fee in cents
   *                 example: 5000
   *               deliveryAddress:
   *                 type: string
   *                 example: "123 Main Street, Victoria Island"
   *               deliveryState:
   *                 type: string
   *                 example: "Lagos"
   *               deliveryLga:
   *                 type: string
   *                 example: "Lagos Island"
   *               deliveryNote:
   *                 type: string
   *                 example: "Please call before delivery"
   *     responses:
   *       201:
   *         description: Order placed successfully
   *       400:
   *         description: Validation error or insufficient stock
   *       401:
   *         description: Unauthorized
   */
  app.post('/api/buyer/orders', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 2) {
        return res.status(403).json({ message: 'Access denied. Buyer account required.' });
      }

      const validatedData = insertCropOrderSchema.parse(req.body);
      
      const crop = await storage.getFarmerCrop(validatedData.cropId);
      if (!crop) {
        return res.status(400).json({ message: 'Crop not found' });
      }
      
      if (crop.availableQuantity < validatedData.quantityOrdered) {
        return res.status(400).json({ 
          message: 'Insufficient stock available',
          available: crop.availableQuantity,
          requested: validatedData.quantityOrdered
        });
      }

      const order = await storage.createCropOrder(user.id, validatedData);
      
      res.status(201).json({
        message: 'Order placed successfully',
        order
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
   * /api/buyer/orders:
   *   get:
   *     summary: Get Buyer Orders (Paginated)
   *     description: Retrieve orders for the authenticated buyer
   *     tags: [Buyer - Orders]
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
  app.get('/api/buyer/orders', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 2) {
        return res.status(403).json({ message: 'Access denied. Buyer account required.' });
      }

      const status = req.query.status as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getBuyerOrders(user.id, status, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/buyer/notifications:
   *   post:
   *     summary: Notify Buyer About Crop
   *     description: Subscribe to notifications for when a specific crop becomes ready
   *     tags: [Buyer - Notifications]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [cropId, message, notificationType]
   *             properties:
   *               cropId:
   *                 type: string
   *                 example: "crop-123"
   *               message:
   *                 type: string
   *                 example: "Please notify me when this crop is ready"
   *               notificationType:
   *                 type: string
   *                 enum: [crop_ready, price_change, quantity_update]
   *                 example: "crop_ready"
   *     responses:
   *       201:
   *         description: Notification subscription created successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  app.post('/api/buyer/notifications', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 2) {
        return res.status(403).json({ message: 'Access denied. Buyer account required.' });
      }

      const validatedData = insertCropNotificationSchema.parse(req.body);
      
      const crop = await storage.getFarmerCrop(validatedData.cropId);
      if (!crop) {
        return res.status(400).json({ message: 'Crop not found' });
      }

      const notificationData = {
        ...validatedData,
        buyerId: user.id,
        farmerId: crop.farmerId,
      };

      const notification = await storage.createCropNotification(notificationData);
      
      res.status(201).json({
        message: 'Notification subscription created successfully',
        notification
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
   * /api/buyer/notifications:
   *   get:
   *     summary: Get Buyer Notifications
   *     description: Retrieve notifications for the authenticated buyer
   *     tags: [Buyer - Notifications]
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
   *         description: Notifications retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  app.get('/api/buyer/notifications', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.roleId !== 2) {
        return res.status(403).json({ message: 'Access denied. Buyer account required.' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getBuyerNotifications(user.id, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
}
