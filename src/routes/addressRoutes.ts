import express from "express";
import { createAddress, updateAddress, getAllAddresses, getAddress, deleteAddress } from "../controllers/addressController";

const router = express.Router();

router.post("/createAddress", createAddress);
router.put("/updateAddress/:addressId", updateAddress);
router.get("/getAllAddresss", getAllAddresses);
router.get("/getAddress/:addressId", getAddress);
router.delete("/deleteAddress/:addressId", deleteAddress);

export default router;
