import type { Express } from "express";
import { registerHealthRoutes } from "./health";
import { registerAuthRoutes } from "./auth";
import { registerUsersRoutes } from "./users";
import { registerLogsRoutes } from "./logs";
import { registerPlantsRoutes } from "./plants";
import { registerFarmerRoutes } from "./farmer";
import { registerBuyerRoutes } from "./buyer";
import { registerDeliveryRoutes } from "./delivery";
import { registerLocationsRoutes } from "./locations";

export function registerAllRoutes(app: Express): void {
  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerUsersRoutes(app);
  registerLogsRoutes(app);
  registerPlantsRoutes(app);
  registerFarmerRoutes(app);
  registerBuyerRoutes(app);
  registerDeliveryRoutes(app);
  registerLocationsRoutes(app);
}
