import express from "express";
import uploader from "../services/multerUploader";
import { createUser, updateUser, getAllUsers, getUser, deleteUser } from "../controllers/userController";

const router = express.Router();

router.post("/createUser", uploader.none(), createUser);
router.put("/updateUser/:UserId", uploader.none(), updateUser);
router.get("/getAllUsers", uploader.none(), getAllUsers);
router.get("/getUser/:UserId", uploader.none(), getUser);
router.delete("/deleteUser/:UserId", uploader.none(), deleteUser);

export default router;
