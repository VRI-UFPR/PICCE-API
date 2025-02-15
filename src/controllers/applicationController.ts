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
import { Application, User, VisibilityMode, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';
import { getProtocolUserRoles } from './protocolController';

const getApplicationUserRoles = async (user: User, application: any, applicationId: number | undefined) => {
    application =
        application ||
        (await prismaClient.application.findUniqueOrThrow({
            where: { id: applicationId },
            include: {
                viewersClassroom: { select: { users: { select: { id: true } } } },
                viewersUser: { select: { id: true } },
                answersViewersClassroom: { select: { users: { select: { id: true } } } },
                answersViewersUser: { select: { id: true } },
                applier: { select: { id: true } },
                protocol: { select: { creatorId: true, managers: { select: { id: true } } } },
            },
        }));

    const protocolCreator = !!(application?.protocol.creatorId === user.id);
    const protocolManager = !!application?.protocol.managers?.some((manager: any) => manager.id === user.id);
    const applier = !!(application?.applier.id === user.id);
    const viewer = !!(
        application?.visibility === VisibilityMode.PUBLIC ||
        (application?.visibility === VisibilityMode.AUTHENTICATED && user.role !== UserRole.GUEST) ||
        application?.viewersUser?.some((viewer: any) => viewer.id === user.id) ||
        application?.viewersClassroom?.some((classroom: any) => classroom.users?.some((viewer: any) => viewer.id === user.id))
    );
    const answersViewer = !!(
        application?.answersVisibility === VisibilityMode.PUBLIC ||
        (application?.answersVisibility === VisibilityMode.AUTHENTICATED && user.role !== UserRole.GUEST) ||
        application?.answersViewersUser?.some((viewer: any) => viewer.id === user.id) ||
        application?.answersViewersClassroom?.some((classroom: any) => classroom.users?.some((viewer: any) => viewer.id === user.id))
    );

    return { protocolCreator, protocolManager, applier, viewer, answersViewer };
};

export const getApplicationUserActions = async (user: User, application: any, applicationId: number | undefined) => {
    const roles = await getApplicationUserRoles(user, application, applicationId);

    // Only protocol managers/applier/protocol creator can perform update operations on applications
    const toUpdate = roles.applier || roles.protocolCreator || roles.protocolManager || user.role === UserRole.ADMIN;
    // Only protocol managers/applier/protocol creator can perform delete operations on applications
    const toDelete = roles.applier || roles.protocolCreator || roles.protocolManager || user.role === UserRole.ADMIN;
    // Only viewers/applier/protocol creator/protocol manager can perform get operations on applications
    const toGet = roles.viewer || roles.applier || roles.protocolCreator || roles.protocolManager || user.role === UserRole.ADMIN;
    // Anyone can perform getMy operations on applications (since the result is filtered according to the user)
    const toGetMy = true;
    // Anyone can perform getVisible operations on applications (since the result is filtered according to the user)
    const toGetVisible = true;
    // No one can perform getAll operations on applications
    const toGetAll = user.role === UserRole.ADMIN;
    // Only answer viewers/applier/protocol creator/protocol managers can perform get answers operations on applications
    const toGetAnswers =
        roles.answersViewer || roles.applier || roles.protocolCreator || roles.protocolManager || user.role === UserRole.ADMIN;

    return { toUpdate, toDelete, toGet, toGetMy, toGetVisible, toGetAll, toGetAnswers };
};

const checkAuthorization = async (user: User, applicationId: number | undefined, protocolId: number | undefined, action: string) => {
    if (user.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create': {
            // Only managers/appliers/creator can perform update/delete operations on applications
            const roles = await getProtocolUserRoles(user, undefined, protocolId);
            if (!roles.applier && !roles.creator && !roles.manager) throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'update':
        case 'delete': {
            // Only protocol managers/applier/protocol creator can perform update/delete operations on applications
            const roles = await getApplicationUserRoles(user, undefined, applicationId);
            if (!roles.applier && !roles.protocolCreator && !roles.protocolManager)
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
            break;
        case 'get': {
            // Only viewers/protocol managers/protocol creator/applier can perform get operations on applications
            const roles = await getApplicationUserRoles(user, undefined, applicationId);
            if (!roles.viewer && !roles.applier && !roles.protocolCreator && !roles.protocolManager)
                throw new Error('This user is not authorized to perform this action:' + JSON.stringify(roles));
            break;
        }
    }
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

const dropSensitiveFields = (application: any) => {
    const filteredApplication = { ...application };
    delete filteredApplication.viewersUser;
    delete filteredApplication.viewersClassroom;
    delete filteredApplication.answersViewersUser;
    delete filteredApplication.answersViewersClassroom;
    delete filteredApplication.protocol.managers;
    delete filteredApplication.protocol.creatorId;
    return filteredApplication;
};

const dropUnapprovedAnswers = (application: any) => {
    const filteredApplication = { ...application };
    filteredApplication.answers = filteredApplication.answers.filter((answer: any) => answer.approved);
    return filteredApplication;
};

const fields = {
    id: true,
    visibility: true,
    answersVisibility: true,
    keepLocation: true,
    applier: { select: { id: true, username: true, institutionId: true } },
    viewersClassroom: { select: { users: { select: { id: true } } } },
    viewersUser: { select: { id: true } },
    answersViewersClassroom: { select: { users: { select: { id: true } } } },
    answersViewersUser: { select: { id: true } },
    protocol: { select: { id: true, title: true, description: true, creatorId: true, managers: { select: { id: true } } } },
    createdAt: true,
    updatedAt: true,
};

const fieldsWViewers = {
    ...fields,
    viewersUser: { select: { id: true, username: true, classrooms: { select: { id: true, name: true } } } },
    viewersClassroom: {
        select: { id: true, name: true, institution: { select: { name: true } }, users: { select: { id: true, username: true } } },
    },
    answersViewersUser: { select: { id: true, username: true, classrooms: { select: { id: true, name: true } } } },
    answersViewersClassroom: {
        select: { id: true, name: true, institution: { select: { name: true } }, users: { select: { id: true, username: true } } },
    },
};

const fieldsWProtocol = {
    ...fields,
    protocol: {
        select: {
            id: true,
            title: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            pages: {
                orderBy: { placement: 'asc' as any },
                select: {
                    type: true,
                    placement: true,
                    itemGroups: {
                        orderBy: { placement: 'asc' as any },
                        select: {
                            id: true,
                            type: true,
                            placement: true,
                            isRepeatable: true,
                            tableColumns: { select: { id: true, text: true, placement: true } },
                            items: {
                                orderBy: { placement: 'asc' as any },
                                select: {
                                    id: true,
                                    text: true,
                                    description: true,
                                    type: true,
                                    placement: true,
                                    itemOptions: {
                                        orderBy: { placement: 'asc' as any },
                                        select: {
                                            id: true,
                                            text: true,
                                            placement: true,
                                            files: { select: { id: true, path: true, description: true } },
                                        },
                                    },
                                    files: { select: { id: true, path: true, description: true } },
                                    itemValidations: { select: { type: true, argument: true, customMessage: true } },
                                },
                            },
                            dependencies: { select: { type: true, argument: true, itemId: true, customMessage: true } },
                        },
                    },
                    dependencies: { select: { type: true, argument: true, itemId: true, customMessage: true } },
                },
            },
        },
    },
};

const fieldsWAnswers = {
    ...fieldsWProtocol,
    answers: {
        select: {
            id: true,
            date: true,
            user: { select: { id: true, username: true } },
            coordinate: { select: { latitude: true, longitude: true } },
            approved: true,
        },
    },
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
            })
            .noUnknown();
        // Yup parsing/validation
        const application = await createApplicationSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to apply the protocol
        await checkAuthorization(user, undefined, application.protocolId, 'create');
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
        const createdApplication = await prismaClient.application.create({
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
            },
            select: fieldsWViewers,
        });

        // Embed user actions in the response
        const processedApplication = {
            ...createdApplication,
            actions: await getApplicationUserActions(user, createdApplication, undefined),
        };
        // Filter sensitive fields
        const filteredApplication = dropSensitiveFields(processedApplication);

        res.status(201).json({ message: 'Application created.', data: filteredApplication });
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
            })
            .noUnknown();
        // Yup parsing/validation
        const application = await updateApplicationSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to update the application
        await checkAuthorization(user, applicationId, undefined, 'update');
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
        const updatedApplication = await prismaClient.application.update({
            where: { id: applicationId },
            data: {
                visibility: application.visibility,
                answersVisibility: application.answersVisibility,
                viewersUser: { set: [], connect: application.viewersUser.map((id) => ({ id: id })) },
                viewersClassroom: { set: [], connect: application.viewersClassroom.map((id) => ({ id: id })) },
                answersViewersUser: { set: [], connect: application.answersViewersUser.map((id) => ({ id: id })) },
                answersViewersClassroom: { set: [], connect: application.answersViewersClassroom.map((id) => ({ id: id })) },
                keepLocation: application.keepLocation,
            },
            select: fieldsWViewers,
        });

        // Embed user actions in the response
        const processedApplication = {
            ...updatedApplication,
            actions: await getApplicationUserActions(user, updatedApplication, undefined),
        };
        // Filter sensitive fields
        const filteredApplication = dropSensitiveFields(processedApplication);

        res.status(200).json({ message: 'Application updated.', data: filteredApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getMyApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to get their applications
        await checkAuthorization(user, undefined, undefined, 'getMy');
        // Prisma operation
        const applications = await prismaClient.application.findMany({
            where: { applierId: user.id },
            select: fieldsWViewers,
        });

        // Embed user actions in the response
        const processedApplications = await Promise.all(
            applications.map(async (application) => ({
                ...application,
                actions: await getApplicationUserActions(user, application, application.id),
            }))
        );
        // Filter sensitive fields
        const filteredApplications = processedApplications.map((application) => dropSensitiveFields(application));

        res.status(200).json({ message: 'All your applications found.', data: filteredApplications });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getVisibleApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to get visible applications
        await checkAuthorization(user, undefined, undefined, 'getVisible');
        // Prisma operation
        const applications =
            user.role === UserRole.ADMIN
                ? await prismaClient.application.findMany({ select: fieldsWViewers })
                : await prismaClient.application.findMany({
                      where: {
                          OR: [
                              { visibility: 'PUBLIC' },
                              { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                              { viewersUser: { some: { id: user.id } } },
                              { applierId: user.id },
                          ],
                      },
                      select: fields,
                  });

        // Embed user actions in the response
        const processedApplications = await Promise.all(
            applications.map(async (application) => ({
                ...application,
                actions: await getApplicationUserActions(user, application, application.id),
            }))
        );
        // Filter sensitive fields
        const filteredApplications = processedApplications.map((application) => dropSensitiveFields(application));

        res.status(200).json({ message: 'All visible applications found.', data: filteredApplications });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if the user is allowed to get all applications
        await checkAuthorization(user, undefined, undefined, 'getAll');
        // Prisma operation
        const applications = await prismaClient.application.findMany({
            select: fieldsWViewers,
        });

        // Embed user actions in the response
        const processedApplications = await Promise.all(
            applications.map(async (application) => ({
                ...application,
                actions: await getApplicationUserActions(user, application, application.id),
            }))
        );
        // Filter sensitive fields
        const filteredApplications = processedApplications.map((application) => dropSensitiveFields(application));

        res.status(200).json({ message: 'All applications found.', data: filteredApplications });
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
        await checkAuthorization(user, applicationId, undefined, 'get');
        // Prisma operation
        const application = await prismaClient.application.findUniqueOrThrow({
            where: {
                id: applicationId,
                OR: [
                    { visibility: 'PUBLIC' },
                    { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                    { viewersUser: { some: { id: user.id } } },
                    { applierId: user.id },
                ],
            },
            select: fieldsWViewers,
        });
        // Embed user actions in the response
        const processedApplication = {
            ...application,
            actions: await getApplicationUserActions(user, application, applicationId),
        };
        // Filter sensitive fields
        const filteredApplication = processedApplication.actions.toUpdate
            ? processedApplication
            : dropSensitiveFields(processedApplication);

        res.status(200).json({ message: 'Application found.', data: filteredApplication });
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
        await checkAuthorization(user, applicationId, undefined, 'get');
        // Prisma operation
        const application = await prismaClient.application.findUniqueOrThrow({
            where: { id: applicationId },
            select: fieldsWProtocol,
        });
        // Embed user actions in the response
        const processedApplication = {
            ...application,
            actions: await getApplicationUserActions(user, application, applicationId),
        };
        // Filter sensitive fields
        const filteredApplication = processedApplication;

        res.status(200).json({ message: 'Application with protocol found.', data: filteredApplication });
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
        await checkAuthorization(user, applicationId, undefined, 'get');
        // Prisma operation
        const applicationWithAnswers: any = await prismaClient.application.findUniqueOrThrow({
            where: {
                id: applicationId,
            },
            select: fieldsWAnswers,
        });

        // If the user is not the applier or a member of the institution that the applier is from, the answers will be filtered to not include unnaproved answers
        if (
            (user.role !== UserRole.ADMIN &&
                user.id !== applicationWithAnswers.applier.id &&
                user.institutionId !== applicationWithAnswers.applier.institutionId) ||
            user.role === UserRole.USER ||
            user.role === UserRole.GUEST
        )
            applicationWithAnswers.answers = applicationWithAnswers.answers.filter((answer: any) => answer.approved);

        for (const page of applicationWithAnswers.protocol.pages) {
            for (const itemGroup of page.itemGroups) {
                for (const item of itemGroup.items) {
                    item.itemAnswers = {};
                    // For each item in the application, get all itemAnswers associated with some applicationAnswer in the application
                    const itemAnswers = await prismaClient.itemAnswer.findMany({
                        where: {
                            group: {
                                applicationAnswerId: {
                                    in: applicationWithAnswers.answers.map((answer: any) => answer.id),
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
                            files: {
                                select: {
                                    id: true,
                                    path: true,
                                    description: true,
                                },
                            },
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
                                    in: applicationWithAnswers.answers.map((answer: any) => answer.id),
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
                                        in: applicationWithAnswers.answers.map((answer: any) => answer.id),
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
        applicationWithAnswers.answers = Object.fromEntries(
            applicationWithAnswers.answers.map((answer: any) => [
                answer.id,
                { date: answer.date, user: answer.user, coordinate: answer.coordinate, approved: answer.approved },
            ])
        );

        res.status(200).json({ message: 'Application with answers found.', data: applicationWithAnswers });
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
        await checkAuthorization(user, applicationId, undefined, 'delete');
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
