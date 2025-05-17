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
import {
    ItemType,
    ItemGroupType,
    PageType,
    ItemValidationType,
    User,
    UserRole,
    VisibilityMode,
    DependencyType,
    EventType,
} from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';

import { unlinkSync, existsSync } from 'fs';
import { getApplicationUserActions } from './applicationController';

export const getProtocolUserRoles = async (user: User, protocol: any, protocolId: number | undefined) => {
    protocol =
        protocol ||
        (await prismaClient.protocol.findUniqueOrThrow({
            where: { id: protocolId },
            include: {
                creator: { select: { id: true, institutionId: true } },
                managers: { select: { id: true } },
                appliers: { select: { id: true } },
                viewersUser: { select: { id: true } },
                viewersClassroom: { select: { users: { select: { id: true } } } },
                answersViewersUser: { select: { id: true } },
                answersViewersClassroom: { select: { users: { select: { id: true } } } },
            },
        }));

    const coordinator = user.role === UserRole.COORDINATOR && protocol?.creator?.institutionId === user.institutionId;
    const creator = protocol?.creator?.id === user.id;
    const manager = !!protocol?.managers?.some((manager: any) => manager.id === user.id);
    const applier = !!protocol?.appliers?.some((applier: any) => applier.id === user.id);
    const viewer = !!(
        protocol?.visibility === VisibilityMode.PUBLIC ||
        (protocol?.visibility === VisibilityMode.AUTHENTICATED && user.role !== UserRole.GUEST) ||
        protocol?.viewersUser?.some((viewer: any) => viewer.id === user.id) ||
        protocol?.viewersClassroom?.some((classroom: any) => classroom.users?.some((viewer: any) => viewer.id === user.id))
    );
    const answersViewer = !!(
        protocol?.answersVisibility === VisibilityMode.PUBLIC ||
        (protocol?.answersVisibility === VisibilityMode.AUTHENTICATED && user.role !== UserRole.GUEST) ||
        protocol?.answersViewersUser?.some((viewer: any) => viewer.id === user.id) ||
        protocol?.answersViewersClassroom?.some((classroom: any) => classroom.users?.some((viewer: any) => viewer.id === user.id))
    );

    return { creator, manager, applier, viewer, answersViewer, coordinator };
};

const getProtocolUserActions = async (user: User, protocol: any, protocolId: number | undefined) => {
    const roles = await getProtocolUserRoles(user, protocol, protocolId);
    // Only managers/creator/institution coordinator can perform update/delete operations on protocols
    const toUpdate = roles.manager || roles.coordinator || roles.creator || user.role === UserRole.ADMIN;
    const toDelete = roles.manager || roles.coordinator || roles.creator || user.role === UserRole.ADMIN;
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

    return {
        toUpdate,
        toDelete,
        toGet,
        toGetAll,
        toGetVisible,
        toGetMy,
        toGetWAnswers,
        toApply,
    };
};

