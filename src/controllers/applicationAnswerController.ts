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
import { getApplicationsUserActions, getDetailedApplications } from './applicationController';
import fieldsFilter from '../services/fieldsFilter';

/**
 * Retrieve the detailed application answers fields required for internal endpoint validations.
 *
 * This function handles the creation of a custom select filter that serves as a parameter for Prisma Client to return an
 * application answer with all the fields required for internal endpoint validations.
 *
 * @returns A Prisma select filter object
 */
const detailedApplicationAnswerFields = () => ({
    application: {
        select: {
            applier: { select: { id: true, institution: { select: { id: true } } } },
            protocol: {
                select: {
                    creator: { select: { id: true, institution: { select: { id: true } } } },
                    managers: { select: { id: true, institution: { select: { id: true } } } },
                },
            },
            answersViewersUser: { select: { id: true, institution: { select: { id: true } } } },
            answersViewersClassroom: { select: { users: { select: { id: true, institution: { select: { id: true } } } } } },
            visibility: true,
        },
    },
});

/**
 * Gets a set of detailed applicationAnswers from a set of IDs
 *
 * This function handles the retrieval of a set of detailed application answers, with all the fields required for internal
 * endpoint validations, from a set of application answers IDs using Prisma.
 *
 * @param applicationAnswersIds An array of application answers IDs
 * @returns A set of detailed application answers
 */
const getDetailedApplicationAnswers = async (applicationAnswersIds: number[]) => {
    return await prismaClient.applicationAnswer.findMany({
        where: { id: { in: applicationAnswersIds } },
        include: detailedApplicationAnswerFields(),
    });
};

/**
 * Retrieves a user's roles against a given set of application answers.
 *
 * @param user - The user whose roles are being determined.
 * @param applicationAnswers - The detailed application answers for which the roles are being determined.
 * @returns A promise that resolves to an array of objects representing the roles of the user for each application answer.
 *
 * Each role object contains the following properties:
 * - `answerer`: Whether the user is the one who answered the application.
 * - `applicationApplier`: Whether the user is the creator of the application.
 * - `applicationCoordinator`: Whether the user is the coordinator of the application applier's institution.
 * - `applicationInstitutionMember`: Whether the user is a member of the application applier's institution.
 * - `protocolCoordinator`: Whether the user is the coordinator of the protocol creator's institution.
 * - `protocolCreator`: Whether the user is the creator of the protocol.
 * - `protocolInstitutionMember`: Whether the user is a member of the protocol creator's institution.
 * - `protocolManager`: Whether the user is a manager of the protocol.
 * - `viewer`: Whether the user has viewing permissions for the application answer.
 */
const getApplicationAnswerUserRoles = async (user: User, applicationAnswers: Awaited<ReturnType<typeof getDetailedApplicationAnswers>>) => {
    const roles = applicationAnswers.map((applicationAnswer) => {
        const protocolCreator = applicationAnswer.application.protocol.creator.id === user.id;
        const protocolManager = applicationAnswer.application.protocol.managers.some(({ id }) => id === user.id);
        const protocolCoordinator =
            user.institutionId &&
            user.role === UserRole.COORDINATOR &&
            applicationAnswer.application.protocol.creator.institution?.id === user.institutionId;
        const applicationCoordinator =
            user.institutionId &&
            user.role === UserRole.COORDINATOR &&
            applicationAnswer.application.applier.institution?.id === user.institutionId;
        const protocolInstitutionMember =
            user.institutionId && applicationAnswer.application.protocol.creator.institution?.id === user.institutionId;
        const applicationInstitutionMember =
            user.institutionId && applicationAnswer.application.applier.institution?.id === user.institutionId;
        const applicationApplier = applicationAnswer.application.applier.id === user.id;
        const answerer = applicationAnswer.userId === user.id;
        const viewer =
            applicationAnswer.application.answersViewersUser.some(({ id }) => id === user.id) ||
            applicationAnswer.application.answersViewersClassroom.some(({ users }) => users.some(({ id }) => id === user.id)) ||
            applicationAnswer.application.visibility === VisibilityMode.PUBLIC ||
            (applicationAnswer.application.visibility === VisibilityMode.AUTHENTICATED && user.role !== UserRole.GUEST);

        return {
            answerer,
            applicationApplier,
            applicationCoordinator,
            applicationInstitutionMember,
            protocolCoordinator,
            protocolCreator,
            protocolInstitutionMember,
            protocolManager,
            viewer,
        };
    });

    return roles;
};

