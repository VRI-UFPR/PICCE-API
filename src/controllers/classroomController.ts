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
import { detailedUserFields, getPeerUserActions, getVisibleUserFields as getUsersVisibleFields } from './userController';
import fieldsFilter from '../services/fieldsFilter';

/**
 * Retrieve the detailed classrooms fields required for internal endpoint validations.
 *
 * This function handles the creation of a custom select filter that serves as a parameter for Prisma Client to return an
 * classroom with all the fields required for internal endpoint validations.
 *
 * @returns A Prisma select filter object
 */
export const detailedClassroomFields = () => ({
    users: { include: detailedUserFields() },
    institution: { select: { id: true } },
    creator: { select: { id: true } },
});

/**
 * Gets a set of detailed classrooms from a set of IDs
 *
 * This function handles the retrieval of a set of detailed classrooms, with all the fields required for internal
 * endpoint validations, from a set of classrooms IDs using Prisma.
 *
 * @param classroomsIds An array of classrooms IDs
 * @returns A set of detailed classrooms
 */
const getDetailedClassrooms = async (classroomsIds: number[]) => {
    return await prismaClient.classroom.findMany({ where: { id: { in: classroomsIds } }, include: detailedClassroomFields() });
};

/**
 * Retrieves the visible fields for classrooms based on the user's roles and permissions.
 *
 * @param user - The user for whom the visible fields are being determined.
 * @param classrooms - The detailed classrooms for which the visible fields are being determined.
 * @param includeUsers - A boolean indicating whether to include the users of the classrooms in the visible fields.
 * @param ignoreFilters - A boolean indicating whether to ignore role-based filters and grant full access.
 * @returns A promise that resolves to an array of objects representing the visible fields for each classroom.
 */
export const getVisibleFields = async (
    user: User,
    classrooms: Awaited<ReturnType<typeof getDetailedClassrooms>> | [],
    includeUsers: boolean,
    ignoreFilters: boolean
) => {
    const classroomRoles = await getClassroomUserRoles(user, classrooms);

    const mapVisibleFields = (roles: (typeof classroomRoles)[0] | undefined) => {
        const fullAccess = roles ? roles.creator || user.role === UserRole.ADMIN : ignoreFilters;
        const baseAccess = roles
            ? ((roles.viewer || roles.member) && user.role !== UserRole.GUEST && user.role !== UserRole.USER) ||
              roles.institutionMember ||
              roles.creator ||
              user.role === UserRole.ADMIN
            : ignoreFilters;

        const visibleFields = {
            select: {
                id: baseAccess,
                createdAt: baseAccess,
                updatedAt: baseAccess,
                name: baseAccess,
                users: includeUsers && { select: { id: baseAccess, name: fullAccess, username: baseAccess, role: fullAccess } },
                creator: { select: { id: fullAccess, username: fullAccess } },
            },
        };

        return visibleFields;
    };

    const visibleFields = ignoreFilters ? [mapVisibleFields(undefined)] : classroomRoles.map(mapVisibleFields);

    return visibleFields;
};

/**
 * Retrieves a user's roles against a given set of classrooms.
 *
 * @param user - The user whose roles are being determined.
 * @param classrooms - The detailed classrooms for which the roles are being determined.
 * @returns A promise that resolves to an array of objects representing the roles of the user for each classroom.
 *
 * Each role object contains the following properties:
 * - `creator` - Whether the user is the creator of the classroom.
 * - `institutionMember` - Whether the user is a member of the institution to which the classroom belongs.
 * - `member` - Whether the user is a member of the classroom.
 * - `viewer` - Whether the user is a viewer of the classroom.
 */
const getClassroomUserRoles = async (user: User, classrooms: Awaited<ReturnType<typeof getDetailedClassrooms>>) => {
    const roles = classrooms.map((classroom) => {
        const creator = classroom.creator.id === user.id;
        const member = classroom.users.some(({ id }) => id === user.id);
        const institutionMember = user.institutionId && classroom.institution?.id === user.institutionId;
        const viewer = !classroom.institution && user.role !== UserRole.GUEST && user.role !== UserRole.USER;

        return { creator, institutionMember, member, viewer };
    });

    return roles;
};

