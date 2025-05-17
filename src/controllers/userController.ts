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
import { EventType, User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';

import { unlinkSync, existsSync } from 'fs';
import { hashSync } from 'bcrypt';

const getPeerUserRoles = async (curUser: User, user: any, userId: number | undefined) => {
    user = user || (await prismaClient.user.findUniqueOrThrow({ where: { id: userId } }));

    const creator = user.creator?.id === curUser.id;
    const coordinator = curUser.role === UserRole.COORDINATOR && curUser.institutionId && curUser.institutionId === user.institution.id;
    const itself = curUser.id === userId;

    return { creator, coordinator, itself };
};

export const getPeerUserActions = async (curUser: User, user: any, userId: number | undefined) => {
    const roles = await getPeerUserRoles(curUser, user, userId);

    // Only the user itself, its creator and its institution coordinators can perform update operations on it
    const toUpdate = roles.creator || roles.coordinator || roles.itself || curUser.role === UserRole.ADMIN;
    // Only the user itself, its creator and its institution coordinators can perform delete operations on it
    const toDelete = roles.creator || roles.coordinator || roles.itself || curUser.role === UserRole.ADMIN;
    // Only the user itself, its creator and its institution coordinators can perform get operations on it
    const toGet = roles.creator || roles.coordinator || roles.itself || curUser.role === UserRole.ADMIN;
    // Only admins can perform get all users operation
    const toGetAll = curUser.role === UserRole.ADMIN;
    // Anyone (except users and guests) can perform search operations on users
    const toSearch = curUser.role !== UserRole.USER && curUser.role !== UserRole.GUEST;
    // Anyone (except users and guests) can perform getManaged operations on users
    const toGetManaged = curUser.role !== UserRole.USER && curUser.role !== UserRole.GUEST;

    return { toUpdate, toDelete, toGet, toGetAll, toSearch, toGetManaged };
};

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
                role === UserRole.ADMIN || // Admins cannot be created
                (curUser.role === UserRole.COORDINATOR && // Coordinators can only manage publishers, appliers and users
                    role !== UserRole.PUBLISHER &&
                    role !== UserRole.APPLIER &&
                    role !== UserRole.USER) ||
                (curUser.role === UserRole.PUBLISHER && role !== UserRole.USER && role !== UserRole.APPLIER) || // Publishers can only manage appliers and users
                (curUser.role === UserRole.APPLIER && role !== UserRole.USER) || // Appliers can only manage users
                curUser.role === UserRole.USER || // Users cannot perform create operations
                curUser.role === UserRole.GUEST || // Guests cannot perform create operations
                (institutionId && curUser.institutionId !== institutionId) || // Users cannot insert people in institutions to which they do not belong
                (role === UserRole.COORDINATOR && institutionId === undefined) || // Coordinators must belong to an institution
                role === UserRole.GUEST // Users cannot be created as guests
            ) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
        case 'update': {
            // Only the user itself, its creator and its institution coordinators can perform update operations on it, respecting the hierarchy
            const user: User | null = await prismaClient.user.findUniqueOrThrow({ where: { id: userId } });
            if (
                (curUser.id !== userId &&
                    curUser.id !== user.creatorId &&
                    (curUser.role !== UserRole.COORDINATOR || curUser.institutionId !== user.institutionId)) ||
                (curUser.id === userId && role) || // The user itself cannot change its role
                (curUser.role === UserRole.COORDINATOR && // Coordinators can only manage publishers, appliers and users
                    role !== UserRole.PUBLISHER &&
                    role !== UserRole.APPLIER &&
                    role !== UserRole.USER) ||
                (curUser.role === UserRole.PUBLISHER && role !== UserRole.USER) || // Publishers can only manage users
                (curUser.role === UserRole.APPLIER && role !== UserRole.USER) || // Appliers can only manage users
                curUser.role === UserRole.GUEST || // Guests cannot perform update operations
                role === UserRole.GUEST || // Users cannot be updated to guests
                (institutionId && curUser.institutionId !== institutionId) || // Users cannot insert people in institutions to which they do not belong
                (user.role === UserRole.ADMIN && institutionId) // Admins cannot have institutions
            ) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
        }
        case 'getAll':
            // Only ADMINs can perform get all users operation
            throw new Error('This user is not authorized to perform this action');
            break;
        case 'get': {
            // Only the user itself (except guests), its creator and institution members (except users and guests) can perform get operations on it
            const user: User | null = await prismaClient.user.findUniqueOrThrow({ where: { id: userId } });
            if (
                (userId !== curUser.id &&
                    user.creatorId !== curUser.id &&
                    ((user.institutionId && user.institutionId !== curUser.institutionId) || // Users cannot get information from users from other institutions
                        curUser.role === UserRole.USER || // Users cannot get information from other users
                        curUser.role === UserRole.GUEST || // Guests cannot get information from other users
                        user.institutionId === undefined)) || // Users cannot get information from users without institutions
                user.role === UserRole.GUEST // No one can get information from guests
            )
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getManaged':
        case 'search':
            // Anyone (except users and guests) can perform search operations on users
            if (curUser.role === UserRole.USER || curUser.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        case 'delete': {
            // Only the user itself, its creator and its institution coordinators can perform delete operations on it
            const user: User | null = await prismaClient.user.findUniqueOrThrow({ where: { id: userId } });
            if (
                curUser.id !== userId &&
                curUser.id !== user.creatorId &&
                (curUser.role !== UserRole.COORDINATOR || curUser.institutionId !== user.institutionId)
            )
                throw new Error('This user is not authorized to perform this action');
            break;
        }
    }
};

