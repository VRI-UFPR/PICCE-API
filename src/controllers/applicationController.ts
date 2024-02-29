import { Response, Request } from 'express';
import { Application, User, VisibilityMode } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

const checkAuthorizationToApply = async (user: User, protocolId: number) => {
    if (user.role !== 'ADMIN') {
        const protocol = await prismaClient.protocol.findUnique({
            where: {
                id: protocolId,
                applicable: true,
                enabled: true,
            },
        });

        if (!protocol) {
            throw new Error('This user is not authorized to apply this protocol.');
        }
    }
};

const selectedFieldsWithNested = {
    id: true,
    protocol: { select: { id: true, title: true, description: true } },
    visibilityMode: true,
    applicator: { select: { id: true, username: true } },
    createdAt: true,
    updatedAt: true,
    viewersUser: { select: { id: true, username: true } },
    viewersClassroom: { select: { id: true, institution: { select: { name: true } } } },
};

const selectedFieldsWithProtocol = {
    ...selectedFieldsWithNested,
    protocol: {
        include: {
            pages: {
                include: {
                    itemGroups: {
                        include: {
                            items: {
                                include: {
                                    itemOptions: {
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
                visibilityMode: yup.string().oneOf(Object.values(VisibilityMode)).required(),
                viewersUser: yup.array().of(yup.number()).min(1).required(),
                viewersClassroom: yup.array().of(yup.number()).min(1).required(),
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
                applicatorId: user.id,
                visibilityMode: application.visibilityMode,
                viewersUser: {
                    connect: application.viewersUser.map((id) => ({ id: id })),
                },
                viewersClassroom: {
                    connect: application.viewersClassroom.map((id) => ({ id: id })),
                },
            },
            select: selectedFieldsWithNested,
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
                visibilityMode: yup.string().oneOf(Object.values(VisibilityMode)),
                viewersUser: yup.array().of(yup.number()).min(1).required(),
                viewersClassroom: yup.array().of(yup.number()).min(1).required(),
            })
            .noUnknown();

        // Yup parsing/validation
        const application = await updateApplicationSchema.validate(req.body, { stripUnknown: false });

        // User from Passport-JWT
        const user = req.user as User;

        // Check if the user is allowed to update the application
        if (user.role !== 'ADMIN') {
            await prismaClient.application.findUniqueOrThrow({
                where: {
                    id: id,
                    applicatorId: user.id,
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
                visibilityMode: application.visibilityMode,
                viewersUser: {
                    set: [],
                    connect: application.viewersUser.map((id) => ({ id: id })),
                },
                viewersClassroom: {
                    set: [],
                    connect: application.viewersClassroom.map((id) => ({ id: id })),
                },
            },
            select: selectedFieldsWithNested,
        });

        res.status(200).json({ message: 'Application updated.', data: updatedApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;

        // Get all applications that the user is allowed to see
        const applications =
            user.role === 'ADMIN'
                ? await prismaClient.application.findMany({
                      select: selectedFieldsWithNested,
                  })
                : await prismaClient.application.findMany({
                      where: {
                          applicatorId: user.id,
                      },
                      select: selectedFieldsWithNested,
                  });
        res.status(200).json({ message: 'All applications found.', data: applications });
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
        const application =
            user.role === 'ADMIN'
                ? await prismaClient.application.findUniqueOrThrow({
                      where: {
                          id: id,
                      },
                      select: selectedFieldsWithNested,
                  })
                : await prismaClient.application.findUniqueOrThrow({
                      where: {
                          id: id,
                          OR: [
                              { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                              { viewersUser: { some: { id: user.id } } },
                              { applicatorId: user.id },
                          ],
                      },
                      select: selectedFieldsWithNested,
                  });

        res.status(200).json({ message: 'Application found.', data: application });
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
            user.role === 'ADMIN'
                ? await prismaClient.application.findUniqueOrThrow({
                      where: {
                          id: id,
                      },
                      select: selectedFieldsWithProtocol,
                  })
                : await prismaClient.application.findUniqueOrThrow({
                      where: {
                          id: id,
                          OR: [
                              { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                              { viewersUser: { some: { id: user.id } } },
                              { applicatorId: user.id },
                          ],
                      },
                      select: selectedFieldsWithProtocol,
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
            user.role === 'ADMIN'
                ? await prismaClient.application.delete({
                      where: {
                          id: id,
                      },
                  })
                : await prismaClient.application.delete({
                      where: {
                          id: id,
                          applicatorId: user.id,
                      },
                  });

        res.status(200).json({ message: 'Application deleted.', data: deletedApplication });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
