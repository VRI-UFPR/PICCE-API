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
import { ApplicationAnswer, User, UserRole, VisibilityMode } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';
import { unlinkSync, existsSync } from 'fs';

const checkAuthorization = async (
    user: User,
    applicationAnswerId: number | undefined,
    applicationId: number | undefined,
    action: string
) => {
    if (user.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create':
            // Only ADMINs, the applier or viewers of the application can perform create operations on application answers
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
            if (!application) throw new Error('This user is not authorized to perform this action.');

            break;
        case 'update':
        case 'get':
        case 'delete':
            // Only ADMINs or the creator of the application answer can perform update/get/delete operations on application answers
            const applicationAnswer = await prismaClient.applicationAnswer.findUnique({
                where: { id: applicationAnswerId, userId: user.id },
            });
            if (!applicationAnswer) throw new Error('This user is not authorized to perform this action.');

            break;
        case 'getAll':
            // Only ADMINs can perform get all application answers operation
            throw new Error('This user is not authorized to perform this action.');
            break;
        case 'getMy':
            // All users can perform getMy operations on application answers (the results will be filtered based on the user)
            break;
    }
};

const validateAnswers = async (itemAnswerGroups: any, applicationId: number) => {
    const application = await prismaClient.application.findUnique({
        where: { id: applicationId },
        select: {
            protocol: {
                select: {
                    pages: {
                        select: {
                            itemGroups: {
                                select: {
                                    items: {
                                        select: {
                                            id: true,
                                            type: true,
                                            text: true,
                                            itemValidations: { select: { type: true, argument: true, customMessage: true } },
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

    const itemValidations =
        application?.protocol.pages.flatMap((page) =>
            page.itemGroups.flatMap((itemGroup) =>
                itemGroup.items.map((item) => ({
                    id: item.id,
                    text: item.text,
                    type: item.type,
                    mandatory: item.itemValidations?.find((validation) => validation.type === 'MANDATORY'),
                    min: item.itemValidations?.find((validation) => validation.type === 'MIN'),
                    max: item.itemValidations?.find((validation) => validation.type === 'MAX'),
                    step: item.itemValidations?.find((validation) => validation.type === 'STEP'),
                }))
            )
        ) || [];

    const answers: any = {};

    for (const itemAnswerGroup of itemAnswerGroups) {
        for (const itemAnswer of itemAnswerGroup.itemAnswers) {
            if (answers[itemAnswer.itemId]) {
                answers[itemAnswer.itemId].push(itemAnswer);
            } else {
                answers[itemAnswer.itemId] = [itemAnswer];
            }
        }
        for (const optionAnswer of itemAnswerGroup.optionAnswers) {
            if (answers[optionAnswer.itemId]) {
                answers[optionAnswer.itemId].push(optionAnswer);
            } else {
                answers[optionAnswer.itemId] = [optionAnswer];
            }
        }
        for (const tableAnswer of itemAnswerGroup.tableAnswers) {
            if (answers[tableAnswer.itemId]) {
                answers[tableAnswer.itemId].push(tableAnswer);
            } else {
                answers[tableAnswer.itemId] = [tableAnswer];
            }
        }
    }

    for (const itemValidation of itemValidations) {
        if (itemValidation.mandatory) {
            if (!answers[itemValidation.id]) throw new Error('Mandatory item is missing: ' + itemValidation.text);
            for (const answer of answers[itemValidation.id]) {
                if (answer.text === '') throw new Error('Mandatory item is missing: ' + itemValidation.text);
            }
        }
        if (itemValidation.min && answers[itemValidation.id]) {
            if (itemValidation.type === 'NUMBERBOX') {
                for (const answer of answers[itemValidation.id]) {
                    if (answer.text !== '' && Number(answer.text) < Number(itemValidation.min.argument)) {
                        throw new Error(
                            'Item value is too low: ' + itemValidation.text + ' expected at least ' + itemValidation.min.argument
                        );
                    }
                }
            } else if (itemValidation.type === 'TEXTBOX') {
                for (const answer of answers[itemValidation.id]) {
                    if (answer.text !== '' && answer.text.length < Number(itemValidation.min.argument)) {
                        throw new Error(
                            'Item value is too low: ' + itemValidation.text + ' expected at least ' + itemValidation.min.argument
                        );
                    }
                }
            } else if (itemValidation.type === 'CHECKBOX') {
                if (answers[itemValidation.id].length < Number(itemValidation.min.argument)) {
                    throw new Error(
                        'Not enough items selected: ' + itemValidation.text + ' expected at least ' + itemValidation.min.argument
                    );
                }
            }
        }
        if (itemValidation.max && answers[itemValidation.id]) {
            if (itemValidation.type === 'NUMBERBOX') {
                for (const answer of answers[itemValidation.id]) {
                    if (answer.text !== '' && Number(answer.text) > Number(itemValidation.max.argument)) {
                        throw new Error(
                            'Item value is too high: ' + itemValidation.text + ' expected at most ' + itemValidation.max.argument
                        );
                    }
                }
            } else if (itemValidation.type === 'TEXTBOX') {
                for (const answer of answers[itemValidation.id]) {
                    if (answer.text !== '' && answer.text.length > Number(itemValidation.max.argument)) {
                        throw new Error(
                            'Item value is too high: ' + itemValidation.text + ' expected at most ' + itemValidation.max.argument
                        );
                    }
                }
            } else if (itemValidation.type === 'CHECKBOX') {
                if (answers[itemValidation.id].length > Number(itemValidation.max.argument)) {
                    throw new Error('Too many items selected: ' + itemValidation.text + ' expected at most ' + itemValidation.max.argument);
                }
            }
        }
    }
};
const fields = {
    id: true,
    date: true,
    userId: true,
    applicationId: true,
    addressId: true,
    createdAt: true,
    updatedAt: true,
    itemAnswerGroups: {
        select: {
            id: true,
            itemAnswers: { select: { id: true, text: true, itemId: true, files: { select: { id: true, path: true, description: true } } } },
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
                addressId: yup.number(),
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
        // Validate answers
        await validateAnswers(applicationAnswer.itemAnswerGroups, applicationAnswer.applicationId);
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
                            files.splice(files.indexOf(file), 1);
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
            // Check if there are any files left
            if (files.length > 0) {
                throw new Error('Files not associated with any item answer detected.');
            }

            // Return the created application answer with nested content included
            return await prisma.applicationAnswer.findUnique({
                where: { id: createdApplicationAnswer.id },
                select: fields,
            });
        });

        res.status(201).json({ message: 'Application answer created.', data: createdApplicationAnswer });
    } catch (error: any) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) if (existsSync(file.path)) unlinkSync(file.path);
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
        // Validate answers
        await validateAnswers(applicationAnswer.itemAnswerGroups, applicationAnswerId);
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
                    const filesToDelete = await prisma.file.findMany({
                        where: {
                            id: { notIn: itemAnswer.filesIds.filter((fileId) => fileId).map((fileId) => fileId as number) },
                            itemAnswerId: upsertedItemAnswer.id,
                        },
                        select: { id: true, path: true },
                    });
                    for (const file of filesToDelete) if (existsSync(file.path)) unlinkSync(file.path);
                    await prisma.file.deleteMany({ where: { id: { in: filesToDelete.map((file) => file.id) } } });
                    // Create new files (udpating files is not supported)
                    const itemAnswerFiles = files
                        .filter((file) =>
                            file.fieldname.startsWith(`itemAnswerGroups[${itemAnswerGroupIndex}][itemAnswers][${itemAnswerIndex}][files]`)
                        )
                        .map((file) => {
                            files.splice(files.indexOf(file), 1);
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
            // Check if there are any files left
            if (files.length > 0) {
                throw new Error('Files not associated with any item answer detected.');
            }

            // Return the updated application answer with nested content included
            return await prisma.applicationAnswer.findUnique({ where: { id: applicationAnswerId }, select: fields });
        });

        res.status(200).json({ message: 'Application answer updated.', data: upsertedApplicationAnswer });
    } catch (error: any) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) if (existsSync(file.path)) unlinkSync(file.path);
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