/**
 * Retrieves the actions that a user can perform on a set of application answers.
 *
 * @param user - The user whose actions are being determined.
 * @param applicationAnswers - The detailed application answers for which the actions are being determined.
 * @returns A promise that resolves to an array of objects representing the actions that the user can perform on each application answer.
 *
 * The returned action object contains the following properties:
 * - `toApprove`: Indicates if the user can approve the application answer.
 * - `toDelete`: Indicates if the user can delete the application answer.
 * - `toGet`: Indicates if the user can get details of the application answer.
 * - `toUpdate`: Indicates if the user can update the application answer.
 */
const getApplicationAnswerActions = async (user: User, applicationAnswers: Awaited<ReturnType<typeof getDetailedApplicationAnswers>>) => {
    const applicationAnswersRoles = await getApplicationAnswerUserRoles(user, applicationAnswers);
    // Admins can perform all actions on application answers
    const actions = applicationAnswersRoles.map((roles) => {
        // Only the creator can perform update operations on application answers
        const toUpdate = roles.answerer || user.role === UserRole.ADMIN;
        // Only protocol managers/protocol creator/application applier/creator can perform get/delete operations on application answers
        const toDelete =
            roles.answerer || roles.applicationApplier || roles.protocolCreator || roles.protocolManager || user.role === UserRole.ADMIN;
        const toGet =
            roles.answerer || roles.applicationApplier || roles.protocolCreator || roles.protocolManager || user.role === UserRole.ADMIN;
        // Only protocol managers/protocol creator/application applier can perform approve operations on application answers
        const toApprove = roles.applicationApplier || roles.protocolCreator || roles.protocolManager || user.role === UserRole.ADMIN;
        // No one can perform getAll operations on application answers
        const toGetAll = user.role === UserRole.ADMIN;
        // Anyone can perform getMy operations on application answers (since the content is filtered according to the user)
        const toGetMy = true;

        return { toApprove, toDelete, toGet, toUpdate };
    });

    return actions;
};

/**
 * Checks if the user is authorized to perform a specific action on a set of application answers.
 *
 * @param requester - The user object containing requester user details.
 * @param action - The action the user wants to perform (e.g., 'create', 'update', 'get', 'delete', 'approve', 'getAll', 'getMy').
 *
 * @throws Will throw an error if the user is not authorized to perform the action.
 * @returns A promise that resolves if the user is authorized to perform the action.
 */
