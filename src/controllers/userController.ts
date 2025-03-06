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
import fieldsFilter from '../services/fieldsFilter';

export const detailedUserFields = () => ({ institution: { select: { id: true } }, creator: { select: { id: true } } });

const getDetailedUsers = async (usersIds: number[]) => {
    return await prismaClient.user.findMany({ where: { id: { in: usersIds } }, include: detailedUserFields() });
};

export const getVisibleFields = async (curUser: User, users: Awaited<ReturnType<typeof getDetailedUsers>>, ignoreFilters: boolean) => {
    const peerUsersRoles = await getPeerUsersRoles(curUser, users);

    const mapVisibleFields = (roles: (typeof peerUsersRoles)[0] | undefined) => {
        const fullAccess = roles ? roles.creator || roles.coordinator || roles.itself || curUser.role === UserRole.ADMIN : ignoreFilters;
        const baseAccess = roles
            ? roles.viewer ||
              roles.coordinator ||
              roles.itself ||
              roles.creator ||
              roles.instituionMember ||
              curUser.role === UserRole.ADMIN
            : ignoreFilters;

        const fields = {
            select: {
                id: baseAccess,
                createdAt: fullAccess,
                updatedAt: fullAccess,
                name: fullAccess,
                username: baseAccess,
                role: fullAccess,
                acceptedTerms: fullAccess,
                profileImage: { select: { id: fullAccess, path: fullAccess } },
                institution: { select: { id: baseAccess, name: baseAccess } },
                classrooms: { select: { id: baseAccess, name: baseAccess } },
            },
        };

        return fields;
    };

    const visibleFields = ignoreFilters ? [mapVisibleFields(undefined)] : peerUsersRoles.map(mapVisibleFields);

    return visibleFields;
};

const getPeerUsersRoles = async (curUser: User, users: Awaited<ReturnType<typeof getDetailedUsers>>) => {
    const roles = users.map((user) => {
        const creator = user.creator?.id === curUser.id;
        const coordinator =
            curUser.role === UserRole.COORDINATOR && curUser.institutionId && curUser.institutionId === user.institution?.id;
        const instituionMember = curUser.institutionId && curUser.institutionId === user.institution?.id;
        const itself = curUser.id === user.id;
        const viewer = !user.institution && curUser.role !== UserRole.USER && curUser.role !== UserRole.GUEST;

        return { creator, coordinator, instituionMember, itself, viewer };
    });

    return roles;
};

export const getPeerUserActions = async (curUser: User, users: Awaited<ReturnType<typeof getDetailedUsers>>) => {
    const peerUsersRoles = await getPeerUsersRoles(curUser, users);

    const actions = peerUsersRoles.map((roles) => {
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

        return { toDelete, toGet, toUpdate };
    });

    return actions;
};

const validateHierarchy = async (
    curUser: User,
    role: UserRole | undefined,
    institutionId: number | undefined,
    userId: number | undefined
) => {
    if (
        role === UserRole.ADMIN || // Admins cannot be managed by anyone
        (curUser.role === UserRole.COORDINATOR && // Coordinators can only manage publishers, appliers and users
            role !== UserRole.PUBLISHER &&
            role !== UserRole.APPLIER &&
            role !== UserRole.USER) ||
        (curUser.role === UserRole.PUBLISHER && role !== UserRole.USER) || // Publishers can only manage users
        (curUser.role === UserRole.APPLIER && role !== UserRole.USER) || // Appliers can only manage users
        (institutionId && curUser.institutionId !== institutionId) || // Users cannot insert people in institutions to which they do not belong
        (role === UserRole.COORDINATOR && institutionId === undefined) || // Coordinators must belong to an institution
        role === UserRole.GUEST || // Users cannot be created as guests
        (curUser.id === userId && role) || // The user itself cannot change its role
        (curUser.role === UserRole.ADMIN && curUser.id === userId && institutionId) // Admins cannot have institutions
    )
        throw new Error('The role or institution of the user is invalid.');
};

