/*
Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>
*/

import { Response, Request } from 'express';
import { User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import jwt from 'jsonwebtoken';
import errorFormatter from '../services/errorFormatter';
import ms from 'ms';
import { compareSync } from 'bcrypt';

export const signIn = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const signInSchema = yup
            .object()
            .shape({ username: yup.string().min(3).max(20).required(), hash: yup.string().required() })
            .noUnknown();
        // Yup parsing/validation
        const signingUser = await signInSchema.validate(req.body, { stripUnknown: false });
        // Prisma operation
        const user = await prismaClient.user.findUniqueOrThrow({
            where: { username: signingUser.username },
            include: { profileImage: true },
        });
        // Password check
        if (!compareSync(signingUser.hash, user.hash)) throw new Error('Invalid credentials.');
        // JWT token creation
        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRATION,
        });

        res.status(200).json({
            message: 'User signed in.',
            data: {
                id: user.id,
                role: user.role,
                acceptedTerms: user.acceptedTerms,
                token: token,
                expiresIn: ms(process.env.JWT_EXPIRATION as string),
                institutionId: user.institutionId,
                profileImage: user.profileImage ? { path: user.profileImage.path } : undefined,
            },
        });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const passwordlessSignIn = async (req: Request, res: Response) => {
    try {
        // Prisma operation
        const user = await prismaClient.user.findFirstOrThrow({ where: { role: UserRole.GUEST }, include: { profileImage: true } });
        // JWT token creation
        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRATION,
        });

        res.status(200).json({
            message: 'User signed in.',
            data: {
                id: user.id,
                role: user.role,
                token: token,
                expiresIn: ms(process.env.JWT_EXPIRATION as string),
                institutionId: user.institutionId,
                profileImage: user.profileImage ? { path: user.profileImage.path } : undefined,
            },
        });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const renewSignIn = async (req: Request, res: Response) => {
    try {
        // User from Passport-JWT
        const user = req.user as any;
        // JWT token creation
        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRATION,
        });

        res.status(200).json({
            message: 'User signed in.',
            data: {
                id: user.id,
                role: user.role,
                token: token,
                expiresIn: ms(process.env.JWT_EXPIRATION as string),
                institutionId: user.institutionId,
                profileImage: user.profileImage ? { path: user.profileImage.path } : undefined,
            },
        });
    } catch (error) {
        res.status(400).json(errorFormatter(error));
    }
};

export const checkSignIn = async (req: Request, res: Response) => {
    try {
        // User from Passport-JWT
        const user = req.user as User;

        res.status(200).json({ message: 'User currently signed in.', data: { id: user.id } });
    } catch (error) {
        res.status(400).json(errorFormatter(error));
    }
};

export const acceptTerms = async (req: Request, res: Response) => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to accept terms
        if (user.role === UserRole.GUEST) throw new Error('Cannot accept terms as guest.');
        // Prisma operation
        const updatedUser = await prismaClient.user.update({ where: { id: user.id }, data: { acceptedTerms: true } });

        res.status(200).json({ message: 'Terms accepted.', data: { id: updatedUser.id, acceptedTerms: updatedUser.acceptedTerms } });
    } catch (error) {
        res.status(400).json(errorFormatter(error));
    }
};
