import { Response, Request } from 'express';
import { ApplicationAnswer, User } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

const checkAuthorizationToAnswer = async (user: User, applicationId: number) => {
    if (user.role !== 'ADMIN') {
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
            throw new Error('This user is not authorized to answer this application.');
        }
    }
};

const fieldsWithNesting = {
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
            .shape({ id: yup.number(), text: yup.string().max(255).required(), itemId: yup.number().required() })
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
        await checkAuthorizationToAnswer(user, applicationAnswer.applicationId);

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
            // Create nested item answer groups as well as nested item, option and table answers
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
                select: fieldsWithNesting,
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
        const id: number = parseInt(req.params.applicationAnswerId);

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

        // Prisma transaction
        const upsertedApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            // Update application answer
            await prisma.applicationAnswer.update({
                where: { id, userId: user.id },
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
                    applicationAnswerId: id,
                },
            });
            for (const [itemAnswerGroupIndex, itemAnswerGroup] of applicationAnswer.itemAnswerGroups.entries()) {
                // Create new item answer group if it does not exist
                const upsertedItemAnswerGroupId =
                    itemAnswerGroup.id ||
                    (
                        await prisma.itemAnswerGroup.create({
                            data: { applicationAnswerId: id },
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
                        group: { applicationAnswerId: id },
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
            return await prisma.applicationAnswer.findUnique({ where: { id }, select: fieldsWithNesting });
        });
        res.status(200).json({ message: 'Application answer updated.', data: upsertedApplicationAnswer });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllApplicationAnswers = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user as User;

        // Get all application answers with nested content included (only those that the user is allowed to view)
        const applicationAnswers: ApplicationAnswer[] =
            user.role === 'ADMIN'
                ? await prismaClient.applicationAnswer.findMany({ select: fieldsWithNesting })
                : await prismaClient.applicationAnswer.findMany({ where: { userId: user.id }, select: fieldsWithNesting });

        res.status(200).json({ message: 'All application answers found.', data: applicationAnswers });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getApplicationWithAnswers = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user as User;

        const applicationId: number = parseInt(req.params.applicationId);

        const applicationWithAnswers: any = await prismaClient.application.findUniqueOrThrow({
            where: {
                id: applicationId,
            },
            select: {
                answers: {
                    select: {
                        id: true,
                        date: true,
                        user: {
                            select: {
                                id: true,
                                username: true,
                            },
                        },
                    },
                },
                protocol: {
                    select: {
                        title: true,
                        description: true,
                        pages: {
                            select: {
                                type: true,
                                placement: true,
                                itemGroups: {
                                    select: {
                                        type: true,
                                        placement: true,
                                        isRepeatable: true,
                                        items: {
                                            select: {
                                                id: true,
                                                text: true,
                                                description: true,
                                                type: true,
                                                placement: true,
                                                itemOptions: {
                                                    select: {
                                                        id: true,
                                                        text: true,
                                                        placement: true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
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
                        },
                    });

                    for (const answer of itemAnswers) {
                        if (!item.itemAnswers[answer.group.applicationAnswerId]) {
                            item.itemAnswers[answer.group.applicationAnswerId] = {};
                        }

                        if (!item.itemAnswers[answer.group.applicationAnswerId][answer.group.id]) {
                            item.itemAnswers[answer.group.applicationAnswerId][answer.group.id] = [];
                        }

                        item.itemAnswers[answer.group.applicationAnswerId][answer.group.id].push({ text: answer.text });
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

        res.status(200).json({ message: 'All answers for application ' + applicationId + ' found.', data: applicationWithAnswers });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;

        // ID from params
        const id: number = parseInt(req.params.applicationAnswerId);

        // Get application answer with nested content included (only if user is allowed to view it or is admin)
        const applicationAnswer: ApplicationAnswer =
            user.role === 'ADMIN'
                ? await prismaClient.applicationAnswer.findUniqueOrThrow({ where: { id }, select: fieldsWithNesting })
                : await prismaClient.applicationAnswer.findUniqueOrThrow({
                      where: { id, userId: user.id },
                      select: fieldsWithNesting,
                  });

        res.status(200).json({ message: 'Application answer found.', data: applicationAnswer });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;

        // ID from params
        const id: number = parseInt(req.params.applicationAnswerId);

        // Delete application answer (only if user is allowed to delete it or is admin)
        const deletedApplicationAnswer: ApplicationAnswer =
            user.role === 'ADMIN'
                ? await prismaClient.applicationAnswer.delete({ where: { id } })
                : await prismaClient.applicationAnswer.delete({ where: { id, userId: user.id } });

        res.status(200).json({ message: 'Application answer deleted.', data: deletedApplicationAnswer });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
