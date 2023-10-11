import express from "express";
import addressRoutes from "./addressRoutes";
import institutionRoutes from "./institutionRoutes";
import userRoutes from "./userRoutes";
import classroomRoutes from "./classroomRoutes";

const router = express.Router();

router.use("/address", addressRoutes);
router.use("/institution", institutionRoutes);
router.use("/user", userRoutes);
router.use("/classroom", classroomRoutes);

export default router;
