import express from 'express';
import uploader from '../services/multerUploader';
import { signIn, signUp } from '../controllers/authController';

const router = express.Router();

router.post('/signIn', uploader.none(), signIn);
router.post('/signUp', uploader.none(), signUp);

export default router;