const checkAuthorization = async (user: User, protocolId: number | undefined, action: string) => {
    // Admins can perform any action
    if (user.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create':
            // Anyone except users, appliers and guests can create protocols
            if (user.role === UserRole.USER || user.role === UserRole.APPLIER || user.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        case 'update':
        case 'delete': {
            // Only managers/creator/coordinator can perform update/delete operations on protocols
            const roles = await getProtocolUserRoles(user, undefined, protocolId);
            if (!roles.manager && !roles.creator && !roles.coordinator)
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getAll':
            // No one can perform getAll operations on protocols
            throw new Error('This user is not authorized to perform this action');
            break;
        case 'getVisible':
        case 'getMy':
            // Anyone can perform getVisible and getMy operations on protocols (since the content is filtered according to the user)
            break;
        case 'get': {
            // Only viewers/creator/managers/appliers/coordinator can perform get operations on protocols
            const roles = await getProtocolUserRoles(user, undefined, protocolId);
            if (!roles.viewer && !roles.creator && !roles.applier && !roles.manager && !roles.coordinator)
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getWAnswers': {
            // Only answers viewers/creator/managers/coordinator can perform getWAnswers operations on protocols
            const roles = await getProtocolUserRoles(user, undefined, protocolId);
            if (!roles.answersViewer && !roles.creator && !roles.manager && !roles.coordinator)
                throw new Error('This user is not authorized to perform this action');
            break;
        }
    }
};

const validateItem = async (type: ItemType, itemOptionsLength: number) => {
    if (type === ItemType.CHECKBOX || type === ItemType.RADIO || type === ItemType.SELECT) {
        if (itemOptionsLength < 2) throw new Error('Not enough options.');
    } else if (itemOptionsLength !== 0) throw new Error('Options not allowed.');
};

const validateItemGroup = async (type: ItemGroupType, itemsLength: number, tableColumnsLength: number) => {
    if (
        itemsLength === 0 ||
        ((type === ItemGroupType.CHECKBOX_TABLE || type === ItemGroupType.RADIO_TABLE || type === ItemGroupType.TEXTBOX_TABLE) &&
            tableColumnsLength === 0) ||
        (type === ItemGroupType.ONE_DIMENSIONAL && tableColumnsLength > 0)
    )
        throw new Error('ItemGroup type does not match the amount of items or tableColumns.');
};

const validateDependencies = async (protocol: any) => {
    const previousItemsTempIds = new Map<number, ItemType>();
    for (const page of protocol.pages) {
        for (const dependency of page.dependencies) {
            const itemType = previousItemsTempIds.get(dependency.itemTempId);
            if (!itemType) throw new Error('Invalid dependency item: must reference a previous item.');
            switch (dependency.type) {
                case DependencyType.EXACT_ANSWER:
                    if (itemType !== ItemType.TEXTBOX && itemType !== ItemType.NUMBERBOX && itemType !== ItemType.RANGE)
                        throw new Error('Exact answer dependency not allowed for this item type.');
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
                        throw new Error('Min dependency only allowed for checkbox, numberbox, range and textbox items.');
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
                        throw new Error('Max dependency only allowed for checkbox, numberbox, range and textbox items.');
                    break;
                case DependencyType.OPTION_SELECTED:
                    if (itemType !== ItemType.RADIO && itemType !== ItemType.SELECT && itemType !== ItemType.CHECKBOX)
                        throw new Error('Option selected dependency only allowed for radio, select and checkbox items.');
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
                            throw new Error('Exact answer dependency not allowed for this item type.');
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
                            throw new Error('Min dependency only allowed for checkbox, numberbox, range and textbox items.');
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
                            throw new Error('Max dependency only allowed for checkbox, numberbox, range and textbox items.');
                        break;
                    case DependencyType.OPTION_SELECTED:
                        if (itemType !== ItemType.RADIO && itemType !== ItemType.SELECT && itemType !== ItemType.CHECKBOX)
                            throw new Error('Option selected dependency only allowed for radio, select and checkbox items.');
                        break;
                }
            }
            for (const item of itemGroup.items) {
                previousItemsTempIds.set(item.tempId, item.type);
            }
        }
    }
};

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
    if (minValidation && maxValidation && stepValidation && maxValidation.argument - minValidation.argument <= stepValidation.argument)
        throw new Error('Step argument must be less than the difference between min and max arguments.');
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

const validadeViewers = async (viewers: number[]) => {
    const invalidViewers = await prismaClient.user.findMany({
        where: { id: { in: viewers }, role: { in: [UserRole.ADMIN, UserRole.GUEST] } },
    });
    if (invalidViewers.length > 0) throw new Error('You cannot add guests or admins as viewers.');
};

const validateAppliers = async (appliers: number[]) => {
    const invalidAppliers = await prismaClient.user.findMany({
        where: { id: { in: appliers }, role: { notIn: [UserRole.APPLIER, UserRole.PUBLISHER, UserRole.COORDINATOR] } },
    });
    if (invalidAppliers.length > 0) throw new Error('Appliers must be publishers, coordinators or appliers.');
};

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

const validateDependency = async (type: DependencyType, argument: string = '') => {
    switch (type) {
        case DependencyType.EXACT_ANSWER:
        case DependencyType.OPTION_SELECTED:
            if (argument.length === 0) throw new Error('Option selected and exact answer dependencies must have an argument.');
            break;
        case DependencyType.MIN:
        case DependencyType.MAX:
            if (Number.isNaN(parseInt(argument))) throw new Error('Min and max dependencies must have a numeric argument.');
            break;
        case DependencyType.IS_ANSWERED:
            if (argument.length > 0) throw new Error('Is answered dependency must not have an argument.');
            break;
        default:
            throw new Error('Invalid dependency type.');
    }
};

const dropSensitiveFields = (protocol: any) => {
    const filteredProtocol = { ...protocol };
    delete filteredProtocol.managers;
    delete filteredProtocol.appliers;
    delete filteredProtocol.viewersUser;
    delete filteredProtocol.viewersClassroom;
    delete filteredProtocol.answersViewersUser;
    delete filteredProtocol.answersViewersClassroom;
    return filteredProtocol;
};

const fields = {
    id: true,
    title: true,
    description: true,
    createdAt: true,
    updatedAt: true,
    enabled: true,
    replicable: true,
    creator: { select: { id: true, username: true, institutionId: true } },
    applicability: true,
    visibility: true,
    answersVisibility: true,
    managers: { select: { id: true } },
    appliers: { select: { id: true } },
    viewersUser: { select: { id: true } },
    viewersClassroom: { select: { users: { select: { id: true } } } },
    answersViewersUser: { select: { id: true } },
    answersViewersClassroom: { select: { users: { select: { id: true } } } },
    pages: {
        orderBy: { placement: 'asc' as any },
        select: {
            id: true,
            type: true,
            placement: true,
            itemGroups: {
                orderBy: { placement: 'asc' as any },
                select: {
                    id: true,
                    type: true,
                    placement: true,
                    isRepeatable: true,
                    items: {
                        orderBy: { placement: 'asc' as any },
                        select: {
                            id: true,
                            text: true,
                            description: true,
                            type: true,
                            placement: true,
                            enabled: true,
                            itemOptions: {
                                orderBy: { placement: 'asc' as any },
                                select: { id: true, text: true, placement: true, files: { select: { id: true, path: true } } },
                            },
                            files: { select: { id: true, path: true, description: true } },
                            itemValidations: { select: { type: true, argument: true, customMessage: true } },
                        },
                    },
                    tableColumns: { select: { id: true, text: true, placement: true } },
                    dependencies: { select: { type: true, argument: true, customMessage: true, itemId: true } },
                },
            },
            dependencies: { select: { type: true, argument: true, customMessage: true, itemId: true } },
        },
    },
};

const fieldsWViewers = {
    ...fields,
    managers: { select: { id: true, username: true } },
    viewersUser: { select: { id: true, username: true, classrooms: { select: { id: true, name: true } } } },
    viewersClassroom: { select: { id: true, name: true, users: { select: { id: true, username: true } } } },
    answersViewersUser: { select: { id: true, username: true, classrooms: { select: { id: true, name: true } } } },
    answersViewersClassroom: { select: { id: true, name: true, users: { select: { id: true, username: true } } } },
    appliers: { select: { id: true, username: true } },
};

const fieldsWAnswers = {
    id: true,
    title: true,
    description: true,
    createdAt: true,
    updatedAt: true,
    enabled: true,
    replicable: true,
    creator: { select: { id: true, username: true, institutionId: true } },
    applicability: true,
    visibility: true,
    answersVisibility: true,
    managers: { select: { id: true, username: true, institutionId: true } },
    pages: {
        orderBy: { placement: 'asc' as any },
        select: {
            id: true,
            type: true,
            placement: true,
            itemGroups: {
                orderBy: { placement: 'asc' as any },
                select: {
                    id: true,
                    type: true,
                    placement: true,
                    isRepeatable: true,
                    items: {
                        orderBy: { placement: 'asc' as any },
                        select: {
                            id: true,
                            text: true,
                            description: true,
                            type: true,
                            placement: true,
                            enabled: true,
                            itemOptions: {
                                orderBy: { placement: 'asc' as any },
                                select: {
                                    id: true,
                                    text: true,
                                    placement: true,
                                    files: { select: { id: true, path: true } },
                                    optionAnswers: {
                                        select: {
                                            id: true,
                                            text: true,
                                            group: {
                                                select: { id: true, applicationAnswer: { select: { id: true, userId: true } } },
                                            },
                                        },
                                    },
                                },
                            },
                            files: { select: { id: true, path: true, description: true } },
                            itemValidations: { select: { type: true, argument: true, customMessage: true } },
                            itemAnswers: {
                                select: {
                                    id: true,
                                    text: true,
                                    files: { select: { id: true, path: true } },
                                    group: { select: { id: true, applicationAnswer: { select: { id: true, userId: true } } } },
                                },
                            },
                            tableAnswers: {
                                select: {
                                    id: true,
                                    text: true,
                                    columnId: true,
                                    group: { select: { id: true, applicationAnswer: { select: { id: true, userId: true } } } },
                                },
                            },
                        },
                    },
                    tableColumns: { select: { id: true, text: true, placement: true } },
                    dependencies: { select: { type: true, argument: true, customMessage: true, itemId: true } },
                },
            },
            dependencies: { select: { type: true, argument: true, customMessage: true, itemId: true } },
        },
    },
    applications: {
        select: {
            id: true,
            applier: { select: { id: true, username: true, institutionId: true } },
            createdAt: true,
            answers: {
                select: {
                    id: true,
                    user: { select: { id: true, username: true } },
                    date: true,
                    approved: true,
                    coordinate: { select: { latitude: true, longitude: true } },
                },
            },
        },
    },
};

export const createProtocol = async (req: Request, res: Response, next: any) => {
    try {
        // Yup schemas
        const fileSchema = yup
            .object()
            .shape({ description: yup.string().max(20000) })
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
                argument: yup.string(),
                customMessage: yup.string(),
                itemTempId: yup.number().min(1).required(),
            })
            .noUnknown();

        const itemsSchema = yup
            .object()
            .shape({
                tempId: yup.number().min(1).required(),
                text: yup.string().min(3).max(20000).required(),
                description: yup.string().max(20000),
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
                description: yup.string().max(20000),
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
        const protocol = await createProtocolSchema.validate(req.body, { stripUnknown: false });
        // Sort elements by placement
        for (const page of protocol.pages) {
            page.itemGroups.sort((a, b) => a.placement - b.placement);
            for (const itemGroup of page.itemGroups) {
                for (const item of itemGroup.items) {
                    item.itemOptions.sort((a, b) => a.placement - b.placement);
                }
                itemGroup.items.sort((a, b) => a.placement - b.placement);
                itemGroup.tableColumns.sort((a, b) => a.placement - b.placement);
            }
        }
        protocol.pages.sort((a, b) => a.placement - b.placement);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to create a application
        await checkAuthorization(user, undefined, 'create');
        // Check if managers are publishers, coordinators or admins of the same institution
        await validateManagers(protocol.managers as number[], user.institutionId);
        // Check if viewers are not guests or admins
        await validadeViewers(protocol.viewersUser as number[]);
        await validadeViewers(protocol.answersViewersUser as number[]);
        // Check if appliers are publishers, coordinators or appliers
        await validateAppliers(protocol.appliers as number[]);
        // Check if protocol placements are valid
        await validateProtocolPlacements(protocol);
        // Check if dependencies are valid
        await validateDependencies(protocol);
        // Multer files
        const files = req.files as Express.Multer.File[];
        // Create map table for tempIds
        const tempIdMap = new Map<number, number>();
        // Prisma transaction
        const createdProtocol = await prismaClient.$transaction(async (prisma) => {
            const createdProtocol = await prisma.protocol.create({
                data: {
                    title: protocol.title,
                    description: protocol.description,
                    enabled: protocol.enabled,
                    creatorId: user.id,
                    managers: { connect: protocol.managers.map((manager) => ({ id: manager })) },
                    visibility: protocol.visibility as VisibilityMode,
                    applicability: protocol.applicability as VisibilityMode,
                    answersVisibility: protocol.answersVisibility as VisibilityMode,
                    viewersUser: { connect: protocol.viewersUser.map((viewer) => ({ id: viewer })) },
                    viewersClassroom: { connect: protocol.viewersClassroom.map((viewer) => ({ id: viewer })) },
                    answersViewersUser: { connect: protocol.answersViewersUser.map((viewer) => ({ id: viewer })) },
                    answersViewersClassroom: { connect: protocol.answersViewersClassroom.map((viewer) => ({ id: viewer })) },
                    appliers: { connect: protocol.appliers.map((applier) => ({ id: applier })) },
                    replicable: protocol.replicable,
                },
            });
            // Create nested pages as well as nested itemGroups, items, itemOptions and itemValidations
            for (const [pageId, page] of protocol.pages.entries()) {
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
                        // Validate dependency type and argument
                        await validateDependency(dependency.type, dependency.argument);
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
                    // Validate dependency type and argument
                    await validateDependency(dependency.type, dependency.argument);
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

            // Return the created application answer with nested content included
            return await prisma.protocol.findUnique({ where: { id: createdProtocol.id }, select: fieldsWViewers });
        });
        // Embed user actions in the response
        const processedProtocol = { ...createdProtocol, actions: await getProtocolUserActions(user, createdProtocol, undefined) };
        // Filter sensitive fields
        const filteredProtocol = dropSensitiveFields(processedProtocol);

        res.locals.type = EventType.ACTION;
        res.locals.message = 'Protocol created.';
        res.status(201).json({ message: res.locals.message, data: filteredProtocol });
    } catch (error: any) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) if (existsSync(file.path)) unlinkSync(file.path);
        next(error);
    }
};

