import type { Express } from "express";
import { storage } from "../storage";

export function registerLocationsRoutes(app: Express): void {
  /**
   * @swagger
   * /api/locations/countries:
   *   get:
   *     summary: Get All Countries
   *     description: Retrieve a list of all countries
   *     tags: [Locations]
   *     responses:
   *       200:
   *         description: Countries retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 countries:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: integer
   *                         example: 1
   *                       name:
   *                         type: string
   *                         example: "Nigeria"
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                 total:
   *                   type: integer
   *                   example: 1
   *       500:
   *         description: Internal server error
   */
  app.get('/api/locations/countries', async (req, res, next) => {
    try {
      const countries = await storage.getAllCountries();
      res.json({
        countries,
        total: countries.length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/locations/states/{countryId}:
   *   get:
   *     summary: Get States by Country
   *     description: Retrieve all states for a specific country
   *     tags: [Locations]
   *     parameters:
   *       - name: countryId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: The country ID
   *         example: 1
   *     responses:
   *       200:
   *         description: States retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 states:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: integer
   *                         example: 1
   *                       name:
   *                         type: string
   *                         example: "Lagos"
   *                       countryId:
   *                         type: integer
   *                         example: 1
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                 total:
   *                   type: integer
   *                   example: 37
   *       400:
   *         description: Invalid country ID
   *       500:
   *         description: Internal server error
   */
  app.get('/api/locations/states/:countryId', async (req, res, next) => {
    try {
      const countryId = parseInt(req.params.countryId);
      
      if (isNaN(countryId)) {
        return res.status(400).json({ message: 'Invalid country ID' });
      }
      
      const states = await storage.getStatesByCountry(countryId);
      res.json({
        states,
        total: states.length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/locations/lgas/{stateId}:
   *   get:
   *     summary: Get LGAs by State
   *     description: Retrieve all Local Government Areas (LGAs) for a specific state
   *     tags: [Locations]
   *     parameters:
   *       - name: stateId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: The state ID
   *         example: 1
   *     responses:
   *       200:
   *         description: LGAs retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 lgas:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: integer
   *                         example: 1
   *                       name:
   *                         type: string
   *                         example: "Ikeja"
   *                       stateId:
   *                         type: integer
   *                         example: 1
   *                       countryId:
   *                         type: integer
   *                         example: 1
   *                       createdAt:
   *                         type: string
   *                         format: date-time
   *                 total:
   *                   type: integer
   *                   example: 20
   *       400:
   *         description: Invalid state ID
   *       500:
   *         description: Internal server error
   */
  app.get('/api/locations/lgas/:stateId', async (req, res, next) => {
    try {
      const stateId = parseInt(req.params.stateId);
      
      if (isNaN(stateId)) {
        return res.status(400).json({ message: 'Invalid state ID' });
      }
      
      const lgas = await storage.getLgasByState(stateId);
      res.json({
        lgas,
        total: lgas.length
      });
    } catch (error) {
      next(error);
    }
  });
}
