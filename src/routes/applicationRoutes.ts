import express from "express";
import uploader from "../services/multerUploader";
import {
    createApplication,
    updateApplication,
    getAllApplications,
    getApplication,
    deleteApplication,
} from "../controllers/applicationController";

const router = express.Router();

router.post("/createApplication", uploader.none(), createApplication);
router.put("/updateApplication/:applicationId", uploader.none(), updateApplication);
router.get("/getAllApplications", uploader.none(), getAllApplications);
router.get("/getApplication/:applicationId", uploader.none(), getApplication);
router.delete("/deleteApplication/:applicationId", uploader.none(), deleteApplication);

export default router;