/**
 * Retrieves the actions that a user can perform on a set of classrooms.
 *
 * @param user - The user whose actions are being determined.
 * @param classrooms - The detailed classrooms for which the actions are being determined.
 * @returns A promise that resolves to an array of objects representing the actions that the user can perform on each classroom.
 *
 * The returned action object contains the following properties:
 * - `toDelete` - Whether the user can delete the classroom.
 * - `toGet` - Whether the user can get the classroom.
 * - `toUpdate` - Whether the user can update the classroom.
 */
export const getClassroomUserActions = async (user: User, classrooms: Awaited<ReturnType<typeof getDetailedClassrooms>>) => {
    const classroomsRoles = await getClassroomUserRoles(user, classrooms);

    const actions = classroomsRoles.map((roles) => {
        // Only institution members (except users and guests)/creator can perform update operations on classrooms
        const toUpdate =
            roles.creator ||
            (roles.institutionMember && user.role !== UserRole.USER && user.role !== UserRole.GUEST) ||
            user.role === UserRole.ADMIN;
        // Only institution members (except users and guests)/creator can perform delete operations on classrooms
        const toDelete =
            roles.creator ||
            (roles.institutionMember && user.role !== UserRole.USER && user.role !== UserRole.GUEST) ||
            user.role === UserRole.ADMIN;
        // Only institution members (except users and guests)/creator can perform get operations on classrooms
        const toGet =
            roles.creator ||
            roles.viewer ||
            (roles.institutionMember && user.role !== UserRole.USER && user.role !== UserRole.GUEST) ||
            user.role === UserRole.ADMIN;
        // No one can perform get all classrooms operation on classrooms
        const toGetAll = user.role === UserRole.ADMIN;
        // Anyone except users and guests can perform create operations on classrooms
        const toSearch = user.role !== UserRole.USER && user.role !== UserRole.GUEST;
        // Anyone can perform getMy operation on classrooms
        const toGetMy = true;
        // Anyone can perform getManaged operation on classrooms
        const toGetManaged = true;

        return { toDelete, toGet, toUpdate };
    });

    return actions;
};

/**
 * Validates the institution of a classroom
 *
 * @param user - The user whose institution is being validated.
 * @param institutionId - The institution ID to validate.
 * @throws An error if the user is not authorized to perform the action.
 *
 * The function performs the following validations:
 * - If the institution ID is provided, the user must be from that institution.
 *
 * @returns void
 */
const validateInstitution = (user: User, institutionId: number | undefined) => {
    if (institutionId && user.institutionId !== institutionId) throw new Error('This user is not authorized to perform this action');
};

/**
 * Checks if the user is authorized to perform a specific action on a set of classrooms.
 *
 * @param requester - The user object containing requester user details.
 * @param classroomsIds - The classrooms IDs the user wants to perform the action on.
 * @param action - The action the user wants to perform (e.g., 'create', 'update', 'getAll', 'get', 'delete', 'search', 'getMy', 'getManaged').
 *
 * @throws Will throw an error if the classroom institution is not valid.
 * @returns A promise that resolves if the user is authorized to perform the action.
 */
