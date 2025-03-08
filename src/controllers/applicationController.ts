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

export const getDetailedApplications = async (applicationsIds: number[]) => {
    const detailedApplications = await prismaClient.application.findMany({
        where: { id: { in: applicationsIds } },
        include: detailedApplicationFields(),
    });
    return detailedApplications;
};

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

const checkAuthorization = async (user: User, applicationsId: number[], protocolsId: number[], action: string) => {
    if (user.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create': {
            if ((await getProtocolsUserActions(user, await getDetailedProtocols(protocolsId))).some(({ toApply }) => !toApply))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'update': {
            if ((await getApplicationsUserActions(user, await getDetailedApplications(applicationsId))).some(({ toUpdate }) => !toUpdate))
                throw new Error('This user is not authorized to perform this action');
        }
        case 'delete': {
            if ((await getApplicationsUserActions(user, await getDetailedApplications(applicationsId))).some(({ toDelete }) => !toDelete))
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
            if ((await getApplicationsUserActions(user, await getDetailedApplications(applicationsId))).some(({ toGet }) => !toGet))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
    }
};

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
        const application = await createApplicationSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to apply the protocol
        await checkAuthorization(user, [], [application.protocolId], 'create');
        // Check if the viewers are valid
        await validateVisibility(
            application.visibility,
            application.answersVisibility,
            application.viewersUser as number[],
            application.viewersClassroom as number[],
            application.answersViewersUser as number[],
            application.answersViewersClassroom as number[],
            application.protocolId
        );
        // Prisma operation
        const detailedCreatedApplication = await prismaClient.application.create({
            data: {
                protocolId: application.protocolId,
                applierId: user.id,
                visibility: application.visibility,
                answersVisibility: application.answersVisibility,
                viewersUser: { connect: application.viewersUser.map((id) => ({ id: id })) },
                viewersClassroom: { connect: application.viewersClassroom.map((id) => ({ id: id })) },
                answersViewersUser: { connect: application.answersViewersUser.map((id) => ({ id: id })) },
                answersViewersClassroom: { connect: application.answersViewersClassroom.map((id) => ({ id: id })) },
                keepLocation: application.keepLocation,
                startDate: application.startDate,
                endDate: application.endDate,
                enabled: application.enabled,
            },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const visibleApplication = {
            ...(await prismaClient.application.findUnique({
                where: { id: detailedCreatedApplication.id },
                ...(await getApplicationsVisibleFields(user, [detailedCreatedApplication], false, true, true, false))[0],
            })),
            actions: (await getApplicationsUserActions(user, [detailedCreatedApplication]))[0],
        };

        res.status(201).json({ message: 'Application created.', data: visibleApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

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
        const application = await updateApplicationSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to update the application
        await checkAuthorization(user, [applicationId], [], 'update');
        // Check if the viewers are valid
        await validateVisibility(
            application.visibility,
            application.answersVisibility,
            application.viewersUser as number[],
            application.viewersClassroom as number[],
            application.answersViewersUser as number[],
            application.answersViewersClassroom as number[],
            (await prismaClient.application.findUniqueOrThrow({ where: { id: applicationId } })).protocolId
        );
        // Prisma operation
        const detailedUpdatedApplication = await prismaClient.application.update({
            where: { id: applicationId },
            data: {
                visibility: application.visibility,
                answersVisibility: application.answersVisibility,
                viewersUser: { set: [], connect: application.viewersUser.map((id) => ({ id: id })) },
                viewersClassroom: { set: [], connect: application.viewersClassroom.map((id) => ({ id: id })) },
                answersViewersUser: { set: [], connect: application.answersViewersUser.map((id) => ({ id: id })) },
                answersViewersClassroom: { set: [], connect: application.answersViewersClassroom.map((id) => ({ id: id })) },
                keepLocation: application.keepLocation,
                startDate: application.startDate,
                endDate: application.endDate,
                enabled: application.enabled,
            },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const visibleApplication = {
            ...(await prismaClient.application.findUnique({
                where: { id: detailedUpdatedApplication.id },
                ...(await getApplicationsVisibleFields(user, [detailedUpdatedApplication], false, true, true, false))[0],
            })),
            actions: (await getApplicationsUserActions(user, [detailedUpdatedApplication]))[0],
        };

        res.status(200).json({ message: 'Application updated.', data: visibleApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getMyApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to get their applications
        await checkAuthorization(user, [], [], 'getMy');
        // Prisma operation
        const detailedApplications = await prismaClient.application.findMany({
            orderBy: { id: 'asc' },
            where: { applierId: user.id },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const actions = await getApplicationsUserActions(user, detailedApplications);
        const filteredFields = await getApplicationsVisibleFields(user, detailedApplications, false, true, true, false);
        const unfilteredFields = (await getApplicationsVisibleFields(user, [], false, true, true, true))[0];
        const unfilteredApplications = await prismaClient.application.findMany({
            where: { id: { in: detailedApplications.map(({ id }) => id) } },
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

export const getVisibleApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to get visible applications
        await checkAuthorization(user, [], [], 'getVisible');
        // Prisma operation
        const detailedApplications = await prismaClient.application.findMany({
            orderBy: { id: 'asc' },
            where:
                user.role === UserRole.ADMIN
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
                                              { viewersUser: { some: { id: user.id } } },
                                              { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                                              ...(user.role !== UserRole.GUEST ? [{ visibility: VisibilityMode.AUTHENTICATED }] : []),
                                          ],
                                      },
                                  ],
                              },
                              { applierId: user.id },
                              ...(user.role === UserRole.COORDINATOR ? [{ applier: { institutionId: user.institutionId } }] : []),
                          ],
                      },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const actions = await getApplicationsUserActions(user, detailedApplications);
        const filteredFields = await getApplicationsVisibleFields(user, detailedApplications, false, true, true, false);
        const unfilteredFields = (await getApplicationsVisibleFields(user, [], false, true, true, true))[0];
        const unfilteredApplications = await prismaClient.application.findMany({
            where: { id: { in: detailedApplications.map(({ id }) => id) } },
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

export const getAllApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to get all applications
        await checkAuthorization(user, [], [], 'getAll');
        // Prisma operation
        const detailedApplications = await prismaClient.application.findMany({
            orderBy: { id: 'asc' },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const actions = await getApplicationsUserActions(user, detailedApplications);
        const filteredFields = await getApplicationsVisibleFields(user, detailedApplications, false, true, true, false);
        const unfilteredFields = (await getApplicationsVisibleFields(user, [], false, true, true, true))[0];
        const unfilteredApplications = await prismaClient.application.findMany({
            where: { id: { in: detailedApplications.map(({ id }) => id) } },
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

export const getApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationId: number = parseInt(req.params.applicationId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to get the application
        await checkAuthorization(user, [applicationId], [], 'get');
        // Prisma operation
        const detailedApplication = await prismaClient.application.findUniqueOrThrow({
            where: {
                id: applicationId,
                ...(user.role === UserRole.ADMIN
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
                                                  { viewersUser: { some: { id: user.id } } },
                                                  { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                                                  ...(user.role !== UserRole.GUEST ? [{ visibility: VisibilityMode.AUTHENTICATED }] : []),
                                              ],
                                          },
                                      ],
                                  },
                                  { applierId: user.id },
                                  ...(user.role === UserRole.COORDINATOR ? [{ applier: { institutionId: user.institutionId } }] : []),
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
                ...(await getApplicationsVisibleFields(user, [detailedApplication], false, true, true, false))[0],
            })),
            actions: (await getApplicationsUserActions(user, [detailedApplication]))[0],
        };

        res.status(200).json({ message: 'Application found.', data: visibleApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getApplicationWithProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationId: number = parseInt(req.params.applicationId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to view applications with protocols
        await checkAuthorization(user, [applicationId], [], 'get');
        // Prisma operation
        const detailedApplication = await prismaClient.application.findUniqueOrThrow({
            where: { id: applicationId },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const visibleApplication = {
            ...(await prismaClient.application.findUnique({
                where: { id: applicationId },
                ...(await getApplicationsVisibleFields(user, [detailedApplication], false, true, true, false))[0],
            })),
            actions: (await getApplicationsUserActions(user, [detailedApplication]))[0],
        };

        res.status(200).json({ message: 'Application with protocol found.', data: visibleApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getApplicationWithAnswers = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationId: number = parseInt(req.params.applicationId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to view applications with answers
        await checkAuthorization(user, [applicationId], [], 'get');
        // Prisma operation
        const detailedApplication: any = await prismaClient.application.findUniqueOrThrow({
            where: { id: applicationId },
            include: detailedApplicationFields(),
        });

        // Get application only with visible fields and with embedded actions
        const visibleApplication = {
            ...(await prismaClient.application.findUnique({
                where: { id: applicationId },
                ...(await getApplicationsVisibleFields(user, [detailedApplication], true, true, true, false))[0],
            })),
            actions: (await getApplicationsUserActions(user, [detailedApplication]))[0],
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

export const deleteApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationId: number = parseInt(req.params.applicationId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to delete the application
        await checkAuthorization(user, [applicationId], [], 'delete');
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
