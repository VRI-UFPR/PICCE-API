import express from "express";
import uploader from "../services/multerUploader";
import {
  createClassroom,
  updateClassroom,
  getAllClassrooms,
  getClassroom,
  deleteClassroom,
} from "../controllers/classroomController";

const router = express.Router();

router.post("/createClassroom", uploader.none(), createClassroom);
router.put("/updateClassroom/:classroomId", uploader.none(), updateClassroom);
router.get("/getAllClassrooms", uploader.none(), getAllClassrooms);
router.get("/getClassroom/:classroomId", uploader.none(), getClassroom);
router.delete(
  "/deleteClassroom/:classroomId",
  uploader.none(),
  deleteClassroom
);

export default router;
