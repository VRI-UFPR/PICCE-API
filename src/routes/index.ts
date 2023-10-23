import express from 'express';
import addressRoutes from './addressRoutes';
import applicationAnswerRoutes from './applicationAnswerRoutes';
import applicationRoutes from './applicationRoutes';

const router = express.Router();

router.use('/address', addressRoutes);
router.use('/applicationAnswer', applicationAnswerRoutes);
router.use('/application', applicationRoutes);

export default router;
