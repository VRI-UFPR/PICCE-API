import { Response, Request } from 'express';
import { ApplicationAnswer, User, UserRole, VisibilityMode } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

const checkAuthorization = async (
    user: User,
    applicationAnswerId: number | undefined,
    applicationId: number | undefined,
    action: string
) => {
    switch (action) {
        case 'create':
            // Only ADMINs, the applier or viewers of the application can perform create operations on application answers
            if (user.role !== UserRole.ADMIN) {
                const application = await prismaClient.application.findUnique({
                    where: {
                        id: applicationId,
                        OR: [
                            { visibility: VisibilityMode.PUBLIC },
                            { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                            { viewersUser: { some: { id: user.id } } },
                            { applierId: user.id },
                        ],
                    },
                });
                if (!application) {
                    throw new Error('This user is not authorized to perform this action.');
                }
            }
            break;
        case 'update':
        case 'get':
        case 'delete':
            // Only ADMINs or the creator of the application answer can perform update/get/delete operations on application answers
            if (user.role !== UserRole.ADMIN) {
                const applicationAnswer = await prismaClient.applicationAnswer.findUnique({
                    where: { id: applicationAnswerId, userId: user.id },
                });
                if (!applicationAnswer) {
                    throw new Error('This user is not authorized to perform this action.');
                }
            }
            break;
        case 'getAll':
            // Only ADMINs can perform get all application answers operation
            if (user.role !== UserRole.ADMIN) {
                throw new Error('This user is not authorized to perform this action.');
            }
            break;
        case 'getMy':
            // All users can perform getMy operations on application answers (the results will be filtered based on the user)
            break;
    }
};

const fields = {
    id: true,
    date: true,
    userId: true,
    applicationId: true,
    addressId: true,
    createdAt: true,
    updateAt: true,
    itemAnswerGroups: {
        select: {
            id: true,
            itemAnswers: { select: { id: true, text: true, itemId: true, files: { select: { id: true, path: true } } } },
            optionAnswers: { select: { id: true, text: true, itemId: true, optionId: true } },
            tableAnswers: { select: { id: true, text: true, itemId: true, columnId: true } },
        },
    },
};

export const createApplicationAnswer = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createItemAnswerSchema = yup
            .object()
            .shape({ id: yup.number(), text: yup.string().max(255), itemId: yup.number().required() })
            .noUnknown();
        const createOptionAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().max(255),
                itemId: yup.number().required(),
                optionId: yup.number().required(),
            })
            .noUnknown();
        const createTableAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().max(255),
                itemId: yup.number().required(),
                columnId: yup.number().required(),
            })
            .noUnknown();
        const createItemAnswerGroupSchema = yup
            .object()
            .shape({
                id: yup.number(),
                itemAnswers: yup.array().of(createItemAnswerSchema).default([]),
                tableAnswers: yup.array().of(createTableAnswerSchema).default([]),
                optionAnswers: yup.array().of(createOptionAnswerSchema).default([]),
            })
            .noUnknown();
        const createApplicationAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                date: yup.date().required(),
                applicationId: yup.number().required(),
                addressId: yup.number().required(),
                itemAnswerGroups: yup.array().of(createItemAnswerGroupSchema).min(1).required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const applicationAnswer = await createApplicationAnswerSchema.validate(req.body, { stripUnknown: false });
        // Multer files
        const files = req.files as Express.Multer.File[];
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to answer this application
        await checkAuthorization(user, undefined, applicationAnswer.applicationId, 'create');
        // Prisma transaction
        const createdApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            const createdApplicationAnswer: ApplicationAnswer = await prisma.applicationAnswer.create({
                data: {
                    id: applicationAnswer.id,
                    date: applicationAnswer.date,
                    userId: user.id,
                    applicationId: applicationAnswer.applicationId,
                    addressId: applicationAnswer.addressId,
                },
            });
            for (const [itemAnswerGroupIndex, itemAnswerGroup] of applicationAnswer.itemAnswerGroups.entries()) {
                const createdItemAnswerGroup = await prisma.itemAnswerGroup.create({
                    data: {
                        id: itemAnswerGroup.id,
                        applicationAnswerId: createdApplicationAnswer.id,
                        optionAnswers: {
                            createMany: {
                                data: itemAnswerGroup.optionAnswers.map((optionAnswer) => {
                                    return {
                                        id: optionAnswer.id,
                                        text: optionAnswer.text,
                                        itemId: optionAnswer.itemId,
                                        optionId: optionAnswer.optionId,
                                    };
                                }),
                            },
                        },
                        tableAnswers: {
                            createMany: {
                                data: itemAnswerGroup.tableAnswers.map((tableAnswer) => {
                                    return {
                                        id: tableAnswer.id,
                                        text: tableAnswer.text,
                                        itemId: tableAnswer.itemId,
                                        columnId: tableAnswer.columnId,
                                    };
                                }),
                            },
                        },
                    },
                });
                for (const [itemAnswerIndex, itemAnswer] of itemAnswerGroup.itemAnswers.entries()) {
                    const itemAnswerFiles = files
                        .filter((file) =>
                            file.fieldname.startsWith(`itemAnswerGroups[${itemAnswerGroupIndex}][itemAnswers][${itemAnswerIndex}][files]`)
                        )
                        .map((file) => {
                            return { path: file.path };
                        });
                    await prisma.itemAnswer.create({
                        data: {
                            id: itemAnswer.id,
                            text: itemAnswer.text,
                            itemId: itemAnswer.itemId,
                            groupId: createdItemAnswerGroup.id,
                            files: { createMany: { data: itemAnswerFiles } },
                        },
                    });
                }
            }
            // Return the created application answer with nested content included
            return await prisma.applicationAnswer.findUnique({
                where: { id: createdApplicationAnswer.id },
                select: fields,
            });
        });

        res.status(201).json({ message: 'Application answer created.', data: createdApplicationAnswer });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationAnswerId: number = parseInt(req.params.applicationAnswerId);
        // Yup schemas
        const updateItemAnswerSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                text: yup.string().max(255),
                itemId: yup.number().min(1),
                filesIds: yup.array().of(yup.number()).default([]),
            })
            .noUnknown();
        const updateOptionAnswerSchema = yup
            .object()
            .shape({ id: yup.number(), text: yup.string().max(255), itemId: yup.number().min(1), optionId: yup.number().min(1) })
            .noUnknown();
        const updateTableAnswerSchema = yup
            .object()
            .shape({ id: yup.number(), text: yup.string().max(255), itemId: yup.number().min(1), columnId: yup.number().min(1) })
            .noUnknown();
        const updateItemAnswerGroupSchema = yup
            .object()
            .shape({
                id: yup.number(),
                itemAnswers: yup.array().of(updateItemAnswerSchema).default([]),
                tableAnswers: yup.array().of(updateTableAnswerSchema).default([]),
                optionAnswers: yup.array().of(updateOptionAnswerSchema).default([]),
            })
            .noUnknown();
        const updateApplicationAnswerSchema = yup
            .object()
            .shape({
                date: yup.date(),
                addressId: yup.number(),
                itemAnswerGroups: yup.array().of(updateItemAnswerGroupSchema).min(1).required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const applicationAnswer = await updateApplicationAnswerSchema.validate(req.body, { stripUnknown: false });
        // Multer files
        const files = req.files as Express.Multer.File[];
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to update this application answer
        await checkAuthorization(user, applicationAnswerId, undefined, 'update');
        // Prisma transaction
        const upsertedApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            // Update application answer
            await prisma.applicationAnswer.update({
                where: { id: applicationAnswerId },
                data: { date: applicationAnswer.date, addressId: applicationAnswer.addressId },
            });
            // Remove item answer groups that are not in the updated application answer
            await prisma.itemAnswerGroup.deleteMany({
                where: {
                    id: {
                        notIn: applicationAnswer.itemAnswerGroups
                            .filter((itemAnswerGroup) => itemAnswerGroup.id)
                            .map((itemAnswerGroup) => itemAnswerGroup.id as number),
                    },
                    applicationAnswerId: applicationAnswerId,
                },
            });
            for (const [itemAnswerGroupIndex, itemAnswerGroup] of applicationAnswer.itemAnswerGroups.entries()) {
                // Create new item answer group if it does not exist
                const upsertedItemAnswerGroupId =
                    itemAnswerGroup.id ||
                    (
                        await prisma.itemAnswerGroup.create({
                            data: { applicationAnswerId: applicationAnswerId },
                        })
                    ).id;
                // Remove item answers that are not in the updated item answer group
                await prisma.itemAnswer.deleteMany({
                    where: {
                        id: {
                            notIn: itemAnswerGroup.itemAnswers
                                .filter((itemAnswer) => itemAnswer.id)
                                .map((itemAnswer) => itemAnswer.id as number),
                        },
                        group: { applicationAnswerId: applicationAnswerId },
                    },
                });
                for (const [itemAnswerIndex, itemAnswer] of itemAnswerGroup.itemAnswers.entries()) {
                    // Update existing item answers or create new ones
                    const upsertedItemAnswer = itemAnswer.id
                        ? await prisma.itemAnswer.update({
                              where: { id: itemAnswer.id, groupId: upsertedItemAnswerGroupId },
                              data: { text: itemAnswer.text },
                          })
                        : await prisma.itemAnswer.create({
                              data: {
                                  text: itemAnswer.text as string,
                                  itemId: itemAnswer.itemId as number,
                                  groupId: upsertedItemAnswerGroupId as number,
                              },
                          });
                    //Remove files that are not in the updated item answer
                    await prisma.file.deleteMany({
                        where: {
                            id: { notIn: itemAnswer.filesIds.filter((fileId) => fileId).map((fileId) => fileId as number) },
                            itemAnswerId: upsertedItemAnswer.id,
                        },
                    });
                    // Create new files (udpating files is not supported)
                    const itemAnswerFiles = files
                        .filter(
                            (file) => file.fieldname === `itemAnswerGroups[${itemAnswerGroupIndex}][itemAnswers][${itemAnswerIndex}][files]`
                        )
                        .map((file) => {
                            return { path: file.path, itemAnswerId: upsertedItemAnswer.id };
                        });
                    await prisma.file.createMany({ data: itemAnswerFiles });
                }
                // Remove option answers that are not in the updated item answer group
                await prisma.optionAnswer.deleteMany({
                    where: {
                        id: {
                            notIn: itemAnswerGroup.optionAnswers
                                .filter((optionAnswer) => optionAnswer.id)
                                .map((optionAnswer) => optionAnswer.id as number),
                        },
                        groupId: upsertedItemAnswerGroupId,
                    },
                });
                for (const optionAnswer of itemAnswerGroup.optionAnswers) {
                    // Update existing option answers or create new ones
                    optionAnswer.id
                        ? await prisma.optionAnswer.update({
                              where: { id: optionAnswer.id, groupId: upsertedItemAnswerGroupId },
                              data: { text: optionAnswer.text },
                          })
                        : await prisma.optionAnswer.create({
                              data: {
                                  text: optionAnswer.text as string,
                                  itemId: optionAnswer.itemId as number,
                                  optionId: optionAnswer.optionId as number,
                                  groupId: upsertedItemAnswerGroupId as number,
                              },
                          });
                }
                // Remove table answers that are not in the updated item answer group
                await prisma.tableAnswer.deleteMany({
                    where: {
                        id: {
                            notIn: itemAnswerGroup.tableAnswers
                                .filter((tableAnswer) => tableAnswer.id)
                                .map((tableAnswer) => tableAnswer.id as number),
                        },
                        groupId: upsertedItemAnswerGroupId,
                    },
                });
                for (const tableAnswer of itemAnswerGroup.tableAnswers) {
                    // Update existing table answers or create new ones
                    tableAnswer.id
                        ? await prisma.tableAnswer.update({
                              where: { id: tableAnswer.id, groupId: upsertedItemAnswerGroupId },
                              data: { text: tableAnswer.text },
                          })
                        : await prisma.tableAnswer.create({
                              data: {
                                  text: tableAnswer.text as string,
                                  itemId: tableAnswer.itemId as number,
                                  columnId: tableAnswer.columnId as number,
                                  groupId: upsertedItemAnswerGroupId as number,
                              },
                          });
                }
            }
            // Return the updated application answer with nested content included
            return await prisma.applicationAnswer.findUnique({ where: { id: applicationAnswerId }, select: fields });
        });

        res.status(200).json({ message: 'Application answer updated.', data: upsertedApplicationAnswer });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllApplicationAnswers = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to get all application answers
        await checkAuthorization(user, undefined, undefined, 'getAll');
        // Prisma operation
        const applicationAnswers: ApplicationAnswer[] = await prismaClient.applicationAnswer.findMany({ select: fields });

        res.status(200).json({ message: 'All application answers found.', data: applicationAnswers });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getMyApplicationAnswers = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to get their application answers
        await checkAuthorization(user, undefined, undefined, 'getMy');
        // Prisma operation
        const applicationAnswers: ApplicationAnswer[] = await prismaClient.applicationAnswer.findMany({
            where: { userId: user.id },
            select: fields,
        });

        res.status(200).json({ message: 'My application answers found.', data: applicationAnswers });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationAnswerId: number = parseInt(req.params.applicationAnswerId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to view this application answer
        await checkAuthorization(user, applicationAnswerId, undefined, 'get');
        // Prisma operation
        const applicationAnswer: ApplicationAnswer = await prismaClient.applicationAnswer.findUniqueOrThrow({
            where: { id: applicationAnswerId },
            select: fields,
        });

        res.status(200).json({ message: 'Application answer found.', data: applicationAnswer });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationAnswerId: number = parseInt(req.params.applicationAnswerId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to delete this application answer
        await checkAuthorization(user, applicationAnswerId, undefined, 'delete');
        // Prisma operation
        const deletedApplicationAnswer = await prismaClient.applicationAnswer.delete({
            where: { id: applicationAnswerId },
            select: { id: true },
        });

        res.status(200).json({ message: 'Application answer deleted.', data: deletedApplicationAnswer });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
