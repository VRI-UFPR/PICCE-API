import { Response, Request } from 'express';
import { User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

const checkAuthorization = (user: User, id: number) => {
    if (user.role !== UserRole.ADMIN && user.id !== id) {
        throw new Error('This user is not authorized to perform this action');
    }
};

const checkHierarchy = (user: User, role: UserRole) => {
    const coordinatorRestrictions = user.role === UserRole.COORDINATOR && (role === UserRole.ADMIN || role === UserRole.COORDINATOR);
    const publisherRestrictions =
        user.role === UserRole.PUBLISHER &&
        (role === UserRole.ADMIN || role === UserRole.COORDINATOR || role === UserRole.PUBLISHER || role === UserRole.APLICATOR);
    const otherRestrictions = user.role === UserRole.APLICATOR || user.role === UserRole.USER;

    if (coordinatorRestrictions || publisherRestrictions || otherRestrictions) {
        throw new Error('This user is not authorized to perform this action');
    }
};

const fieldsWithNesting = {
    name: true,
    username: true,
    role: true,
    institution: {
        select: {
            id: true,
            name: true,
        },
    },
    classrooms: {
        select: {
            id: true,
        },
    },
    createdAt: true,
    updateAt: true,
};

export const createUser = async (req: Request, res: Response) => {
    try {
        const createUserSchema = yup
            .object()
            .shape({
                name: yup.string().min(1).max(255).required(),
                username: yup.string().min(3).max(16).required(),
                hash: yup.string().required(),
                role: yup.string().oneOf(Object.values(UserRole)).required(),
                institutionId: yup.number().required(),
                classrooms: yup.array().of(yup.number()).default([]),
            })
            .noUnknown();

        const user = await createUserSchema.validate(req.body);

        const curUser = req.user as User;

        checkHierarchy(curUser, user.role);

        const createdUser = await prismaClient.user.create({
            data: {
                name: user.name,
                username: user.username,
                hash: user.hash,
                role: user.role,
                institutionId: user.institutionId,
            },
            select: fieldsWithNesting,
        });

        res.status(201).json({ message: 'User created.', data: createdUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.userId);

        const updateUserSchema = yup
            .object()
            .shape({
                name: yup.string().min(1).max(255),
                username: yup.string().min(3).max(16),
                hash: yup.string(),
                role: yup.string().oneOf(Object.values(UserRole)),
                institutionId: yup.number(),
                classrooms: yup.array().of(yup.number()),
            })
            .noUnknown();

        const user = await updateUserSchema.validate(req.body);

        const curUser = req.user as User;

        checkAuthorization(curUser, id);

        const updatedUser = await prismaClient.user.update({
            where: {
                id,
            },
            data: {
                name: user.name,
                username: user.username,
                hash: user.hash,
                role: user.role,
                institutionId: user.institutionId,
                classrooms: {
                    disconnect: user.classrooms?.map((id) => ({ id: id })),
                },
            },
            select: fieldsWithNesting,
        });

        res.status(200).json({ message: 'User updated.', data: updatedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        if ((req.user as User).role !== UserRole.ADMIN) throw new Error('This user is not authorized to perform this action');

        const users = await prismaClient.user.findMany({ select: fieldsWithNesting });

        res.status(200).json({ message: 'All users found.', data: users });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.userId);

        const curUser = req.user as User;

        checkAuthorization(curUser, id);

        const user = await prismaClient.user.findUniqueOrThrow({
            where: {
                id,
            },
            select: fieldsWithNesting,
        });

        res.status(200).json({ message: 'User found.', data: user });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.userId);

        const curUser = req.user as User;

        checkAuthorization(curUser, id);

        const deletedUser = await prismaClient.user.delete({
            where: {
                id,
            },
            select: {
                id: true,
            },
        });

        res.status(200).json({ message: 'User deleted.', data: deletedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
