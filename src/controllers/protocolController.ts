import { Response, Request } from 'express';
import { ItemType, ItemGroupType, PageType, ItemValidationType, User, UserRole, VisibilityMode } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

const checkAuthorization = async (user: User, protocolId: number | undefined, action: string) => {
    switch (action) {
        case 'create':
            // Only publishers, coordinators and admins can perform create operations on protocols
            if (user.role === UserRole.USER || user.role === UserRole.APPLIER)
                throw new Error('This user is not authorized to perform this action.');
            break;
        case 'update':
        case 'delete':
            // Only admins, the creator or the owners of the protocol can perform update/delete operations on it
            if (user.role !== UserRole.ADMIN) {
                const protocol = await prismaClient.protocol.findUnique({
                    where: { id: protocolId, OR: [{ owners: { some: { id: user.id } } }, { creatorId: user.id }] },
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
            // Only admins, the creator, the owners, the appliers or the viewers of the protocol can perform get operations on it
            if (user.role !== UserRole.ADMIN) {
                const protocol = await prismaClient.protocol.findUnique({
                    where: {
                        id: protocolId,
                        OR: [
                            { owners: { some: { id: user.id } } },
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
        (type === ItemGroupType.TABLE && tableColumnsLength === 0) ||
        (type !== ItemGroupType.TABLE && tableColumnsLength > 0)
    )
        throw new Error('ItemGroup type does not match the amount of items or tableColumns.');
};

const validateOwners = async (owners: (number | undefined)[], institutionId: number | null) => {
    for (const owner of owners) {
        const user = await prismaClient.user.findUnique({
            where: {
                id: owner,
                institutionId: institutionId,
                role: {
                    in: [UserRole.PUBLISHER, UserRole.COORDINATOR, UserRole.ADMIN],
                },
            },
        });
        if (!user || !institutionId) throw new Error('Owners must be publishers, coordinators or admins of the same institution.');
    }
};

const validateProtocolPlacements = async (protocol: any) => {
    const pagesPlacements = [];
    const itemGroupsPlacements = [];
    const itemsPlacements = [];
    const itemOptionsPlacements = [];
    const tableColumnsPlacements = [];
    for (const page of protocol.pages) {
        pagesPlacements.push(page.placement);
        for (const itemGroup of page.itemGroups) {
            itemGroupsPlacements.push(itemGroup.placement);
            for (const item of itemGroup.items) {
                itemsPlacements.push(item.placement);
                for (const itemOption of item.itemOptions) {
                    itemOptionsPlacements.push(itemOption.placement);
                }
            }
            for (const tableColumn of itemGroup.tableColumns) {
                tableColumnsPlacements.push(tableColumn.placement);
            }
        }
    }
    await validatePlacements(pagesPlacements);
    await validatePlacements(itemGroupsPlacements);
    await validatePlacements(itemsPlacements);
    await validatePlacements(itemOptionsPlacements);
    await validatePlacements(tableColumnsPlacements);
};

const validatePlacements = async (placements: number[]) => {
    const placementSet = new Set<number>(placements);
    placements.sort((a, b) => a - b);
    if (placementSet.size !== placements.length || placements[0] !== 1 || placements[placements.length - 1] !== placements.length)
        throw new Error('Invalid placement values: must be unique, consecutive and start from 1.');
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
                            itemOptions: { orderBy: { placement: 'asc' as any }, select: { id: true, text: true, placement: true } },
                            files: { select: { id: true, path: true } },
                        },
                    },
                    tableColumns: { select: { id: true, text: true, placement: true } },
                },
            },
        },
    },
};

const fieldsWViewers = {
    ...fields,
    owners: { select: { id: true, username: true } },
    viewersUser: { select: { id: true, username: true } },
    viewersClassroom: { select: { id: true, name: true } },
    answersViewersUser: { select: { id: true, username: true } },
    answersViewersClassroom: { select: { id: true, name: true } },
    appliers: { select: { id: true, username: true } },
};

export const createProtocol = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const tableColumnSchema = yup
            .object()
            .shape({ text: yup.string().min(3).max(255).required(), placement: yup.number().min(1).required() })
            .noUnknown();

        const itemOptionsSchema = yup
            .object()
            .shape({ text: yup.string().min(3).max(255).required(), placement: yup.number().min(1).required() })
            .noUnknown();

        const itemValidationsSchema = yup
            .object()
            .shape({
                type: yup.mixed<ItemValidationType>().oneOf(Object.values(ItemValidationType)).required(),
                argument: yup.string().required(),
                customMessage: yup.string().required(),
            })
            .noUnknown();

        const itemsSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(3000).required(),
                description: yup.string().max(3000),
                enabled: yup.boolean().required(),
                type: yup.mixed<ItemType>().oneOf(Object.values(ItemType)).required(),
                placement: yup.number().min(1).required(),
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
                tableColumns: yup.array().of(tableColumnSchema).default([]),
            })
            .noUnknown();

        const pagesSchema = yup
            .object()
            .shape({
                placement: yup.number().min(1).required(),
                type: yup.mixed<PageType>().oneOf(Object.values(PageType)).required(),
                itemGroups: yup.array().of(itemGroupsSchema).default([]),
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
                owners: yup.array().of(yup.number()).default([]),
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
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is allowed to create a application
        await checkAuthorization(user, undefined, 'create');
        // Check if owners are publishers, coordinators or admins of the same institution
        await validateOwners(protocol.owners, user.institutionId);
        // Check if protocol placements are valid
        await validateProtocolPlacements(protocol);
        // Multer files
        const files = req.files as Express.Multer.File[];
        // Prisma transaction
        const createdProtocol = await prismaClient.$transaction(async (prisma) => {
            const createdProtocol = await prisma.protocol.create({
                data: {
                    title: protocol.title,
                    description: protocol.description,
                    enabled: protocol.enabled,
                    creatorId: protocol.creatorId,
                    owners: { connect: protocol.owners.map((owner) => ({ id: owner })) },
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
                        await validateItem(item.type, item.itemOptions.length);
                        const itemFiles = files
                            .filter((file) =>
                                file.fieldname.startsWith(`pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][files]`)
                            )
                            .map((file) => ({ path: file.path }));
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
                        for (const [itemOptionId, itemOption] of item.itemOptions.entries()) {
                            const itemOptionFiles = files
                                .filter((file) =>
                                    file.fieldname.startsWith(
                                        `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][itemOptions][${itemOptionId}][files]`
                                    )
                                )
                                .map((file) => ({ path: file.path }));

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
                }
            }
            // Return the created application answer with nested content included
            return await prisma.protocol.findUnique({ where: { id: createdProtocol.id }, select: fieldsWViewers });
        });
        res.status(201).json({ message: 'Protocol created.', data: createdProtocol });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.protocolId);
        // Yup schemas
        const UpdatedTableColumnSchema = yup
            .object()
            .shape({ id: yup.number().min(1), text: yup.string().min(3).max(255), placement: yup.number().min(1).required() })
            .noUnknown();

        const updateItemOptionsSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                text: yup.string().min(3).max(255),
                placement: yup.number().min(1).required(),
                filesIds: yup.array().of(yup.number()).default([]),
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

        const updateItemsSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                text: yup.string().min(3).max(3000),
                description: yup.string().max(3000),
                enabled: yup.boolean(),
                type: yup.mixed<ItemType>().oneOf(Object.values(ItemType)).required(),
                placement: yup.number().min(1).required(),
                itemOptions: yup.array().of(updateItemOptionsSchema).default([]),
                itemValidations: yup.array().of(updateItemValidationsSchema).default([]),
                filesIds: yup.array().of(yup.number()).default([]),
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
                tableColumns: yup.array().of(UpdatedTableColumnSchema).default([]),
            })
            .noUnknown();

        const updatePagesSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                placement: yup.number().min(1).required(),
                type: yup.mixed<PageType>().oneOf(Object.values(PageType)).required(),
                itemGroups: yup.array().of(updateItemGroupsSchema).min(1).required(),
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
                owners: yup.array().of(yup.number()).default([]),
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
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is included in the owners, or if user is admin
        await checkAuthorization(user, id, 'update');
        // Check if owners are publishers, coordinators or admins of the same institution
        await validateOwners(protocol.owners, user.institutionId);
        // Check if protocol placements are valid
        await validateProtocolPlacements(protocol);
        //Multer files
        const files = req.files as Express.Multer.File[];
        // Prisma transaction
        const upsertedProtocol = await prismaClient.$transaction(async (prisma) => {
            // Update protocol
            await prisma.protocol.update({
                where: { id: id },
                data: {
                    title: protocol.title,
                    description: protocol.description,
                    enabled: protocol.enabled,
                    owners: { set: [], connect: protocol.owners.map((owner) => ({ id: owner })) },
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
                        // Remove files that are not in the updated item
                        await prisma.file.deleteMany({
                            where: { id: { notIn: item.filesIds as number[] }, itemId: upsertedItem.id },
                        });
                        const itemFiles = files
                            .filter((file) =>
                                file.fieldname.startsWith(`pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][files]`)
                            )
                            .map((file) => ({ path: file.path, itemId: upsertedItem.id }));

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
                            await prisma.file.deleteMany({
                                where: { id: { notIn: itemOption.filesIds as number[] }, itemOptionId: upsertedItemOption.id },
                            });
                            const itemOptionFiles = files
                                .filter((file) =>
                                    file.fieldname.startsWith(
                                        `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][itemOptions][${itemOptionId}][files]`
                                    )
                                )
                                .map((file) => ({ path: file.path, itemOptionId: upsertedItemOption.id }));
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
                }
            }
            // Return the updated application answer with nested content included
            return await prisma.protocol.findUnique({ where: { id: id }, select: fieldsWViewers });
        });
        res.status(200).json({ message: 'Protocol updated.', data: upsertedProtocol });
    } catch (error: any) {
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
                              { owners: { some: { id: user.id } } },
                              { appliers: { some: { id: user.id } } },
                              { viewersUser: { some: { id: user.id } } },
                              { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                              { creatorId: user.id },
                              { visibility: VisibilityMode.PUBLIC },
                          ],
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
            where: { OR: [{ owners: { some: { id: user.id } }, creatorId: user.id }] },
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
                    { owners: { some: { id: user.id } } },
                    { appliers: { some: { id: user.id } } },
                    { viewersUser: { some: { id: user.id } } },
                    { viewersClassroom: { some: { users: { some: { id: user.id } } } } },
                    { creatorId: user.id },
                    { visibility: VisibilityMode.PUBLIC },
                ],
            },
            select: fieldsWViewers,
        });

        const visibleProtocol =
            user.role === UserRole.ADMIN || protocol.creator.id === user.id || protocol.owners.some((owner) => owner.id === user.id)
                ? protocol
                : {
                      ...protocol,
                      viewersUser: undefined,
                      viewersClassroom: undefined,
                      answersViewersUser: undefined,
                      answersViewersClassroom: undefined,
                      appliers: undefined,
                      owners: undefined,
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
