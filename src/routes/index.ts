/*
Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>
*/

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
