import { Response, Request } from 'express';
import { Application, User, VisibilityMode, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

const checkAuthorizationToApply = async (user: User, protocolId: number) => {
    if (user.role !== UserRole.ADMIN) {
        const protocol = await prismaClient.protocol.findUnique({
            where: {
                id: protocolId,
                OR: [{ applicability: 'PUBLIC' }, { appliers: { some: { id: user.id } } }],
                enabled: true,
            },
        });

        if (!protocol || user.role === UserRole.USER) {
            throw new Error('This user is not authorized to apply this protocol.');
        }
    }
};

const validateVisibleFields = async (user: User, application: any) => {
    if (user.role !== UserRole.ADMIN && application.applierId !== user.id) {
        delete application.viewersUser;
        delete application.viewersClassroom;

        return application;
    }
    return application;
};

const fieldsWithNesting = {
    id: true,
    protocol: { select: { id: true, title: true, description: true } },
    visibility: true,
    answersVisibility: true,
    applier: { select: { id: true, username: true } },
    createdAt: true,
    updatedAt: true,
};

const fieldsWithViewers = {
    ...fieldsWithNesting,
    viewersUser: { select: { id: true, username: true } },
    viewersClassroom: { select: { id: true, institution: { select: { name: true } } } },
    answersViewersUser: { select: { id: true, username: true } },
    answersViewersClassroom: { select: { id: true, institution: { select: { name: true } } } },
};

const fieldsWithFullProtocol = {
    ...fieldsWithNesting,
    protocol: {
        include: {
            pages: {
                orderBy: {
                    placement: 'asc' as any,
                },
                include: {
                    itemGroups: {
                        orderBy: {
                            placement: 'asc' as any,
                        },
                        include: {
                            items: {
                                orderBy: {
                                    placement: 'asc' as any,
                                },
                                include: {
                                    itemOptions: {
                                        orderBy: {
                                            placement: 'asc' as any,
                                        },
                                        include: {
                                            files: true,
                                        },
                                    },
                                    itemValidations: true,
                                    files: true,
                                },
                            },
                        },
                    },
                },
            },
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
                visibility: yup.string().oneOf(Object.values(VisibilityMode)).required(),
                answersVisibility: yup.string().oneOf(Object.values(VisibilityMode)).required(),
                viewersUser: yup.array().of(yup.number()).required(),
                viewersClassroom: yup.array().of(yup.number()).required(),
                answersViewersUser: yup.array().of(yup.number()).required(),
                answersViewersClassroom: yup.array().of(yup.number()).required(),
            })
            .noUnknown();

        // Yup parsing/validation
        const application = await createApplicationSchema.validate(req.body, { stripUnknown: false });

        // User from Passport-JWT
        const user = req.user as User;

        // Check if the user is allowed to apply the protocol
        await checkAuthorizationToApply(user, application.protocolId);

        // Create the application
        const createdApplication = await prismaClient.application.create({
            data: {
                protocolId: application.protocolId,
                applierId: user.id,
                visibility: application.visibility,
                answersVisibility: application.answersVisibility,
                viewersUser: {
                    connect: application.viewersUser.map((id) => ({ id: id })),
                },
                viewersClassroom: {
                    connect: application.viewersClassroom.map((id) => ({ id: id })),
                },
                answersViewersUser: {
                    connect: application.answersViewersUser.map((id) => ({ id: id })),
                },
                answersViewersClassroom: {
                    connect: application.answersViewersClassroom.map((id) => ({ id: id })),
                },
            },
            select: fieldsWithViewers,
        });

        res.status(201).json({ message: 'Application created.', data: createdApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.applicationId);

        // Yup schemas
        const updateApplicationSchema = yup
            .object()
            .shape({
                protocolId: yup.number(),
                visibility: yup.string().oneOf(Object.values(VisibilityMode)),
                answersVisibility: yup.string().oneOf(Object.values(VisibilityMode)),
                viewersUser: yup.array().of(yup.number()).required(),
                viewersClassroom: yup.array().of(yup.number()).required(),
                answersViewersUser: yup.array().of(yup.number()).required(),
                answersViewersClassroom: yup.array().of(yup.number()).required(),
            })
            .noUnknown();

        // Yup parsing/validation
        const application = await updateApplicationSchema.validate(req.body, { stripUnknown: false });

        // User from Passport-JWT
        const user = req.user as User;

        // Check if the user is allowed to update the application
        if (user.role !== UserRole.ADMIN) {
            await prismaClient.application.findUniqueOrThrow({
                where: {
                    id: id,
                    applierId: user.id,
                },
            });
        }

        // Update the application
        const updatedApplication = await prismaClient.application.update({
            where: {
                id,
            },
            data: {
                protocolId: application.protocolId,
                visibility: application.visibility,
                answersVisibility: application.answersVisibility,
                viewersUser: {
                    set: [],
                    connect: application.viewersUser.map((id) => ({ id: id })),
                },
                viewersClassroom: {
                    set: [],
                    connect: application.viewersClassroom.map((id) => ({ id: id })),
                },
                answersViewersUser: {
                    set: [],
                    connect: application.answersViewersUser.map((id) => ({ id: id })),
                },
                answersViewersClassroom: {
                    set: [],
                    connect: application.answersViewersClassroom.map((id) => ({ id: id })),
                },
            },
            select: fieldsWithViewers,
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

        // Get all applications created by the user
        const applications = await prismaClient.application.findMany({
            where: {
                applierId: user.id,
            },
            select: fieldsWithViewers,
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

        // Get all applications that the user is allowed to see
        const applications =
            user.role === UserRole.ADMIN
                ? await prismaClient.application.findMany({
                      select: fieldsWithViewers,
                  })
                : await prismaClient.application.findMany({
                      where: {
                          OR: [
                              { visibility: 'PUBLIC' },
                              { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                              { viewersUser: { some: { id: user.id } } },
                              { applierId: user.id },
                          ],
                      },
                      select: fieldsWithNesting,
                  });
        res.status(200).json({ message: 'All visible applications found.', data: applications });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.applicationId);

        // User from Passport-JWT
        const user = req.user as User;

        // Get the application if the user is allowed to see it
        const application = await prismaClient.application.findUniqueOrThrow({
            where: {
                id: id,
                OR: [
                    { visibility: 'PUBLIC' },
                    { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                    { viewersUser: { some: { id: user.id } } },
                    { applierId: user.id },
                ],
            },
            select: fieldsWithViewers,
        });

        const visibleApplication = await validateVisibleFields(user, application);

        res.status(200).json({ message: 'Application found.', data: visibleApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getApplicationWithProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.applicationId);

        // User from Passport-JWT
        const user = req.user as User;

        // Get the application if the user is allowed to see it
        const application =
            user.role === UserRole.ADMIN
                ? await prismaClient.application.findUniqueOrThrow({
                      where: {
                          id: id,
                      },
                      select: fieldsWithFullProtocol,
                  })
                : await prismaClient.application.findUniqueOrThrow({
                      where: {
                          id: id,
                          OR: [
                              { visibility: 'PUBLIC' },
                              { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                              { viewersUser: { some: { id: user.id } } },
                              { applierId: user.id },
                          ],
                      },
                      select: fieldsWithFullProtocol,
                  });

        res.status(200).json({ message: 'Application found.', data: application });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.applicationId);

        // User from Passport-JWT
        const user = req.user as User;

        // Delete the application if the user is allowed to delete it
        const deletedApplication: Application =
            user.role === UserRole.ADMIN
                ? await prismaClient.application.delete({
                      where: {
                          id: id,
                      },
                  })
                : await prismaClient.application.delete({
                      where: {
                          id: id,
                          applierId: user.id,
                      },
                  });

        res.status(200).json({ message: 'Application deleted.', data: deletedApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
