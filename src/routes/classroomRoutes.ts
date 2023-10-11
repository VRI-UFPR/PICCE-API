import express from "express";
import uploader from "../services/multerUploader";
import { createClassroom, updateClassroom, getAllClassrooms, getClassroom, deleteClassroom } from "../controllers/classroomController";

const router = express.Router();

router.post("/createClassroom", uploader.none(), createClassroom);
router.put("/updateClassroom/:ClassroomId", uploader.none(), updateClassroom);
router.get("/getAllClassroom", uploader.none(), getAllClassrooms);
router.get("/getClassroom/:ClassroomId", uploader.none(), getClassroom);
router.delete("/deleteClassroom/:ClassroomId", uploader.none(), deleteClassroom);

export default router;
