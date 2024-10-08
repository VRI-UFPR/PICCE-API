import { Response, Request } from 'express';
import { Application, User, VisibilityMode, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

const checkAuthorization = async (user: User, applicationId: number | undefined, protocolId: number | undefined, action: string) => {
    switch (action) {
        case 'create':
            // All users except USER can perform create operations on applications, but only if the protocol is public or the user is an applier
            if (user.role !== UserRole.ADMIN) {
                const protocol = await prismaClient.protocol.findUnique({
                    where: {
                        id: protocolId,
                        OR: [{ applicability: VisibilityMode.PUBLIC }, { appliers: { some: { id: user.id } } }],
                        enabled: true,
                    },
                });

                if (!protocol || user.role === UserRole.USER) {
                    throw new Error('This user is not authorized to perform this action');
                }
            }
            break;
        case 'update':
            // Only ADMINs or the applier can perform update operations on applications
            if (user.role !== UserRole.ADMIN) {
                const application = await prismaClient.application.findUnique({
                    where: {
                        id: applicationId,
                        applierId: user.id,
                    },
                });
                if (!application) {
                    throw new Error('This user is not authorized to perform this action');
                }
            }
            break;
        case 'getMy':
        case 'getVisible':
            // All users can perform getMy/getVisible operations on applications (the result will be filtered based on the user)
            break;
        case 'getAll':
            // Only ADMINs can perform getAll operations on applications
            if (user.role !== UserRole.ADMIN) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
        case 'get':
            // Only ADMINs or the viewers of the application can perform get operations on applications
            if (user.role !== UserRole.ADMIN) {
                const application = await prismaClient.application.findUnique({
                    where: {
                        id: applicationId,
                        OR: [
                            { visibility: 'PUBLIC' },
                            { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                            { viewersUser: { some: { id: user.id } } },
                            { applierId: user.id },
                        ],
                    },
                });
                if (!application) {
                    throw new Error('This user is not authorized to perform this action');
                }
            }
            break;
        case 'delete':
            // Only ADMINs or the applier can perform delete operations on applications
            if (user.role !== UserRole.ADMIN) {
                const application = await prismaClient.application.findUnique({
                    where: {
                        id: applicationId,
                        applierId: user.id,
                    },
                });
                if (!application) {
                    throw new Error('This user is not authorized to perform this action');
                }
            }
            break;
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

const fields = {
    id: true,
    protocol: { select: { id: true, title: true, description: true } },
    visibility: true,
    answersVisibility: true,
    applier: { select: { id: true, username: true } },
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
                                        select: { id: true, text: true, placement: true, files: { select: { id: true, path: true } } },
                                    },
                                    files: { select: { id: true, path: true } },
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
    answers: { select: { id: true, date: true, user: { select: { id: true, username: true } } } },
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
            },
            select: fieldsWViewers,
        });

        res.status(201).json({ message: 'Application created.', data: createdApplication });
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
            },
            select: fieldsWViewers,
        });

        res.status(200).json({ message: 'Application updated.', data: updatedApplication });
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

        res.status(200).json({ message: 'All your applications found.', data: applications });
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

        res.status(200).json({ message: 'All visible applications found.', data: applications });
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

        res.status(200).json({ message: 'All applications found.', data: applications });
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
        // Filter the application based on the user's role
        const visibleApplication =
            user.role === UserRole.ADMIN || application.applier.id === user.id
                ? application
                : {
                      ...application,
                      viewersUser: undefined,
                      viewersClassroom: undefined,
                      answersViewersUser: undefined,
                      answersViewersClassroom: undefined,
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
        await checkAuthorization(user, applicationId, undefined, 'get');
        // Prisma operation
        const application = await prismaClient.application.findUniqueOrThrow({
            where: { id: applicationId },
            select: fieldsWProtocol,
        });

        res.status(200).json({ message: 'Application with protocol found.', data: application });
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

        for (const page of applicationWithAnswers.protocol.pages) {
            for (const itemGroup of page.itemGroups) {
                for (const item of itemGroup.items) {
                    item.itemAnswers = {};
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
                                    path: true,
                                },
                            },
                        },
                    });

                    for (const answer of itemAnswers) {
                        if (!item.itemAnswers[answer.group.applicationAnswerId]) {
                            item.itemAnswers[answer.group.applicationAnswerId] = {};
                        }

                        if (!item.itemAnswers[answer.group.applicationAnswerId][answer.group.id]) {
                            item.itemAnswers[answer.group.applicationAnswerId][answer.group.id] = [];
                        }

                        item.itemAnswers[answer.group.applicationAnswerId][answer.group.id].push({
                            text: answer.text,
                            files: answer.files,
                        });
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
            applicationWithAnswers.answers.map((answer: any) => [answer.id, { date: answer.date, user: answer.user }])
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
