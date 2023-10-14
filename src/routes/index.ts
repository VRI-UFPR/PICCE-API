import express from "express";
import addressRoutes from "./addressRoutes";
import applicationAnswerRoutes from "./applicationAnswerRoutes";

const router = express.Router();

router.use("/address", addressRoutes);
router.use("/applicationAnswer", applicationAnswerRoutes);

export default router;
