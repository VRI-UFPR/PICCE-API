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

/**
 * Retrieve the detailed users fields required for internal endpoint validations.
 *
 * This function handles the creation of a custom select filter that serves as a parameter for Prisma Client to return an
 * user with all the fields required for internal endpoint validations.
 *
 * @returns A Prisma select filter object
 */
export const detailedUserFields = () => ({ institution: { select: { id: true } }, creator: { select: { id: true } } });

/**
 * Gets a set of detailed users from a set of IDs
 *
 * This function handles the retrieval of a set of detailed users, with all the fields required for internal
 * endpoint validations, from a set of users IDs using Prisma.
 *
 * @param usersIds An array of users IDs
 * @returns A set of detailed users
 */
const getDetailedUsers = async (usersIds: number[]) => {
    return await prismaClient.user.findMany({ where: { id: { in: usersIds } }, include: detailedUserFields() });
};

/**
 * Retrieves the visible fields for users based on the user's roles and permissions.
 *
 * @param user - The user for whom the visible fields are being determined.
 * @param users - The detailed users for which the visible fields are being determined.
 * @param includeInstitutions - A boolean indicating whether to include the institution field in the visible fields.
 * @param includeClassrooms - A boolean indicating whether to include the classrooms field in the visible fields.
 * @param ignoreFilters - A boolean indicating whether to ignore role-based filters and grant full access.
 * @returns A promise that resolves to an array of objects representing the visible fields for each user.
 */
export const getVisibleUserFields = async (
    curUser: User,
    users: Awaited<ReturnType<typeof getDetailedUsers>>,
    includeInstitutions: boolean,
    includeClassrooms: boolean,
    ignoreFilters: boolean
) => {
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
                institution: includeInstitutions && { select: { id: baseAccess, name: baseAccess } },
                classrooms: includeClassrooms && { select: { id: baseAccess, name: baseAccess } },
            },
        };

        return fields;
    };

    const visibleFields = ignoreFilters ? [mapVisibleFields(undefined)] : peerUsersRoles.map(mapVisibleFields);

    return visibleFields;
};

/**
 * Retrieves a user's roles against a given set of users.
 *
 * @param user - The user whose roles are being determined.
 * @param users - The detailed users for which the roles are being determined.
 * @returns A promise that resolves to an array of objects representing the roles of the user for each user.
 *
 * Each role object contains the following properties:
 * - `creator`: Whether the user is the creator of the peer user.
 * - `coordinator`: Whether the user is a coordinator of the peer user's institution.
 * - `instituionMember`: Whether the user belongs to the same institution as the peer user.
 * - `itself`: Whether the user is the peer user itself.
 * - `viewer`: Whether the user has viewer permissions on the peer user.
 */
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

/**
 * Retrieves the actions that a user can perform on a set of users.
 *
 * @param user - The user whose actions are being determined.
 * @param users - The detailed users for which the actions are being determined.
 * @returns A promise that resolves to an array of objects representing the actions that the user can perform on each user.
 *
 * The returned action object contains the following properties:
 * - `toDelete`: Whether the user can delete the peer user.
 * - `toGet`: Whether the user can get the peer user.
 * - `toUpdate`: Whether the user can update the peer user.
 */
