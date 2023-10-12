import express from "express";
import addressRoutes from "./addressRoutes";
import applicationRoutes from "./applicationRoutes";

const router = express.Router();

router.use("/address", addressRoutes);
router.use("/application", applicationRoutes);

export default router;