export const updateProtocol = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.protocolId);
        // Yup schemas
        const updateFileSchema = yup
            .object()
            .shape({ id: yup.number().min(1), description: yup.string().max(20000) })
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
                argument: yup.string(),
                customMessage: yup.string(),
                itemTempId: yup.number().min(1).required(),
            })
            .noUnknown();

        const updateItemsSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                tempId: yup.number().min(1).required(),
                text: yup.string().min(3).max(20000),
                description: yup.string().max(20000),
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
                description: yup.string().max(20000),
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
        const protocol = await updateProtocolSchema.validate(req.body, { stripUnknown: false });
        // Sort elements by placement
        for (const page of protocol.pages) {
            page.itemGroups.sort((a, b) => a.placement - b.placement);
            for (const itemGroup of page.itemGroups) {
                for (const item of itemGroup.items) {
                    item.itemOptions.sort((a, b) => a.placement - b.placement);
                }
                itemGroup.items.sort((a, b) => a.placement - b.placement);
                itemGroup.tableColumns.sort((a, b) => a.placement - b.placement);
            }
        }
        protocol.pages.sort((a, b) => a.placement - b.placement);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is included in the managers, or if user is admin
        await checkAuthorization(user, id, 'update');
        // Check if managers are publishers, coordinators or admins of the same institution
        await validateManagers(protocol.managers as number[], user.institutionId);
        // Check if viewers are not guests or admins
        await validadeViewers(protocol.viewersUser as number[]);
        await validadeViewers(protocol.answersViewersUser as number[]);
        // Check if appliers are publishers, coordinators or appliers
        await validateAppliers(protocol.appliers as number[]);
        // Check if protocol placements are valid
        await validateProtocolPlacements(protocol);
        // Check if dependencies are valid
        await validateDependencies(protocol);
        //Multer files
        const files = req.files as Express.Multer.File[];
        // Create map table for tempIds
        const tempIdMap = new Map<number, number>();
        // Prisma transaction
        const upsertedProtocol = await prismaClient.$transaction(async (prisma) => {
            // Update protocol
            await prisma.protocol.update({
                where: { id: id },
                data: {
                    title: protocol.title,
                    description: protocol.description,
                    enabled: protocol.enabled,
                    managers: { set: [], connect: protocol.managers.map((manager) => ({ id: manager })) },
                    visibility: protocol.visibility as VisibilityMode,
                    applicability: protocol.applicability as VisibilityMode,
                    answersVisibility: protocol.answersVisibility as VisibilityMode,
                    viewersUser: { set: [], connect: protocol.viewersUser.map((viewer) => ({ id: viewer })) },
                    viewersClassroom: { set: [], connect: protocol.viewersClassroom.map((viewer) => ({ id: viewer })) },
                    answersViewersUser: { set: [], connect: protocol.answersViewersUser.map((viewer) => ({ id: viewer })) },
                    answersViewersClassroom: { set: [], connect: protocol.answersViewersClassroom.map((viewer) => ({ id: viewer })) },
                    appliers: { set: [], connect: protocol.appliers.map((applier) => ({ id: applier })) },
                    replicable: protocol.replicable,
                },
            });
            // Update existing pages or create new ones
            const pagesIds = [];
            const itemGroupsIds = [];
            const itemsIds = [];
            const tableColumnsIds = [];
            for (const [pageId, page] of protocol.pages.entries()) {
                const upsertedPage = page.id
                    ? await prisma.page.update({
                          where: { id: page.id, protocolId: id },
                          data: { placement: page.placement, type: page.type },
                      })
                    : await prisma.page.create({
                          data: {
                              protocolId: id as number,
                              placement: page.placement as number,
                              type: page.type as PageType,
                          },
                      });
                pagesIds.push(upsertedPage.id);
                // Update existing itemGroups or create new ones
                for (const [itemGroupId, itemGroup] of page.itemGroups.entries()) {
                    validateItemGroup(itemGroup.type, itemGroup.items.length, itemGroup.tableColumns.length);

                    const upsertedItemGroup = itemGroup.id
                        ? await prisma.itemGroup.update({
                              where: { id: itemGroup.id, page: { protocolId: id } },
                              data: {
                                  placement: itemGroup.placement,
                                  isRepeatable: itemGroup.isRepeatable,
                                  type: itemGroup.type,
                                  pageId: upsertedPage.id,
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
                    itemGroupsIds.push(upsertedItemGroup.id);
                    // Update existing tableColumns or create new ones
                    for (const [tableColumnId, tableColumn] of itemGroup.tableColumns.entries()) {
                        const upsertedTableColumn = tableColumn.id
                            ? await prisma.tableColumn.update({
                                  where: { itemGroup: { page: { protocolId: id } }, id: tableColumn.id },
                                  data: { text: tableColumn.text, placement: tableColumn.placement, groupId: upsertedItemGroup.id },
                              })
                            : await prisma.tableColumn.create({
                                  data: {
                                      text: tableColumn.text as string,
                                      placement: tableColumn.placement as number,
                                      groupId: upsertedItemGroup.id as number,
                                  },
                              });
                        tableColumnsIds.push(upsertedTableColumn.id);
                    }
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
                                      itemGroup: { page: { protocolId: id } },
                                  },
                                  data: {
                                      text: item.text,
                                      description: item.description,
                                      enabled: item.enabled,
                                      type: item.type,
                                      placement: item.placement,
                                      groupId: upsertedItemGroup.id,
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
                        itemsIds.push(upsertedItem.id);
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
                        // Validate dependency type and argument
                        await validateDependency(dependency.type, dependency.argument);
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
                    // Validate dependency type and argument
                    await validateDependency(dependency.type, dependency.argument);
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
            // Remove pages that are not in the updated protocol
            await prisma.page.deleteMany({
                where: { id: { notIn: pagesIds }, protocolId: id },
            });
            // Remove itemGroups that are not in the updated page
            await prisma.itemGroup.deleteMany({
                where: { id: { notIn: itemGroupsIds }, page: { protocolId: id } },
            });
            // Remove tableColumns that are not in the updated itemGroup
            await prisma.tableColumn.deleteMany({
                where: { id: { notIn: tableColumnsIds }, itemGroup: { page: { protocolId: id } } },
            });
            // Remove items that are not in the updated itemGroup
            await prisma.item.deleteMany({
                where: { id: { notIn: itemsIds }, itemGroup: { page: { protocolId: id } } },
            });
            // Check if there are any files left
            if (files.length > 0) {
                throw new Error('Files not associated with any item or option detected.');
            }

            // Return the updated application answer with nested content included
            return await prisma.protocol.findUnique({ where: { id: id }, select: fieldsWViewers });
        });

        // Embed user actions in the response
        const processedProtocol = { ...upsertedProtocol, actions: await getProtocolUserActions(user, upsertedProtocol, undefined) };
        // Filter sensitive fields
        const filteredProtocol = dropSensitiveFields(processedProtocol);

        res.locals.type = EventType.ACTION;
        res.locals.message = 'Protocol updated.';
        res.status(200).json({ message: res.locals.message, data: filteredProtocol });
    } catch (error: any) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) if (existsSync(file.path)) unlinkSync(file.path);
        next(error);
    }
};

export const getAllProtocols = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to get all protocols
        await checkAuthorization(user, undefined, 'getAll');
        // Prisma operation
        const protocol = await prismaClient.protocol.findMany({ select: fieldsWViewers });
        // Embed user actions in the response
        const processedProtocol = await Promise.all(
            protocol.map(async (protocol) => ({
                ...protocol,
                actions: await getProtocolUserActions(user, protocol, undefined),
            }))
        );
        // Filter sensitive fields
        const filteredProtocol = processedProtocol.map((protocol) => dropSensitiveFields(protocol));

        res.status(200).json({ message: 'All protocols found.', data: filteredProtocol });
    } catch (error: any) {
        next(error);
    }
};

