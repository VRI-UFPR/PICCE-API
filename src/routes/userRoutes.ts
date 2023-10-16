import express from "express";
import uploader from "../services/multerUploader";
import {
  createUser,
  updateUser,
  getAllUsers,
  getUser,
  deleteUser,
} from "../controllers/userController";

const router = express.Router();

router.post("/createUser", uploader.none(), createUser);
router.put("/updateUser/:userId", uploader.none(), updateUser);
router.get("/getAllUsers", uploader.none(), getAllUsers);
router.get("/getUser/:userId", uploader.none(), getUser);
router.delete("/deleteUser/:userId", uploader.none(), deleteUser);

export default router;
