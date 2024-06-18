import { Response, Request } from 'express';
import { User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

// Only admins or the user itself can perform --UD operations on users
const checkAuthorization = async (curUser: User, userId: number | undefined, role: UserRole | undefined, action: string) => {
    switch (action) {
        case 'create':
            // Only USERs and APPLIERs can't perform create operations on users, other roles need to respect the hierarchy
            if (
                (curUser.role === UserRole.COORDINATOR && (role === UserRole.ADMIN || role === UserRole.COORDINATOR)) ||
                (curUser.role === UserRole.PUBLISHER && role !== UserRole.USER) ||
                curUser.role === UserRole.APPLIER ||
                curUser.role === UserRole.USER
            ) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
        case 'update':
            if (
                // Only admins or the user itself can perform update operations on it, respecting the hierarchy
                (curUser.role !== UserRole.ADMIN && curUser.id !== userId) ||
                (curUser.role === UserRole.COORDINATOR && (role === UserRole.ADMIN || role === UserRole.COORDINATOR)) ||
                (curUser.role === UserRole.PUBLISHER && role !== UserRole.USER) ||
                curUser.role === UserRole.APPLIER ||
                curUser.role === UserRole.USER
            ) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
        case 'getAll':
            // Only ADMINs can perform get all users operation
            if (curUser.role !== UserRole.ADMIN) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
        case 'get':
            // Only admins, members (except USERs) of its institution or the user itself can perform get operations on it
            if (curUser.role !== UserRole.ADMIN) {
                const user: User | null = await prismaClient.user.findUnique({
                    where: { id: userId, institutionId: curUser.institutionId },
                });
                if (!user || !user.institutionId || (curUser.role === UserRole.USER && curUser.id !== userId)) {
                    throw new Error('This user is not authorized to perform this action');
                }
            }
            break;
        case 'delete':
            // Only ADMINs or the user itself can perform update/delete operations on it
            if (curUser.role !== UserRole.ADMIN && curUser.id !== userId) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
    }
};

// Fields to be selected from the database to the response
const fields = {
    id: true,
    name: true,
    username: true,
    role: true,
    institution: { select: { id: true, name: true } },
    classrooms: { select: { id: true, name: true } },
    acceptedTerms: true,
    createdAt: true,
    updateAt: true,
};

export const createUser = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createUserSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                name: yup.string().min(1).max(255).required(),
                username: yup.string().min(3).max(20).required(),
                hash: yup.string().required(),
                role: yup.string().oneOf(Object.values(UserRole)).required(),
                institutionId: yup.number().required(),
                classrooms: yup.array().of(yup.number()).default([]),
            })
            .noUnknown();
        // Yup parsing/validation
        const user = await createUserSchema.validate(req.body);
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to create a user
        await checkAuthorization(curUser, undefined, user.role as UserRole, 'create');
        // Prisma operation
        const createdUser = await prismaClient.user.create({
            data: {
                id: user.id,
                name: user.name,
                username: user.username,
                hash: user.hash,
                role: user.role,
                institutionId: user.institutionId,
                classrooms: { connect: user.classrooms.map((id) => ({ id: id })) },
            },
            select: fields,
        });

        res.status(201).json({ message: 'User created.', data: createdUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const userId: number = parseInt(req.params.userId);
        // Yup schemas
        const updateUserSchema = yup
            .object()
            .shape({
                name: yup.string().min(1).max(255),
                username: yup.string().min(3).max(20),
                hash: yup.string(),
                role: yup.string().oneOf(Object.values(UserRole)),
                institutionId: yup.number(),
                classrooms: yup.array().of(yup.number()),
            })
            .noUnknown();
        // Yup parsing/validation
        const user = await updateUserSchema.validate(req.body);
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to update the user
        await checkAuthorization(curUser, userId, user.role as UserRole, 'update');
        // Prisma operation
        const updatedUser = await prismaClient.user.update({
            where: { id: userId },
            data: {
                name: user.name,
                username: user.username,
                hash: user.hash,
                role: user.role,
                institutionId: user.institutionId,
                classrooms: { set: [], connect: user.classrooms?.map((id) => ({ id: id })) },
            },
            select: fields,
        });

        res.status(200).json({ message: 'User updated.', data: updatedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to get all users
        await checkAuthorization(curUser, undefined, undefined, 'getAll');
        // Prisma operation
        const users = await prismaClient.user.findMany({ select: fields });

        res.status(200).json({ message: 'All users found.', data: users });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const userId: number = parseInt(req.params.userId);
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to get the user
        await checkAuthorization(curUser, userId, undefined, 'get');
        // Prisma operation
        const user = await prismaClient.user.findUniqueOrThrow({ where: { id: userId }, select: fields });

        res.status(200).json({ message: 'User found.', data: user });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const userId: number = parseInt(req.params.userId);
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to delete the user
        await checkAuthorization(curUser, userId, undefined, 'delete');
        // Prisma operation
        const deletedUser = await prismaClient.user.delete({ where: { id: userId }, select: { id: true } });

        res.status(200).json({ message: 'User deleted.', data: deletedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