const checkAuthorization = async (requester: User, classroomsIds: number[], action: string) => {
    if (requester.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create': {
            // Anyone except users and guests can perform create operations on classrooms (if institutionId is provided, the user must be from that institution)
            if (requester.role === UserRole.USER || requester.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'update': {
            if ((await getClassroomUserActions(requester, await getDetailedClassrooms(classroomsIds))).some(({ toUpdate }) => !toUpdate))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getAll':
            // No one can perform get all classrooms operation on classrooms
            throw new Error('This user is not authorized to perform this action');
        case 'get': {
            if ((await getClassroomUserActions(requester, await getDetailedClassrooms(classroomsIds))).some(({ toGet }) => !toGet))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'delete': {
            if ((await getClassroomUserActions(requester, await getDetailedClassrooms(classroomsIds))).some(({ toDelete }) => !toDelete))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'search':
            // Anyone except USERS and GUESTS can perform search classrooms operation
            if (requester.role === UserRole.USER || requester.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        case 'getMy':
        case 'getManaged':
            // Anyone can perform getMy operation on classrooms (since the result is filtered according to the user)
            break;
    }
};

/**
 * Validates the users of a classroom
 *
 * @param institutionId - The institution ID of the classroom.
 * @param users - The users of the classroom.
 * @throws Will throw an error if the classroom users are not valid.
 *
 * The function performs the following validations:
 * - A classroom can not contain GUEST or ADMIN users.
 * - An institution classroom can only contain users from the institution.
 *
 * @returns void
 */
const validateUsers = async (institutionId: number | undefined, users: number[]) => {
    const guestUsers = await prismaClient.user.findMany({ where: { id: { in: users }, role: { in: [UserRole.GUEST, UserRole.ADMIN] } } });
    if (guestUsers.length > 0) throw new Error('A classroom can not contain GUEST or ADMIN users.');
    if (institutionId) {
        const invalidUsers = await prismaClient.user.findMany({ where: { id: { in: users }, institutionId: { not: institutionId } } });
        if (invalidUsers.length > 0) throw new Error('An institution classroom can only contain users from the institution.');
    }
};

/**
 * Creates a new classroom in the database.
 *
 * This function handles the creation of a new classroom, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the classroom data in the body and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const createClassroom = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createClassroomSchema = yup
            .object()
            .shape({
                name: yup.string().min(3).max(20).required(),
                institutionId: yup.number(),
                users: yup.array().of(yup.number()).min(2).required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const classroomData = await createClassroomSchema.validate(req.body);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to create a classroom
        await checkAuthorization(requester, [], 'create');
        // Check if users are from the same institution
        await validateUsers(classroomData.institutionId, classroomData.users as number[]);
        // Check if user is authorized to create a classroom in this institution
        validateInstitution(requester, classroomData.institutionId);
        // Prisma operation
        const detailedStoredClassroom = await prismaClient.classroom.create({
            data: {
                name: classroomData.name,
                institution: { connect: classroomData.institutionId ? { id: classroomData.institutionId } : undefined },
                users: { connect: classroomData.users.map((id) => ({ id: id })) },
                creator: { connect: { id: requester.id } },
            },
            include: detailedClassroomFields(),
        });
        // Get classroom only with visible fields, with embedded actions and with unfiltered users
        const fieldsWUnfilteredUsers = (await getVisibleFields(requester, [detailedStoredClassroom], true, false))[0];
        fieldsWUnfilteredUsers.select.users = (await getUsersVisibleFields(requester, [], false, false, true))[0];
        const visibleClassroomWUnfilteredUsers = {
            ...(await prismaClient.classroom.findUnique({ where: { id: detailedStoredClassroom.id }, ...fieldsWUnfilteredUsers })),
            actions: (await getClassroomUserActions(requester, [detailedStoredClassroom]))[0],
        };
        // Get users only with visible fields and with embedded actions
        const detailedUsers = detailedStoredClassroom.users;
        const userActions = await getPeerUserActions(requester, detailedUsers);
        const filteredUserFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
        const visibleClassroom = {
            ...visibleClassroomWUnfilteredUsers,
            users: visibleClassroomWUnfilteredUsers.users?.map((user, i) => ({
                ...fieldsFilter(user, filteredUserFields[i]),
                actions: userActions[i],
            })),
        };

        res.status(201).json({ message: 'Classroom created.', data: visibleClassroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Updates an existing classroom in the database.
 *
 * This function handles the update of a existing classroom, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the classroom data in the body, the user object from Passport-JWT and the address ID in the params.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const updateClassroom = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const classroomId: number = parseInt(req.params.classroomId);
        // Yup schemas
        const updateClassroomSchema = yup
            .object()
            .shape({
                name: yup.string().min(3).max(20),
                institutionId: yup.number(),
                users: yup.array().of(yup.number()).min(2),
            })
            .noUnknown();
        // Yup parsing/validation
        const classroomData = await updateClassroomSchema.validate(req.body);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to update this classroom
        await checkAuthorization(requester, [classroomId], 'update');
        // Check if users are from the same institution
        await validateUsers(classroomData.institutionId, classroomData.users as number[]);
        // Check if user is authorized to update this classroom in this institution
        validateInstitution(requester, classroomData.institutionId);
        // Prisma operation
        const detailedStoredClassroom = await prismaClient.classroom.update({
            where: { id: classroomId },
            data: {
                name: classroomData.name,
                institution: classroomData.institutionId ? { connect: { id: classroomData.institutionId } } : { disconnect: true },
                users: { set: [], connect: classroomData.users?.map((id) => ({ id: id })) },
            },
            include: detailedClassroomFields(),
        });

        // Get classroom only with visible fields and with embedded actions
        const fieldsWUnfilteredUsers = (await getVisibleFields(requester, [detailedStoredClassroom], true, false))[0];
        fieldsWUnfilteredUsers.select.users = (await getUsersVisibleFields(requester, [], false, false, true))[0];
        const visibleClassroomWUnfilteredUsers = {
            ...(await prismaClient.classroom.findUnique({ where: { id: detailedStoredClassroom.id }, ...fieldsWUnfilteredUsers })),
            actions: (await getClassroomUserActions(requester, [detailedStoredClassroom]))[0],
        };
        // Get users only with visible fields and with embedded actions
        const detailedUsers = detailedStoredClassroom.users;
        const userActions = await getPeerUserActions(requester, detailedUsers);
        const filteredUserFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
        const visibleClassroom = {
            ...visibleClassroomWUnfilteredUsers,
            users: visibleClassroomWUnfilteredUsers.users?.map((user, i) => ({
                ...fieldsFilter(user, filteredUserFields[i]),
                actions: userActions[i],
            })),
        };

        res.status(200).json({ message: 'Classroom updated.', data: visibleClassroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all classrooms from the database.
 *
 * This function handles the retrieval of all classrooms in the database, validating the user
 * performing the action to then retrieve all classrooms using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getAllClassrooms = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get all classrooms (only roles above USER)
        await checkAuthorization(requester, [], 'getAll');
        // Prisma operation
        const detailedStoredClassrooms = await prismaClient.classroom.findMany({ include: detailedClassroomFields() });
        // Get classrooms only with visible fields and with embedded actions
        const actions = await getClassroomUserActions(requester, detailedStoredClassrooms);
        const filteredFields = await getVisibleFields(requester, detailedStoredClassrooms, true, false);
        const unfilteredFields = (await getVisibleFields(requester, [], true, true))[0];
        unfilteredFields.select.users = (await getUsersVisibleFields(requester, [], false, false, true))[0];
        const unfilteredClassrooms = await prismaClient.classroom.findMany({
            where: { id: { in: detailedStoredClassrooms.map(({ id }) => id) } },
            ...unfilteredFields,
        });
        const visibleClassrooms = await Promise.all(
            unfilteredClassrooms.map(async (classroom, i) => {
                const usersActions = await getPeerUserActions(requester, detailedStoredClassrooms[i].users);
                const usersFields = await getUsersVisibleFields(requester, detailedStoredClassrooms[i].users, false, false, false);
                return {
                    ...fieldsFilter(classroom, filteredFields[i]),
                    users: classroom.users.map((user, j) => ({
                        ...fieldsFilter(user, usersFields[j]),
                        actions: usersActions[j],
                    })),
                    actions: actions[i],
                };
            })
        );

        res.status(200).json({ message: 'All classrooms found.', data: visibleClassrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets an classroom from the database by ID.
 *
 * This function handles the retrieval of an classroom in the database by ID, validating the user
 * performing the action to then retrieve the classroom using Prisma.
 *
 * @param req - The request object, containing the classroom ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getClassroom = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const classroomId: number = parseInt(req.params.classroomId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get this classroom
        await checkAuthorization(requester, [classroomId], 'get');
        // Prisma operation
        const detailedStoredClassroom = await prismaClient.classroom.findUniqueOrThrow({
            where: { id: classroomId },
            include: detailedClassroomFields(),
        });
        // Get classroom only with visible fields and with embedded actions
        const fieldsWUnfilteredUsers = (await getVisibleFields(requester, [detailedStoredClassroom], true, false))[0];
        fieldsWUnfilteredUsers.select.users = (await getUsersVisibleFields(requester, [], false, false, true))[0];
        const visibleClassroomWUnfilteredUsers = {
            ...(await prismaClient.classroom.findUnique({ where: { id: detailedStoredClassroom.id }, ...fieldsWUnfilteredUsers })),
            actions: (await getClassroomUserActions(requester, [detailedStoredClassroom]))[0],
        };
        // Get users only with visible fields and with embedded actions
        const detailedUsers = detailedStoredClassroom.users;
        const userActions = await getPeerUserActions(requester, detailedUsers);
        const filteredUserFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
        const visibleClassroom = {
            ...visibleClassroomWUnfilteredUsers,
            users: visibleClassroomWUnfilteredUsers.users?.map((user, i) => ({
                ...fieldsFilter(user, filteredUserFields[i]),
                actions: userActions[i],
            })),
        };

        res.status(200).json({ message: 'Classroom found.', data: visibleClassroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all classrooms associated with the user from the database.
 *
 * This function handles the retrieval of all classrooms associated with the user in the database,
 * validating the user performing the action to then retrieve all classrooms using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getMyClassrooms = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get his classrooms
        await checkAuthorization(requester, [], 'getMy');
        // Prisma operation
        const detailedStoredClassrooms = await prismaClient.classroom.findMany({
            where: { users: { some: { id: requester.id } } },
            include: detailedClassroomFields(),
        });
        // Get classrooms only with visible fields and with embedded actions
        const actions = await getClassroomUserActions(requester, detailedStoredClassrooms);
        const filteredFields = await getVisibleFields(requester, detailedStoredClassrooms, true, false);
        const unfilteredFields = (await getVisibleFields(requester, [], true, true))[0];
        unfilteredFields.select.users = (await getUsersVisibleFields(requester, [], false, false, true))[0];
        const unfilteredClassrooms = await prismaClient.classroom.findMany({
            where: { id: { in: detailedStoredClassrooms.map(({ id }) => id) } },
            ...unfilteredFields,
        });
        const visibleClassrooms = await Promise.all(
            unfilteredClassrooms.map(async (classroom, i) => {
                const usersActions = await getPeerUserActions(requester, detailedStoredClassrooms[i].users);
                const usersFields = await getUsersVisibleFields(requester, detailedStoredClassrooms[i].users, false, false, false);
                return {
                    ...fieldsFilter(classroom, filteredFields[i]),
                    users: classroom.users.map((user, j) => ({
                        ...fieldsFilter(user, usersFields[j]),
                        actions: usersActions[j],
                    })),
                    actions: actions[i],
                };
            })
        );

        res.status(200).json({ message: 'My classrooms found.', data: visibleClassrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all classrooms managed by the user from the database.
 *
 * This function handles the retrieval of all classrooms managed by the user in the database,
 * validating the user performing the action to then retrieve all classrooms using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getManagedClassrooms = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get his managed classrooms
        await checkAuthorization(requester, [], 'getManaged');
        // Prisma operation
        const detailedStoredClassrooms = await prismaClient.classroom.findMany({
            where: {
                ...(requester.role !== UserRole.ADMIN && {
                    // Admins can manage all classrooms
                    OR: [
                        ...(requester.role === UserRole.COORDINATOR ? [{ institutionId: requester.institutionId }] : []), // Coordinators can manage classrooms from their institutions and users they created
                        { creatorId: requester.id }, // Publishers and appliers can only manage classrooms they created
                    ],
                }),
            },
            include: detailedClassroomFields(),
        });
        // Get classrooms only with visible fields and with embedded actions
        const actions = await getClassroomUserActions(requester, detailedStoredClassrooms);
        const filteredFields = await getVisibleFields(requester, detailedStoredClassrooms, true, false);
        const unfilteredFields = (await getVisibleFields(requester, [], true, true))[0];
        unfilteredFields.select.users = (await getUsersVisibleFields(requester, [], false, false, true))[0];
        const unfilteredClassrooms = await prismaClient.classroom.findMany({
            where: { id: { in: detailedStoredClassrooms.map(({ id }) => id) } },
            ...unfilteredFields,
        });
        const visibleClassrooms = await Promise.all(
            unfilteredClassrooms.map(async (classroom, i) => {
                const usersActions = await getPeerUserActions(requester, detailedStoredClassrooms[i].users);
                const usersFields = await getUsersVisibleFields(requester, detailedStoredClassrooms[i].users, false, false, false);
                return {
                    ...fieldsFilter(classroom, filteredFields[i]),
                    users: classroom.users.map((user, j) => ({
                        ...fieldsFilter(user, usersFields[j]),
                        actions: usersActions[j],
                    })),
                    actions: actions[i],
                };
            })
        );

        res.status(200).json({ message: 'My managed classrooms found.', data: visibleClassrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Searches classrooms by name in the database.
 *
 * This function handles the search of classrooms by name in the database, validating the user
 * performing the action to then retrieve all classrooms using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT and the term in the body.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const searchClassroomByName = async (req: Request, res: Response): Promise<void> => {
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
        const { term } = await searchUserSchema.validate(req.body);
        // Prisma operation
        const detailedStoredClassrooms = await prismaClient.classroom.findMany({
            where: {
                name: { startsWith: term },
                ...(requester.role !== UserRole.ADMIN && {
                    OR: [{ institutionId: requester.institutionId }, { institutionId: null }],
                }),
            },
            include: detailedClassroomFields(),
        });
        // Get classrooms only with visible fields and with embedded actions
        const actions = await getClassroomUserActions(requester, detailedStoredClassrooms);
        const filteredFields = await getVisibleFields(requester, detailedStoredClassrooms, true, false);
        const unfilteredFields = (await getVisibleFields(requester, [], true, true))[0];
        unfilteredFields.select.users = (await getUsersVisibleFields(requester, [], false, false, true))[0];
        const unfilteredClassrooms = await prismaClient.classroom.findMany({
            where: { id: { in: detailedStoredClassrooms.map(({ id }) => id) } },
            ...unfilteredFields,
        });
        const visibleClassrooms = await Promise.all(
            unfilteredClassrooms.map(async (classroom, i) => {
                const usersActions = await getPeerUserActions(requester, detailedStoredClassrooms[i].users);
                const usersFields = await getUsersVisibleFields(requester, detailedStoredClassrooms[i].users, false, false, false);
                return {
                    ...fieldsFilter(classroom, filteredFields[i]),
                    users: classroom.users.map((user, j) => ({
                        ...fieldsFilter(user, usersFields[j]),
                        actions: usersActions[j],
                    })),
                    actions: actions[i],
                };
            })
        );

        res.status(200).json({ message: 'Searched classrooms found.', data: visibleClassrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Deletes an classroom from the database by ID.
 *
 * This function handles the deletion of an classroom in the database by ID, validating the user
 * performing the action to then delete the classroom using Prisma.
 *
 * @param req - The request object, containing the classroom ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const deleteClassroom = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const classroomId: number = parseInt(req.params.classroomId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to delete this classroom
        await checkAuthorization(requester, [classroomId], 'delete');
        // Prisma operation
        const deletedClassroom = await prismaClient.classroom.delete({ where: { id: classroomId }, select: { id: true } });

        res.status(200).json({ message: 'Classroom deleted.', data: deletedClassroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