export const getVisibleProtocols = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to get visible protocols
        await checkAuthorization(user, undefined, 'getVisible');
        // Prisma operation
        const protocols =
            user.role === UserRole.ADMIN
                ? await prismaClient.protocol.findMany({ select: fieldsWViewers })
                : await prismaClient.protocol.findMany({
                      where: {
                          OR: [
                              { managers: { some: { id: user.id } } },
                              { appliers: { some: { id: user.id } }, enabled: true },
                              { viewersUser: { some: { id: user.id } }, enabled: true },
                              { viewersClassroom: { some: { users: { some: { id: user.id } } } }, enabled: true },
                              { creatorId: user.id },
                              { visibility: VisibilityMode.PUBLIC, enabled: true },
                              ...(user.role === UserRole.COORDINATOR ? [{ creator: { institutionId: user.institutionId } }] : []),
                          ],
                      },
                      select: fields,
                  });

        // Embed user actions in the response
        const processedProtocols = await Promise.all(
            protocols.map(async (protocol) => ({
                ...protocol,
                actions: await getProtocolUserActions(user, protocol, undefined),
            }))
        );
        // Filter sensitive fields
        const filteredProtocols = processedProtocols.map((protocol) => dropSensitiveFields(protocol));

        res.status(200).json({ message: 'Visible protocols found.', data: filteredProtocols });
    } catch (error: any) {
        next(error);
    }
};

