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
import { User, VisibilityMode, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';
import { getDetailedProtocols, getProtocolsUserActions } from './protocolController';
import fieldsFilter from '../services/fieldsFilter';

/**
 * Retrieve the detailed applications fields required for internal endpoint validations.
 *
 * This function handles the creation of a custom select filter that serves as a parameter for Prisma Client to return an
 * application with all the fields required for internal endpoint validations.
 *
 * @returns A Prisma select filter object
 */
export const detailedApplicationFields = () => ({
    applier: { select: { id: true, institution: { select: { id: true } } } },
    viewersUser: { select: { id: true, institution: { select: { id: true } } } },
    viewersClassroom: { select: { users: { select: { id: true, institution: { select: { id: true } } } } } },
    answersViewersUser: { select: { id: true, institution: { select: { id: true } } } },
    answersViewersClassroom: { select: { users: { select: { id: true, institution: { select: { id: true } } } } } },
    protocol: {
        select: {
            id: true,
            creator: { select: { id: true, institution: { select: { id: true } } } },
            managers: { select: { id: true, institution: { select: { id: true } } } },
        },
    },
});

/**
 * Gets a set of detailed applications from a set of IDs
 *
 * This function handles the retrieval of a set of detailed applications, with all the fields required for internal
 * endpoint validations, from a set of applications IDs using Prisma.
 *
 * @param applicationsIds An array of applications IDs
 * @returns A set of detailed applications
 */
export const getDetailedApplications = async (applicationsIds: number[]) => {
    const detailedApplications = await prismaClient.application.findMany({
        where: { id: { in: applicationsIds } },
        include: detailedApplicationFields(),
    });
    return detailedApplications;
};

/**
 * Retrieves a user's roles against a given set of applications.
 *
 * @param user - The user whose roles are being determined.
 * @param applications - The detailed applications for which the roles are being determined.
 * @returns A promise that resolves to an array of objects representing the roles of the user for each application.
 *
 * Each role object contains the following properties:
 * - `answersViewer` - Whether the user can view the answers of the application.
 * - `applier` - Whether the user is the creator of the application.
 * - `coordinator` - Whether the user is a coordinator of the application applier's institution.
 * - `instituionMember` - Whether the user is a member of the application applier's institution.
 * - `protocolCreator` - Whether the user is the creator of the protocol associated with the application.
 * - `protocolManager` - Whether the user is a manager of the protocol associated with the application.
 * - `viewer` - Whether the user can view the application.
 */
export const getApplicationsUserRoles = async (user: User, applications: Awaited<ReturnType<typeof getDetailedApplications>>) => {
    const applicationsRoles = applications.map((application) => {
        const coordinator =
            user.institutionId && user.role === UserRole.COORDINATOR && application.applier.institution?.id === user.institutionId;
        const instituionMember = user.institutionId && application.applier.institution?.id === user.institutionId;
        const protocolCreator = application.protocol.creator.id === user.id;
        const protocolManager = application.protocol.managers.some(({ id }) => id === user.id);
        const applier = application.applier.id === user.id;
        const viewer =
            application.visibility === VisibilityMode.PUBLIC ||
            (application.visibility === VisibilityMode.AUTHENTICATED && user.role !== UserRole.GUEST) ||
            application.viewersUser.some(({ id }) => id === user.id) ||
            application.viewersClassroom.some(({ users }) => users.some(({ id }) => id === user.id));
        const answersViewer = !!(
            application.answersVisibility === VisibilityMode.PUBLIC ||
            (application.answersVisibility === VisibilityMode.AUTHENTICATED && user.role !== UserRole.GUEST) ||
            application.answersViewersUser.some(({ id }) => id === user.id) ||
            application.answersViewersClassroom?.some(({ users }) => users.some(({ id }) => id === user.id))
        );

        return { answersViewer, applier, coordinator, instituionMember, protocolCreator, protocolManager, viewer };
    });

    return applicationsRoles;
};

/**
 * Retrieves the actions that a user can perform on a set of applications.
 *
 * @param user - The user whose actions are being determined.
 * @param applications - The detailed applications for which the actions are being determined.
 * @returns A promise that resolves to an array of objects representing the actions that the user can perform on each application.
 *
 * The returned action object contains the following properties:
 * - `toApproveAnswers` - Whether the user can approve answers for the application.
 * - `toDelete` - Whether the user can delete the application.
 * - `toGet` - Whether the user can get details of the application.
 * - `toGetAnswers` - Whether the user can get details of the application with answers.
 * - `toUpdate` - Whether the user can update the application.
 */
export const getApplicationsUserActions = async (user: User, applications: Awaited<ReturnType<typeof getDetailedApplications>>) => {
    const applicationsRoles = await getApplicationsUserRoles(user, applications);

    const applicationsActions = applications.map((application, i) => {
        const roles = applicationsRoles[i];
        // Only protocol managers/applier/institution coordinator/protocol creator can perform update operations on applications
        const toUpdate =
            roles.applier || roles.coordinator || roles.protocolCreator || roles.protocolManager || user.role === UserRole.ADMIN;
        // Only protocol managers/applier/institution coordinator/protocol creator can perform delete operations on applications
        const toDelete =
            roles.applier || roles.coordinator || roles.protocolCreator || roles.protocolManager || user.role === UserRole.ADMIN;
        // Only viewers/applier/protocol creator/institution coordinator/protocol manager can perform get operations on applications
        const toGet =
            roles.viewer ||
            roles.coordinator ||
            roles.applier ||
            roles.protocolCreator ||
            roles.protocolManager ||
            user.role === UserRole.ADMIN;
        // Anyone can perform getMy operations on applications (since the result is filtered according to the user)
        const toGetMy = true;
        // Anyone can perform getVisible operations on applications (since the result is filtered according to the user)
        const toGetVisible = true;
        // No one can perform getAll operations on applications
        const toGetAll = user.role === UserRole.ADMIN;
        // Only answer viewers/applier/protocol creator/institution coordinator/protocol managers can perform get answers operations on applications
        const toGetAnswers =
            roles.answersViewer ||
            roles.applier ||
            roles.coordinator ||
            roles.protocolCreator ||
            roles.protocolManager ||
            user.role === UserRole.ADMIN;
        // Only protocol managers/protocol creator/application/institution coordinator/applier can perform approve operations on application answers
        const toApproveAnswers =
            roles.applier || roles.coordinator || roles.protocolCreator || roles.protocolManager || user.role === UserRole.ADMIN;

        return { toApproveAnswers, toDelete, toGet, toGetAnswers, toUpdate };
    });

    return applicationsActions;
};

/**
 * Checks if the user is authorized to perform a specific action on a set of applications.
 *
 * @param requester - The user object containing requester user details.
 * @param applicationsId - The IDs of the applications the user wants to perform the action on.
 * @param protocolsId - The IDs of the protocols associated with the applications.
 * @param action - The action the user wants to perform (e.g., 'create', 'update', 'get', 'delete', 'approve', 'getAll', 'getMy').
 *
 * @throws Will throw an error if the user is not authorized to perform the action.
 * @returns A promise that resolves if the user is authorized to perform the action.
 */
const checkAuthorization = async (requester: User, applicationsId: number[], protocolsId: number[], action: string) => {
    if (requester.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create': {
            if ((await getProtocolsUserActions(requester, await getDetailedProtocols(protocolsId))).some(({ toApply }) => !toApply))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'update': {
            if (
                (await getApplicationsUserActions(requester, await getDetailedApplications(applicationsId))).some(
                    ({ toUpdate }) => !toUpdate
                )
            )
                throw new Error('This user is not authorized to perform this action');
        }
        case 'delete': {
            if (
                (await getApplicationsUserActions(requester, await getDetailedApplications(applicationsId))).some(
                    ({ toDelete }) => !toDelete
                )
            )
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getMy':
        case 'getVisible':
            // Anyone can perform getMy/getVisible operations on applications (the result will be filtered based on the user)
            break;
        case 'getAll':
            // No one can perform getAll operations on applications
            throw new Error('This user is not authorized to perform this action');
        case 'get': {
            if ((await getApplicationsUserActions(requester, await getDetailedApplications(applicationsId))).some(({ toGet }) => !toGet))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
    }
};

/**
 * Retrieves the visible fields for applications based on the user's roles and permissions.
 *
 * @param user - The user for whom the visible fields are being determined.
 * @param applications - The detailed applications for which the visible fields are being determined.
 * @param includeAnswers - A boolean indicating whether to include the answers in the visible fields.
 * @param includeViewers - A boolean indicating whether to include the viewers in the visible fields.
 * @param includeProtocol - A boolean indicating whether to include the protocol in the visible fields.
 * @param ignoreFilters - A boolean indicating whether to ignore role-based filters and grant full access.
 * @returns A promise that resolves to an array of objects representing the visible fields for each application.
 */
export const getApplicationsVisibleFields = async (
    user: User,
    applications: Awaited<ReturnType<typeof getDetailedApplications>>,
    includeAnswers: boolean,
    includeViewers: boolean,
    includeProtocol: boolean,
    ignoreFilters: boolean
) => {
    const applicationsRoles = await getApplicationsUserRoles(user, applications);

    const mapVisibleFields = (roles: (typeof applicationsRoles)[0] | undefined) => {
        const fullAccess = roles
            ? roles.applier || roles.coordinator || roles.protocolCreator || roles.protocolManager || user.role === UserRole.ADMIN
            : ignoreFilters;
        const answersAccess = roles
            ? roles.answersViewer ||
              roles.applier ||
              roles.coordinator ||
              roles.protocolCreator ||
              roles.protocolManager ||
              user.role === UserRole.ADMIN
            : ignoreFilters;
        const baseAccess = roles
            ? roles.answersViewer ||
              roles.applier ||
              roles.coordinator ||
              roles.protocolCreator ||
              roles.protocolManager ||
              roles.viewer ||
              user.role === UserRole.ADMIN
            : ignoreFilters;

        const visibleFields = {
            select: {
                id: baseAccess,
                createdAt: baseAccess,
                updatedAt: baseAccess,
                visibility: fullAccess,
                answersVisibility: fullAccess,
                keepLocation: baseAccess,
                startDate: baseAccess,
                endDate: baseAccess,
                enabled: fullAccess,
                applier: {
                    select: {
                        id: baseAccess,
                        username: baseAccess,
                        institution: { select: { id: baseAccess, name: baseAccess } },
                    },
                },
                viewersUser: includeViewers && {
                    select: {
                        id: fullAccess,
                        username: fullAccess,
                        institution: { select: { id: fullAccess, name: fullAccess } },
                    },
                },
                viewersClassroom: includeViewers && {
                    select: {
                        id: fullAccess,
                        name: fullAccess,
                        users: {
                            select: {
                                id: fullAccess,
                                username: fullAccess,
                                institution: { select: { id: fullAccess, name: fullAccess } },
                            },
                        },
                    },
                },
                answersViewersUser: includeViewers && {
                    select: {
                        id: fullAccess,
                        username: fullAccess,
                        institution: { select: { id: fullAccess, name: fullAccess } },
                    },
                },
                answersViewersClassroom: includeViewers && {
                    select: {
                        id: fullAccess,
                        name: fullAccess,
                        users: {
                            select: {
                                id: fullAccess,
                                username: fullAccess,
                                institution: { select: { id: fullAccess, name: fullAccess } },
                            },
                        },
                    },
                },
                answers: includeAnswers && {
                    select: {
                        id: answersAccess,
                        date: answersAccess,
                        userId: answersAccess,
                        coordinate: {
                            select: {
                                latitude: answersAccess,
                                longitude: answersAccess,
                            },
                        },
                    },
                },
                protocol: includeProtocol && {
                    select: {
                        id: baseAccess,
                        createdAt: baseAccess,
                        updatedAt: baseAccess,
                        title: baseAccess,
                        description: baseAccess,
                        creator: {
                            select: {
                                id: baseAccess,
                                username: baseAccess,
                                institution: { select: { id: baseAccess, name: baseAccess } },
                            },
                        },
                        pages: {
                            orderBy: { placement: 'asc' as any },
                            select: {
                                id: baseAccess,
                                type: baseAccess,
                                placement: baseAccess,
                                dependencies: {
                                    select: {
                                        id: baseAccess,
                                        type: baseAccess,
                                        argument: baseAccess,
                                        customMessage: baseAccess,
                                        itemId: baseAccess,
                                    },
                                },
                                itemGroups: {
                                    orderBy: { placement: 'asc' as any },
                                    select: {
                                        id: baseAccess,
                                        type: baseAccess,
                                        placement: baseAccess,
                                        isRepeatable: baseAccess,
                                        dependencies: {
                                            select: {
                                                id: baseAccess,
                                                type: baseAccess,
                                                argument: baseAccess,
                                                customMessage: baseAccess,
                                                itemId: baseAccess,
                                            },
                                        },
                                        items: {
                                            select: {
                                                id: baseAccess,
                                                text: baseAccess,
                                                description: baseAccess,
                                                type: baseAccess,
                                                placement: baseAccess,
                                                enabled: baseAccess,
                                                itemValidations: {
                                                    select: {
                                                        id: baseAccess,
                                                        type: baseAccess,
                                                        argument: baseAccess,
                                                        customMessage: baseAccess,
                                                    },
                                                },
                                                itemOptions: {
                                                    select: {
                                                        id: baseAccess,
                                                        text: baseAccess,
                                                        placement: baseAccess,
                                                        files: {
                                                            select: {
                                                                id: baseAccess,
                                                                path: baseAccess,
                                                                description: baseAccess,
                                                            },
                                                        },
                                                        optionAnswers: includeAnswers && {
                                                            select: {
                                                                id: answersAccess,
                                                                text: answersAccess,
                                                                group: {
                                                                    select: {
                                                                        id: answersAccess,
                                                                        applicationAnswer: {
                                                                            select: {
                                                                                id: answersAccess,
                                                                                userId: answersAccess,
                                                                            },
                                                                        },
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                                files: {
                                                    select: {
                                                        id: baseAccess,
                                                        path: baseAccess,
                                                        description: baseAccess,
                                                    },
                                                },
                                                itemAnswers: includeAnswers && {
                                                    select: {
                                                        id: answersAccess,
                                                        text: answersAccess,
                                                        files: {
                                                            select: {
                                                                id: answersAccess,
                                                                path: answersAccess,
                                                                description: answersAccess,
                                                            },
                                                        },
                                                        group: {
                                                            select: {
                                                                id: answersAccess,
                                                                applicationAnswer: {
                                                                    select: {
                                                                        id: answersAccess,
                                                                        userId: answersAccess,
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                                tableAnswers: includeAnswers && {
                                                    select: {
                                                        id: answersAccess,
                                                        text: answersAccess,
                                                        columnId: answersAccess,
                                                        group: {
                                                            select: {
                                                                id: answersAccess,
                                                                applicationAnswer: {
                                                                    select: {
                                                                        id: answersAccess,
                                                                        userId: answersAccess,
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        tableColumns: {
                                            select: {
                                                id: baseAccess,
                                                text: baseAccess,
                                                placement: baseAccess,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };

        return visibleFields;
    };

    const visibleFields = ignoreFilters ? [mapVisibleFields(undefined)] : applicationsRoles.map(mapVisibleFields);

    return visibleFields;
};

/**
 * Validates the visibility and viewers of an application.
 *
 * This function checks if the visibility and viewers of an application are valid based on the protocol's visibility and viewers.
 *
 * @param visibility - The visibility of the application.
 * @param answersVisibility - The visibility of the answers of the application.
 * @param viewersUsers - The IDs of the users that can view the application.
 * @param viewersClassrooms - The IDs of the classrooms that can view the application.
 * @param answersViewersUsers - The IDs of the users that can view the answers of the application.
 * @param answersViewersClassrooms - The IDs of the classrooms that can view the answers of the application.
 * @param protocolId - The ID of the protocol associated with the application.
 * @throws Will throw an error if the visibility/viewers are invalid
 *
 * The function performs the following validations:
 * - The application visibility/viewers must be at least as restrictive as the protocol visibility/viewers.
 *
 * @returns A promise that resolves if the visibility/viewers are valid.
 */
const validateVisibility = async (
    visibility: VisibilityMode | undefined,
    answersVisibility: VisibilityMode | undefined,
    viewersUsers: number[],
    viewersClassrooms: number[],
    answersViewersUsers: number[],
    answersViewersClassrooms: number[],
    protocolId: number
) => {
    const protocolViewers = await prismaClient.protocol.findUnique({
        where: {
            id: protocolId,
            AND: [
                {
                    OR: [
                        { visibility: 'PUBLIC' },
                        {
                            visibility: visibility,
                            viewersUser: { every: { id: { in: viewersUsers } } },
                            viewersClassroom: { every: { id: { in: viewersClassrooms } } },
                        },
                    ],
                },
                {
                    OR: [
                        { answersVisibility: 'PUBLIC' },
                        {
                            answersVisibility: answersVisibility,
                            answersViewersUser: { every: { id: { in: answersViewersUsers } } },
                            answersViewersClassroom: { every: { id: { in: answersViewersClassrooms } } },
                        },
                    ],
                },
            ],
        },
    });

    if (!protocolViewers || !visibility || !answersVisibility) {
        throw new Error('Invalid visibility/viewers. Please make sure the viewers are valid and the protocol allows them.');
    }
};

/**
 * Creates a new application in the database.
 *
 * This function handles the creation of a new application, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the application data in the body and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const createApplication = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createApplicationSchema = yup
            .object()
            .shape({
                protocolId: yup.number().required(),
                visibility: yup.mixed<VisibilityMode>().oneOf(Object.values(VisibilityMode)).required(),
                answersVisibility: yup.mixed<VisibilityMode>().oneOf(Object.values(VisibilityMode)).required(),
                viewersUser: yup.array().of(yup.number()).default([]),
                viewersClassroom: yup.array().of(yup.number()).default([]),
                answersViewersUser: yup.array().of(yup.number()).default([]),
                answersViewersClassroom: yup.array().of(yup.number()).default([]),
                keepLocation: yup.boolean().required(),
                startDate: yup.date(),
                endDate: yup.date(),
                enabled: yup.boolean().required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const applicationData = await createApplicationSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if the user is allowed to apply the protocol
        await checkAuthorization(requester, [], [applicationData.protocolId], 'create');
        // Check if the viewers are valid
        await validateVisibility(
            applicationData.visibility,
            applicationData.answersVisibility,
            applicationData.viewersUser as number[],
            applicationData.viewersClassroom as number[],
            applicationData.answersViewersUser as number[],
            applicationData.answersViewersClassroom as number[],
            applicationData.protocolId
        );
        // Prisma operation
        const detailedStoredApplication = await prismaClient.application.create({
            data: {
                protocolId: applicationData.protocolId,
                applierId: requester.id,
                visibility: applicationData.visibility,
                answersVisibility: applicationData.answersVisibility,
                viewersUser: { connect: applicationData.viewersUser.map((id) => ({ id: id })) },
                viewersClassroom: { connect: applicationData.viewersClassroom.map((id) => ({ id: id })) },
                answersViewersUser: { connect: applicationData.answersViewersUser.map((id) => ({ id: id })) },
                answersViewersClassroom: { connect: applicationData.answersViewersClassroom.map((id) => ({ id: id })) },
                keepLocation: applicationData.keepLocation,
                startDate: applicationData.startDate,
                endDate: applicationData.endDate,
                enabled: applicationData.enabled,
            },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const visibleApplication = {
            ...(await prismaClient.application.findUnique({
                where: { id: detailedStoredApplication.id },
                ...(await getApplicationsVisibleFields(requester, [detailedStoredApplication], false, true, true, false))[0],
            })),
            actions: (await getApplicationsUserActions(requester, [detailedStoredApplication]))[0],
        };

        res.status(201).json({ message: 'Application created.', data: visibleApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Updates an existing application in the database.
 *
 * This function handles the update of a existing application, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the application data in the body, the user object from Passport-JWT and the address ID in the params.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const updateApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationId: number = parseInt(req.params.applicationId);
        // Yup schemas
        const updateApplicationSchema = yup
            .object()
            .shape({
                visibility: yup.mixed<VisibilityMode>().oneOf(Object.values(VisibilityMode)),
                answersVisibility: yup.mixed<VisibilityMode>().oneOf(Object.values(VisibilityMode)),
                viewersUser: yup.array().of(yup.number()).default([]),
                viewersClassroom: yup.array().of(yup.number()).default([]),
                answersViewersUser: yup.array().of(yup.number()).default([]),
                answersViewersClassroom: yup.array().of(yup.number()).default([]),
                keepLocation: yup.boolean(),
                startDate: yup.date(),
                endDate: yup.date(),
                enabled: yup.boolean(),
            })
            .noUnknown();
        // Yup parsing/validation
        const applicationData = await updateApplicationSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if the user is allowed to update the application
        await checkAuthorization(requester, [applicationId], [], 'update');
        // Check if the viewers are valid
        await validateVisibility(
            applicationData.visibility,
            applicationData.answersVisibility,
            applicationData.viewersUser as number[],
            applicationData.viewersClassroom as number[],
            applicationData.answersViewersUser as number[],
            applicationData.answersViewersClassroom as number[],
            (await prismaClient.application.findUniqueOrThrow({ where: { id: applicationId } })).protocolId
        );
        // Prisma operation
        const detailedStoredApplication = await prismaClient.application.update({
            where: { id: applicationId },
            data: {
                visibility: applicationData.visibility,
                answersVisibility: applicationData.answersVisibility,
                viewersUser: { set: [], connect: applicationData.viewersUser.map((id) => ({ id: id })) },
                viewersClassroom: { set: [], connect: applicationData.viewersClassroom.map((id) => ({ id: id })) },
                answersViewersUser: { set: [], connect: applicationData.answersViewersUser.map((id) => ({ id: id })) },
                answersViewersClassroom: { set: [], connect: applicationData.answersViewersClassroom.map((id) => ({ id: id })) },
                keepLocation: applicationData.keepLocation,
                startDate: applicationData.startDate,
                endDate: applicationData.endDate,
                enabled: applicationData.enabled,
            },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const visibleApplication = {
            ...(await prismaClient.application.findUnique({
                where: { id: detailedStoredApplication.id },
                ...(await getApplicationsVisibleFields(requester, [detailedStoredApplication], false, true, true, false))[0],
            })),
            actions: (await getApplicationsUserActions(requester, [detailedStoredApplication]))[0],
        };

        res.status(200).json({ message: 'Application updated.', data: visibleApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all applications associated with the user from the database.
 *
 * This function handles the retrieval of all applications associated with the user in the database,
 * validating the user performing the action to then retrieve all applications using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getMyApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if the user is allowed to get their applications
        await checkAuthorization(requester, [], [], 'getMy');
        // Prisma operation
        const detailedStoredApplications = await prismaClient.application.findMany({
            orderBy: { id: 'asc' },
            where: { applierId: requester.id },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const actions = await getApplicationsUserActions(requester, detailedStoredApplications);
        const filteredFields = await getApplicationsVisibleFields(requester, detailedStoredApplications, false, true, true, false);
        const unfilteredFields = (await getApplicationsVisibleFields(requester, [], false, true, true, true))[0];
        const unfilteredApplications = await prismaClient.application.findMany({
            where: { id: { in: detailedStoredApplications.map(({ id }) => id) } },
            ...unfilteredFields,
        });
        const visibleApplications = unfilteredApplications.map((application, i) => ({
            ...fieldsFilter(application, filteredFields[i]),
            actions: actions[i],
        }));

        res.status(200).json({ message: 'All your applications found.', data: visibleApplications });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all visible applications from the database.
 *
 * This function handles the retrieval of all visible applications in the database, validating the user
 * performing the action to then retrieve all visible applications using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getVisibleApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if the user is allowed to get visible applications
        await checkAuthorization(requester, [], [], 'getVisible');
        // Prisma operation
        const detailedStoredApplications = await prismaClient.application.findMany({
            orderBy: { id: 'asc' },
            where:
                requester.role === UserRole.ADMIN
                    ? undefined
                    : {
                          OR: [
                              {
                                  AND: [
                                      {
                                          enabled: true,
                                          AND: [
                                              { OR: [{ endDate: { gte: new Date() } }, { endDate: { equals: null } }] },
                                              { OR: [{ startDate: { lte: new Date() } }, { startDate: { equals: null } }] },
                                          ],
                                      },
                                      {
                                          OR: [
                                              { visibility: VisibilityMode.PUBLIC },
                                              { viewersUser: { some: { id: requester.id } } },
                                              { viewersClassroom: { some: { users: { some: { id: requester.id } } } } },
                                              ...(requester.role !== UserRole.GUEST ? [{ visibility: VisibilityMode.AUTHENTICATED }] : []),
                                          ],
                                      },
                                  ],
                              },
                              { applierId: requester.id },
                              ...(requester.role === UserRole.COORDINATOR ? [{ applier: { institutionId: requester.institutionId } }] : []),
                          ],
                      },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const actions = await getApplicationsUserActions(requester, detailedStoredApplications);
        const filteredFields = await getApplicationsVisibleFields(requester, detailedStoredApplications, false, true, true, false);
        const unfilteredFields = (await getApplicationsVisibleFields(requester, [], false, true, true, true))[0];
        const unfilteredApplications = await prismaClient.application.findMany({
            where: { id: { in: detailedStoredApplications.map(({ id }) => id) } },
            ...unfilteredFields,
        });
        const visibleApplications = unfilteredApplications.map((application, i) => ({
            ...fieldsFilter(application, filteredFields[i]),
            actions: actions[i],
        }));

        res.status(200).json({ message: 'All visible applications found.', data: visibleApplications });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all aplications from the database.
 *
 * This function handles the retrieval of all aplications in the database, validating the user
 * performing the action to then retrieve all aplications using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getAllApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if the user is allowed to get all applications
        await checkAuthorization(requester, [], [], 'getAll');
        // Prisma operation
        const detailedStoredApplications = await prismaClient.application.findMany({
            orderBy: { id: 'asc' },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const actions = await getApplicationsUserActions(requester, detailedStoredApplications);
        const filteredFields = await getApplicationsVisibleFields(requester, detailedStoredApplications, false, true, true, false);
        const unfilteredFields = (await getApplicationsVisibleFields(requester, [], false, true, true, true))[0];
        const unfilteredApplications = await prismaClient.application.findMany({
            where: { id: { in: detailedStoredApplications.map(({ id }) => id) } },
            ...unfilteredFields,
        });
        const visibleApplications = unfilteredApplications.map((application, i) => ({
            ...fieldsFilter(application, filteredFields[i]),
            actions: actions[i],
        }));

        res.status(200).json({ message: 'All applications found.', data: visibleApplications });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets an application from the database by ID.
 *
 * This function handles the retrieval of an application in the database by ID, validating the user
 * performing the action to then retrieve the application using Prisma.
 *
 * @param req - The request object, containing the application ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationId: number = parseInt(req.params.applicationId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if the user is allowed to get the application
        await checkAuthorization(requester, [applicationId], [], 'get');
        // Prisma operation
        const detailedStoredApplication = await prismaClient.application.findUniqueOrThrow({
            where: {
                id: applicationId,
                ...(requester.role === UserRole.ADMIN
                    ? []
                    : [
                          {
                              OR: [
                                  {
                                      AND: [
                                          {
                                              enabled: true,
                                              AND: [
                                                  { OR: [{ endDate: { gte: new Date() } }, { endDate: { equals: null } }] },
                                                  { OR: [{ startDate: { lte: new Date() } }, { startDate: { equals: null } }] },
                                              ],
                                          },
                                          {
                                              OR: [
                                                  { visibility: VisibilityMode.PUBLIC },
                                                  { viewersUser: { some: { id: requester.id } } },
                                                  { viewersClassroom: { some: { users: { some: { id: requester.id } } } } },
                                                  ...(requester.role !== UserRole.GUEST
                                                      ? [{ visibility: VisibilityMode.AUTHENTICATED }]
                                                      : []),
                                              ],
                                          },
                                      ],
                                  },
                                  { applierId: requester.id },
                                  ...(requester.role === UserRole.COORDINATOR
                                      ? [{ applier: { institutionId: requester.institutionId } }]
                                      : []),
                              ],
                          },
                      ]),
            },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const visibleApplication = {
            ...(await prismaClient.application.findUnique({
                where: { id: applicationId },
                ...(await getApplicationsVisibleFields(requester, [detailedStoredApplication], false, true, true, false))[0],
            })),
            actions: (await getApplicationsUserActions(requester, [detailedStoredApplication]))[0],
        };

        res.status(200).json({ message: 'Application found.', data: visibleApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets an application from the database by ID with protocol.
 *
 * This function handles the retrieval of an application in the database by ID with protocol, validating the user
 * performing the action to then retrieve the application using Prisma.
 *
 * @param req - The request object, containing the application ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getApplicationWithProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationId: number = parseInt(req.params.applicationId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if the user is allowed to view applications with protocols
        await checkAuthorization(requester, [applicationId], [], 'get');
        // Prisma operation
        const detailedStoredApplication = await prismaClient.application.findUniqueOrThrow({
            where: { id: applicationId },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const visibleApplication = {
            ...(await prismaClient.application.findUnique({
                where: { id: applicationId },
                ...(await getApplicationsVisibleFields(requester, [detailedStoredApplication], false, true, true, false))[0],
            })),
            actions: (await getApplicationsUserActions(requester, [detailedStoredApplication]))[0],
        };

        res.status(200).json({ message: 'Application with protocol found.', data: visibleApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets an application from the database by ID with answers.
 *
 * This function handles the retrieval of an application in the database by ID with answers, validating the user
 * performing the action to then retrieve the application using Prisma.
 *
 * @param req - The request object, containing the application ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getApplicationWithAnswers = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationId: number = parseInt(req.params.applicationId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is allowed to view applications with answers
        await checkAuthorization(requester, [applicationId], [], 'get');
        // Prisma operation
        const detailedStoredApplication: any = await prismaClient.application.findUniqueOrThrow({
            where: { id: applicationId },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const visibleApplication = {
            ...(await prismaClient.application.findUnique({
                where: { id: applicationId },
                ...(await getApplicationsVisibleFields(requester, [detailedStoredApplication], true, true, true, false))[0],
            })),
            actions: (await getApplicationsUserActions(requester, [detailedStoredApplication]))[0],
        };

        const processedApplication: any = { ...visibleApplication };

        for (const page of processedApplication.protocol.pages) {
            for (const itemGroup of page.itemGroups) {
                for (const item of itemGroup.items) {
                    item.itemAnswers = {};
                    // For each item in the application, get all itemAnswers associated with some applicationAnswer in the application
                    const itemAnswers = await prismaClient.itemAnswer.findMany({
                        where: {
                            group: { applicationAnswerId: { in: processedApplication.answers?.map((answer: any) => answer.id) } },
                            itemId: item.id,
                        },
                        select: {
                            text: true,
                            group: { select: { id: true, applicationAnswerId: true } },
                            files: { select: { id: true, path: true, description: true } },
                        },
                    });
                    // For each itemAnswer, group them by applicationAnswerId and answerGroupId
                    for (const answer of itemAnswers) {
                        // Initialize the groupAnswers of that applicationAnswer if it doesn't exist
                        if (!item.itemAnswers[answer.group.applicationAnswerId]) {
                            item.itemAnswers[answer.group.applicationAnswerId] = {};
                        }
                        // Initialize the itemAnswers of that groupAnswer if it doesn't exist
                        if (!item.itemAnswers[answer.group.applicationAnswerId][answer.group.id]) {
                            item.itemAnswers[answer.group.applicationAnswerId][answer.group.id] = [];
                        }
                        // Push the itemAnswer to the itemAnswers of that ApplicationAnswer/GroupAnswer
                        item.itemAnswers[answer.group.applicationAnswerId][answer.group.id].push({
                            text: answer.text,
                            files: answer.files,
                        });
                    }
                    // For each item in the application, get all tableAnswers associated with some applicationAnswer in the application
                    item.tableAnswers = {};
                    const tableAnswers = await prismaClient.tableAnswer.findMany({
                        where: {
                            group: {
                                applicationAnswerId: {
                                    in: processedApplication.answers.map((answer: any) => answer.id),
                                },
                            },
                            itemId: item.id,
                        },
                        select: {
                            text: true,
                            group: {
                                select: {
                                    id: true,
                                    applicationAnswerId: true,
                                },
                            },
                            columnId: true,
                        },
                    });
                    // For each tableAnswer, group them by applicationAnswerId and answerGroupId
                    for (const answer of tableAnswers) {
                        // Initialize the groupAnswers of that applicationAnswer if it doesn't exist
                        if (!item.tableAnswers[answer.group.applicationAnswerId]) {
                            item.tableAnswers[answer.group.applicationAnswerId] = {};
                        }
                        // Initialize the columnAnswer of that groupAnswer if it doesn't exist
                        if (!item.tableAnswers[answer.group.applicationAnswerId][answer.group.id]) {
                            item.tableAnswers[answer.group.applicationAnswerId][answer.group.id] = {};
                        }
                        // Define the columnAnswer of that applicationAnswer/GroupAnswer/ColumnAnswer
                        item.tableAnswers[answer.group.applicationAnswerId][answer.group.id][answer.columnId] = answer.text;
                    }

                    for (const option of item.itemOptions) {
                        option.optionAnswers = {};
                        const optionAnswers = await prismaClient.optionAnswer.findMany({
                            where: {
                                group: {
                                    applicationAnswerId: {
                                        in: processedApplication.answers.map((answer: any) => answer.id),
                                    },
                                },
                                optionId: option.id,
                            },
                            select: {
                                text: true,
                                group: {
                                    select: {
                                        id: true,
                                        applicationAnswerId: true,
                                    },
                                },
                            },
                        });

                        for (const answer of optionAnswers) {
                            if (!option.optionAnswers[answer.group.applicationAnswerId]) {
                                option.optionAnswers[answer.group.applicationAnswerId] = {};
                            }

                            if (!option.optionAnswers[answer.group.applicationAnswerId][answer.group.id]) {
                                option.optionAnswers[answer.group.applicationAnswerId][answer.group.id] = [];
                            }

                            option.optionAnswers[answer.group.applicationAnswerId][answer.group.id].push({
                                text: answer.text,
                            });
                        }
                    }
                }
            }
        }
        processedApplication.answers = Object.fromEntries(
            processedApplication.answers.map((answer: any) => [
                answer.id,
                { date: answer.date, user: answer.user, coordinate: answer.coordinate, approved: answer.approved },
            ])
        );

        res.status(200).json({ message: 'Application with answers found.', data: processedApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Deletes an application from the database by ID.
 *
 * This function handles the deletion of an application in the database by ID, validating the user
 * performing the action to then delete the application using Prisma.
 *
 * @param req - The request object, containing the application ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const deleteApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationId: number = parseInt(req.params.applicationId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is allowed to delete the application
        await checkAuthorization(requester, [applicationId], [], 'delete');
        // Prisma operation
        const deletedApplication = await prismaClient.application.delete({
            where: { id: applicationId },
            select: { id: true },
        });

        res.status(200).json({ message: 'Application deleted.', data: deletedApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
