import express from "express";
import uploader from "../services/multerUploader";
import { createAddress, updateAddress, getAllAddresses, getAddress, deleteAddress } from "../controllers/addressController";

const router = express.Router();

router.post("/createAddress", uploader.none(), createAddress);
router.put("/updateAddress/:addressId", uploader.none(), updateAddress);
router.get("/getAllAddress", uploader.none(), getAllAddresses);
router.get("/getAddress/:addressId", uploader.none(), getAddress);
router.delete("/deleteAddress/:addressId", uploader.none(), deleteAddress);

export default router;
