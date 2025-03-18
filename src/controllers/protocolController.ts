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
import { ItemType, ItemGroupType, PageType, ItemValidationType, User, UserRole, VisibilityMode, DependencyType } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';
import { unlinkSync, existsSync } from 'fs';
import { detailedApplicationFields, getApplicationsUserActions, getApplicationsVisibleFields } from './applicationController';
import fieldsFilter from '../services/fieldsFilter';

/**
 * Retrieves the visible fields for protocols based on the user's roles and permissions.
 *
 * @param user - The user for whom the visible fields are being determined.
 * @param protocols - The detailed protocols for which the visible fields are being determined.
 * @param includeAnswers - A boolean indicating whether to include protocol answers in the visible fields.
 * @param ignoreFilters - A boolean indicating whether to ignore role-based filters and grant full access.
 * @returns A promise that resolves to an array of objects representing the visible fields for each protocol.
 */
export const getVisibleFields = async (
    user: User,
    protocols: Awaited<ReturnType<typeof getDetailedProtocols>>,
    includeAnswers: boolean,
    ignoreFilters: boolean
) => {
    const protocolsRoles = await getProtocolsUserRoles(user, protocols);

    const mapVisibleFields = (roles: (typeof protocolsRoles)[0] | undefined) => {
        const fullAccess = roles ? roles.coordinator || roles.creator || roles.manager || user.role === UserRole.ADMIN : ignoreFilters;
        const applierAccess = roles
            ? roles.applier || roles.coordinator || roles.creator || roles.manager || user.role === UserRole.ADMIN
            : ignoreFilters;
        const baseAccess = roles
            ? roles.answersViewer ||
              roles.applier ||
              roles.coordinator ||
              roles.creator ||
              roles.manager ||
              roles.viewer ||
              user.role === UserRole.ADMIN
            : ignoreFilters;
        const answerAccess = roles
            ? roles.answersViewer || roles.applier || roles.coordinator || roles.creator || roles.manager || user.role === UserRole.ADMIN
            : ignoreFilters;

        const visibleFields = {
            select: {
                id: baseAccess,
                createdAt: baseAccess,
                updatedAt: baseAccess,
                title: baseAccess,
                description: baseAccess,
                enabled: fullAccess,
                replicable: applierAccess,
                creator: {
                    select: {
                        id: baseAccess,
                        username: baseAccess,
                        institution: { select: { id: baseAccess, name: baseAccess } },
                    },
                },
                applicability: fullAccess,
                visibility: applierAccess,
                answersVisibility: applierAccess,
                appliers: {
                    select: {
                        id: fullAccess,
                        username: fullAccess,
                        institution: { select: { id: fullAccess, name: fullAccess } },
                    },
                },
                viewersUser: {
                    select: {
                        id: applierAccess,
                        username: applierAccess,
                        institution: { select: { id: applierAccess, name: applierAccess } },
                    },
                },
                viewersClassroom: {
                    select: {
                        id: applierAccess,
                        name: applierAccess,
                        users: {
                            select: {
                                id: applierAccess,
                                username: applierAccess,
                                institution: { select: { id: applierAccess, name: applierAccess } },
                            },
                        },
                    },
                },
                answersViewersUser: {
                    select: {
                        id: applierAccess,
                        username: applierAccess,
                        institution: { select: { id: fullAccess, name: applierAccess } },
                    },
                },
                answersViewersClassroom: {
                    select: {
                        id: applierAccess,
                        name: applierAccess,
                        users: {
                            select: {
                                id: applierAccess,
                                username: applierAccess,
                                institution: { select: { id: fullAccess, name: applierAccess } },
                            },
                        },
                    },
                },
                managers: {
                    select: {
                        id: fullAccess,
                        username: fullAccess,
                        institution: { select: { id: fullAccess, name: fullAccess } },
                    },
                },
                applications: {
                    select: { id: true },
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
                                                    ...(!fullAccess
                                                        ? [
                                                              {
                                                                  where: {
                                                                      group: {
                                                                          applicationAnswer: { application: { enabled: true } },
                                                                      },
                                                                  },
                                                              },
                                                          ]
                                                        : []),
                                                    select: {
                                                        id: answerAccess,
                                                        text: answerAccess,
                                                        group: {
                                                            select: {
                                                                id: answerAccess,
                                                                applicationAnswer: {
                                                                    select: {
                                                                        id: answerAccess,
                                                                        userId: answerAccess,
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
                                            ...(!fullAccess
                                                ? [
                                                      {
                                                          where: {
                                                              group: {
                                                                  applicationAnswer: { application: { enabled: true } },
                                                              },
                                                          },
                                                      },
                                                  ]
                                                : []),
                                            select: {
                                                id: answerAccess,
                                                text: answerAccess,
                                                files: {
                                                    select: {
                                                        id: answerAccess,
                                                        path: answerAccess,
                                                        description: answerAccess,
                                                    },
                                                },
                                                group: {
                                                    select: {
                                                        id: answerAccess,
                                                        applicationAnswer: {
                                                            select: {
                                                                id: answerAccess,
                                                                userId: answerAccess,
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        tableAnswers: {
                                            select: {
                                                id: answerAccess,
                                                text: answerAccess,
                                                columnId: answerAccess,
                                                group: {
                                                    select: {
                                                        id: answerAccess,
                                                        applicationAnswer: {
                                                            select: {
                                                                id: answerAccess,
                                                                userId: answerAccess,
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
        };

        return visibleFields;
    };

    const visibleFields = ignoreFilters ? [mapVisibleFields(undefined)] : protocolsRoles.map(mapVisibleFields);

    return visibleFields;
};

/**
 * Retrieve the detailed protocols fields required for internal endpoint validations.
 *
 * This function handles the creation of a custom select filter that serves as a parameter for Prisma Client to return an
 * protocol with all the fields required for internal endpoint validations.
 *
 * @returns A Prisma select filter object
 */
const detailedProtocolFields = () => ({
    creator: { select: { id: true, institution: { select: { id: true } } } },
    managers: { select: { id: true, institution: { select: { id: true } } } },
    appliers: { select: { id: true, institution: { select: { id: true } } } },
    viewersUser: { select: { id: true, institution: { select: { id: true } } } },
    viewersClassroom: { select: { id: true, users: { select: { id: true, institution: { select: { id: true } } } } } },
    answersViewersUser: { select: { id: true, institution: { select: { id: true } } } },
    answersViewersClassroom: { select: { users: { select: { id: true, institution: { select: { id: true } } } } } },
    applications: {
        include: detailedApplicationFields(),
    },
});

/**
 * Gets a set of detailed protocols from a set of IDs
 *
 * This function handles the retrieval of a set of detailed protocols, with all the fields required for internal
 * endpoint validations, from a set of protocols IDs using Prisma.
 *
 * @param protocolsIds An array of protocols IDs
 * @returns A set of detailed protocols
 */
export const getDetailedProtocols = async (protocolsIds: number[]) =>
    await prismaClient.protocol.findMany({ where: { id: { in: protocolsIds } }, include: detailedProtocolFields() });

/**
 * Retrieves a user's roles against a given set of protocols.
 *
 * @param user - The user whose roles are being determined.
 * @param protocols - The detailed protocols for which the roles are being determined.
 * @returns A promise that resolves to an array of objects representing the roles of the user for each protocol.
 *
 * Each role object contains the following properties:
 * - `answersViewer`: Whether the user can view the answers of the protocol.
 * - `applier`: Whether the user can create an application for the protocol.
 * - `coordinator`: Whether the user is the coordinator of the protocol creator's institution.
 * - `creator`: Whether the user is the creator of the protocol.
 * - `instituionMember`: Whether the user is a member of the protocol creator's institution.
 * - `manager`: Whether the user is a manager of the protocol.
 * - `viewer`: Whether the user can view the protocol.
 */
export const getProtocolsUserRoles = async (user: User, protocols: Awaited<ReturnType<typeof getDetailedProtocols>>) => {
    const protocolsRoles = protocols.map((protocol) => {
        const coordinator =
            user.institutionId &&
            user.role === UserRole.COORDINATOR &&
            protocol.creator.institution &&
            protocol.creator.institution?.id === user.institutionId;
        const instituionMember = user.institutionId && user.institutionId === protocol.creator.institution?.id;
        const creator = protocol.creator.id === user.id;
        const manager = protocol.managers.some(({ id }) => id === user.id);
        const applier = protocol.appliers.some(({ id }) => id === user.id);
        const viewer =
            protocol.visibility === VisibilityMode.PUBLIC ||
            (protocol.visibility === VisibilityMode.AUTHENTICATED && user.role !== UserRole.GUEST) ||
            protocol.viewersUser.some(({ id }) => id === user.id) ||
            protocol.viewersClassroom.some(({ users }) => users.some(({ id }) => id === user.id));
        const answersViewer = !!(
            protocol.answersVisibility === VisibilityMode.PUBLIC ||
            (protocol.answersVisibility === VisibilityMode.AUTHENTICATED && user.role !== UserRole.GUEST) ||
            protocol.answersViewersUser.some(({ id }) => id === user.id) ||
            protocol.answersViewersClassroom.some(({ users }) => users.some(({ id }) => id === user.id))
        );
        return { answersViewer, applier, coordinator, creator, instituionMember, manager, viewer };
    });

    return protocolsRoles;
};

/**
 * Retrieves the actions that a user can perform on a set of protocols.
 *
 * @param user - The user whose actions are being determined.
 * @param protocols - The detailed protocols for which the actions are being determined.
 * @returns A promise that resolves to an array of objects representing the actions that the user can perform on each protocol.
 *
 * The returned action object contains the following properties:
 * - `toApply`: Indicates if the user can create an application for the protocol.
 * - `toDelete`: Indicates if the user can delete the protocol.
 * - `toGet`: Indicates if the user can retrieve the protocol.
 * - `toGetWAnswers`: Indicates if the user can retrieve the protocol with answers.
 * - `toUpdate`: Indicates if the user can update the protocol.
 */
export const getProtocolsUserActions = async (user: User, protocols: Awaited<ReturnType<typeof getDetailedProtocols>>) => {
    const protocolsRoles = await getProtocolsUserRoles(user, protocols);

    const protocolsActions = protocols.map((protocol, i) => {
        const roles = protocolsRoles[i];
        // Anyone except users, appliers and guests can create protocols
        const toCreate = user.role === UserRole.ADMIN || user.role === UserRole.PUBLISHER || user.role === UserRole.COORDINATOR;
        // Only managers/creator/institution coordinator can perform delete operations on protocols
        const toUpdate = roles.manager || roles.coordinator || roles.creator || user.role === UserRole.ADMIN;
        // Only managers/creator/institution coordinator can perform delete operations on protocols if there are no applications
        const toDelete =
            ((roles.manager || roles.coordinator || roles.creator) && protocol.applications.length === 0) || user.role === UserRole.ADMIN;
        // Only viewers/creator/managers/appliers/institution coordinator can perform get operations on protocols
        const toGet = roles.viewer || roles.coordinator || roles.creator || roles.manager || roles.applier || user.role === UserRole.ADMIN;
        // No one can perform getAll operations on protocols
        const toGetAll = user.role === UserRole.ADMIN;
        // Anyone can perform getVisible and getMy operations on protocols (since the content is filtered according to the user)
        const toGetVisible = true;
        const toGetMy = true;
        // Only answers viewers/creator/managers/institution coordinator can perform getWAnswers operations on protocols
        const toGetWAnswers = roles.answersViewer || roles.coordinator || roles.creator || roles.manager || user.role === UserRole.ADMIN;
        // Only appliers/managers/creator/institution coordinator can apply to protocols
        const toApply = roles.applier || roles.manager || roles.coordinator || roles.creator || user.role === UserRole.ADMIN;

        return { toApply, toDelete, toGet, toGetWAnswers, toUpdate };
    });

    return protocolsActions;
};

/**
 * Checks if the user is authorized to perform a specific action on a set of protocols.
 *
 * @param requester - The user object containing requester user details.
 * @param protocolIds - An array of protocol IDs on which the user wants to perform the action.
 * @param action - The action the user wants to perform (e.g., 'create', 'update', 'delete', 'get', 'getWAnswers').
 *
 * @throws Will throw an error if the user is not authorized to perform the action.
 * @returns A promise that resolves if the user is authorized to perform the action.
 */
const checkAuthorization = async (requester: User, protocolIds: number[], action: string) => {
    // Admins can perform any action
    if (requester.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create': {
            // Anyone except users, appliers and guests can create protocols
            if (requester.role === UserRole.USER || requester.role === UserRole.APPLIER || requester.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'update': {
            if ((await getProtocolsUserActions(requester, await getDetailedProtocols(protocolIds))).some(({ toUpdate }) => !toUpdate))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'delete': {
            if ((await getProtocolsUserActions(requester, await getDetailedProtocols(protocolIds))).some(({ toDelete }) => !toDelete))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getAll': {
            // No one can perform getAll operations on protocols
            throw new Error('This user is not authorized to perform this action');
        }
        case 'getVisible':
        case 'getMy': {
            // Anyone can perform getVisible and getMy operations on protocols (since the content is filtered according to the user)
            break;
        }
        case 'get': {
            if ((await getProtocolsUserActions(requester, await getDetailedProtocols(protocolIds))).some(({ toGet }) => !toGet))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getWAnswers': {
            if (
                (await getProtocolsUserActions(requester, await getDetailedProtocols(protocolIds))).some(
                    ({ toGetWAnswers }) => !toGetWAnswers
                )
            )
                throw new Error('This user is not authorized to perform this action');
            break;
        }
    }
};

/**
 * Validates an item based on its type and options length.
 *
 * @param type - The item type.
 * @param itemOptionsLength - The length of the item options.
 * @throws Will throw an error if the item is invalid.
 *
 * The function performs the following validations:
 * - For checkbox, radio and select items, the options length must be at least 2.
 * - For other item types, the options length must be 0.
 *
 * @returns A promise that resolves if the item is valid.
 */
const validateItem = async (type: ItemType, itemOptionsLength: number) => {
    if (type === ItemType.CHECKBOX || type === ItemType.RADIO || type === ItemType.SELECT) {
        if (itemOptionsLength < 2) throw new Error('Not enough options.');
    } else if (itemOptionsLength !== 0) throw new Error('Options not allowed.');
};

/**
 * Validates an item group based on its type and items length.
 *
 * @param type - The item group type.
 * @param itemsLength - The length of the items.
 * @param tableColumnsLength - The length of the table columns.
 * @throws Will throw an error if the item group is invalid.
 *
 * The function performs the following validations:
 * - For checkbox table, radio table and textbox table item groups, the table columns length must be at least 1.
 * - For one-dimensional item groups, the table columns length must be 0.
 * - Items length must be at least 1 for all item group types.
 *
 * @returns A promise that resolves if the item group is valid.
 */
const validateItemGroup = async (type: ItemGroupType, itemsLength: number, tableColumnsLength: number) => {
    if (
        itemsLength === 0 ||
        ((type === ItemGroupType.CHECKBOX_TABLE || type === ItemGroupType.RADIO_TABLE || type === ItemGroupType.TEXTBOX_TABLE) &&
            tableColumnsLength === 0) ||
        (type === ItemGroupType.ONE_DIMENSIONAL && tableColumnsLength > 0)
    )
        throw new Error('ItemGroup type does not match the amount of items or tableColumns.');
};

/**
 * Validates the protocol page dependencies and item group dependencies.
 *
 * @param protocol - The protocol object to which the dependencies belong.
 *
 * @throws Will throw an error if the dependencies are invalid.
 *
 * The function performs the following validations:
 * - The dependency item must reference a previous item.
 * - The dependency type must match the item type.
 * - The min argument must be a valid integer.
 * - The max argument must be a valid integer.
 * - The min argument must be less than the max argument.
 *
 * @returns A promise that resolves if the dependencies are valid.
 */
const validateDependencies = async (protocol: any) => {
    const previousItemsTempIds = new Map<number, ItemType>();
    for (const page of protocol.pages) {
        for (const dependency of page.dependencies) {
            const itemType = previousItemsTempIds.get(dependency.itemTempId);
            if (!itemType) throw new Error('Invalid dependency item: must reference a previous item.');
            switch (dependency.type) {
                case DependencyType.EXACT_ANSWER:
                    if (itemType !== ItemType.TEXTBOX && itemType !== ItemType.NUMBERBOX && itemType !== ItemType.RANGE)
                        throw new Error('Exact answer dependencies can only be used with textbox, numberbox and range items.');
                    break;
                case DependencyType.MIN:
                    if (dependency.argument.includes('.') || isNaN(parseFloat(dependency.argument)))
                        throw new Error('Min argument must be a valid integer.');
                    if (
                        page.dependencies.find(
                            (d: any) =>
                                d.type === DependencyType.MAX && d.argument <= dependency.argument && d.itemTempId === dependency.itemTempId
                        )
                    )
                        throw new Error('Min argument must be less than max argument.');
                    if (
                        itemType !== ItemType.CHECKBOX &&
                        itemType !== ItemType.NUMBERBOX &&
                        itemType !== ItemType.RANGE &&
                        itemType !== ItemType.TEXTBOX
                    )
                        throw new Error('Min dependencies can only be used with checkbox, numberbox, range and textbox items.');
                    break;
                case DependencyType.MAX:
                    if (dependency.argument.includes('.') || isNaN(parseFloat(dependency.argument)))
                        throw new Error('Max argument must be a valid integer.');
                    if (
                        page.dependencies.find(
                            (d: any) =>
                                d.type === DependencyType.MIN && d.argument >= dependency.argument && d.itemTempId === dependency.itemTempId
                        )
                    )
                        throw new Error('Max argument must be greater than min argument.');
                    if (
                        itemType !== ItemType.CHECKBOX &&
                        itemType !== ItemType.NUMBERBOX &&
                        itemType !== ItemType.RANGE &&
                        itemType !== ItemType.TEXTBOX
                    )
                        throw new Error('Max dependencies can only be used with checkbox, numberbox, range and textbox items.');
                    break;
                case DependencyType.OPTION_SELECTED:
                    if (itemType !== ItemType.RADIO && itemType !== ItemType.SELECT && itemType !== ItemType.CHECKBOX)
                        throw new Error('Option selected dependencies can only be used with radio, select and checkbox items.');
                    break;
            }
        }
        for (const itemGroup of page.itemGroups) {
            for (const dependency of itemGroup.dependencies) {
                const itemType = previousItemsTempIds.get(dependency.itemTempId);
                if (!itemType) throw new Error('Invalid dependency item: must reference a previous item.');
                switch (dependency.type) {
                    case DependencyType.EXACT_ANSWER:
                        if (itemType !== ItemType.TEXTBOX && itemType !== ItemType.NUMBERBOX && itemType !== ItemType.RANGE)
                            throw new Error('Exact answer dependencies can only be used with textbox, numberbox and range items.');
                        break;
                    case DependencyType.MIN:
                        if (dependency.argument.includes('.') || isNaN(parseFloat(dependency.argument)))
                            throw new Error('Min argument must be a valid integer.');
                        if (
                            page.dependencies.find(
                                (d: any) =>
                                    d.type === DependencyType.MAX &&
                                    d.argument <= dependency.argument &&
                                    d.itemTempId === dependency.itemTempId
                            )
                        )
                            throw new Error('Min argument must be less than max argument.');
                        if (
                            itemType !== ItemType.CHECKBOX &&
                            itemType !== ItemType.NUMBERBOX &&
                            itemType !== ItemType.RANGE &&
                            itemType !== ItemType.TEXTBOX
                        )
                            throw new Error('Min dependencies can only be used with checkbox, numberbox, range and textbox items.');
                        break;
                    case DependencyType.MAX:
                        if (dependency.argument.includes('.') || isNaN(parseFloat(dependency.argument)))
                            throw new Error('Max argument must be a valid integer.');
                        if (
                            page.dependencies.find(
                                (d: any) =>
                                    d.type === DependencyType.MIN &&
                                    d.argument >= dependency.argument &&
                                    d.itemTempId === dependency.itemTempId
                            )
                        )
                            throw new Error('Max argument must be greater than min argument.');
                        if (
                            itemType !== ItemType.CHECKBOX &&
                            itemType !== ItemType.NUMBERBOX &&
                            itemType !== ItemType.RANGE &&
                            itemType !== ItemType.TEXTBOX
                        )
                            throw new Error('Max dependencies can only be used with checkbox, numberbox, range and textbox items.');
                        break;
                    case DependencyType.OPTION_SELECTED:
                        if (itemType !== ItemType.RADIO && itemType !== ItemType.SELECT && itemType !== ItemType.CHECKBOX)
                            throw new Error('Option selected dependencies can only be used with radio, select and checkbox items.');
                        break;
                }
            }
            for (const item of itemGroup.items) {
                previousItemsTempIds.set(item.tempId, item.type);
            }
        }
    }
};

/**
 * Validates the item validations.
 *
 * @param itemType - The item type.
 * @param validations - An array of item validations to be validated.
 * @throws Will throw an error if the item validations are invalid.
 *
 * The function performs the following validations:
 * - Min, max and step arguments must be valid integers.
 * - Mandatory argument must be a valid boolean.
 * - Min argument must be less than max argument.
 * - Step argument must be less than the difference between min and max arguments and divide it.
 * - Range items must have min, max and step.
 * - Step validation only allowed for range items.
 * - Min and max validations only allowed for numberbox, textbox, range and checkbox items.
 *
 * @returns A promise that resolves if the item validations are valid.
 */
const validateItemValidations = async (itemType: ItemType, validations: any[]) => {
    const minValidation = validations.find((v) => v.type === ItemValidationType.MIN);
    const maxValidation = validations.find((v) => v.type === ItemValidationType.MAX);
    const stepValidation = validations.find((v) => v.type === ItemValidationType.STEP);
    const mandatoryValidation = validations.find((v) => v.type === ItemValidationType.MANDATORY);

    if (minValidation && (minValidation.argument.includes('.') || isNaN(parseFloat(minValidation.argument))))
        throw new Error('Min argument must be a valid integer.');
    if (maxValidation && (maxValidation.argument.includes('.') || isNaN(parseFloat(maxValidation.argument))))
        throw new Error('Max argument must be a valid integer.');
    if (stepValidation && (stepValidation.argument.includes('.') || isNaN(parseFloat(stepValidation.argument))))
        throw new Error('Step argument must be a valid integer.');
    if (mandatoryValidation && mandatoryValidation.argument !== 'true' && mandatoryValidation.argument !== 'false')
        throw new Error('Mandatory argument must be a valid boolean.');
    if (minValidation && maxValidation && minValidation.argument >= maxValidation.argument)
        throw new Error('Min argument must be less than max argument.');
    if (
        minValidation &&
        maxValidation &&
        stepValidation &&
        maxValidation.argument - minValidation.argument <= stepValidation.argument &&
        (maxValidation.argument - minValidation.argument) % stepValidation.argument === 0
    )
        throw new Error('Step argument must be less than the difference between min and max arguments and divide it.');
    if (itemType === ItemType.RANGE && (!minValidation || !maxValidation || !stepValidation))
        throw new Error('Range items must have min, max and step.');
    if (stepValidation && itemType !== ItemType.RANGE) throw new Error('Step validation only allowed for range items.');
    if (
        (maxValidation || minValidation) &&
        itemType !== ItemType.NUMBERBOX &&
        itemType !== ItemType.RANGE &&
        itemType !== ItemType.CHECKBOX &&
        itemType !== ItemType.TEXTBOX
    )
        throw new Error('Min and max validations only allowed for numberbox, textbox, range and checkbox items.');
};

/**
 * Validates the protocol managers
 *
 * @param managers - An array of user IDs representing the managers of the protocol.
 * @param institutionId - The ID of the institution to which the protocol creator belongs.
 *
 * @throws Will throw an error if the managers are invalid.
 *
 * The function performs the following validations:
 * - Managers must be publishers or coordinators of the same institution of the protocol creator.
 *
 * @returns A promise that resolves if the managers are valid.
 */
const validateManagers = async (managers: number[], institutionId: number | null) => {
    const invalidManagers = await prismaClient.user.findMany({
        where: {
            id: { in: managers },
            role: { notIn: [UserRole.PUBLISHER, UserRole.COORDINATOR] },
            ...(institutionId && { institutionId: { not: institutionId } }),
        },
    });
    if (invalidManagers.length > 0) throw new Error('Managers must be publishers or coordinators of the same institution.');
};

/**
 * Validates the protocol viewers
 *
 * @param viewers - An array of user IDs representing the viewers of the protocol.
 * @throws Will throw an error if the viewers are invalid.
 *
 * The function performs the following validations:
 * - Viewers cannot be guests or admins.
 *
 * @returns A promise that resolves if the viewers are valid.
 */
const validadeViewers = async (viewers: number[]) => {
    const invalidViewers = await prismaClient.user.findMany({
        where: { id: { in: viewers }, role: { in: [UserRole.ADMIN, UserRole.GUEST] } },
    });
    if (invalidViewers.length > 0) throw new Error('You cannot add guests or admins as viewers.');
};

/**
 * Validates the protocol appliers
 *
 * @param appliers - An array of user IDs representing the appliers of the protocol.
 * @throws Will throw an error if the appliers are invalid.
 *
 * The function performs the following validations:
 * - Appliers must be publishers, coordinators or appliers.
 *
 * @returns A promise that resolves if the appliers are valid.
 */
const validateAppliers = async (appliers: number[]) => {
    const invalidAppliers = await prismaClient.user.findMany({
        where: { id: { in: appliers }, role: { notIn: [UserRole.APPLIER, UserRole.PUBLISHER, UserRole.COORDINATOR] } },
    });
    if (invalidAppliers.length > 0) throw new Error('Appliers must be publishers, coordinators or appliers.');
};

/**
 * Validates the placements of the protocol pages, item groups, items, item options and table columns.
 *
 * @param protocol - The protocol object to which the placements belong.
 * @throws Will throw an error if the placements are invalid
 *
 * The function performs the following validations:
 * - Placement values must be unique, consecutive and start from 1.
 *
 * @returns A promise that resolves if the placements are valid.
 */
const validateProtocolPlacements = async (protocol: any) => {
    const pagesPlacements = [];
    for (const page of protocol.pages) {
        pagesPlacements.push(page.placement);
        const itemGroupsPlacements = [];
        for (const itemGroup of page.itemGroups) {
            itemGroupsPlacements.push(itemGroup.placement);
            const itemsPlacements = [];
            for (const item of itemGroup.items) {
                itemsPlacements.push(item.placement);
                const itemOptionsPlacements = [];
                for (const itemOption of item.itemOptions) itemOptionsPlacements.push(itemOption.placement);
                await validatePlacements(itemOptionsPlacements);
            }
            await validatePlacements(itemsPlacements);
            const tableColumnsPlacements = [];
            for (const tableColumn of itemGroup.tableColumns) tableColumnsPlacements.push(tableColumn.placement);
            await validatePlacements(tableColumnsPlacements);
        }
        await validatePlacements(itemGroupsPlacements);
    }
    await validatePlacements(pagesPlacements);
};

const validatePlacements = async (placements: number[]) => {
    if (placements.length > 0) {
        const placementSet = new Set<number>(placements);
        placements.sort((a, b) => a - b);
        if (placementSet.size !== placements.length || placements[0] !== 1 || placements[placements.length - 1] !== placements.length)
            throw new Error('Invalid placement values: must be unique, consecutive and start from 1.');
    }
};

/**
 * Creates a new protocol in the database.
 *
 * This function handles the creation of a new protocol, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the protocol data in the body and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const createProtocol = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const fileSchema = yup
            .object()
            .shape({ description: yup.string().max(3000) })
            .noUnknown();

        const tableColumnSchema = yup
            .object()
            .shape({ text: yup.string().min(1).max(255).required(), placement: yup.number().min(1).required() })
            .noUnknown();

        const itemOptionsSchema = yup
            .object()
            .shape({
                text: yup.string().min(1).max(255).required(),
                placement: yup.number().min(1).required(),
                files: yup.array().of(fileSchema).default([]),
            })
            .noUnknown();

        const itemValidationsSchema = yup
            .object()
            .shape({
                type: yup.mixed<ItemValidationType>().oneOf(Object.values(ItemValidationType)).required(),
                argument: yup.string().required(),
                customMessage: yup.string(),
            })
            .noUnknown();

        const dependenciesSchema = yup
            .object()
            .shape({
                type: yup.mixed<DependencyType>().oneOf(Object.values(DependencyType)).required(),
                argument: yup.string().required(),
                customMessage: yup.string(),
                itemTempId: yup.number().min(1).required(),
            })
            .noUnknown();

        const itemsSchema = yup
            .object()
            .shape({
                tempId: yup.number().min(1).required(),
                text: yup.string().min(3).max(3000).required(),
                description: yup.string().max(3000),
                enabled: yup.boolean().required(),
                type: yup.mixed<ItemType>().oneOf(Object.values(ItemType)).required(),
                placement: yup.number().min(1).required(),
                files: yup.array().of(fileSchema).default([]),
                itemOptions: yup.array().of(itemOptionsSchema).default([]),
                itemValidations: yup.array().of(itemValidationsSchema).default([]),
            })
            .noUnknown();

        const itemGroupsSchema = yup
            .object()
            .shape({
                placement: yup.number().min(1).required(),
                isRepeatable: yup.boolean().required(),
                type: yup.mixed<ItemGroupType>().oneOf(Object.values(ItemGroupType)).required(),
                items: yup.array().of(itemsSchema).min(1).required(),
                dependencies: yup.array().of(dependenciesSchema).default([]),
                tableColumns: yup.array().of(tableColumnSchema).default([]),
            })
            .noUnknown();

        const pagesSchema = yup
            .object()
            .shape({
                placement: yup.number().min(1).required(),
                type: yup.mixed<PageType>().oneOf(Object.values(PageType)).required(),
                itemGroups: yup.array().of(itemGroupsSchema).default([]),
                dependencies: yup.array().of(dependenciesSchema).default([]),
            })
            .noUnknown();

        const createProtocolSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                title: yup.string().min(3).max(255).required(),
                description: yup.string().max(3000),
                enabled: yup.boolean().required(),
                pages: yup.array().of(pagesSchema).min(1).required(),
                managers: yup.array().of(yup.number()).default([]),
                visibility: yup.mixed<VisibilityMode>().oneOf(Object.values(VisibilityMode)).required(),
                applicability: yup.mixed<VisibilityMode>().oneOf(Object.values(VisibilityMode)).required(),
                answersVisibility: yup.mixed<VisibilityMode>().oneOf(Object.values(VisibilityMode)).required(),
                viewersUser: yup.array().of(yup.number()).default([]),
                viewersClassroom: yup.array().of(yup.number()).default([]),
                answersViewersUser: yup.array().of(yup.number()).default([]),
                answersViewersClassroom: yup.array().of(yup.number()).default([]),
                appliers: yup.array().of(yup.number()).default([]),
                replicable: yup.boolean().required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const protocolData = await createProtocolSchema.validate(req.body, { stripUnknown: true });
        // Sort elements by placement
        for (const page of protocolData.pages) {
            page.itemGroups.sort((a, b) => a.placement - b.placement);
            for (const itemGroup of page.itemGroups) {
                for (const item of itemGroup.items) {
                    item.itemOptions.sort((a, b) => a.placement - b.placement);
                }
                itemGroup.items.sort((a, b) => a.placement - b.placement);
                itemGroup.tableColumns.sort((a, b) => a.placement - b.placement);
            }
        }
        protocolData.pages.sort((a, b) => a.placement - b.placement);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is allowed to create a application
        await checkAuthorization(requester, [], 'create');
        // Check if managers are publishers, coordinators or admins of the same institution
        await validateManagers(protocolData.managers as number[], requester.institutionId);
        // Check if viewers are not guests or admins
        await validadeViewers(protocolData.viewersUser as number[]);
        await validadeViewers(protocolData.answersViewersUser as number[]);
        // Check if appliers are publishers, coordinators or appliers
        await validateAppliers(protocolData.appliers as number[]);
        // Check if protocol placements are valid
        await validateProtocolPlacements(protocolData);
        // Check if dependencies are valid
        await validateDependencies(protocolData);
        // Multer files
        const files = req.files as Express.Multer.File[];
        // Create map table for tempIds
        const tempIdMap = new Map<number, number>();
        // Prisma transaction
        const detailedStoredProtocol = await prismaClient.$transaction(async (prisma) => {
            const createdProtocol = await prisma.protocol.create({
                data: {
                    title: protocolData.title,
                    description: protocolData.description,
                    enabled: protocolData.enabled,
                    creatorId: requester.id,
                    managers: { connect: protocolData.managers.map((manager) => ({ id: manager })) },
                    visibility: protocolData.visibility as VisibilityMode,
                    applicability: protocolData.applicability as VisibilityMode,
                    answersVisibility: protocolData.answersVisibility as VisibilityMode,
                    viewersUser: { connect: protocolData.viewersUser.map((viewer) => ({ id: viewer })) },
                    viewersClassroom: { connect: protocolData.viewersClassroom.map((viewer) => ({ id: viewer })) },
                    answersViewersUser: { connect: protocolData.answersViewersUser.map((viewer) => ({ id: viewer })) },
                    answersViewersClassroom: { connect: protocolData.answersViewersClassroom.map((viewer) => ({ id: viewer })) },
                    appliers: { connect: protocolData.appliers.map((applier) => ({ id: applier })) },
                    replicable: protocolData.replicable,
                },
            });
            // Create nested pages as well as nested itemGroups, items, itemOptions and itemValidations
            for (const [pageId, page] of protocolData.pages.entries()) {
                const createdPage = await prisma.page.create({
                    data: { placement: page.placement, protocolId: createdProtocol.id, type: page.type },
                });
                for (const [itemGroupId, itemGroup] of page.itemGroups.entries()) {
                    await validateItemGroup(itemGroup.type, itemGroup.items.length, itemGroup.tableColumns.length);
                    const createdItemGroup = await prisma.itemGroup.create({
                        data: {
                            placement: itemGroup.placement,
                            isRepeatable: itemGroup.isRepeatable,
                            pageId: createdPage.id,
                            type: itemGroup.type,
                        },
                    });
                    for (const [tableColumnId, tableColumn] of itemGroup.tableColumns.entries()) {
                        const createdTableColumn = await prisma.tableColumn.create({
                            data: { text: tableColumn.text, placement: tableColumn.placement, groupId: createdItemGroup.id },
                        });
                    }
                    for (const [itemId, item] of itemGroup.items.entries()) {
                        // Check if item has the allowed amount of itemOptions and tableColumns
                        await validateItem(item.type, item.itemOptions.length);
                        // Check if itemValidations are valid
                        await validateItemValidations(item.type, item.itemValidations);
                        const itemFiles = item.files.map((file, fileIndex) => {
                            const storedFile = files.find(
                                (f) =>
                                    f.fieldname ===
                                    `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][files][${fileIndex}][content]`
                            );
                            if (!storedFile) throw new Error('File not found.');
                            else files.splice(files.indexOf(storedFile), 1);
                            return {
                                description: file.description,
                                path: storedFile.path,
                            };
                        });
                        const createdItem = await prisma.item.create({
                            data: {
                                text: item.text,
                                description: item.description,
                                enabled: item.enabled,
                                groupId: createdItemGroup.id,
                                type: item.type,
                                placement: item.placement,
                                files: { create: itemFiles },
                            },
                        });
                        tempIdMap.set(item.tempId, createdItem.id);
                        for (const [itemOptionId, itemOption] of item.itemOptions.entries()) {
                            const itemOptionFiles = itemOption.files.map((file, fileIndex) => {
                                const storedFile = files.find(
                                    (f) =>
                                        f.fieldname ===
                                        `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][itemOptions][${itemOptionId}][files][${fileIndex}][content]`
                                );
                                if (!storedFile) throw new Error('File not found.');
                                else files.splice(files.indexOf(storedFile), 1);
                                return {
                                    description: file.description,
                                    path: storedFile.path,
                                };
                            });

                            const createdItemOption = await prisma.itemOption.create({
                                data: {
                                    text: itemOption.text,
                                    placement: itemOption.placement,
                                    itemId: createdItem.id,
                                    files: { create: itemOptionFiles },
                                },
                            });
                        }
                        for (const [itemValidationId, itemValidation] of item.itemValidations.entries()) {
                            const createdItemValidation = await prisma.itemValidation.create({
                                data: {
                                    type: itemValidation.type,
                                    argument: itemValidation.argument,
                                    customMessage: itemValidation.customMessage,
                                    itemId: createdItem.id,
                                },
                            });
                        }
                    }
                    for (const [dependencyId, dependency] of itemGroup.dependencies.entries()) {
                        const createdDependency = await prisma.itemGroupDependencyRule.create({
                            data: {
                                type: dependency.type,
                                argument: dependency.argument,
                                customMessage: dependency.customMessage,
                                itemGroupId: createdItemGroup.id,
                                itemId: tempIdMap.get(dependency.itemTempId) as number,
                            },
                        });
                    }
                }
                for (const [dependencyId, dependency] of page.dependencies.entries()) {
                    const createdDependency = await prisma.pageDependencyRule.create({
                        data: {
                            type: dependency.type,
                            argument: dependency.argument,
                            customMessage: dependency.customMessage,
                            pageId: createdPage.id,
                            itemId: tempIdMap.get(dependency.itemTempId) as number,
                        },
                    });
                }
            }
            // Check if there are any files left
            if (files.length > 0) {
                throw new Error('Files not associated with any item or option detected.');
            }

            // Return the created protocol with nested content included
            return await prisma.protocol.findUniqueOrThrow({ where: { id: createdProtocol.id }, include: detailedProtocolFields() });
        });

        // Get protocol only with visible fields and with embedded actions
        const fieldsWUnfilteredApplications = (await getVisibleFields(requester, [detailedStoredProtocol], false, false))[0];
        fieldsWUnfilteredApplications.select.applications = (
            await getApplicationsVisibleFields(requester, [], false, false, false, true)
        )[0];
        const visibleProtocolWUnfilteredApplications = {
            ...(await prismaClient.protocol.findUnique({
                where: { id: detailedStoredProtocol.id },
                ...fieldsWUnfilteredApplications,
            })),
            actions: (await getProtocolsUserActions(requester, [detailedStoredProtocol]))[0],
        };
        // Get applicattions only with visible fields and with embedded actions
        const detailedApplications = detailedStoredProtocol.applications;
        const applicationActions = await getApplicationsUserActions(requester, detailedApplications);
        const applicationFields = await getApplicationsVisibleFields(requester, detailedApplications, false, false, false, false);
        const visibleProtocolWApplications = {
            ...visibleProtocolWUnfilteredApplications,
            applications: visibleProtocolWUnfilteredApplications.applications?.map((application, i) => ({
                ...fieldsFilter(application, applicationFields[i]),
                actions: applicationActions[i],
            })),
        };

        res.status(201).json({ message: 'Protocol created.', data: visibleProtocolWApplications });
    } catch (error: any) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) if (existsSync(file.path)) unlinkSync(file.path);
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Updates an existing protocol in the database.
 *
 * This function handles the update of a existing protocol, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the protocol data in the body, the user object from Passport-JWT and the address ID in the params.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const updateProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const protocolId: number = parseInt(req.params.protocolId);
        // Yup schemas
        const updateFileSchema = yup
            .object()
            .shape({ id: yup.number().min(1), description: yup.string().max(3000) })
            .noUnknown();

        const updateTableColumnSchema = yup
            .object()
            .shape({ id: yup.number().min(1), text: yup.string().min(1).max(255), placement: yup.number().min(1).required() })
            .noUnknown();

        const updateItemOptionsSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                text: yup.string().min(1).max(255),
                placement: yup.number().min(1).required(),
                files: yup.array().of(updateFileSchema).default([]),
            })
            .noUnknown();

        const updateItemValidationsSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                type: yup.mixed<ItemValidationType>().oneOf(Object.values(ItemValidationType)),
                argument: yup.string(),
                customMessage: yup.string(),
            })
            .noUnknown();

        const updateDependenciesSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                type: yup.mixed<DependencyType>().oneOf(Object.values(DependencyType)).required(),
                argument: yup.string().required(),
                customMessage: yup.string(),
                itemTempId: yup.number().min(1).required(),
            })
            .noUnknown();

        const updateItemsSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                tempId: yup.number().min(1).required(),
                text: yup.string().min(3).max(3000),
                description: yup.string().max(3000),
                enabled: yup.boolean(),
                type: yup.mixed<ItemType>().oneOf(Object.values(ItemType)).required(),
                placement: yup.number().min(1).required(),
                files: yup.array().of(updateFileSchema).default([]),
                itemOptions: yup.array().of(updateItemOptionsSchema).default([]),
                itemValidations: yup.array().of(updateItemValidationsSchema).default([]),
            })
            .noUnknown();

        const updateItemGroupsSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                placement: yup.number().min(1).required(),
                isRepeatable: yup.boolean(),
                type: yup.mixed<ItemGroupType>().oneOf(Object.values(ItemGroupType)).required(),
                items: yup.array().of(updateItemsSchema).min(1).required(),
                tableColumns: yup.array().of(updateTableColumnSchema).default([]),
                dependencies: yup.array().of(updateDependenciesSchema).default([]),
            })
            .noUnknown();

        const updatePagesSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                placement: yup.number().min(1).required(),
                type: yup.mixed<PageType>().oneOf(Object.values(PageType)).required(),
                itemGroups: yup.array().of(updateItemGroupsSchema).min(1).required(),
                dependencies: yup.array().of(updateDependenciesSchema).default([]),
            })
            .noUnknown();

        const updateProtocolSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                title: yup.string().min(3).max(255),
                description: yup.string().max(3000),
                enabled: yup.boolean(),
                pages: yup.array().of(updatePagesSchema).min(1).required(),
                managers: yup.array().of(yup.number()).default([]),
                visibility: yup.mixed<VisibilityMode>().oneOf(Object.values(VisibilityMode)),
                applicability: yup.mixed<VisibilityMode>().oneOf(Object.values(VisibilityMode)),
                answersVisibility: yup.mixed<VisibilityMode>().oneOf(Object.values(VisibilityMode)),
                viewersUser: yup.array().of(yup.number()).default([]),
                viewersClassroom: yup.array().of(yup.number()).default([]),
                answersViewersUser: yup.array().of(yup.number()).default([]),
                answersViewersClassroom: yup.array().of(yup.number()).default([]),
                appliers: yup.array().of(yup.number()).default([]),
                replicable: yup.boolean(),
            })
            .noUnknown();
        // Yup parsing/validation
        const protocolData = await updateProtocolSchema.validate(req.body, { stripUnknown: true });
        // Sort elements by placement
        for (const page of protocolData.pages) {
            page.itemGroups.sort((a, b) => a.placement - b.placement);
            for (const itemGroup of page.itemGroups) {
                for (const item of itemGroup.items) {
                    item.itemOptions.sort((a, b) => a.placement - b.placement);
                }
                itemGroup.items.sort((a, b) => a.placement - b.placement);
                itemGroup.tableColumns.sort((a, b) => a.placement - b.placement);
            }
        }
        protocolData.pages.sort((a, b) => a.placement - b.placement);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is included in the managers, or if user is admin
        await checkAuthorization(requester, [protocolId], 'update');
        // Check if managers are publishers, coordinators or admins of the same institution
        await validateManagers(protocolData.managers as number[], requester.institutionId);
        // Check if viewers are not guests or admins
        await validadeViewers(protocolData.viewersUser as number[]);
        await validadeViewers(protocolData.answersViewersUser as number[]);
        // Check if appliers are publishers, coordinators or appliers
        await validateAppliers(protocolData.appliers as number[]);
        // Check if protocol placements are valid
        await validateProtocolPlacements(protocolData);
        // Check if dependencies are valid
        await validateDependencies(protocolData);
        //Multer files
        const files = req.files as Express.Multer.File[];
        // Create map table for tempIds
        const tempIdMap = new Map<number, number>();
        // Prisma transaction
        const detailedStoredProtocol = await prismaClient.$transaction(async (prisma) => {
            // Update protocol
            await prisma.protocol.update({
                where: { id: protocolId },
                data: {
                    title: protocolData.title,
                    description: protocolData.description,
                    enabled: protocolData.enabled,
                    managers: { set: [], connect: protocolData.managers.map((manager) => ({ id: manager })) },
                    visibility: protocolData.visibility as VisibilityMode,
                    applicability: protocolData.applicability as VisibilityMode,
                    answersVisibility: protocolData.answersVisibility as VisibilityMode,
                    viewersUser: { set: [], connect: protocolData.viewersUser.map((viewer) => ({ id: viewer })) },
                    viewersClassroom: { set: [], connect: protocolData.viewersClassroom.map((viewer) => ({ id: viewer })) },
                    answersViewersUser: { set: [], connect: protocolData.answersViewersUser.map((viewer) => ({ id: viewer })) },
                    answersViewersClassroom: { set: [], connect: protocolData.answersViewersClassroom.map((viewer) => ({ id: viewer })) },
                    appliers: { set: [], connect: protocolData.appliers.map((applier) => ({ id: applier })) },
                    replicable: protocolData.replicable,
                },
            });
            // Remove pages that are not in the updated protocol
            await prisma.page.deleteMany({
                where: {
                    id: { notIn: protocolData.pages.filter((page) => page.id).map((page) => page.id as number) },
                    protocolId: protocolId,
                },
            });
            // Update existing pages or create new ones
            for (const [pageId, page] of protocolData.pages.entries()) {
                const upsertedPage = page.id
                    ? await prisma.page.update({
                          where: { id: page.id, protocolId: protocolId },
                          data: { placement: page.placement, type: page.type },
                      })
                    : await prisma.page.create({
                          data: {
                              protocolId: protocolId as number,
                              placement: page.placement as number,
                              type: page.type as PageType,
                          },
                      });
                // Remove itemGroups that are not in the updated page
                await prisma.itemGroup.deleteMany({
                    where: {
                        id: { notIn: page.itemGroups.filter((itemGroup) => itemGroup.id).map((itemGroup) => itemGroup.id as number) },
                        pageId: upsertedPage.id,
                    },
                });
                // Update existing itemGroups or create new ones
                for (const [itemGroupId, itemGroup] of page.itemGroups.entries()) {
                    validateItemGroup(itemGroup.type, itemGroup.items.length, itemGroup.tableColumns.length);

                    const upsertedItemGroup = itemGroup.id
                        ? await prisma.itemGroup.update({
                              where: { id: itemGroup.id, pageId: upsertedPage.id },
                              data: {
                                  placement: itemGroup.placement,
                                  isRepeatable: itemGroup.isRepeatable,
                                  type: itemGroup.type,
                              },
                          })
                        : await prisma.itemGroup.create({
                              data: {
                                  placement: itemGroup.placement as number,
                                  isRepeatable: itemGroup.isRepeatable as boolean,
                                  pageId: upsertedPage.id as number,
                                  type: itemGroup.type as ItemGroupType,
                              },
                          });
                    // Remove tableColumns that are not in the updated itemGroup
                    await prisma.tableColumn.deleteMany({
                        where: {
                            id: {
                                notIn: itemGroup.tableColumns
                                    .filter((tableColumn) => tableColumn.id)
                                    .map((tableColumn) => tableColumn.id as number),
                            },
                            groupId: upsertedItemGroup.id,
                        },
                    });
                    // Update existing tableColumns or create new ones
                    for (const [tableColumnId, tableColumn] of itemGroup.tableColumns.entries()) {
                        const upsertedTableColumn = tableColumn.id
                            ? await prisma.tableColumn.update({
                                  where: {
                                      groupId: upsertedItemGroup.id,
                                      id: tableColumn.id,
                                  },
                                  data: { text: tableColumn.text, placement: tableColumn.placement },
                              })
                            : await prisma.tableColumn.create({
                                  data: {
                                      text: tableColumn.text as string,
                                      placement: tableColumn.placement as number,
                                      groupId: upsertedItemGroup.id as number,
                                  },
                              });
                    }
                    // Remove items that are not in the updated itemGroup
                    await prisma.item.deleteMany({
                        where: {
                            id: { notIn: itemGroup.items.filter((item) => item.id).map((item) => item.id as number) },
                            groupId: upsertedItemGroup.id,
                        },
                    });
                    // Update existing items or create new ones
                    for (const [itemId, item] of itemGroup.items.entries()) {
                        // Check if item has the allowed amount of itemOptions and tableColumns
                        await validateItem(item.type, item.itemOptions.length);
                        // Check if itemValidations are valid
                        await validateItemValidations(item.type, item.itemValidations);
                        const upsertedItem = item.id
                            ? await prisma.item.update({
                                  where: {
                                      id: item.id,
                                      groupId: upsertedItemGroup.id,
                                  },
                                  data: {
                                      text: item.text,
                                      description: item.description,
                                      enabled: item.enabled,
                                      type: item.type,
                                      placement: item.placement,
                                  },
                              })
                            : await prisma.item.create({
                                  data: {
                                      text: item.text as string,
                                      description: item.description as string,
                                      enabled: item.enabled as boolean,
                                      groupId: upsertedItemGroup.id as number,
                                      type: item.type as ItemType,
                                      placement: item.placement as number,
                                  },
                              });
                        tempIdMap.set(item.tempId, upsertedItem.id);
                        // Remove files that are not in the updated item
                        const filesToDelete = await prisma.file.findMany({
                            where: {
                                id: { notIn: item.files.filter((file) => file.id).map((file) => file?.id as number) },
                                itemId: upsertedItem.id,
                            },
                            select: { id: true, path: true },
                        });
                        for (const file of filesToDelete) if (existsSync(file.path)) unlinkSync(file.path);
                        await prisma.file.deleteMany({ where: { id: { in: filesToDelete.map((file) => file.id) } } });
                        // Update existing files or create new ones
                        for (const [fileIndex, itemFile] of item.files.entries()) {
                            if (itemFile.id) {
                                await prisma.file.update({
                                    where: { id: itemFile.id, itemId: upsertedItem.id },
                                    data: { description: itemFile.description },
                                });
                            } else {
                                const storedFile = files.find(
                                    (f) =>
                                        f.fieldname ===
                                        `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][files][${fileIndex}][content]`
                                );
                                if (!storedFile) throw new Error('File not found.');
                                else files.splice(files.indexOf(storedFile), 1);
                                await prisma.file.create({
                                    data: {
                                        description: itemFile.description,
                                        path: storedFile.path,
                                        itemId: upsertedItem.id,
                                    },
                                });
                            }
                        }
                        // Update existing itemOptions or create new ones
                        for (const [itemOptionId, itemOption] of item.itemOptions.entries()) {
                            const upsertedItemOption = itemOption.id
                                ? await prisma.itemOption.update({
                                      where: { id: itemOption.id, itemId: upsertedItem.id },
                                      data: { text: itemOption.text, placement: itemOption.placement },
                                  })
                                : await prisma.itemOption.create({
                                      data: {
                                          text: itemOption.text as string,
                                          placement: itemOption.placement as number,
                                          itemId: upsertedItem.id as number,
                                      },
                                  });
                            // Remove files that are not in the updated itemOption
                            const filesToDelete = await prisma.file.findMany({
                                where: {
                                    id: { notIn: itemOption.files.filter((file) => file.id).map((file) => file.id as number) },
                                    itemOptionId: upsertedItemOption.id,
                                },
                                select: { id: true, path: true },
                            });
                            for (const file of filesToDelete) if (existsSync(file.path)) unlinkSync(file.path);
                            await prisma.file.deleteMany({ where: { id: { in: filesToDelete.map((file) => file.id) } } });
                            // Update existing files or create new ones
                            for (const [fileIndex, itemOptionFile] of itemOption.files.entries()) {
                                if (itemOptionFile.id) {
                                    await prisma.file.update({
                                        where: { id: itemOptionFile.id, itemOptionId: upsertedItemOption.id },
                                        data: { description: itemOptionFile.description },
                                    });
                                } else {
                                    const storedFile = files.find(
                                        (f) =>
                                            f.fieldname ===
                                            `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][itemOptions][${itemOptionId}][files][${fileIndex}][content]`
                                    );
                                    if (!storedFile) throw new Error('File not found.');
                                    else files.splice(files.indexOf(storedFile), 1);
                                    await prisma.file.create({
                                        data: {
                                            description: itemOptionFile.description,
                                            path: storedFile.path,
                                            itemOptionId: upsertedItemOption.id,
                                        },
                                    });
                                }
                            }
                        }
                        // Remove itemValidations that are not in the updated item
                        await prisma.itemValidation.deleteMany({
                            where: {
                                id: {
                                    notIn: item.itemValidations
                                        .filter((itemValidation) => itemValidation.id)
                                        .map((itemValidation) => itemValidation.id as number),
                                },
                                itemId: upsertedItem.id,
                            },
                        });
                        // Update existing itemValidations or create new ones
                        for (const [itemValidationId, itemValidation] of item.itemValidations.entries()) {
                            const upsertedItemValidation = itemValidation.id
                                ? await prisma.itemValidation.update({
                                      where: { id: itemValidation.id, itemId: upsertedItem.id },
                                      data: {
                                          type: itemValidation.type,
                                          argument: itemValidation.argument,
                                          customMessage: itemValidation.customMessage,
                                      },
                                  })
                                : await prisma.itemValidation.create({
                                      data: {
                                          type: itemValidation.type as ItemValidationType,
                                          argument: itemValidation.argument as string,
                                          customMessage: itemValidation.customMessage as string,
                                          itemId: upsertedItem.id as number,
                                      },
                                  });
                        }
                    }
                    // Remove dependencies that are not in the updated itemGroup
                    await prisma.itemGroupDependencyRule.deleteMany({
                        where: {
                            id: {
                                notIn: itemGroup.dependencies
                                    .filter((dependency) => dependency.id)
                                    .map((dependency) => dependency.id as number),
                            },
                            itemGroupId: upsertedItemGroup.id,
                        },
                    });
                    // Update existing dependencies or create new ones
                    for (const [dependencyId, dependency] of itemGroup.dependencies.entries()) {
                        const upsertedDependency = dependency.id
                            ? await prisma.itemGroupDependencyRule.update({
                                  where: { id: dependency.id, itemGroupId: upsertedItemGroup.id },
                                  data: {
                                      argument: dependency.argument,
                                      customMessage: dependency.customMessage,
                                  },
                              })
                            : await prisma.itemGroupDependencyRule.create({
                                  data: {
                                      type: dependency.type as DependencyType,
                                      argument: dependency.argument as string,
                                      customMessage: dependency.customMessage as string,
                                      itemGroupId: upsertedItemGroup.id as number,
                                      itemId: tempIdMap.get(dependency.itemTempId) as number,
                                  },
                              });
                    }
                }
                // Remove dependencies that are not in the updated page
                await prisma.pageDependencyRule.deleteMany({
                    where: {
                        id: {
                            notIn: page.dependencies.filter((dependency) => dependency.id).map((dependency) => dependency.id as number),
                        },
                        pageId: upsertedPage.id,
                    },
                });
                // Update existing dependencies or create new ones
                for (const [dependencyId, dependency] of page.dependencies.entries()) {
                    const upsertedDependency = dependency.id
                        ? await prisma.pageDependencyRule.update({
                              where: { id: dependency.id, pageId: upsertedPage.id },
                              data: { argument: dependency.argument, customMessage: dependency.customMessage },
                          })
                        : await prisma.pageDependencyRule.create({
                              data: {
                                  type: dependency.type as DependencyType,
                                  argument: dependency.argument as string,
                                  customMessage: dependency.customMessage as string,
                                  pageId: upsertedPage.id as number,
                                  itemId: tempIdMap.get(dependency.itemTempId) as number,
                              },
                          });
                }
            }
            // Check if there are any files left
            if (files.length > 0) {
                throw new Error('Files not associated with any item or option detected.');
            }

            // Return the updated protocol with nested content included
            return await prisma.protocol.findUniqueOrThrow({ where: { id: protocolId }, include: detailedProtocolFields() });
        });

        // Get protocol only with visible fields and with embedded actions
        const fieldsWUnfilteredApplications = (await getVisibleFields(requester, [detailedStoredProtocol], false, false))[0];
        fieldsWUnfilteredApplications.select.applications = (
            await getApplicationsVisibleFields(requester, [], false, false, false, true)
        )[0];
        const visibleProtocolWUnfilteredApplications = {
            ...(await prismaClient.protocol.findUnique({
                where: { id: detailedStoredProtocol.id },
                ...fieldsWUnfilteredApplications,
            })),
            actions: (await getProtocolsUserActions(requester, [detailedStoredProtocol]))[0],
        };
        // Get applicattions only with visible fields and with embedded actions
        const detailedApplications = detailedStoredProtocol.applications;
        const applicationActions = await getApplicationsUserActions(requester, detailedApplications);
        const applicationFields = await getApplicationsVisibleFields(requester, detailedApplications, false, false, false, false);
        const visibleProtocolWApplications = {
            ...visibleProtocolWUnfilteredApplications,
            applications: visibleProtocolWUnfilteredApplications.applications?.map((application, i) => ({
                ...fieldsFilter(application, applicationFields[i]),
                actions: applicationActions[i],
            })),
        };

        res.status(200).json({ message: 'Protocol updated.', data: visibleProtocolWApplications });
    } catch (error: any) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) if (existsSync(file.path)) unlinkSync(file.path);
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all protocols from the database.
 *
 * This function handles the retrieval of all protocols in the database, validating the user
 * performing the action to then retrieve all protocols using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getAllProtocols = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is allowed to get all protocols
        await checkAuthorization(requester, [], 'getAll');
        // Prisma operation
        const detailedStoredProtocols = await prismaClient.protocol.findMany({ orderBy: { id: 'asc' }, include: detailedProtocolFields() });
        // Get protocol only with visible fields and with embedded actions
        const actions = await getProtocolsUserActions(requester, detailedStoredProtocols);
        const filteredFields = await getVisibleFields(requester, detailedStoredProtocols, false, false);
        const unfilteredFields = (await getVisibleFields(requester, detailedStoredProtocols, false, true))[0];
        unfilteredFields.select.applications = (await getApplicationsVisibleFields(requester, [], false, false, false, true))[0];
        const unfilteredProtocolsWApplications = await prismaClient.protocol.findMany({
            where: { id: { in: detailedStoredProtocols.map((protocol) => protocol.id) } },
            ...unfilteredFields,
        });
        const visibleProtocols = await Promise.all(
            unfilteredProtocolsWApplications.map(async (protocol, i) => {
                const applicationsActions = await getApplicationsUserActions(requester, detailedStoredProtocols[i].applications);
                const applicationsFields = await getApplicationsVisibleFields(
                    requester,
                    detailedStoredProtocols[i].applications,
                    false,
                    false,
                    false,
                    false
                );
                return {
                    ...fieldsFilter(protocol, filteredFields[i]),
                    applications: protocol.applications.map((application, j) => ({
                        ...fieldsFilter(application, applicationsFields[j]),
                        actions: applicationsActions[j],
                    })),
                    actions: actions[i],
                };
            })
        );

        res.status(200).json({ message: 'All protocols found.', data: visibleProtocols });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all visible protocols from the database.
 *
 * This function handles the retrieval of all visible protocols in the database, validating the user
 * performing the action to then retrieve all visible protocols using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getVisibleProtocols = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is allowed to get visible protocols
        await checkAuthorization(requester, [], 'getVisible');
        // Prisma operation
        const detailedStoredProtocols =
            requester.role === UserRole.ADMIN
                ? await prismaClient.protocol.findMany({ orderBy: { id: 'asc' }, include: detailedProtocolFields() })
                : await prismaClient.protocol.findMany({
                      orderBy: { id: 'asc' },
                      where: {
                          OR: [
                              { managers: { some: { id: requester.id } } },
                              { appliers: { some: { id: requester.id } } },
                              { viewersUser: { some: { id: requester.id } }, enabled: true },
                              { viewersClassroom: { some: { users: { some: { id: requester.id } } } }, enabled: true },
                              { creatorId: requester.id },
                              { visibility: VisibilityMode.PUBLIC, enabled: true },
                              ...(requester.role === UserRole.COORDINATOR ? [{ creator: { institutionId: requester.institutionId } }] : []),
                              ...(requester.role !== UserRole.GUEST ? [{ visibility: VisibilityMode.AUTHENTICATED, enabled: true }] : []),
                          ],
                          enabled: true,
                      },
                      include: detailedProtocolFields(),
                  });

        // Get protocol only with visible fields and with embedded actions
        const actions = await getProtocolsUserActions(requester, detailedStoredProtocols);
        const filteredFields = await getVisibleFields(requester, detailedStoredProtocols, false, false);
        const unfilteredFields = (await getVisibleFields(requester, detailedStoredProtocols, false, true))[0];
        unfilteredFields.select.applications = (await getApplicationsVisibleFields(requester, [], false, false, false, true))[0];
        const unfilteredProtocolsWApplications = await prismaClient.protocol.findMany({
            where: { id: { in: detailedStoredProtocols.map((protocol) => protocol.id) } },
            ...unfilteredFields,
        });
        const visibleProtocols = await Promise.all(
            unfilteredProtocolsWApplications.map(async (protocol, i) => {
                const applicationsActions = await getApplicationsUserActions(requester, detailedStoredProtocols[i].applications);
                const applicationsFields = await getApplicationsVisibleFields(
                    requester,
                    detailedStoredProtocols[i].applications,
                    false,
                    false,
                    false,
                    false
                );
                return {
                    ...fieldsFilter(protocol, filteredFields[i]),
                    applications: protocol.applications.map((application, j) => ({
                        ...fieldsFilter(application, applicationsFields[j]),
                        actions: applicationsActions[j],
                    })),
                    actions: actions[i],
                };
            })
        );

        res.status(200).json({ message: 'Visible protocols found.', data: visibleProtocols });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all protocols associated with the user from the database.
 *
 * This function handles the retrieval of all protocols associated with the user in the database,
 * validating the user performing the action to then retrieve all protocols using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getMyProtocols = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const requester = req.user as User;
        // Prisma operation
        const detailedStoredProtocols = await prismaClient.protocol.findMany({
            orderBy: { id: 'asc' },
            where: { OR: [{ managers: { some: { id: requester.id } }, creatorId: requester.id }] },
            include: detailedProtocolFields(),
        });
        // Get protocol only with visible fields and with embedded actions
        const actions = await getProtocolsUserActions(requester, detailedStoredProtocols);
        const filteredFields = await getVisibleFields(requester, detailedStoredProtocols, false, false);
        const unfilteredFields = (await getVisibleFields(requester, detailedStoredProtocols, false, true))[0];
        unfilteredFields.select.applications = (await getApplicationsVisibleFields(requester, [], false, false, false, true))[0];
        const unfilteredProtocolsWApplications = await prismaClient.protocol.findMany({
            where: { id: { in: detailedStoredProtocols.map((protocol) => protocol.id) } },
            ...unfilteredFields,
        });
        const visibleProtocols = await Promise.all(
            unfilteredProtocolsWApplications.map(async (protocol, i) => {
                const applicationsActions = await getApplicationsUserActions(requester, detailedStoredProtocols[i].applications);
                const applicationsFields = await getApplicationsVisibleFields(
                    requester,
                    detailedStoredProtocols[i].applications,
                    false,
                    false,
                    false,
                    false
                );
                return {
                    ...fieldsFilter(protocol, filteredFields[i]),
                    applications: protocol.applications.map((application, j) => ({
                        ...fieldsFilter(application, applicationsFields[j]),
                        actions: applicationsActions[j],
                    })),
                    actions: actions[i],
                };
            })
        );

        res.status(200).json({ message: 'My protocols found.', data: visibleProtocols });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets an protocol from the database by ID.
 *
 * This function handles the retrieval of an protocol in the database by ID, validating the user
 * performing the action to then retrieve the protocol using Prisma.
 *
 * @param req - The request object, containing the protocol ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const protocolId: number = parseInt(req.params.protocolId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is allowed to get the protocol
        await checkAuthorization(requester, [protocolId], 'get');
        // Get protocol with nested content included
        const detailedStoredProtocol = await prismaClient.protocol.findUniqueOrThrow({
            where: {
                id: protocolId,
                OR: [
                    { managers: { some: { id: requester.id } } },
                    { appliers: { some: { id: requester.id } }, enabled: true },
                    { viewersUser: { some: { id: requester.id } }, enabled: true },
                    { viewersClassroom: { some: { users: { some: { id: requester.id } } } }, enabled: true },
                    { creatorId: requester.id },
                    { visibility: VisibilityMode.PUBLIC, enabled: true },
                    ...(requester.role === UserRole.COORDINATOR ? [{ creator: { institutionId: requester.institutionId } }] : []),
                    ...(requester.role !== UserRole.GUEST ? [{ visibility: VisibilityMode.AUTHENTICATED, enabled: true }] : []),
                ],
            },
            include: detailedProtocolFields(),
        });

        // Get protocol only with visible fields and with embedded actions
        const fieldsWUnfilteredApplications = (await getVisibleFields(requester, [detailedStoredProtocol], false, false))[0];
        fieldsWUnfilteredApplications.select.applications = (
            await getApplicationsVisibleFields(requester, [], false, false, false, true)
        )[0];
        const visibleProtocolWUnfilteredApplications = {
            ...(await prismaClient.protocol.findUnique({
                where: { id: detailedStoredProtocol.id },
                ...fieldsWUnfilteredApplications,
            })),
            actions: (await getProtocolsUserActions(requester, [detailedStoredProtocol]))[0],
        };
        // Get applicattions only with visible fields and with embedded actions
        const detailedApplications = detailedStoredProtocol.applications;
        const applicationActions = await getApplicationsUserActions(requester, detailedApplications);
        const applicationFields = await getApplicationsVisibleFields(requester, detailedApplications, false, false, false, false);
        const visibleProtocolWApplications = {
            ...visibleProtocolWUnfilteredApplications,
            applications: visibleProtocolWUnfilteredApplications.applications?.map((application, i) => ({
                ...fieldsFilter(application, applicationFields[i]),
                actions: applicationActions[i],
            })),
        };

        res.status(200).json({ message: 'Protocol found.', data: visibleProtocolWApplications });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets an protocol from the database by ID with answers.
 *
 * This function handles the retrieval of an protocol in the database by ID with answers, validating the user
 * performing the action to then retrieve the protocol using Prisma.
 *
 * @param req - The request object, containing the protocol ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getProtocolWithAnswers = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const protocolId: number = parseInt(req.params.protocolId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is allowed to get the protocol
        await checkAuthorization(requester, [protocolId], 'getWAnswers');
        // Get protocol with nested content included
        const detailedStoredProtocol = await prismaClient.protocol.findUniqueOrThrow({
            where: {
                id: protocolId,
                OR: [
                    { managers: { some: { id: requester.id } } },
                    { answersViewersUser: { some: { id: requester.id } }, enabled: true },
                    { answersViewersClassroom: { some: { users: { some: { id: requester.id } } } }, enabled: true },
                    { creatorId: requester.id },
                    { answersVisibility: VisibilityMode.PUBLIC, enabled: true },
                    ...(requester.role === UserRole.COORDINATOR ? [{ creator: { institutionId: requester.institutionId } }] : []),
                    ...(requester.role !== UserRole.GUEST ? [{ answersVisibility: VisibilityMode.AUTHENTICATED, enabled: true }] : []),
                ],
            },
            include: detailedProtocolFields(),
        });

        // Get protocol only with visible fields and with embedded actions
        const fieldsWUnfilteredApplications = (await getVisibleFields(requester, [detailedStoredProtocol], true, false))[0];
        fieldsWUnfilteredApplications.select.applications = (
            await getApplicationsVisibleFields(requester, [], true, false, false, true)
        )[0];
        const visibleProtocolWUnfilteredApplications = {
            ...(await prismaClient.protocol.findUnique({
                where: { id: detailedStoredProtocol.id },
                ...fieldsWUnfilteredApplications,
            })),
            actions: (await getProtocolsUserActions(requester, [detailedStoredProtocol]))[0],
        };
        // Get applicattions only with visible fields and with embedded actions
        const detailedApplications = detailedStoredProtocol.applications;
        const applicationActions = await getApplicationsUserActions(requester, detailedApplications);
        const applicationFields = await getApplicationsVisibleFields(requester, detailedApplications, true, false, false, false);
        const visibleProtocolWApplications = {
            ...visibleProtocolWUnfilteredApplications,
            applications: visibleProtocolWUnfilteredApplications.applications?.map((application, i) => ({
                ...fieldsFilter(application, applicationFields[i]),
                actions: applicationActions[i],
            })),
        };

        res.status(200).json({ message: 'Protocol with answers found.', data: visibleProtocolWApplications });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Deletes an protocol from the database by ID.
 *
 * This function handles the deletion of an protocol in the database by ID, validating the user
 * performing the action to then delete the protocol using Prisma.
 *
 * @param req - The request object, containing the protocol ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const deleteProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const protocolId: number = parseInt(req.params.protocolId);
        // User from Passport-JWT
        const requester = req.user as User;
        // Check if user is allowed to delete the protocol
        await checkAuthorization(requester, [protocolId], 'delete');
        // Get current number of applications
        const applicationsCount = await prismaClient.application.count({ where: { protocolId: protocolId } });
        // Check if there are any applications associated with the protocol
        if (applicationsCount > 0)
            throw new Error('Cannot delete protocol with associated applications, please delete them first or disable the protocol.');
        // Delete protocol
        const deletedProtocol = await prismaClient.protocol.delete({ where: { id: protocolId }, select: { id: true } });

        res.status(200).json({ message: 'Protocol deleted.', data: deletedProtocol });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
