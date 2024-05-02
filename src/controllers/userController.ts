import { Response, Request } from 'express';
import { User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

// Only admins or the user itself can perform --UD operations on users
const checkAuthorization = (user: User, userId: number) => {
    if (user.role !== UserRole.ADMIN && user.id !== userId) {
        throw new Error('This user is not authorized to perform this action');
    }
};

// Check if the user is above the role to be handled
const checkHierarchy = (user: User, role: UserRole) => {
    const coordinatorRestrictions = user.role === UserRole.COORDINATOR && (role === UserRole.ADMIN || role === UserRole.COORDINATOR);
    const publisherRestrictions = user.role === UserRole.PUBLISHER && role !== UserRole.USER;
    const otherRestrictions = user.role === UserRole.APLICATOR || user.role === UserRole.USER;

    if (coordinatorRestrictions || publisherRestrictions || otherRestrictions) {
        throw new Error('This user is not authorized to perform this action');
    }
};

// Fields to be selected from the database to the response
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

        // Check if user is authorized to create a user with the given role
        checkHierarchy(curUser, user.role);

        // Prisma operation
        const createdUser = await prismaClient.user.create({
            data: {
                id: user.id,
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
        // ID from params
        const id: number = parseInt(req.params.userId);

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
        checkAuthorization(curUser, id);

        // Check if user is authorized to update a user with the given role
        checkHierarchy(curUser, user.role as UserRole);

        // Prisma operation
        const updatedUser = await prismaClient.user.update({
            where: { id },
            data: {
                name: user.name,
                username: user.username,
                hash: user.hash,
                role: user.role,
                institutionId: user.institutionId,
                classrooms: { disconnect: user.classrooms?.map((id) => ({ id: id })) },
            },
            select: fieldsWithNesting,
        });

        res.status(200).json({ message: 'User updated.', data: updatedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const acceptTermsUser = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.userId);

        // User from Passport-JWT
        const curUser = req.user as User;

        // Check if user is authorized to update the user
        checkAuthorization(curUser, id);

        // Check if user is authorized to update a user with the given role
        const updatedUser = await prismaClient.user.update({
            where: { id },
            data: {
                acceptedTerms: true,
            },
            select: fieldsWithNesting,
        });

        res.status(200).json({ message: 'User accepted terms.', data: updatedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const curUser = req.user as User;

        // Check if user is authorized to get all users
        if (curUser.role !== UserRole.ADMIN) throw new Error('This user is not authorized to perform this action');

        // Prisma operation
        const users = await prismaClient.user.findMany({ select: fieldsWithNesting });

        res.status(200).json({ message: 'All users found.', data: users });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getInstitutionUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const curUser = req.user as User;

        // Check if user is authorized to get all users from the institution
        if (curUser.role === UserRole.USER) throw new Error('This user is not authorized to perform this action');

        // Prisma operation
        const users = await prismaClient.user.findMany({ where: { institutionId: curUser.institutionId }, select: fieldsWithNesting });

        res.status(200).json({ message: 'Institution users found.', data: users });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.userId);

        // User from Passport-JWT
        const curUser = req.user as User;

        // Check if user is authorized to get the user
        checkAuthorization(curUser, id);

        // Prisma operation
        const user = await prismaClient.user.findUniqueOrThrow({ where: { id }, select: fieldsWithNesting });

        res.status(200).json({ message: 'User found.', data: user });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.userId);

        // User from Passport-JWT
        const curUser = req.user as User;

        // Check if user is authorized to delete the user
        checkAuthorization(curUser, id);

        // Prisma operation
        const deletedUser = await prismaClient.user.delete({ where: { id }, select: { id: true } });

        res.status(200).json({ message: 'User deleted.', data: deletedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
