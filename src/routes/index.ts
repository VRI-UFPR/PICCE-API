import express from 'express';
import addressRoutes from './addressRoutes';
import authRoutes from './authRoutes';
import applicationAnswerRoutes from './applicationAnswerRoutes';
import applicationRoutes from './applicationRoutes';
import institutionRoutes from './institutionRoutes';
import userRoutes from './userRoutes';
import classroomRoutes from './classroomRoutes';
import protocolRoutes from './protocolRoutes';

const router = express.Router();

router.use('/address', addressRoutes);
router.use('/auth', authRoutes);
router.use('/institution', institutionRoutes);
router.use('/user', userRoutes);
router.use('/classroom', classroomRoutes);
router.use('/applicationAnswer', applicationAnswerRoutes);
router.use('/application', applicationRoutes);
router.use('/protocol', protocolRoutes);

export default router;
