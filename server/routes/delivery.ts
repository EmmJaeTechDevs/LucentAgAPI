import type { Express } from "express";
import { storage } from "../storage";
import { deliveryService } from "../services/delivery";
import { deliveryFeeRequestSchema } from "@shared/schema";
import { z } from "zod";

export function registerDeliveryRoutes(app: Express): void {
  /**
   * @swagger
   * /api/delivery/calculate-fee:
   *   post:
   *     summary: Calculate Delivery Fee
   *     description: Calculate delivery fee from farm location to delivery address using third-party service
   *     tags: [Delivery]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [fromState, fromLga, toState, toLga, toAddress, weight, unit, quantity]
   *             properties:
   *               fromState:
   *                 type: string
   *                 example: "Ogun"
   *               fromLga:
   *                 type: string
   *                 example: "Abeokuta North"
   *               fromAddress:
   *                 type: string
   *                 example: "Farm Road, Abeokuta"
   *               toState:
   *                 type: string
   *                 example: "Lagos"
   *               toLga:
   *                 type: string
   *                 example: "Lagos Island"
   *               toAddress:
   *                 type: string
   *                 example: "123 Victoria Island, Lagos"
   *               weight:
   *                 type: number
   *                 minimum: 0.1
   *                 example: 50.5
   *               unit:
   *                 type: string
   *                 enum: [bags, baskets, kg]
   *                 example: "bags"
   *               quantity:
   *                 type: integer
   *                 minimum: 1
   *                 example: 10
   *     responses:
   *       200:
   *         description: Delivery fee calculated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 deliveryFee:
   *                   type: integer
   *                   description: Delivery fee in cents
   *                   example: 15000
   *                 distance:
   *                   type: number
   *                   description: Distance in kilometers
   *                   example: 85.5
   *                 estimatedDuration:
   *                   type: string
   *                   description: Estimated delivery time
   *                   example: "2-3 business days"
   *                 provider:
   *                   type: string
   *                   example: "Nigerian Logistics Service"
   *       400:
   *         description: Validation error or location not found
   *       503:
   *         description: Third-party service unavailable
   */
  app.post('/api/delivery/calculate-fee', async (req, res, next) => {
    try {
      const validatedData = deliveryFeeRequestSchema.parse(req.body);
      const providerName = req.query.provider as string;

      const deliveryCalculation = await deliveryService.calculateDeliveryFee(
        validatedData, 
        providerName
      );

      res.json({
        message: 'Delivery fee calculated successfully',
        ...deliveryCalculation,
        calculation: {
          fromLocation: `${validatedData.fromLga}, ${validatedData.fromState}`,
          toLocation: `${validatedData.toLga}, ${validatedData.toState}`,
          weight: validatedData.weight,
          unit: validatedData.unit,
          quantity: validatedData.quantity
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      
      if (error instanceof Error && error.message.includes('API key')) {
        return res.status(503).json({ 
          message: 'Delivery service temporarily unavailable',
          error: 'External API not configured'
        });
      }

      next(error);
    }
  });

  /**
   * @swagger
   * /api/delivery/compare-providers:
   *   post:
   *     summary: Compare Delivery Providers
   *     description: Get delivery quotes from multiple providers and compare prices
   *     tags: [Delivery]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [fromState, fromLga, toState, toLga, toAddress, weight, unit, quantity]
   *             properties:
   *               fromState:
   *                 type: string
   *                 example: "Ogun"
   *               fromLga:
   *                 type: string
   *                 example: "Abeokuta North"
   *               fromAddress:
   *                 type: string
   *                 example: "Farm Road, Abeokuta"
   *               toState:
   *                 type: string
   *                 example: "Lagos"
   *               toLga:
   *                 type: string
   *                 example: "Lagos Island"
   *               toAddress:
   *                 type: string
   *                 example: "123 Victoria Island, Lagos"
   *               weight:
   *                 type: number
   *                 minimum: 0.1
   *                 example: 50.5
   *               unit:
   *                 type: string
   *                 enum: [bags, baskets, kg]
   *                 example: "bags"
   *               quantity:
   *                 type: integer
   *                 minimum: 1
   *                 example: 10
   *     responses:
   *       200:
   *         description: Provider comparison completed successfully
   *       400:
   *         description: Validation error
   *       503:
   *         description: All delivery services unavailable
   */
  app.post('/api/delivery/compare-providers', async (req, res, next) => {
    try {
      const validatedData = deliveryFeeRequestSchema.parse(req.body);

      const providerQuotes = await deliveryService.compareProviders(validatedData);

      if (providerQuotes.length === 0) {
        return res.status(503).json({
          message: 'All delivery services are currently unavailable',
          error: 'No providers responded'
        });
      }

      res.json({
        message: 'Delivery providers compared successfully',
        providers: providerQuotes,
        cheapest: providerQuotes[0],
        calculation: {
          fromLocation: `${validatedData.fromLga}, ${validatedData.fromState}`,
          toLocation: `${validatedData.toLga}, ${validatedData.toState}`,
          weight: validatedData.weight,
          unit: validatedData.unit,
          quantity: validatedData.quantity
        }
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
   * /api/delivery/providers:
   *   get:
   *     summary: Get Available Delivery Providers
   *     description: Retrieve a list of all available delivery service providers
   *     tags: [Delivery]
   *     responses:
   *       200:
   *         description: Available providers retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 providers:
   *                   type: array
   *                   items:
   *                     type: string
   *                   example: ["Nigerian Express Logistics", "Google Maps Delivery Calculator", "GIG Logistics"]
   */
  app.get('/api/delivery/providers', async (req, res) => {
    const providers = deliveryService.getAvailableProviders();
    res.json({
      providers,
      total: providers.length
    });
  });

  /**
   * @swagger
   * /api/delivery/units:
   *   get:
   *     summary: Get Available Delivery Units
   *     description: Retrieve a list of all available delivery units (bags, baskets, kg, etc.) with their weight conversions
   *     tags: [Delivery]
   *     parameters:
   *       - name: activeOnly
   *         in: query
   *         description: Only return active units
   *         schema:
   *           type: boolean
   *           default: true
   *     responses:
   *       200:
   *         description: Available delivery units retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 units:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       name:
   *                         type: string
   *                         example: "bags"
   *                       displayName:
   *                         type: string
   *                         example: "Bags"
   *                       weightInKg:
   *                         type: integer
   *                         description: Weight conversion factor in grams
   *                         example: 50000
   *                       description:
   *                         type: string
   *                         example: "Standard 50kg grain bags"
   *                       isActive:
   *                         type: boolean
   *                         example: true
   *                 total:
   *                   type: integer
   *                   example: 3
   *       500:
   *         description: Internal server error
   */
  app.get('/api/delivery/units', async (req, res, next) => {
    try {
      const activeOnly = req.query.activeOnly !== 'false';
      
      const units = activeOnly 
        ? await storage.getActiveDeliveryUnits()
        : await storage.getAllDeliveryUnits();
      
      res.json({
        units,
        total: units.length
      });
    } catch (error) {
      next(error);
    }
  });
}