export const getPeerUserActions = async (curUser: User, users: Awaited<ReturnType<typeof getDetailedUsers>>) => {
    const peerUsersRoles = await getPeerUsersRoles(curUser, users);

    const actions = peerUsersRoles.map((roles, i) => {
        // Only the user itself, its creator and its institution coordinators can perform update operations on it
        const toUpdate =
            (roles.creator || roles.coordinator || roles.itself || curUser.role === UserRole.ADMIN) &&
            users[i].role !== UserRole.GUEST &&
            users[i].role !== UserRole.ADMIN;
        // Only the user itself, its creator and its institution coordinators can perform delete operations on it
        const toDelete =
            (roles.creator || roles.coordinator || roles.itself || curUser.role === UserRole.ADMIN) &&
            users[i].role !== UserRole.GUEST &&
            users[i].role !== UserRole.ADMIN;
        // Only the user itself, its creator and its institution coordinators can perform get operations on it
        const toGet =
            (roles.creator || roles.coordinator || roles.itself || curUser.role === UserRole.ADMIN) &&
            users[i].role !== UserRole.GUEST &&
            users[i].role !== UserRole.ADMIN;
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

/**
 * Validates the hierarchy of a user to create or update another user.
 *
 * @param requester - The user performing the operation.
 * @param role - The role of the user being created or updated.
 * @param institutionId - The institution ID of the user being created or updated.
 * @param userId - The ID of the user being updated.
 * @throws An error if the hierarchy is invalid.
 *
 * @returns A promise that resolves if the hierarchy is valid.
 */
const validateHierarchy = async (
    requester: User,
    role: UserRole | undefined,
    institutionId: number | undefined,
    userId: number | undefined
) => {
    if (
        role === UserRole.ADMIN || // Admins cannot be managed by anyone
        (requester.role === UserRole.COORDINATOR &&
            role && // Coordinators can only manage publishers, appliers and users
            role !== UserRole.PUBLISHER &&
            role !== UserRole.APPLIER &&
            role !== UserRole.USER) ||
        (requester.role === UserRole.PUBLISHER && role && role !== UserRole.USER) || // Publishers can only manage users
        (requester.role === UserRole.APPLIER && role && role !== UserRole.USER) || // Appliers can only manage users
        (institutionId && requester.institutionId !== institutionId && requester.role !== UserRole.ADMIN) || // Users cannot insert people in institutions to which they do not belong except for admins
        (role === UserRole.COORDINATOR && institutionId === undefined) || // Coordinators must belong to an institution
        role === UserRole.GUEST || // Users cannot be created as guests
        (requester.id === userId && role) || // The user itself cannot change its role
        (requester.role === UserRole.ADMIN && requester.id === userId && institutionId) // Admins cannot have institutions
    )
        throw new Error('The role or institution of the user is invalid.');
};

/**
 * Checks if the user is authorized to perform a specific action on a set of classrooms.
 *
 * @param requester - The user object containing requester user details.
 * @param usersIds - The IDs of the users the requester wants to perform the action on.
 * @param action - The action the user wants to perform (e.g., 'create', 'update', 'delete', 'get', 'getAll', 'getManaged').
 *
 * @throws Will throw an error if the classroom institution is not valid.
 * @returns A promise that resolves if the user is authorized to perform the action.
 */
const checkAuthorization = async (requester: User, usersIds: number[], action: string) => {
    if (requester.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create': {
            // Anyone (except users and guests) can perform create operations on users, respecting the hierarchy
            if (requester.role === UserRole.USER || requester.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'update': {
            if ((await getPeerUserActions(requester, await getDetailedUsers(usersIds))).some(({ toUpdate }) => !toUpdate))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getAll':
            // Only ADMINs can perform get all users operation
            throw new Error('This user is not authorized to perform this action');
        case 'get': {
            if ((await getPeerUserActions(requester, await getDetailedUsers(usersIds))).some(({ toGet }) => !toGet))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getManaged':
        case 'search':
            // Anyone (except users and guests) can perform search operations on users
            if (requester.role === UserRole.USER || requester.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        case 'delete': {
            if ((await getPeerUserActions(requester, await getDetailedUsers(usersIds))).some(({ toDelete }) => !toDelete))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
    }
};

/**
 * Validates if the classrooms of a user are valid.
 *
 * @param role - The role of the user performing the operation.
 * @param institutionId - The institution ID of the user being created or updated.
 * @param classrooms - The classrooms IDs of the user being created or updated.
 * @throws An error if the classrooms are invalid.
 *
 * The function performs the following validations:
 * - Users cannot be placed in classrooms of institutions to which they do not belong.
 * - Users cannot be assigned classrooms if they are guests or admins.
 *
 * @returns A promise that resolves if the classrooms are valid.
 */
const validateClassrooms = async (role: UserRole, institutionId: number | undefined, classrooms: number[]) => {
    const invalidClassrooms = await prismaClient.classroom.findMany({
        where: { id: { in: classrooms }, institutionId: { not: institutionId } },
    });
    if (invalidClassrooms.length > 0) throw new Error('Users cannot be placed in classrooms of institutions to which they do not belong.');
    if (classrooms.length > 0 && (role === UserRole.ADMIN || role === UserRole.GUEST))
        throw new Error('You cannot assign classrooms to this user.');
};

/**
 * Creates a new user in the database.
 *
 * This function handles the creation of a new user, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the user data in the body and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
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
        const userData = await createUserSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to create a user
        await checkAuthorization(requester, [], 'create');
        // Validate hierarchy
        await validateHierarchy(requester, userData.role, userData.institutionId, userData.id);
        // Validate classrooms
        await validateClassrooms(requester.role, userData.institutionId, userData.classrooms as number[]);
        // Multer single file
        const file = req.file as Express.Multer.File;
        // Password encryption
        userData.hash = hashSync(userData.hash, 10);
        // Prisma operation
        const detailedStoredUser = await prismaClient.user.create({
            data: {
                name: userData.name,
                username: userData.username,
                hash: userData.hash,
                role: userData.role,
                classrooms: { connect: userData.classrooms.map((id) => ({ id: id })) },
                profileImage: file ? { create: { path: file.path } } : undefined,
                institution: { connect: userData.institutionId ? { id: userData.institutionId } : undefined },
                creator: { connect: { id: requester.id } },
            },
            include: detailedUserFields(),
        });
        // Get user only with visible fields and with embedded actions
        const visibleUser = {
            ...(await prismaClient.user.findUnique({
                where: { id: detailedStoredUser.id },
                ...(await getVisibleUserFields(requester, [detailedStoredUser], true, true, false))[0],
            })),
            actions: (await getPeerUserActions(requester, [detailedStoredUser]))[0],
        };

        res.status(201).json({ message: 'User created.', data: visibleUser });
    } catch (error: any) {
        const file = req.file as Express.Multer.File;
        if (file) if (existsSync(file.path)) unlinkSync(file.path);
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Updates an existing user in the database.
 *
 * This function handles the update of a existing user, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the user data in the body, the user object from Passport-JWT and the address ID in the params.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
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
                classrooms: yup.array().of(yup.number()).default([]),
                profileImageId: yup.number(),
            })
            .noUnknown();
        // Yup parsing/validation
        const userData = await updateUserSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to update the user
        await checkAuthorization(requester, [userId], 'update');
        // Validade hierarchy
        await validateHierarchy(requester, userData.role, userData.institutionId, userId);
        // Validate classrooms
        await validateClassrooms(requester.role, userData.institutionId, userData.classrooms as number[]);
        // Multer single file
        const file = req.file as Express.Multer.File;
        // Password encryption
        if (userData.hash) userData.hash = hashSync(userData.hash, 10);
        // Prisma transaction
        const detailedStoredUser = await prismaClient.$transaction(async (prisma) => {
            const filesToDelete = await prisma.file.findMany({
                where: { id: { not: userData.profileImageId }, users: { some: { id: userId } } },
                select: { id: true, path: true },
            });
            for (const file of filesToDelete) if (existsSync(file.path)) unlinkSync(file.path);
            await prisma.file.deleteMany({ where: { id: { in: filesToDelete.map((file) => file.id) } } });
            const updatedUser = await prisma.user.update({
                where: { id: userId },
                data: {
                    name: userData.name,
                    username: userData.username,
                    hash: userData.hash,
                    role: userData.role,
                    institution: userData.institutionId ? { connect: { id: userData.institutionId } } : { disconnect: true },
                    classrooms: { set: [], connect: userData.classrooms?.map((id) => ({ id: id })) },
                    profileImage: {
                        create: !userData.profileImageId && file ? { path: file.path } : undefined,
                    },
                },
                include: detailedUserFields(),
            });

            return updatedUser;
        });
        // Get user only with visible fields and with embedded actions
        const visibleUser = {
            ...(await prismaClient.user.findUnique({
                where: { id: detailedStoredUser.id },
                ...(await getVisibleUserFields(requester, [detailedStoredUser], true, true, false))[0],
            })),
            actions: (await getPeerUserActions(requester, [detailedStoredUser]))[0],
        };

        res.status(200).json({ message: 'User updated.', data: visibleUser });
    } catch (error: any) {
        const file = req.file as Express.Multer.File;
        if (file) if (existsSync(file.path)) unlinkSync(file.path);
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all users from the database.
 *
 * This function handles the retrieval of all users in the database, validating the user
 * performing the action to then retrieve all users using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get all users
        await checkAuthorization(requester, [], 'getAll');
        // Prisma operation
        const detailedStoredUsers = await prismaClient.user.findMany({ include: detailedUserFields() });
        // Get users only with visible fields and with embedded actions
        const actions = await getPeerUserActions(requester, detailedStoredUsers);
        const filteredFIelds = await getVisibleUserFields(requester, detailedStoredUsers, true, true, false);
        const unfilteredFields = (await getVisibleUserFields(requester, [detailedStoredUsers[0]], true, true, true))[0];
        const unfilteredVisibleUsers = await prismaClient.user.findMany({
            where: { id: { in: detailedStoredUsers.map((user) => user.id) } },
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

/**
 * Gets all users managed by the user from the database.
 *
 * This function handles the retrieval of all users managed by the user in the database,
 * validating the user performing the action to then retrieve all users using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getManagedUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get managed users
        await checkAuthorization(requester, [], 'getManaged');
        // Prisma operation
        const detailedStoredUsers = await prismaClient.user.findMany({
            where: {
                ...(requester.role !== UserRole.ADMIN && {
                    // Admins can manage all users
                    role: { notIn: [UserRole.GUEST, UserRole.ADMIN] },
                    OR: [
                        //{ institutionId: curUser.role !== UserRole.COORDINATOR ? curUser.institutionId : undefined }, // Coordinators can manage users from their institutions and users they created
                        ...(requester.role === UserRole.COORDINATOR ? [{ institutionId: requester.institutionId }] : []), // Coordinators can manage users from their institutions and users they created
                        { creatorId: requester.id }, // Publishers and appliers can only manage users they created
                    ],
                }),
            },
            include: detailedUserFields(),
        });
        // Get users only with visible fields and with embedded actions
        const actions = await getPeerUserActions(requester, detailedStoredUsers);
        const filteredFIelds = await getVisibleUserFields(requester, detailedStoredUsers, true, true, false);
        const unfilteredFields = (await getVisibleUserFields(requester, [detailedStoredUsers[0]], true, true, true))[0];
        const unfilteredVisibleUsers = await prismaClient.user.findMany({
            where: { id: { in: detailedStoredUsers.map((user) => user.id) } },
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

/**
 * Gets an user from the database by ID.
 *
 * This function handles the retrieval of an user in the database by ID, validating the user
 * performing the action to then retrieve the user using Prisma.
 *
 * @param req - The request object, containing the user ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getUser = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const userId: number = parseInt(req.params.userId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get the user
        await checkAuthorization(requester, [userId], 'get');
        // Prisma operation
        const detailedStoredUser = await prismaClient.user.findUniqueOrThrow({ where: { id: userId }, include: detailedUserFields() });
        // Get user only with visible fields and with embedded actions
        const processedUser = {
            ...(await prismaClient.user.findUnique({
                where: { id: userId },
                ...(await getVisibleUserFields(requester, [detailedStoredUser], true, true, false))[0],
            })),
            actions: (await getPeerUserActions(requester, [detailedStoredUser]))[0],
        };

        res.status(200).json({ message: 'User found.', data: processedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Searches users by username in the database.
 *
 * This function handles the search of users by username in the database, validating the user
 * performing the action to then retrieve all users using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT and the term in the body.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const searchUserByUsername = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from passport-jwt
        const requester = req.user as User;
        // Check if user is authorized to search users
        await checkAuthorization(requester, [], 'search');
        // Yup schemas
        const searchUserSchema = yup
            .object()
            .shape({ term: yup.string().min(3).max(20).required() })
            .noUnknown();
        // Yup parsing/validation
        const { term } = await searchUserSchema.validate(req.body, { stripUnknown: false });
        // Prisma operation
        const detailedStoredUsers = await prismaClient.user.findMany({
            where: {
                username: { startsWith: term },
                role: { notIn: [UserRole.GUEST, UserRole.ADMIN] },
                ...(requester.role !== UserRole.ADMIN && {
                    OR: [{ institutionId: requester.institutionId }, { institutionId: null }],
                }),
            },
            include: detailedUserFields(),
        });
        // Get users only with visible fields and with embedded actions
        const actions = await getPeerUserActions(requester, detailedStoredUsers);
        const filteredFIelds = await getVisibleUserFields(requester, detailedStoredUsers, true, true, false);
        const unfilteredFields = (await getVisibleUserFields(requester, [detailedStoredUsers[0]], true, true, true))[0];
        const unfilteredVisibleUsers = await prismaClient.user.findMany({
            where: { id: { in: detailedStoredUsers.map((user) => user.id) } },
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

/**
 * Deletes an user from the database by ID.
 *
 * This function handles the deletion of an user in the database by ID, validating the user
 * performing the action to then delete the user using Prisma.
 *
 * @param req - The request object, containing the user ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const userId: number = parseInt(req.params.userId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to delete the user
        await checkAuthorization(requester, [userId], 'delete');
        // Prisma operation
        const deletedUser = await prismaClient.user.delete({ where: { id: userId }, select: { id: true } });

        res.status(200).json({ message: 'User deleted.', data: deletedUser });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
