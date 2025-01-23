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
import errorFormatter from '../services/errorFormatter';
import { unlinkSync, existsSync } from 'fs';
import { hashSync } from 'bcrypt';

// Only admins or the user itself can perform --UD operations on users
const checkAuthorization = async (
    curUser: User,
    userId: number | undefined,
    role: UserRole | undefined,
    institutionId: number | undefined,
    action: string
) => {
    if (curUser.role === UserRole.ADMIN && role !== UserRole.ADMIN) return;

    switch (action) {
        case 'create':
            // Anyone (except users and guests) can perform create operations on users, respecting the hierarchy
            if (
                role === UserRole.ADMIN ||
                (curUser.role === UserRole.COORDINATOR && role === UserRole.COORDINATOR) ||
                (curUser.role === UserRole.PUBLISHER && role !== UserRole.USER) ||
                (curUser.role === UserRole.APPLIER && role !== UserRole.USER) ||
                curUser.role === UserRole.USER ||
                curUser.role === UserRole.GUEST ||
                (institutionId && curUser.institutionId !== institutionId) ||
                role === UserRole.GUEST
            ) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
        case 'update':
            if (
                // Only the user itself can perform update operations on it, respecting the hierarchy
                Number(curUser.id) !== userId ||
                (curUser.role === UserRole.COORDINATOR && role === UserRole.ADMIN) ||
                (curUser.role === UserRole.PUBLISHER &&
                    role !== UserRole.PUBLISHER &&
                    role !== UserRole.USER &&
                    role !== UserRole.APPLIER) ||
                (curUser.role === UserRole.APPLIER && role !== UserRole.USER && role !== UserRole.APPLIER) ||
                (curUser.role === UserRole.USER && role !== UserRole.USER) ||
                curUser.role === UserRole.GUEST
            ) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
        case 'getAll':
            // Only ADMINs can perform get all users operation
            throw new Error('This user is not authorized to perform this action');
            break;
        case 'get':
            // Only the user itself (except guests) and institution members (except users and guests) can perform get operations on it
            const user: User | null = await prismaClient.user.findUnique({ where: { id: userId } });
            if (
                !user ||
                (user.institutionId &&
                    curUser.institutionId !== user.institutionId &&
                    curUser.role !== UserRole.USER &&
                    curUser.role !== UserRole.GUEST) ||
                (!user.institutionId && userId !== curUser.id) ||
                curUser.role === UserRole.GUEST
            )
                throw new Error('This user is not authorized to perform this action');
            break;
        case 'search':
            // Anyone (except users and guests) can perform search operations on users
            if (curUser.role === UserRole.USER || curUser.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        case 'delete':
            // Only the user itself can perform delete operations on it
            if (curUser.id !== userId) throw new Error('This user is not authorized to perform this action');
            break;
    }
};

const validateClassrooms = async (institutionId: number | undefined, classrooms: number[]) => {
    const invalidClassrooms = await prismaClient.classroom.findMany({
        where: { id: { in: classrooms }, institutionId: { not: institutionId } },
    });
    if (invalidClassrooms.length > 0) throw new Error('Users cannot be placed in classrooms of institutions to which they do not belong.');
};

// Fields to be selected from the database to the response
const fields = {
    id: true,
    name: true,
    username: true,
    role: true,
    institution: { select: { id: true, name: true } },
    classrooms: { select: { id: true, name: true } },
    profileImage: { select: { id: true, path: true } },
    acceptedTerms: true,
    createdAt: true,
    updatedAt: true,
};

const publicFields = {
    id: true,
    name: true,
    username: true,
    institution: { select: { id: true, name: true } },
    classrooms: { select: { id: true, name: true } },
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
                institutionId: yup.number(),
                classrooms: yup.array().of(yup.number()).default([]),
            })
            .noUnknown();
        // Yup parsing/validation
        const user = await createUserSchema.validate(req.body);
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to create a user
        await checkAuthorization(curUser, undefined, user.role as UserRole, user.institutionId, 'create');
        // Validate classrooms
        await validateClassrooms(user.institutionId, user.classrooms as number[]);
        // Multer single file
        const file = req.file as Express.Multer.File;
        // Password encryption
        user.hash = hashSync(user.hash, 10);
        // Prisma operation
        const createdUser = await prismaClient.user.create({
            data: {
                name: user.name,
                username: user.username,
                hash: user.hash,
                role: user.role,
                classrooms: { connect: user.classrooms.map((id) => ({ id: id })) },
                profileImage: file ? { create: { path: file.path } } : undefined,
                institution: { connect: user.institutionId ? { id: user.institutionId } : undefined },
            },
            select: fields,
        });

        res.status(201).json({ message: 'User created.', data: createdUser });
    } catch (error: any) {
        const file = req.file as Express.Multer.File;
        if (file) if (existsSync(file.path)) unlinkSync(file.path);
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
                profileImageId: yup.number(),
            })
            .noUnknown();
        // Yup parsing/validation
        const user = await updateUserSchema.validate(req.body);
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to update the user
        await checkAuthorization(curUser, userId, user.role as UserRole, undefined, 'update');
        // Validate classrooms
        await validateClassrooms(user.institutionId, user.classrooms as number[]);
        // Multer single file
        const file = req.file as Express.Multer.File;
        // Password encryption
        if (user.hash) user.hash = hashSync(user.hash, 10);
        // Prisma transaction
        const updatedUser = await prismaClient.$transaction(async (prisma) => {
            const filesToDelete = await prisma.file.findMany({
                where: { id: { not: user.profileImageId }, users: { some: { id: userId } } },
                select: { id: true, path: true },
            });
            for (const file of filesToDelete) if (existsSync(file.path)) unlinkSync(file.path);
            await prisma.file.deleteMany({ where: { id: { in: filesToDelete.map((file) => file.id) } } });
            const updatedUser = await prisma.user.update({
                where: { id: userId },
                data: {
                    name: user.name,
                    username: user.username,
                    hash: user.hash,
                    role: user.role,
                    institution: user.institutionId ? { connect: { id: user.institutionId } } : { disconnect: true },
                    classrooms: { set: [], connect: user.classrooms?.map((id) => ({ id: id })) },
                    profileImage: {
                        create: !user.profileImageId && file ? { path: file.path } : undefined,
                    },
                },
                select: fields,
            });

            return updatedUser;
        });

        res.status(200).json({ message: 'User updated.', data: updatedUser });
    } catch (error: any) {
        const file = req.file as Express.Multer.File;
        if (file) if (existsSync(file.path)) unlinkSync(file.path);
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to get all users
        await checkAuthorization(curUser, undefined, undefined, undefined, 'getAll');
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
        await checkAuthorization(curUser, userId, undefined, undefined, 'get');
        // Prisma operation
        const user = await prismaClient.user.findUniqueOrThrow({ where: { id: userId }, select: fields });

        res.status(200).json({ message: 'User found.', data: user });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const searchUserByUsername = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from passport-jwt
        const curUser = req.user as User;
        // Check if user is authorized to search users
        await checkAuthorization(curUser, undefined, undefined, undefined, 'search');
        // Yup schemas
        const searchUserSchema = yup
            .object()
            .shape({ term: yup.string().min(3).max(20).required() })
            .noUnknown();
        // Yup parsing/validation
        const { term } = await searchUserSchema.validate(req.body);
        // Prisma operation
        const users = await prismaClient.user.findMany({
            where: { username: { startsWith: term }, role: { not: UserRole.ADMIN } },
            select: publicFields,
        });

        res.status(200).json({ message: 'Searched users found.', data: users });
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
        await checkAuthorization(curUser, userId, undefined, undefined, 'delete');
        // Prisma operation
        const deletedUser = await prismaClient.user.delete({ where: { id: userId }, select: { id: true } });

        res.status(200).json({ message: 'User deleted.', data: deletedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
