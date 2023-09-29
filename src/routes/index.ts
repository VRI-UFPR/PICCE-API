import express from "express";
import addressRoutes from "./addressRoutes";
import institutionRoutes from "./institutionRoutes";

const router = express.Router();

router.use("/address", addressRoutes);
router.use("/institution", institutionRoutes);

export default router;