const checkAuthorization = async (curUser: User, usersIds: number[], action: string) => {
    if (curUser.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create': {
            // Anyone (except users and guests) can perform create operations on users, respecting the hierarchy
            if (curUser.role === UserRole.USER || curUser.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'update': {
            if ((await getPeerUserActions(curUser, await getDetailedUsers(usersIds))).some(({ toUpdate }) => !toUpdate))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getAll':
            // Only ADMINs can perform get all users operation
            throw new Error('This user is not authorized to perform this action');
        case 'get': {
            if ((await getPeerUserActions(curUser, await getDetailedUsers(usersIds))).some(({ toGet }) => !toGet))
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
            if ((await getPeerUserActions(curUser, await getDetailedUsers(usersIds))).some(({ toDelete }) => !toDelete))
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
        await checkAuthorization(curUser, [], 'create');
        // Validate hierarchy
        await validateHierarchy(curUser, user.role, user.institutionId, user.id);
        // Validate classrooms
        await validateClassrooms(curUser.role, user.institutionId, user.classrooms as number[]);
        // Multer single file
        const file = req.file as Express.Multer.File;
        // Password encryption
        user.hash = hashSync(user.hash, 10);
        // Prisma operation
        const detailedCreatedUser = await prismaClient.user.create({
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
            include: detailedUserFields(),
        });
        // Get user only with visible fields and with embedded actions
        const visibleUser = {
            ...(await prismaClient.user.findUnique({
                where: { id: detailedCreatedUser.id },
                ...(await getVisibleFields(curUser, [detailedCreatedUser], false))[0],
            })),
            actions: (await getPeerUserActions(curUser, [detailedCreatedUser]))[0],
        };

        res.status(201).json({ message: 'User created.', data: visibleUser });
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
        await checkAuthorization(curUser, [userId], 'update');
        // Validade hierarchy
        await validateHierarchy(curUser, user.role, user.institutionId, userId);
        // Validate classrooms
        await validateClassrooms(curUser.role, user.institutionId, user.classrooms as number[]);
        // Multer single file
        const file = req.file as Express.Multer.File;
        // Password encryption
        if (user.hash) user.hash = hashSync(user.hash, 10);
        // Prisma transaction
        const detailedUpdatedUser = await prismaClient.$transaction(async (prisma) => {
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
                include: detailedUserFields(),
            });

            return updatedUser;
        });
        // Get user only with visible fields and with embedded actions
        const visibleUser = {
            ...(await prismaClient.user.findUnique({
                where: { id: detailedUpdatedUser.id },
                ...(await getVisibleFields(curUser, [detailedUpdatedUser], false))[0],
            })),
            actions: (await getPeerUserActions(curUser, [detailedUpdatedUser]))[0],
        };

        res.status(200).json({ message: 'User updated.', data: visibleUser });
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
        await checkAuthorization(curUser, [], 'getAll');
        // Prisma operation
        const detailedUsers = await prismaClient.user.findMany({ include: detailedUserFields() });
        // Get users only with visible fields and with embedded actions
        const actions = await getPeerUserActions(curUser, detailedUsers);
        const filteredFIelds = await getVisibleFields(curUser, detailedUsers, false);
        const unfilteredFields = (await getVisibleFields(curUser, [detailedUsers[0]], true))[0];
        const unfilteredVisibleUsers = await prismaClient.user.findMany({
            where: { id: { in: detailedUsers.map((user) => user.id) } },
            ...unfilteredFields,
        });
        const visibleUsers = unfilteredVisibleUsers.map((user, i) => ({
            ...fieldsFilter(user, filteredFIelds[i]),
            actions: actions[i],
        }));

        res.status(200).json({ message: 'All users found.', data: visibleUsers });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getManagedUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const curUser = req.user as User;
        // Check if user is authorized to get managed users
        await checkAuthorization(curUser, [], 'getManaged');
        // Prisma operation
        const detailedUsers = await prismaClient.user.findMany({
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
            include: detailedUserFields(),
        });
        // Get users only with visible fields and with embedded actions
        const actions = await getPeerUserActions(curUser, detailedUsers);
        const filteredFIelds = await getVisibleFields(curUser, detailedUsers, false);
        const unfilteredFields = (await getVisibleFields(curUser, [detailedUsers[0]], true))[0];
        const unfilteredVisibleUsers = await prismaClient.user.findMany({
            where: { id: { in: detailedUsers.map((user) => user.id) } },
            ...unfilteredFields,
        });
        const visibleUsers = unfilteredVisibleUsers.map((user, i) => ({
            ...fieldsFilter(user, filteredFIelds[i]),
            actions: actions[i],
        }));

        res.status(200).json({ message: 'Managed users found.', data: visibleUsers });
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
        await checkAuthorization(curUser, [userId], 'get');
        // Prisma operation
        const detailedUser = await prismaClient.user.findUniqueOrThrow({ where: { id: userId }, include: detailedUserFields() });
        // Get user only with visible fields and with embedded actions
        const processedUser = {
            ...(await prismaClient.user.findUnique({
                where: { id: userId },
                ...(await getVisibleFields(curUser, [detailedUser], false))[0],
            })),
            actions: (await getPeerUserActions(curUser, [detailedUser]))[0],
        };

        res.status(200).json({ message: 'User found.', data: processedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const searchUserByUsername = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from passport-jwt
        const curUser = req.user as User;
        // Check if user is authorized to search users
        await checkAuthorization(curUser, [], 'search');
        // Yup schemas
        const searchUserSchema = yup
            .object()
            .shape({ term: yup.string().min(3).max(20).required() })
            .noUnknown();
        // Yup parsing/validation
        const { term } = await searchUserSchema.validate(req.body);
        // Prisma operation
        const detailedUsers = await prismaClient.user.findMany({
            where: {
                username: { startsWith: term },
                role: { notIn: [UserRole.GUEST, UserRole.ADMIN] },
                ...(curUser.role !== UserRole.ADMIN && {
                    OR: [{ institutionId: curUser.institutionId }, { institutionId: null }],
                }),
            },
            include: detailedUserFields(),
        });
        // Get users only with visible fields and with embedded actions
        const actions = await getPeerUserActions(curUser, detailedUsers);
        const filteredFIelds = await getVisibleFields(curUser, detailedUsers, false);
        const unfilteredFields = (await getVisibleFields(curUser, [detailedUsers[0]], true))[0];
        const unfilteredVisibleUsers = await prismaClient.user.findMany({
            where: { id: { in: detailedUsers.map((user) => user.id) } },
            ...unfilteredFields,
        });
        const visibleUsers = unfilteredVisibleUsers.map((user, i) => ({
            ...fieldsFilter(user, filteredFIelds[i]),
            actions: actions[i],
        }));

        res.status(200).json({ message: 'Searched users found.', data: visibleUsers });
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
        await checkAuthorization(curUser, [userId], 'delete');
        // Prisma operation
        const deletedUser = await prismaClient.user.delete({ where: { id: userId }, select: { id: true } });

        res.status(200).json({ message: 'User deleted.', data: deletedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
