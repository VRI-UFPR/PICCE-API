import express from "express";
import addressRoutes from "./addressRoutes";
import protocolRoutes from "./protocolRoutes";

const router = express.Router();

router.use("/address", addressRoutes);
router.use("/protocol", protocolRoutes);

export default router;