export const getMyProtocols = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Prisma operation
        const protocols = await prismaClient.protocol.findMany({
            where: { OR: [{ managers: { some: { id: user.id } } }, { creatorId: user.id }] },
            select: fieldsWViewers,
        });
        // Embed user actions in the response
        const processedProtocols = await Promise.all(
            protocols.map(async (protocol) => ({
                ...protocol,
                actions: await getProtocolUserActions(user, protocol, undefined),
            }))
        );
        // Filter sensitive fields
        const filteredProtocols = processedProtocols.map((protocol) => dropSensitiveFields(protocol));

        res.status(200).json({ message: 'My protocols found.', data: filteredProtocols });
    } catch (error: any) {
        next(error);
    }
};

export const getProtocol = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        // ID from params
        const protocolId: number = parseInt(req.params.protocolId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to get the protocol
        await checkAuthorization(user, protocolId, 'get');
        // Get protocol with nested content included
        const protocol = await prismaClient.protocol.findUniqueOrThrow({
            where: {
                id: protocolId,
                OR: [
                    { managers: { some: { id: user.id } } },
                    { appliers: { some: { id: user.id } }, enabled: true },
                    { viewersUser: { some: { id: user.id } }, enabled: true },
                    { viewersClassroom: { some: { users: { some: { id: user.id } } } }, enabled: true },
                    { creatorId: user.id },
                    { visibility: VisibilityMode.PUBLIC, enabled: true },
                    ...(user.role === UserRole.COORDINATOR ? [{ creator: { institutionId: user.institutionId } }] : []),
                ],
            },
            select: fieldsWViewers,
        });

        const processedProtocol = { ...protocol, actions: await getProtocolUserActions(user, protocol, undefined) };

        const filteredProtocol =
            (user.role !== UserRole.USER &&
                (user.role === UserRole.ADMIN ||
                    processedProtocol.creator.id === user.id ||
                    processedProtocol.managers?.some((manager) => manager.id === user.id) ||
                    processedProtocol.appliers?.some((applier) => applier.id === user.id) ||
                    processedProtocol.applicability === VisibilityMode.PUBLIC)) ||
            (user.role === UserRole.COORDINATOR && processedProtocol.creator.institutionId === user.id)
                ? processedProtocol
                : {
                      ...processedProtocol,
                      viewersUser: undefined,
                      viewersClassroom: undefined,
                      answersViewersUser: undefined,
                      answersViewersClassroom: undefined,
                      appliers: undefined,
                      managers: undefined,
                  };

        res.status(200).json({ message: 'Protocol found.', data: filteredProtocol });
    } catch (error: any) {
        next(error);
    }
};

