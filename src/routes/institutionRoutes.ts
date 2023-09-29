import express from "express";
import uploader from "../services/multerUploader";
import { createInstitution, updateInstitution, getAllInstitutions, getInstitution, deleteInstitution } from "../controllers/institutionController";

const router = express.Router();

router.post("/createInstitution", uploader.none(), createInstitution);
router.put("/updateInstitution/:institutionId", uploader.none(), updateInstitution);
router.get("/getAllInstitutions", uploader.none(), getAllInstitutions);
router.get("/getInstitution/:institutionId", uploader.none(), getInstitution);
router.delete("/deleteInstitution/:institutionId", uploader.none(), deleteInstitution);

export default router;