import express from "express";
import addressRoutes from "./addressRoutes";

const router = express.Router();

router.use("/address", addressRoutes);

export default router;