const checkAuthorization = async (requester: User, applicationAnswersIds: number[], applicationsIds: number[], action: string) => {
    if (requester.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create': {
            if ((await getApplicationsUserActions(requester, await getDetailedApplications(applicationsIds))).some(({ toGet }) => !toGet))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'update': {
            if (
                (await getApplicationAnswerActions(requester, await getDetailedApplicationAnswers(applicationAnswersIds))).some(
                    ({ toUpdate }) => !toUpdate
                )
            )
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'get': {
            if (
                (await getApplicationAnswerActions(requester, await getDetailedApplicationAnswers(applicationAnswersIds))).some(
                    ({ toGet }) => !toGet
                )
            )
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'delete': {
            if (
                (await getApplicationAnswerActions(requester, await getDetailedApplicationAnswers(applicationAnswersIds))).some(
                    ({ toDelete }) => !toDelete
                )
            )
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'approve': {
            if (
                (await getApplicationAnswerActions(requester, await getDetailedApplicationAnswers(applicationAnswersIds))).some(
                    ({ toApprove }) => !toApprove
                )
            )
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getAll':
            // No one can perform getAll operations on application answers
            throw new Error('This user is not authorized to perform this action');
        case 'getMy':
            // Anyone can perform getMy operations on application answers (since the content is filtered according to the user)
            break;
    }
};

/**
 * Validates the answers provided for an application based on the validation rules defined in the protocol.
 *
 * @param itemAnswerGroups - The groups of answers provided by the user.
 * @param applicationId - The ID of the application to validate against.
 * @throws Will throw an error if any answer does not meet the validation criteria.
 *
 * The function performs the following validations:
 * - Checks if mandatory items are present and not empty.
 * - Validates numerical answers against minimum and maximum values.
 * - Validates text answers against minimum and maximum length.
 * - Validates the number of selected items for checkbox answers against minimum and maximum limits.
 *
 * @returns A promise that resolves if all answers meet the validation criteria.
 */
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

    // Create a map of answers
    const answers: any = {};

    for (const itemAnswerGroup of itemAnswerGroups) {
        for (const itemAnswer of itemAnswerGroup.itemAnswers) {
            if (answers[itemAnswer.itemId]) answers[itemAnswer.itemId].push(itemAnswer);
            else answers[itemAnswer.itemId] = [itemAnswer];
        }
        for (const optionAnswer of itemAnswerGroup.optionAnswers) {
            if (answers[optionAnswer.itemId]) answers[optionAnswer.itemId].push(optionAnswer);
            else answers[optionAnswer.itemId] = [optionAnswer];
        }
        for (const tableAnswer of itemAnswerGroup.tableAnswers) {
            if (answers[tableAnswer.itemId]) answers[tableAnswer.itemId].push(tableAnswer);
            else answers[tableAnswer.itemId] = [tableAnswer];
        }
    }

    // Check all validations
    for (const itemValidation of itemValidations) {
        if (itemValidation.mandatory) {
            if (!answers[itemValidation.id]) throw new Error('Mandatory item is missing: ' + itemValidation.text);
            for (const answer of answers[itemValidation.id]) {
                if (answer.text === '') throw new Error('Mandatory item is missing: ' + itemValidation.text);
            }
        }
        // Min validation
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
        // Max validation
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

/**
 * Retrieves the visible fields for application answers based on the user's roles and permissions.
 *
 * @param user - The user for whom the visible fields are being determined.
 * @param applicationAnswers - The detailed application answers for which the visible fields are being determined.
 * @param ignoreFilters - A boolean indicating whether to ignore role-based filters and grant full access.
 * @returns A promise that resolves to an array of objects representing the visible fields for each application answer.
 */
const getVisibleFields = async (
    user: User,
    applicationAnswers: Awaited<ReturnType<typeof getDetailedApplicationAnswers>>,
    ignoreFilters: boolean
) => {
    const applicationAnswersRoles = await getApplicationAnswerUserRoles(user, applicationAnswers);

    const mapVisibleFields = (roles: (typeof applicationAnswersRoles)[0] | undefined) => {
        const fullAccess = roles
            ? roles.applicationApplier ||
              roles.protocolCreator ||
              roles.protocolManager ||
              roles.protocolCoordinator ||
              roles.applicationCoordinator ||
              user.role === UserRole.ADMIN
            : ignoreFilters;
        const baseAccess = roles
            ? roles.answerer ||
              roles.applicationApplier ||
              roles.protocolCreator ||
              roles.protocolManager ||
              roles.protocolCoordinator ||
              roles.applicationCoordinator ||
              roles.protocolInstitutionMember ||
              roles.applicationInstitutionMember ||
              roles.viewer ||
              user.role === UserRole.ADMIN
            : ignoreFilters;

        const visibleFields = {
            select: {
                id: baseAccess,
                createdAt: baseAccess,
                updatedAt: baseAccess,
                date: baseAccess,
                approved: fullAccess,
                user: { select: { id: baseAccess, username: baseAccess, institution: { select: { id: baseAccess, name: baseAccess } } } },
                coordinate: { select: { latitude: baseAccess, longitude: baseAccess } },
                itemAnswerGroups: {
                    select: {
                        id: baseAccess,
                        itemAnswers: { select: { id: baseAccess, text: baseAccess, itemId: baseAccess } },
                        optionAnswers: { select: { id: baseAccess, text: baseAccess, itemId: baseAccess, optionId: baseAccess } },
                        tableAnswers: { select: { id: baseAccess, text: baseAccess, itemId: baseAccess, columnId: baseAccess } },
                    },
                },
            },
        };

        return visibleFields;
    };

    const visibleFields = ignoreFilters ? [mapVisibleFields(undefined)] : applicationAnswersRoles.map(mapVisibleFields);

    return visibleFields;
};

/**
 * Creates a new application answer in the database.
 *
 * This function handles the creation of a new application answer, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the application answer data in the body and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
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
        const createCoordinateSchema = yup.object().shape({ latitude: yup.number(), longitude: yup.number() }).noUnknown();
        const createApplicationAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                date: yup.date().required(),
                applicationId: yup.number().required(),
                coordinate: createCoordinateSchema,
                itemAnswerGroups: yup.array().of(createItemAnswerGroupSchema).min(1).required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const applicationAnswerData = await createApplicationAnswerSchema.validate(req.body, { stripUnknown: false });
        // Multer files
        const files = req.files as Express.Multer.File[];
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is allowed to answer this application
        await checkAuthorization(requester, [], [applicationAnswerData.applicationId], 'create');
        // Validate answers
        await validateAnswers(applicationAnswerData.itemAnswerGroups, applicationAnswerData.applicationId);
        // Prisma database transactions
        // Get detailed application answer to perform internal operations
        const detailedStoredApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            const createdApplicationAnswer: ApplicationAnswer = await prisma.applicationAnswer.create({
                data: {
                    date: applicationAnswerData.date,
                    user: { connect: { id: requester.id } },
                    application: { connect: { id: applicationAnswerData.applicationId } },
                    coordinate:
                        applicationAnswerData.coordinate.latitude !== undefined && applicationAnswerData.coordinate.longitude !== undefined
                            ? {
                                  connectOrCreate: {
                                      where: {
                                          latitude_longitude: {
                                              latitude: applicationAnswerData.coordinate.latitude,
                                              longitude: applicationAnswerData.coordinate.longitude,
                                          },
                                      },
                                      create: {
                                          latitude: applicationAnswerData.coordinate.latitude,
                                          longitude: applicationAnswerData.coordinate.longitude,
                                      },
                                  },
                              }
                            : undefined,
                    approved: false,
                },
            });
            for (const [itemAnswerGroupIndex, itemAnswerGroup] of applicationAnswerData.itemAnswerGroups.entries()) {
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
            return await prisma.applicationAnswer.findUniqueOrThrow({
                where: { id: createdApplicationAnswer.id },
                include: detailedApplicationAnswerFields(),
            });
        });

        // Get application answer only with visible fields and embed actions
        const visibleApplicationAnswer = {
            ...(await prismaClient.applicationAnswer.findUnique({
                where: { id: detailedStoredApplicationAnswer.id },
                ...(await getVisibleFields(requester, [detailedStoredApplicationAnswer], false))[0],
            })),
            actions: (await getApplicationAnswerActions(requester, [detailedStoredApplicationAnswer]))[0],
        };

        res.status(201).json({ message: 'Application answer created.', data: visibleApplicationAnswer });
    } catch (error: any) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) if (existsSync(file.path)) unlinkSync(file.path);
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Updates an existing application answer in the database.
 *
 * This function handles the update of a existing application answer, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the application answer data in the body, the user object from Passport-JWT and the address ID in the params.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
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
        const updateCoordinateSchema = yup
            .object()
            .shape({ latitude: yup.number().required(), longitude: yup.number().required() })
            .noUnknown();
        const updateApplicationAnswerSchema = yup
            .object()
            .shape({
                date: yup.date(),
                coordinate: updateCoordinateSchema,
                itemAnswerGroups: yup.array().of(updateItemAnswerGroupSchema).min(1).required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const applicationAnswer = await updateApplicationAnswerSchema.validate(req.body, { stripUnknown: false });
        // Multer files
        const files = req.files as Express.Multer.File[];
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is allowed to update this application answer
        await checkAuthorization(requester, [applicationAnswerId], [], 'update');
        // Validate answers
        await validateAnswers(applicationAnswer.itemAnswerGroups, applicationAnswerId);
        // Prisma database transactions
        // Get detailed application answer to perform internal operations
        const detailedStoredApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            // Update application answer
            await prisma.applicationAnswer.update({
                where: { id: applicationAnswerId },
                data: {
                    date: applicationAnswer.date,
                    coordinate:
                        applicationAnswer.coordinate.latitude !== undefined && applicationAnswer.coordinate.longitude !== undefined
                            ? {
                                  connectOrCreate: {
                                      where: {
                                          latitude_longitude: {
                                              latitude: applicationAnswer.coordinate.latitude,
                                              longitude: applicationAnswer.coordinate.longitude,
                                          },
                                      },
                                      create: {
                                          latitude: applicationAnswer.coordinate.latitude,
                                          longitude: applicationAnswer.coordinate.longitude,
                                      },
                                  },
                              }
                            : { disconnect: true },
                },
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
            return await prisma.applicationAnswer.findUniqueOrThrow({
                where: { id: applicationAnswerId },
                include: detailedApplicationAnswerFields(),
            });
        });

        // Get application answer only with visible fields and with embed actions
        const visibleApplicationAnswer = {
            ...(await prismaClient.applicationAnswer.findUnique({
                where: { id: detailedStoredApplicationAnswer.id },
                ...(await getVisibleFields(requester, [detailedStoredApplicationAnswer], false))[0],
            })),
            actions: (await getApplicationAnswerActions(requester, [detailedStoredApplicationAnswer]))[0],
        };

        res.status(200).json({ message: 'Application answer updated.', data: visibleApplicationAnswer });
    } catch (error: any) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) if (existsSync(file.path)) unlinkSync(file.path);
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all aplication answers from the database.
 *
 * This function handles the retrieval of all aplication answers in the database, validating the user
 * performing the action to then retrieve all aplication answers using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getAllApplicationAnswers = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is allowed to get all application answers
        await checkAuthorization(requester, [], [], 'getAll');
        // Prisma database transactions
        // Get detailed application answers to perform internal operations
        const detailedApplicationAnswers = await prismaClient.applicationAnswer.findMany({ include: detailedApplicationAnswerFields() });
        // Get unfiltered application answers from the database
        const unfilteredApplicationAnswers = await prismaClient.applicationAnswer.findMany({
            where: { id: { in: detailedApplicationAnswers.map(({ id }) => id) } },
            ...(await getVisibleFields(requester, [], true))[0],
        });
        // Get application answers only with visible fields and with embed actions
        const actions = await getApplicationAnswerActions(requester, detailedApplicationAnswers);
        const filteredFields = await getVisibleFields(requester, detailedApplicationAnswers, false);
        const visibleApplicationAnswers = unfilteredApplicationAnswers.map((applicationAnswer, i) => ({
            ...fieldsFilter(applicationAnswer, filteredFields[i]),
            actions: actions[i],
        }));

        res.status(200).json({ message: 'All application answers found.', data: visibleApplicationAnswers });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all application answers associated with the user from the database.
 *
 * This function handles the retrieval of all application answers associated with the user in the database,
 * validating the user performing the action to then retrieve all application answers using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getMyApplicationAnswers = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to get their application answers
        await checkAuthorization(user, [], [], 'getMy');
        // Prisma operation
        const detailedApplicationAnswers = await prismaClient.applicationAnswer.findMany({
            where: { userId: user.id },
            include: detailedApplicationAnswerFields(),
        });
        // Get application answers only with visible fields and with embedded actions
        // Get application answers only with visible fields and with embedded actions
        const actions = await getApplicationAnswerActions(user, detailedApplicationAnswers);
        const filteredFields = await getVisibleFields(user, detailedApplicationAnswers, false);
        const unfilteredFields = (await getVisibleFields(user, [], true))[0];
        const unfilteredApplicationAnswers = await prismaClient.applicationAnswer.findMany({
            where: { id: { in: detailedApplicationAnswers.map(({ id }) => id) } },
            ...unfilteredFields,
        });
        const visibleApplicationAnswers = unfilteredApplicationAnswers.map((applicationAnswer, i) => ({
            ...fieldsFilter(applicationAnswer, filteredFields[i]),
            actions: actions[i],
        }));

        res.status(200).json({ message: 'My application answers found.', data: visibleApplicationAnswers });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets an application answer from the database by ID.
 *
 * This function handles the retrieval of an application answer in the database by ID, validating the user
 * performing the action to then retrieve the application answer using Prisma.
 *
 * @param req - The request object, containing the application answer ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationAnswerId: number = parseInt(req.params.applicationAnswerId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to view this application answer
        await checkAuthorization(user, [applicationAnswerId], [], 'get');
        // Prisma operation
        const detailedApplicationAnswer = await prismaClient.applicationAnswer.findUniqueOrThrow({
            where: { id: applicationAnswerId },
            include: detailedApplicationAnswerFields(),
        });
        // Get application answer only with visible fields and with embedded actions
        const visibleApplicationAnswer = {
            ...(await prismaClient.applicationAnswer.findUnique({
                where: { id: detailedApplicationAnswer.id },
                ...(await getVisibleFields(user, [detailedApplicationAnswer], false))[0],
            })),
            actions: (await getApplicationAnswerActions(user, [detailedApplicationAnswer]))[0],
        };

        res.status(200).json({ message: 'Application answer found.', data: visibleApplicationAnswer });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Updates an existing application answer in the database to be approved.
 *
 * This function handles the update of a existing application answer approval status to approved,
 * validating the body of the request and the user performing the action to then persist the object
 * in the database using Prisma.
 *
 * @param req - The request object, containing the application answer data in the body, the user object from Passport-JWT and the address ID in the params.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const approveApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationAnswerId: number = parseInt(req.params.applicationAnswerId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to approve this application answer
        await checkAuthorization(user, [applicationAnswerId], [], 'approve');
        // Prisma operation
        const detailedApprovedApplicationAnswer = await prismaClient.applicationAnswer.update({
            where: { id: applicationAnswerId },
            data: { approved: true },
            include: detailedApplicationAnswerFields(),
        });
        // Get application answer only with visible fields and with embedded actions
        const visibleApplicationAnswer = {
            ...(await prismaClient.applicationAnswer.findUnique({
                where: { id: detailedApprovedApplicationAnswer.id },
                ...(await getVisibleFields(user, [detailedApprovedApplicationAnswer], false))[0],
            })),
            actions: (await getApplicationAnswerActions(user, [detailedApprovedApplicationAnswer]))[0],
        };

        res.status(200).json({ message: 'Application answer approved.', data: visibleApplicationAnswer });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Deletes an application answer from the database by ID.
 *
 * This function handles the deletion of an application answer in the database by ID, validating the user
 * performing the action to then delete the application answer using Prisma.
 *
 * @param req - The request object, containing the application answer ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const deleteApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const applicationAnswerId: number = parseInt(req.params.applicationAnswerId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to delete this application answer
        await checkAuthorization(user, [applicationAnswerId], [], 'delete');
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
