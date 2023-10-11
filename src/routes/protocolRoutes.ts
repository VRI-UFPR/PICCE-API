import express from "express";
import uploader from "../services/multerUploader";
import { createProtocol } from "../controllers/protocolController";

const router = express.Router();

router.post("/createProtocol", uploader.none(), createProtocol);

export default router;