export const getProtocolWithAnswers = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        // ID from params
        const protocolId: number = parseInt(req.params.protocolId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to get the protocol
        await checkAuthorization(user, protocolId, 'getWAnswers');
        // Get protocol with nested content included
        const protocol = await prismaClient.protocol.findUniqueOrThrow({
            where: {
                id: protocolId,
                OR: [
                    { managers: { some: { id: user.id } } },
                    { answersViewersUser: { some: { id: user.id } }, enabled: true },
                    { answersViewersClassroom: { some: { users: { some: { id: user.id } } } }, enabled: true },
                    { creatorId: user.id },
                    { answersVisibility: VisibilityMode.PUBLIC, enabled: true },
                    ...(user.role === UserRole.COORDINATOR ? [{ creator: { institutionId: user.institutionId } }] : []),
                ],
            },
            select: fieldsWAnswers,
        });

        // Filter unapproved answers if user is not allowed to see/approve them
        for (const application of protocol.applications) {
            if (
                user.role !== UserRole.ADMIN &&
                (user.id !== protocol.creator.id ||
                    !protocol.managers?.some((manager) => manager.id === user.id) ||
                    user.id !== application.applier.id ||
                    user.institutionId !== application.applier.institutionId ||
                    user.institutionId !== protocol.creator.institutionId ||
                    user.role === UserRole.USER ||
                    user.role === UserRole.GUEST)
            ) {
                application.answers = application.answers.filter((answer: any) => answer.approved);
            }
        }

        // Filter answers that are not visible to the user (the ones associated with the applications filtered above)
        for (const page of protocol.pages) {
            for (const itemGroup of page.itemGroups) {
                for (const item of itemGroup.items) {
                    item.itemAnswers = item.itemAnswers.filter(
                        (itemAnswer) =>
                            protocol.applications?.some(
                                (application) => application.answers?.some((answer) => answer.id === itemAnswer.group.applicationAnswer.id)
                            )
                    );
                    item.tableAnswers = item.tableAnswers.filter(
                        (tableAnswer) =>
                            protocol.applications?.some(
                                (application) => application.answers?.some((answer) => answer.id === tableAnswer.group.applicationAnswer.id)
                            )
                    );
                    for (const itemOption of item.itemOptions) {
                        itemOption.optionAnswers = itemOption.optionAnswers.filter(
                            (optionAnswer) =>
                                protocol.applications?.some(
                                    (application) =>
                                        application.answers?.some((answer) => answer.id === optionAnswer.group.applicationAnswer.id)
                                )
                        );
                    }
                }
            }
        }
        // Embed user actions in the response
        const processedProtocol = {
            ...protocol,
            actions: await getProtocolUserActions(user, protocol, undefined),
            applications: await Promise.all(
                protocol.applications.map((application) => ({
                    ...application,
                    actions: getApplicationUserActions(user, application, undefined),
                }))
            ),
        };
        // Filter other properties that are not visible to the user
        processedProtocol.managers = [];
        processedProtocol.creator.institutionId = null;
        for (const application of processedProtocol.applications) {
            application.applier.institutionId = null;
        }

        res.status(200).json({ message: 'Protocol with answers found.', data: processedProtocol });
    } catch (error: any) {
        next(error);
    }
};

export const deleteProtocol = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.protocolId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to delete the protocol
        await checkAuthorization(user, id, 'delete');
        // Delete protocol
        const deletedProtocol = await prismaClient.protocol.delete({ where: { id }, select: { id: true } });

        res.locals.type = EventType.ACTION;
        res.locals.message = 'Protocol deleted.';
        res.status(200).json({ message: res.locals.message, data: deletedProtocol });
    } catch (error: any) {
        next(error);
    }
};
