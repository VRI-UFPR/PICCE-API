import express from "express";
import uploader from "../services/multerUploader";
import {
    createApplicationAnswer,
    updateApplicationAnswer,
    getAllApplicationAnswers,
    getApplicationAnswer,
    deleteApplicationAnswer,
} from "../controllers/applicationAnswerController";

const router = express.Router();

router.post("/createApplicationAnswer", uploader.none(), createApplicationAnswer);
router.put("/updateApplicationAnswer/:applicationAnswerId", uploader.none(), updateApplicationAnswer);
router.get("/getAllApplicationAnswers", uploader.none(), getAllApplicationAnswers);
router.get("/getApplicationAnswer/:applicationAnswerId", uploader.none(), getApplicationAnswer);
router.delete("/deleteApplicationAnswer/:applicationAnswerId", uploader.none(), deleteApplicationAnswer);

export default router;
