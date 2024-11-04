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

const checkAuthorization = async (user: User, protocolId: number | undefined, action: string) => {
    switch (action) {
        case 'create':
            // Only publishers, coordinators and admins can perform create operations on protocols
            if (user.role === UserRole.USER || user.role === UserRole.APPLIER)
                throw new Error('This user is not authorized to perform this action.');
            break;
        case 'update':
        case 'delete':
            // Only admins, the creator or the managers of the protocol can perform update/delete operations on it
            if (user.role !== UserRole.ADMIN) {
                const protocol = await prismaClient.protocol.findUnique({
                    where: { id: protocolId, OR: [{ managers: { some: { id: user.id } } }, { creatorId: user.id }] },
                });
                if (!protocol) throw new Error('This user is not authorized to perform this action.');
            }
            break;
        case 'getAll':
            // Only admins can perform getAll operations on protocols
            if (user.role !== UserRole.ADMIN) throw new Error('This user is not authorized to perform this action.');
            break;
        case 'getVisible':
            // All users can perform getVisible operations on protocols (the result will be filtered based on the user)
            break;
        case 'get':
            // Only admins, the creator, the managers, the appliers or the viewers of the protocol can perform get operations on it
            if (user.role !== UserRole.ADMIN) {
                const protocol = await prismaClient.protocol.findUnique({
                    where: {
                        id: protocolId,
                        OR: [
                            { managers: { some: { id: user.id } } },
                            { appliers: { some: { id: user.id } } },
                            { viewersUser: { some: { id: user.id } } },
                            { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                            { creatorId: user.id },
                            { visibility: VisibilityMode.PUBLIC },
                        ],
                    },
                });
                if (!protocol) throw new Error('This user is not authorized to perform this action.');
            }
            break;
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

const validateManagers = async (managers: (number | undefined)[], institutionId: number | null) => {
    for (const manager of managers) {
        const user = await prismaClient.user.findUnique({
            where: {
                id: manager,
                institutionId: institutionId,
                role: { in: [UserRole.PUBLISHER, UserRole.COORDINATOR, UserRole.ADMIN] },
            },
        });
        if (!user || !institutionId) throw new Error('Managers must be publishers, coordinators or admins of the same institution.');
    }
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

const fields = {
    id: true,
    title: true,
    description: true,
    createdAt: true,
    updatedAt: true,
    enabled: true,
    replicable: true,
    creator: { select: { id: true, username: true } },
    applicability: true,
    visibility: true,
    answersVisibility: true,
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

export const createProtocol = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const fileSchema = yup
            .object()
            .shape({ description: yup.string().max(3000), path: yup.string().required() })
            .noUnknown();

        const tableColumnSchema = yup
            .object()
            .shape({ text: yup.string().min(3).max(255).required(), placement: yup.number().min(1).required() })
            .noUnknown();

        const itemOptionsSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
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
                title: yup.string().min(3).max(3000).required(),
                description: yup.string().max(3000),
                enabled: yup.boolean().required(),
                pages: yup.array().of(pagesSchema).min(1).required(),
                managers: yup.array().of(yup.number()).default([]),
                visibility: yup.mixed<VisibilityMode>().oneOf(Object.values(VisibilityMode)).required(),
                creatorId: yup.number().required(),
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
        const protocol = await createProtocolSchema.validate(req.body, { stripUnknown: true });
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
        await validateManagers(protocol.managers, user.institutionId);
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
                    creatorId: protocol.creatorId,
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
                                (f) => f.fieldname === `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][files][${fileIndex}]`
                            );
                            if (!storedFile) throw new Error('File not found.');
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
                                        `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][itemOptions][${itemOptionId}][files][${fileIndex}]`
                                );
                                if (!storedFile) throw new Error('File not found.');
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

            // Return the created application answer with nested content included
            return await prisma.protocol.findUnique({ where: { id: createdProtocol.id }, select: fieldsWViewers });
        });
        res.status(201).json({ message: 'Protocol created.', data: createdProtocol });
    } catch (error: any) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) if (existsSync(file.path)) unlinkSync(file.path);
        res.status(400).json(errorFormatter(error));
    }
};

