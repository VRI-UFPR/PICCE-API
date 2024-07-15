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

export const signUp = async (req: Request, res: Response) => {
    try {
        const signUpSchema = yup
            .object()
            .shape({
                id: yup.number(),
                name: yup.string().min(1).max(255).required(),
                username: yup.string().min(3).max(20).required(),
                hash: yup.string().required(),
                role: yup.string().oneOf(Object.values(UserRole)).required(),
                institutionId: yup.number(),
                classrooms: yup.array().of(yup.number()).default([]),
            })
            .noUnknown();

        const signingUser = await signUpSchema.validate(req.body, { stripUnknown: false });

        const createdUser = await prismaClient.user.create({
            data: {
                id: signingUser.id,
                name: signingUser.name,
                username: signingUser.username,
                hash: signingUser.hash,
                role: signingUser.role,
                institutionId: signingUser.institutionId,
                classrooms: {
                    connect: signingUser.classrooms.map((classroomId) => ({ id: classroomId })),
                },
            },
        });

        const token = jwt.sign({ id: createdUser.id, username: createdUser.username }, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRATION,
        });

        res.status(201).json({
            message: 'User signed up.',
            data: { id: createdUser.id, token: token, expiresIn: process.env.JWT_EXPIRATION },
        });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const signIn = async (req: Request, res: Response) => {
    try {
        const signInSchema = yup
            .object()
            .shape({
                username: yup.string().min(3).max(20).required(),
                hash: yup.string().required(),
            })
            .noUnknown();

        const signingUser = await signInSchema.validate(req.body, { stripUnknown: false });

        const user: User = await prismaClient.user.findUniqueOrThrow({
            where: {
                username: signingUser.username,
            },
        });

        if (user.hash !== signingUser.hash) {
            throw new Error('Invalid credentials.');
        }

        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRATION,
        });

        res.status(200).json({
            message: 'User signed in.',
            data: { id: user.id, acceptedTerms: user.acceptedTerms, token: token, expiresIn: ms(process.env.JWT_EXPIRATION as string) },
        });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const passwordlessSignIn = async (req: Request, res: Response) => {
    try {
        const user = await prismaClient.user.findUniqueOrThrow({
            where: {
                id: 1,
            },
        });

        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRATION,
        });

        res.status(200).json({
            message: 'User signed in.',
            data: { id: user.id, token: token, expiresIn: ms(process.env.JWT_EXPIRATION as string) },
        });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const renewSignIn = async (req: Request, res: Response) => {
    try {
        const user = req.user as User;

        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRATION,
        });

        res.status(200).json({
            message: 'User signed in.',
            data: { id: user.id, token: token, expiresIn: ms(process.env.JWT_EXPIRATION as string) },
        });
    } catch (error) {
        res.status(400).json(errorFormatter(error));
    }
};

export const checkSignIn = async (req: Request, res: Response) => {
    try {
        const user = req.user as User;
        res.status(200).json({ message: 'User currently signed in.', data: { id: user.id } });
    } catch (error) {
        res.status(400).json(errorFormatter(error));
    }
};

export const acceptTerms = async (req: Request, res: Response) => {
    try {
        const user = req.user as User;

        if (user.id === 1) {
            throw new Error('Cannot accept terms as anonymous user.');
        }

        const updatedUser = await prismaClient.user.update({
            where: {
                id: user.id,
            },
            data: {
                acceptedTerms: true,
            },
        });

        res.status(200).json({ message: 'Terms accepted.', data: { id: updatedUser.id, acceptedTerms: updatedUser.acceptedTerms } });
    } catch (error) {
        res.status(400).json(errorFormatter(error));
    }
};