const validateClassrooms = async (role: UserRole, institutionId: number | undefined, classrooms: number[]) => {
    const invalidClassrooms = await prismaClient.classroom.findMany({
        where: { id: { in: classrooms }, institutionId: { not: institutionId } },
    });
    if (invalidClassrooms.length > 0) throw new Error('Users cannot be placed in classrooms of institutions to which they do not belong.');
    if (classrooms.length > 0 && (role === UserRole.ADMIN || role === UserRole.GUEST))
        throw new Error('You cannot assign classrooms to this user.');
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

export const createUser = async (req: Request, res: Response, next: any) => {
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
        const user = await createUserSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to create a user
        await checkAuthorization(curUser, undefined, user.role as UserRole, user.institutionId, 'create');
        // Validate classrooms
        await validateClassrooms(curUser.role, user.institutionId, user.classrooms as number[]);
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
                creator: { connect: { id: curUser.id } },
            },
            select: fields,
        });
        // Embed user actions in the response
        const processedUser = { ...createdUser, actions: await getPeerUserActions(curUser, createdUser, undefined) };

        res.locals.type = EventType.ACTION;
        res.locals.message = 'User created.';
        res.status(201).json({ message: res.locals.message, data: processedUser });
    } catch (error: any) {
        const file = req.file as Express.Multer.File;
        if (file) if (existsSync(file.path)) unlinkSync(file.path);
        next(error);
    }
};

export const updateUser = async (req: Request, res: Response, next: any): Promise<void> => {
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
                classrooms: yup.array().of(yup.number()).default([]),
                profileImageId: yup.number(),
            })
            .noUnknown();
        // Yup parsing/validation
        const user = await updateUserSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to update the user
        await checkAuthorization(curUser, userId, user.role as UserRole, undefined, 'update');
        // Validate classrooms
        await validateClassrooms(curUser.role, user.institutionId, user.classrooms as number[]);
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
        // Embed user actions in the response
        const processedUser = { ...updatedUser, actions: await getPeerUserActions(curUser, updatedUser, userId) };

        res.locals.type = EventType.ACTION;
        res.locals.message = 'User updated.';
        res.status(200).json({ message: res.locals.message, data: processedUser });
    } catch (error: any) {
        const file = req.file as Express.Multer.File;
        if (file) if (existsSync(file.path)) unlinkSync(file.path);
        next(error);
    }
};

