import { Response, Request } from 'express';
import { User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import jwt from 'jsonwebtoken';
import errorFormatter from '../services/errorFormatter';
import ms from 'ms';

export const signUp = async (req: Request, res: Response) => {
    try {
        // Yup schemas
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
        // Yup parsing/validation
        const signingUser = await signUpSchema.validate(req.body, { stripUnknown: false });
        // Prisma operation
        const createdUser = await prismaClient.user.create({
            data: {
                id: signingUser.id,
                name: signingUser.name,
                username: signingUser.username,
                hash: signingUser.hash,
                role: signingUser.role,
                institutionId: signingUser.institutionId,
                classrooms: { connect: signingUser.classrooms.map((classroomId) => ({ id: classroomId })) },
            },
        });
        // JWT token creation
        const token = jwt.sign({ id: createdUser.id, username: createdUser.username }, process.env.JWT_SECRET as string, {
            expiresIn: process.env.JWT_EXPIRATION,
        });

        res.status(201).json({
            message: 'User signed up.',
            data: {
                id: createdUser.id,
                role: createdUser.role,
                token: token,
                expiresIn: process.env.JWT_EXPIRATION,
                institutionId: createdUser.institutionId,
            },
        });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

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
        const user: User = await prismaClient.user.findUniqueOrThrow({
            where: {
                username: signingUser.username,
            },
        });
        // Password check
        if (user.hash !== signingUser.hash) {
            throw new Error('Invalid credentials.');
        }
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
            },
        });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const passwordlessSignIn = async (req: Request, res: Response) => {
    try {
        // Prisma operation
        const user = await prismaClient.user.findUniqueOrThrow({ where: { id: 1 } });
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
            },
        });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const renewSignIn = async (req: Request, res: Response) => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
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
        if (user.id === 1) {
            throw new Error('Cannot accept terms as anonymous user.');
        }
        // Prisma operation
        const updatedUser = await prismaClient.user.update({ where: { id: user.id }, data: { acceptedTerms: true } });

        res.status(200).json({ message: 'Terms accepted.', data: { id: updatedUser.id, acceptedTerms: updatedUser.acceptedTerms } });
    } catch (error) {
        res.status(400).json(errorFormatter(error));
    }
};