export const updateProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.protocolId);
        // Yup schemas
        const updateFileSchema = yup
            .object()
            .shape({ id: yup.number().min(1), description: yup.string().max(3000), path: yup.string().required() })
            .noUnknown();

        const updateTableColumnSchema = yup
            .object()
            .shape({ id: yup.number().min(1), text: yup.string().min(3).max(255), placement: yup.number().min(1).required() })
            .noUnknown();

        const updateItemOptionsSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                text: yup.string().min(3).max(255),
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
                title: yup.string().min(3).max(3000),
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
        const protocol = await updateProtocolSchema.validate(req.body, { stripUnknown: true });
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
        await validateManagers(protocol.managers, user.institutionId);
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
            // Remove pages that are not in the updated protocol
            await prisma.page.deleteMany({
                where: {
                    id: { notIn: protocol.pages.filter((page) => page.id).map((page) => page.id as number) },
                    protocolId: id,
                },
            });
            // Update existing pages or create new ones
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
                            where: { id: { notIn: item.files.map((file) => file.id as number) }, itemId: upsertedItem.id },
                            select: { id: true, path: true },
                        });
                        for (const file of filesToDelete) if (existsSync(file.path)) unlinkSync(file.path);
                        await prisma.file.deleteMany({ where: { id: { in: filesToDelete.map((file) => file.id) } } });
                        const itemFiles = item.files.map((file, fileIndex) => {
                            const storedFile = files.find(
                                (f) => f.fieldname === `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][files][${fileIndex}]`
                            );
                            if (!storedFile) throw new Error('File not found.');
                            return {
                                description: file.description,
                                path: storedFile.path,
                                itemId: upsertedItem.id,
                            };
                        });

                        // Create new files (updating files is not supported)
                        await prisma.file.createMany({ data: itemFiles });
                        // Remove itemOptions that are not in the updated item
                        await prisma.itemOption.deleteMany({
                            where: {
                                id: {
                                    notIn: item.itemOptions.filter((itemOption) => item.id).map((itemOption) => itemOption.id as number),
                                },
                                itemId: upsertedItem.id,
                            },
                        });
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
                                    id: { notIn: itemOption.files.map((file) => file.id as number) },
                                    itemOptionId: upsertedItemOption.id,
                                },
                                select: { id: true, path: true },
                            });
                            for (const file of filesToDelete) if (existsSync(file.path)) unlinkSync(file.path);
                            await prisma.file.deleteMany({ where: { id: { in: filesToDelete.map((file) => file.id) } } });
                            const itemOptionFiles = itemOption.files.map((file, fileIndex) => {
                                const storedFile = files.find(
                                    (f) =>
                                        f.fieldname ===
                                        `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][itemOptions][${itemOptionId}][files][${fileIndex}]`
                                );
                                if (!storedFile) throw new Error('File not found.');
                                return {
                                    description: file.description,
                                    path: storedFile.path,
                                    itemOptionId: upsertedItemOption.id,
                                };
                            });

                            // Create new files (updating files is not supported)
                            await prisma.file.createMany({ data: itemOptionFiles });
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

            // Return the updated application answer with nested content included
            return await prisma.protocol.findUnique({ where: { id: id }, select: fieldsWViewers });
        });

        res.status(200).json({ message: 'Protocol updated.', data: upsertedProtocol });
    } catch (error: any) {
        const files = req.files as Express.Multer.File[];
        for (const file of files) if (existsSync(file.path)) unlinkSync(file.path);
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllProtocols = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to get all protocols
        await checkAuthorization(user, undefined, 'getAll');
        // Prisma operation
        const protocol = await prismaClient.protocol.findMany({ select: fieldsWViewers });

        res.status(200).json({ message: 'All protocols found.', data: protocol });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getVisibleProtocols = async (req: Request, res: Response): Promise<void> => {
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
                              { appliers: { some: { id: user.id } } },
                              { viewersUser: { some: { id: user.id } } },
                              { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                              { creatorId: user.id },
                              { visibility: VisibilityMode.PUBLIC },
                          ],
                          enabled: true,
                      },
                      select: fields,
                  });

        res.status(200).json({ message: 'Visible protocols found.', data: protocols });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getMyProtocols = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Prisma operation
        const protocols = await prismaClient.protocol.findMany({
            where: { OR: [{ managers: { some: { id: user.id } }, creatorId: user.id }] },
            select: fieldsWViewers,
        });

        res.status(200).json({ message: 'My protocols found.', data: protocols });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getProtocol = async (req: Request, res: Response): Promise<void> => {
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
                ],
            },
            select: fieldsWViewers,
        });

        const visibleProtocol =
            user.role !== UserRole.USER &&
            (user.role === UserRole.ADMIN ||
                protocol.creator.id === user.id ||
                protocol.managers.some((manager) => manager.id === user.id) ||
                protocol.appliers.some((applier) => applier.id === user.id) ||
                protocol.applicability === VisibilityMode.PUBLIC)
                ? protocol
                : {
                      ...protocol,
                      viewersUser: undefined,
                      viewersClassroom: undefined,
                      answersViewersUser: undefined,
                      answersViewersClassroom: undefined,
                      appliers: undefined,
                      managers: undefined,
                  };

        res.status(200).json({ message: 'Protocol found.', data: visibleProtocol });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.protocolId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to delete the protocol
        await checkAuthorization(user, id, 'delete');
        // Delete protocol
        const deletedProtocol = await prismaClient.protocol.delete({ where: { id }, select: { id: true } });

        res.status(200).json({ message: 'Protocol deleted.', data: deletedProtocol });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
