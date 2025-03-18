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
import { InstitutionType, User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';
import { detailedUserFields, getPeerUserActions, getVisibleUserFields as getUsersVisibleFields } from './userController';
import { detailedClassroomFields, getClassroomUserActions, getVisibleFields as getClassroomVisibleFields } from './classroomController';
import fieldsFilter from '../services/fieldsFilter';

/**
 * Retrieve the detailed institutions fields required for internal endpoint validations.
 *
 * This function handles the creation of a custom select filter that serves as a parameter for Prisma Client to return an
 * institution with all the fields required for internal endpoint validations.
 *
 * @returns A Prisma select filter object
 */
const detailedInstitutionFields = () => ({
    users: { include: detailedUserFields() },
    classrooms: { include: detailedClassroomFields() },
});

/**
 * Gets a set of detailed institutions from a set of IDs
 *
 * This function handles the retrieval of a set of detailed institutions, with all the fields required for internal
 * endpoint validations, from a set of institutions IDs using Prisma.
 *
 * @param institutionsIds An array of institutions IDs
 * @returns A set of detailed institutions
 */
const getDetailedInstitutions = async (institutionsIds: number[]) => {
    return await prismaClient.institution.findMany({
        where: { id: { in: institutionsIds } },
        include: detailedInstitutionFields(),
    });
};

/**
 * Retrieves a user's roles against a given set of institutions.
 *
 * @param user - The user whose roles are being determined.
 * @param institutions - The detailed institutions for which the roles are being determined.
 * @returns A promise that resolves to an array of objects representing the roles of the user for each institution.
 *
 * Each role object contains the following properties:
 * - `member` - Whether the user is a member of the institution.
 * - `coordinator` - Whether the user is a coordinator of the institution.
 */
const getInstitutionUserRoles = async (user: User, institutions: Awaited<ReturnType<typeof getDetailedInstitutions>>) => {
    const roles = institutions.map((institution) => {
        const member = institution.id === user.institutionId;
        const coordinator = institution.id === user.institutionId && user.role === UserRole.COORDINATOR;
        return { member, coordinator };
    });
    return roles;
};

/**
 * Retrieves the visible fields for institutions based on the user's roles and permissions.
 *
 * @param user - The user for whom the visible fields are being determined.
 * @param institutions - The detailed institutions for which the visible fields are being determined.
 * @param includeUsers - A boolean indicating whether to include visible fields for users.
 * @param includeClassrooms - A boolean indicating whether to include visible fields for classrooms.
 * @param ignoreFilters - A boolean indicating whether to ignore role-based filters and grant full access.
 * @returns A promise that resolves to an array of objects representing the visible fields for each institution.
 */
const getVisibleFields = async (
    user: User,
    institutions: Awaited<ReturnType<typeof getDetailedInstitutions>>,
    includeUsers: boolean,
    includeClassrooms: boolean,
    ignoreFilters: boolean
) => {
    const institutionsRoles = await getInstitutionUserRoles(user, institutions);

    const mapVisibleFields = (roles: (typeof institutionsRoles)[0] | undefined) => {
        const fullAccess = roles ? roles.coordinator || user.role === UserRole.ADMIN : ignoreFilters;
        const creatorAccess = roles
            ? (roles.member && user.role !== UserRole.GUEST && user.role !== UserRole.USER) ||
              roles.coordinator ||
              user.role === UserRole.ADMIN
            : ignoreFilters;
        const baseAccess = roles ? roles.member || roles.coordinator || user.role === UserRole.ADMIN : ignoreFilters;

        const visibleFields = {
            select: {
                id: baseAccess,
                createdAt: baseAccess,
                updatedAt: baseAccess,
                name: baseAccess,
                type: baseAccess,
                address: {
                    select: {
                        city: baseAccess,
                        state: baseAccess,
                        country: baseAccess,
                    },
                },
                users: includeUsers && {
                    select: {
                        id: creatorAccess,
                        name: creatorAccess,
                        username: creatorAccess,
                        role: creatorAccess,
                    },
                },
                classrooms: includeClassrooms && {
                    select: {
                        id: creatorAccess,
                        name: creatorAccess,
                        users: {
                            select: {
                                id: creatorAccess,
                                name: creatorAccess,
                                username: creatorAccess,
                                role: creatorAccess,
                            },
                        },
                    },
                },
            },
        };

        return visibleFields;
    };

    const fields = ignoreFilters ? [mapVisibleFields(undefined)] : institutionsRoles.map(mapVisibleFields);

    return fields;
};

/**
 * Retrieves the actions that a user can perform on a set of institutions.
 *
 * @param user - The user whose actions are being determined.
 * @param institutions - The detailed institutions for which the actions are being determined.
 * @returns A promise that resolves to an array of objects representing the actions that the user can perform on each institution.
 *
 * The returned action object contains the following properties:
 * - `toUpdate` - Whether the user can perform update operations on the institution.
 * - `toDelete` - Whether the user can perform delete operations on the institution.
 * - `toGet` - Whether the user can perform get operations on the institution.
 */
const getInstitutionUserActions = async (user: User, institutions: Awaited<ReturnType<typeof getDetailedInstitutions>>) => {
    const institutionsRoles = await getInstitutionUserRoles(user, institutions);

    const actions = institutionsRoles.map((roles) => {
        // Only the coordinator can perform update operations on an institution
        const toUpdate = roles.coordinator || user.role === UserRole.ADMIN;
        // Only the coordinator can perform delete operations on an institution
        const toDelete = roles.coordinator || user.role === UserRole.ADMIN;
        // Only members (except users and guests) can perform get operations on institutions
        const toGet = (roles.member && user.role !== UserRole.USER && user.role !== UserRole.GUEST) || user.role === UserRole.ADMIN;
        // No one can perform getAll operations on institutions
        const toGetAll = user.role === UserRole.ADMIN;
        // Anyone (except users and guests) can perform getVisible operations on institutions
        const toGetVisible = user.role !== UserRole.USER && user.role !== UserRole.GUEST;

        return { toDelete, toGet, toUpdate };
    });

    return actions;
};

/**
 * Checks if the user is authorized to perform a specific action on a set of institutions.
 *
 * @param requester - The user object containing requester user details.
 * @param institutionsIds - The IDs of the institutions the user wants to perform the action on.
 * @param action - The action the user wants to perform (e.g., 'create', 'update', 'delete', 'get', 'getAll', 'getVisible').
 *
 * @throws Will throw an error if the user is not authorized to perform the action.
 * @returns A promise that resolves if the user is authorized to perform the action.
 */
const checkAuthorization = async (requester: User, institutionsIds: number[], action: string) => {
    if (requester.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create':
        case 'getAll': {
            // No one can perform create/getAll operations on institutions
            throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'update': {
            if (
                (await getInstitutionUserActions(requester, await getDetailedInstitutions(institutionsIds))).some(
                    ({ toUpdate }) => !toUpdate
                )
            )
                throw new Error('This user is not authorized to perform this action');
        }
        case 'delete': {
            if (
                (await getInstitutionUserActions(requester, await getDetailedInstitutions(institutionsIds))).some(
                    ({ toDelete }) => !toDelete
                )
            )
                throw new Error('This user is not authorized to perform this action');
        }
        case 'get': {
            if ((await getInstitutionUserActions(requester, await getDetailedInstitutions(institutionsIds))).some(({ toGet }) => !toGet))
                throw new Error('This user is not authorized to perform this action');
        }
        case 'getVisible': {
            // Anyone (except users and guests) can perform getVisible operations on institutions
            if (requester.role === UserRole.USER || requester.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        }
    }
};

/**
 * Creates a new institution in the database.
 *
 * This function handles the creation of a new institution, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the institution data in the body and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const createInstitution = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createInstitutionSchema = yup
            .object()
            .shape({
                id: yup.number(),
                name: yup.string().min(1).max(255).required(),
                type: yup.string().oneOf(Object.values(InstitutionType)).required(),
                addressId: yup.number().required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const institutionData = await createInstitutionSchema.validate(req.body);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to create an institution
        await checkAuthorization(requester, [], 'create');
        // Prisma operation
        const detailedStoredInstitution = await prismaClient.institution.create({
            data: { id: institutionData.id, name: institutionData.name, type: institutionData.type, addressId: institutionData.addressId },
            include: detailedInstitutionFields(),
        });
        // Get institution only with visible fields and with embedded actions
        const fieldsWUnfilteredUsers = {
            select: {
                ...(await getVisibleFields(requester, [detailedStoredInstitution], true, true, false))[0].select,
                users: (await getUsersVisibleFields(requester, [], true, true, true))[0],
                classrooms: (await getClassroomVisibleFields(requester, [], true, true))[0],
            },
        };
        const visibleInstitutionWUnfilteredUsers = {
            ...(await prismaClient.institution.findUnique({ where: { id: detailedStoredInstitution.id }, ...fieldsWUnfilteredUsers })),
            actions: (await getInstitutionUserActions(requester, [detailedStoredInstitution]))[0],
        };
        // Get users only with visible fields and with embedded actions
        const detailedUsers = detailedStoredInstitution.users;
        const userActions = await getPeerUserActions(requester, detailedUsers);
        const filteredUserFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
        const detailedClassrooms = detailedStoredInstitution.classrooms;
        const classroomActions = await getClassroomUserActions(requester, detailedClassrooms);
        const filteredClassroomFields = await getClassroomVisibleFields(requester, detailedClassrooms, true, false);
        const visibleInstitution = {
            ...visibleInstitutionWUnfilteredUsers,
            users: visibleInstitutionWUnfilteredUsers.users?.map((user, i) => ({
                ...fieldsFilter(user, filteredUserFields[i]),
                actions: userActions[i],
            })),
            classrooms: await Promise.all(
                (visibleInstitutionWUnfilteredUsers.classrooms ?? []).map(async (classroom, i) => {
                    const detailedUsers = detailedClassrooms[i].users;
                    const userActions = await getPeerUserActions(requester, detailedUsers);
                    const userFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
                    return {
                        ...fieldsFilter(classroom, filteredClassroomFields[i]),
                        users: classroom.users.map((user, j) => ({
                            ...fieldsFilter(user, userFields[j]),
                            actions: userActions[j],
                        })),
                        actions: classroomActions[i],
                    };
                })
            ),
        };

        res.status(201).json({ message: 'Institution created.', data: visibleInstitution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Updates an existing institution in the database.
 *
 * This function handles the update of a existing institution, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the institution data in the body, the user object from Passport-JWT and the address ID in the params.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const updateInstitution = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const institutionId: number = parseInt(req.params.institutionId);
        // Yup schemas
        const updateInstitutionSchema = yup
            .object()
            .shape({
                name: yup.string().min(1).max(255),
                type: yup.string().oneOf(Object.values(InstitutionType)),
                addressId: yup.number(),
            })
            .noUnknown();
        // Yup parsing/validation
        const institutionData = await updateInstitutionSchema.validate(req.body);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to update an institution
        await checkAuthorization(requester, [institutionId], 'update');
        // Prisma operation
        const detailedStoredInstitution = await prismaClient.institution.update({
            where: { id: institutionId },
            data: { name: institutionData.name, type: institutionData.type, addressId: institutionData.addressId },
            include: detailedInstitutionFields(),
        });
        const fieldsWUnfilteredUsers = {
            select: {
                ...(await getVisibleFields(requester, [detailedStoredInstitution], true, true, false))[0].select,
                users: (await getUsersVisibleFields(requester, [], true, true, true))[0],
                classrooms: (await getClassroomVisibleFields(requester, [], true, true))[0],
            },
        };
        const visibleInstitutionWUnfilteredUsers = {
            ...(await prismaClient.institution.findUnique({ where: { id: detailedStoredInstitution.id }, ...fieldsWUnfilteredUsers })),
            actions: (await getInstitutionUserActions(requester, [detailedStoredInstitution]))[0],
        };
        // Get users only with visible fields and with embedded actions
        const detailedUsers = detailedStoredInstitution.users;
        const userActions = await getPeerUserActions(requester, detailedUsers);
        const filteredUserFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
        const detailedClassrooms = detailedStoredInstitution.classrooms;
        const classroomActions = await getClassroomUserActions(requester, detailedClassrooms);
        const filteredClassroomFields = await getClassroomVisibleFields(requester, detailedClassrooms, true, false);
        const visibleInstitution = {
            ...visibleInstitutionWUnfilteredUsers,
            users: visibleInstitutionWUnfilteredUsers.users?.map((user, i) => ({
                ...fieldsFilter(user, filteredUserFields[i]),
                actions: userActions[i],
            })),
            classrooms: await Promise.all(
                (visibleInstitutionWUnfilteredUsers.classrooms ?? []).map(async (classroom, i) => {
                    const detailedUsers = detailedClassrooms[i].users;
                    const userActions = await getPeerUserActions(requester, detailedUsers);
                    const userFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
                    return {
                        ...fieldsFilter(classroom, filteredClassroomFields[i]),
                        users: classroom.users.map((user, j) => ({
                            ...fieldsFilter(user, userFields[j]),
                            actions: userActions[j],
                        })),
                        actions: classroomActions[i],
                    };
                })
            ),
        };

        res.status(200).json({ message: 'Institution updated.', data: visibleInstitution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all institutions from the database.
 *
 * This function handles the retrieval of all institutions in the database, validating the user
 * performing the action to then retrieve all institutions using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getAllInstitutions = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get all institutions (only admins)
        await checkAuthorization(requester, [], 'getAll');
        // Prisma operation
        const detailedStoredInstitutions = await prismaClient.institution.findMany({ include: detailedInstitutionFields() });
        // Get institutions only with visible fields and with embedded actions
        const actions = await getInstitutionUserActions(requester, detailedStoredInstitutions);
        const filteredFields = await getVisibleFields(requester, detailedStoredInstitutions, true, true, false);
        const unfilteredFields = {
            select: {
                ...(await getVisibleFields(requester, detailedStoredInstitutions, true, true, true))[0].select,
                users: (await getUsersVisibleFields(requester, [], false, false, true))[0],
                classrooms: (await getClassroomVisibleFields(requester, [], true, true))[0],
            },
        };
        const unfilteredInstitutionWUsers = await prismaClient.institution.findMany({
            where: { id: { in: detailedStoredInstitutions.map(({ id }) => id) } },
            ...unfilteredFields,
        });
        const visibleInstitutions = await Promise.all(
            unfilteredInstitutionWUsers.map(async (institution, i) => {
                const detailedUsers = detailedStoredInstitutions[i].users;
                const userActions = await getPeerUserActions(requester, detailedUsers);
                const userFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
                const detailedClassrooms = detailedStoredInstitutions[i].classrooms;
                const classroomActions = await getClassroomUserActions(requester, detailedClassrooms);
                const classroomFields = await getClassroomVisibleFields(requester, detailedClassrooms, true, false);
                return {
                    ...fieldsFilter(institution, filteredFields[i]),
                    users: institution.users?.map((user, j) => ({
                        ...fieldsFilter(user, userFields[j]),
                        actions: userActions[j],
                    })),
                    classrooms: await Promise.all(
                        institution.classrooms.map(async (classroom, j) => {
                            const detailedUsers = detailedClassrooms[j].users;
                            const userActions = await getPeerUserActions(requester, detailedUsers);
                            const userFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
                            return {
                                ...fieldsFilter(classroom, classroomFields[j]),
                                users: classroom.users.map((user, k) => ({
                                    ...fieldsFilter(user, userFields[k]),
                                    actions: userActions[k],
                                })),
                                actions: classroomActions[j],
                            };
                        })
                    ),
                    actions: actions[i],
                };
            })
        );

        res.status(200).json({ message: 'All institutions found.', data: visibleInstitutions });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all visible institutions from the database.
 *
 * This function handles the retrieval of all visible institutions in the database, validating the user
 * performing the action to then retrieve all visible institutions using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getVisibleInstitutions = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get their institutions
        await checkAuthorization(requester, [], 'getVisible');
        // Prisma operation
        const detailedStoredInstitutions =
            requester.role === UserRole.ADMIN
                ? // Admins can see all institutions
                  await prismaClient.institution.findMany({ include: detailedInstitutionFields() })
                : // Other users can see only their institutions
                  await prismaClient.institution.findMany({
                      where: { users: { some: { id: requester.id } } },
                      include: detailedInstitutionFields(),
                  });
        // Get institutions only with visible fields and with embedded actions
        const actions = await getInstitutionUserActions(requester, detailedStoredInstitutions);
        const filteredFields = await getVisibleFields(requester, detailedStoredInstitutions, true, true, false);
        const unfilteredFields = {
            select: {
                ...(await getVisibleFields(requester, detailedStoredInstitutions, true, true, true))[0].select,
                users: (await getUsersVisibleFields(requester, [], false, false, true))[0],
                classrooms: (await getClassroomVisibleFields(requester, [], true, true))[0],
            },
        };
        const unfilteredInstitutionWUsers = await prismaClient.institution.findMany({
            where: { id: { in: detailedStoredInstitutions.map(({ id }) => id) } },
            ...unfilteredFields,
        });
        const visibleInstitutions = await Promise.all(
            unfilteredInstitutionWUsers.map(async (institution, i) => {
                const detailedUsers = detailedStoredInstitutions[i].users;
                const userActions = await getPeerUserActions(requester, detailedUsers);
                const userFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
                const detailedClassrooms = detailedStoredInstitutions[i].classrooms;
                const classroomActions = await getClassroomUserActions(requester, detailedClassrooms);
                const classroomFields = await getClassroomVisibleFields(requester, detailedClassrooms, true, false);
                return {
                    ...fieldsFilter(institution, filteredFields[i]),
                    users: institution.users?.map((user, j) => ({
                        ...fieldsFilter(user, userFields[j]),
                        actions: userActions[j],
                    })),
                    classrooms: await Promise.all(
                        institution.classrooms.map(async (classroom, j) => {
                            const detailedUsers = detailedClassrooms[j].users;
                            const userActions = await getPeerUserActions(requester, detailedUsers);
                            const userFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
                            return {
                                ...fieldsFilter(classroom, classroomFields[j]),
                                users: classroom.users.map((user, k) => ({
                                    ...fieldsFilter(user, userFields[k]),
                                    actions: userActions[k],
                                })),
                                actions: classroomActions[j],
                            };
                        })
                    ),
                    actions: actions[i],
                };
            })
        );

        res.status(200).json({ message: 'Visible institutions found.', data: visibleInstitutions });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets an institution from the database by ID.
 *
 * This function handles the retrieval of an institution in the database by ID, validating the user
 * performing the action to then retrieve the institution using Prisma.
 *
 * @param req - The request object, containing the institution ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getInstitution = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const institutionId: number = parseInt(req.params.institutionId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get an institution
        await checkAuthorization(requester, [institutionId], 'get');
        // Prisma operation
        const detailedStoredInstitution = await prismaClient.institution.findUniqueOrThrow({
            where: { id: institutionId },
            include: detailedInstitutionFields(),
        });
        // Get institution only with visible fields and with embedded actions
        const fieldsWUnfilteredUsers = {
            select: {
                ...(await getVisibleFields(requester, [detailedStoredInstitution], true, true, false))[0].select,
                users: (await getUsersVisibleFields(requester, [], true, true, true))[0],
                classrooms: (await getClassroomVisibleFields(requester, [], true, true))[0],
            },
        };
        const visibleInstitutionWUnfilteredUsers = {
            ...(await prismaClient.institution.findUnique({ where: { id: detailedStoredInstitution.id }, ...fieldsWUnfilteredUsers })),
            actions: (await getInstitutionUserActions(requester, [detailedStoredInstitution]))[0],
        };
        // Get users only with visible fields and with embedded actions
        const detailedUsers = detailedStoredInstitution.users;
        const userActions = await getPeerUserActions(requester, detailedUsers);
        const filteredUserFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
        const detailedClassrooms = detailedStoredInstitution.classrooms;
        const classroomActions = await getClassroomUserActions(requester, detailedClassrooms);
        const filteredClassroomFields = await getClassroomVisibleFields(requester, detailedClassrooms, true, false);
        const visibleInstitutionWUsers = {
            ...visibleInstitutionWUnfilteredUsers,
            users: visibleInstitutionWUnfilteredUsers.users?.map((user, i) => ({
                ...fieldsFilter(user, filteredUserFields[i]),
                actions: userActions[i],
            })),
            classrooms: await Promise.all(
                (visibleInstitutionWUnfilteredUsers.classrooms ?? []).map(async (classroom, i) => {
                    const detailedUsers = detailedClassrooms[i].users;
                    const userActions = await getPeerUserActions(requester, detailedUsers);
                    const userFields = await getUsersVisibleFields(requester, detailedUsers, false, false, false);
                    return {
                        ...fieldsFilter(classroom, filteredClassroomFields[i]),
                        users: classroom.users.map((user, j) => ({
                            ...fieldsFilter(user, userFields[j]),
                            actions: userActions[j],
                        })),
                        actions: classroomActions[i],
                    };
                })
            ),
        };

        res.status(200).json({ message: 'Institution found.', data: visibleInstitutionWUsers });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Deletes an institution from the database by ID.
 *
 * This function handles the deletion of an institution in the database by ID, validating the user
 * performing the action to then delete the institution using Prisma.
 *
 * @param req - The request object, containing the institution ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const deleteInstitution = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const institutionId: number = parseInt(req.params.institutionId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to delete an institution
        await checkAuthorization(requester, [institutionId], 'delete');
        // Prisma operation
        const deletedInstitution = await prismaClient.institution.delete({ where: { id: institutionId }, select: { id: true } });

        res.status(200).json({ message: 'Institution deleted.', data: deletedInstitution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
