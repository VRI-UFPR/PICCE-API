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

/**
 * Handles user sign-in process.
 *
 * This function handles the user sign-in process, validating the body of the request to check the
 * user's credentials to then authenticate the user through a JWT token.
 *
 * @param req - The request object containing the user's sign-in data in the body.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const signIn = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const signInSchema = yup
            .object()
            .shape({ username: yup.string().min(3).max(20).required(), hash: yup.string().required() })
            .noUnknown();
        // Yup parsing/validation
        const userData = await signInSchema.validate(req.body, { stripUnknown: false });
        // Prisma operation
        const storedUser = await prismaClient.user.findUniqueOrThrow({
            where: { username: userData.username },
            include: { profileImage: true },
        });
        // Password check
        if (!compareSync(userData.hash, storedUser.hash)) throw new Error('Invalid credentials.');
        // JWT token creation
        const token = jwt.sign({ id: storedUser.id, username: storedUser.username }, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRATION,
        });

        res.status(200).json({
            message: 'User signed in.',
            data: {
                id: storedUser.id,
                role: storedUser.role,
                acceptedTerms: storedUser.acceptedTerms,
                token: token,
                expiresIn: ms(process.env.JWT_EXPIRATION as string),
                institutionId: storedUser.institutionId,
                profileImage: storedUser.profileImage ? { path: storedUser.profileImage.path } : undefined,
            },
        });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Handles user passwordless sign-in process.
 *
 * This function handles the user sign-up process for guests, authenticating the user through a JWT token.
 *
 * @param req - The request object.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const passwordlessSignIn = async (req: Request, res: Response) => {
    try {
        // Prisma operation
        const guestUser = await prismaClient.user.findFirstOrThrow({ where: { role: UserRole.GUEST }, include: { profileImage: true } });
        // JWT token creation
        const token = jwt.sign({ id: guestUser.id, username: guestUser.username }, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRATION,
        });

        res.status(200).json({
            message: 'User signed in.',
            data: {
                id: guestUser.id,
                role: guestUser.role,
                token: token,
                expiresIn: ms(process.env.JWT_EXPIRATION as string),
                institutionId: guestUser.institutionId,
                profileImage: guestUser.profileImage ? { path: guestUser.profileImage.path } : undefined,
            },
        });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Handles user sign-in renewal process.
 *
 * This function handles the user sign-in renewal process, validating the user performing the action to
 * then reauthenticate the user through a new JWT token.
 *
 * @param req - The request object containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const renewSignIn = async (req: Request, res: Response) => {
    try {
        // User from Passport-JWT
        const requester = req.user as any;
        // JWT token creation
        const token = jwt.sign({ id: requester.id, username: requester.username }, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRATION,
        });

        res.status(200).json({
            message: 'User signed in.',
            data: {
                id: requester.id,
                role: requester.role,
                token: token,
                expiresIn: ms(process.env.JWT_EXPIRATION as string),
                institutionId: requester.institutionId,
                profileImage: requester.profileImage ? { path: requester.profileImage.path } : undefined,
            },
        });
    } catch (error) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Checks if a user is currently signed in.
 *
 * This function handles the user sign-in status check, validating the user performing the action, which
 * immediately implies the user is signed in.
 *
 * @param req - The request object containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const checkSignIn = async (req: Request, res: Response) => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;

        res.status(200).json({ message: 'User currently signed in.', data: { id: requester.id } });
    } catch (error) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Handles user terms acceptance process.
 *
 * This function handles the user terms acceptance process, validating the user performing the action to then
 * update the user's terms acceptance status.
 *
 * @param req - The request object containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const acceptTerms = async (req: Request, res: Response) => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to accept terms
        if (requester.role === UserRole.GUEST) throw new Error('Cannot accept terms as guest.');
        // Prisma operation
        const storedUser = await prismaClient.user.update({ where: { id: requester.id }, data: { acceptedTerms: true } });

        res.status(200).json({ message: 'Terms accepted.', data: { id: storedUser.id, acceptedTerms: storedUser.acceptedTerms } });
    } catch (error) {
        res.status(400).json(errorFormatter(error));
    }
};