export const getAllUsers = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to get all users
        await checkAuthorization(curUser, undefined, undefined, undefined, 'getAll');
        // Prisma operation
        const users = await prismaClient.user.findMany({ select: fields });
        // Embed user actions in the response
        const processedUsers = await Promise.all(
            users.map(async (user) => ({ ...user, actions: await getPeerUserActions(curUser, user, user.id) }))
        );

        res.status(200).json({ message: 'All users found.', data: processedUsers });
    } catch (error: any) {
        next(error);
    }
};

export const getManagedUsers = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to get managed users
        await checkAuthorization(curUser, undefined, undefined, undefined, 'getManaged');
        // Prisma operation
        const users = await prismaClient.user.findMany({
            where: {
                ...(curUser.role !== UserRole.ADMIN && {
                    // Admins can manage all users
                    role: { notIn: [UserRole.GUEST, UserRole.ADMIN] },
                    OR: [
                        //{ institutionId: curUser.role !== UserRole.COORDINATOR ? curUser.institutionId : undefined }, // Coordinators can manage users from their institutions and users they created
                        ...(curUser.role === UserRole.COORDINATOR ? [{ institutionId: curUser.institutionId }] : []), // Coordinators can manage users from their institutions and users they created
                        { creatorId: curUser.id }, // Publishers and appliers can only manage users they created
                    ],
                }),
            },
            select: { ...publicFields, creator: { select: { id: true, name: true } } },
        });
        // Embed user actions in the response
        const processedUsers = await Promise.all(
            users.map(async (user) => ({ ...user, actions: await getPeerUserActions(curUser, user, user.id) }))
        );

        res.status(200).json({ message: 'Managed users found.', data: processedUsers });
    } catch (error: any) {
        next(error);
    }
};

export const getUser = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        // ID from params
        const userId: number = parseInt(req.params.userId);
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to get the user
        await checkAuthorization(curUser, userId, undefined, undefined, 'get');
        // Prisma operation
        const user = await prismaClient.user.findUniqueOrThrow({
            where: { id: userId },
            select: { ...fields, creator: { select: { id: true, name: true } } },
        });
        // Embed user actions in the response
        const processedUser = { ...user, actions: await getPeerUserActions(curUser, user, userId) };

        res.status(200).json({ message: 'User found.', data: processedUser });
    } catch (error: any) {
        next(error);
    }
};

export const searchUserByUsername = async (req: Request, res: Response, next: any): Promise<void> => {
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
        const { term } = await searchUserSchema.validate(req.body, { stripUnknown: false });
        // Prisma operation
        const users = await prismaClient.user.findMany({
            where: {
                username: { startsWith: term },
                role: { notIn: [UserRole.GUEST, UserRole.ADMIN] },
                ...(curUser.role !== UserRole.ADMIN && {
                    OR: [{ institutionId: curUser.institutionId }, { institutionId: null }],
                }),
            },
            select: publicFields,
        });
        // Embed user actions in the response
        const processedUsers = await Promise.all(
            users.map(async (user) => ({ ...user, actions: await getPeerUserActions(curUser, user, user.id) }))
        );

        res.status(200).json({ message: 'Searched users found.', data: processedUsers });
    } catch (error: any) {
        next(error);
    }
};

export const deleteUser = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        // ID from params
        const userId: number = parseInt(req.params.userId);
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to delete the user
        await checkAuthorization(curUser, userId, undefined, undefined, 'delete');
        // Prisma operation
        const deletedUser = await prismaClient.user.delete({ where: { id: userId }, select: { id: true } });

        res.locals.type = EventType.ACTION;
        res.locals.message = 'User deleted.';
        res.status(200).json({ message: res.locals.message, data: deletedUser });
    } catch (error: any) {
        next(error);
    }
};
