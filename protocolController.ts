import { Response, Request } from 'express';
import { Protocol, ItemType, ItemGroupType, PageType, ItemValidationType, User, Item, UserRole, ItemGroup } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

export const checkAuthorizationToCreate = async (creator: User) => {
    const user = await prismaClient.user.findUnique({
        where: {
            id: creator.id,
            role: {
                not: {
                    in: [UserRole.USER, UserRole.APLICATOR]
                }
            }
        },
    });
    if (!user)
        throw new Error('This user is not authorized to create a protocol.');
};

export const checkAuthorizationToUpdateAndDeleteProtocol = async (user: User, protocolId: number) => {
    if(user.role !== UserRole.ADMIN){
        const protocol = await prismaClient.protocol.findUnique({
            where: {
                id: protocolId,
                owners: {some: {id: user.id}},
            }
        });
        if (!protocol)
            throw new Error('This user is not authorized to alter this application.');
    }
 };

export const validateItem = async (type: ItemType, itemOptionsLength: number, tableColumnsLength: number) => {
    if(!(type === ItemType.CHECKBOX || type === ItemType.RADIO || type === ItemType.SELECT)){
        if(itemOptionsLength !== 0)
            throw new Error('Options not allowed.');
    }else
        if(itemOptionsLength < 2)
            throw new Error('Not enough options.');
        
    if(type !== ItemType.SCALE){
        if(tableColumnsLength !== 0 )
            throw new Error('Columns not allowed.');
    }else
        if(tableColumnsLength === 0)
            throw new Error('Scale items must have at least one column.');
};

export const createProtocol = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const tableColumnSchema = yup.
            object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                placement: yup.number().min(1).required(),
            })
            .noUnknown();    

        const itemOptionsSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                placement: yup.number().min(1).required(),
            })
            .noUnknown();

        const itemValidationsSchema = yup
            .object()
            .shape({
                type: yup.string().oneOf(Object.values(ItemValidationType)).required(),
                argument: yup.string().required(),
                customMessage: yup.string().required(),
                itemId: yup.number().required(),
            })
            .noUnknown();

        const itemsSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                description: yup.string().min(3).max(255).notRequired(),
                enabled: yup.boolean().required(),
                type: yup.string().oneOf(Object.values(ItemType)).required(),
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
                type: yup.string().oneOf(Object.values(ItemGroupType)).required(),
                items: yup.array().of(itemsSchema).min(1).required(),
                tableColumns: yup.array().of(tableColumnSchema).default([]),
            })
            .noUnknown();

        const pagesSchema = yup
            .object()
            .shape({
                placement: yup.number().min(1).required(),
                type: yup.string().oneOf(Object.values(PageType)).required(),
                itemGroups: yup.array().of(itemGroupsSchema).default([]),
            })
            .noUnknown();

        const createProtocolSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                title: yup.string().min(3).max(255).required(),
                description: yup.string().min(3).max(255).notRequired(),
                enabled: yup.boolean().required(),
                pages: yup.array().of(pagesSchema).min(1).required(),
                owners: yup.array().of(yup.number()).min(1).required(),
            })
            .noUnknown();
        
        const user = req.user as User;
        // Check if user is allowed to create a application
        await checkAuthorizationToCreate(user);

        // Yup parsing/validation
        const protocol = await createProtocolSchema.validate(req.body, { stripUnknown: true });

        // Check if publisher is the only owner
        if(user.role === UserRole.PUBLISHER && protocol.owners.includes(user.id) && protocol.owners.length > 1){
            throw new Error('Publisher must be the only owner.');
        }

        // Multer files
        const files = req.files as Express.Multer.File[];

        // Create a set to store encountered placement values to prevent duplicate placemets
        const placementSet = new Set<number>();

        // Prisma transaction
        const createdProtocol = await prismaClient.$transaction(async (prisma) => {
            const createdProtocol = await prisma.protocol.create({
                data: {
                    title: protocol.title,
                    description: protocol.description,
                    enabled: protocol.enabled,
                    owners: {
                        connect: protocol.owners.map((owner) => {
                            return { id: owner };
                        }),
                    },
                },
            });
            // Create nested pages as well as nested itemGroups, items, itemOptions and itemValidations
            for (const [pageId, page] of protocol.pages.entries()) {                
                // Checks for duplicate placement values
                for (const page of protocol.pages) {
                    if (placementSet.has(page.placement))
                        throw new Error('Duplicate placement value found for pages.');
                    placementSet.add(page.placement);
                }
                placementSet.clear();

                const createdPage = await prisma.page.create({
                    data: {
                        placement: page.placement,
                        protocolId: createdProtocol.id,
                        type: page.type,
                    },
                });
                for (const [itemGroupId, itemGroup] of page.itemGroups.entries()) {
                    // Checks for duplicate placement values
                    for (const itemGroup of page.itemGroups) {
                        if (placementSet.has(itemGroup.placement))
                            throw new Error('Duplicate placement value found for item Group.');
                        placementSet.add(itemGroup.placement);
                    }
                    placementSet.clear();

                    const createdItemGroup = await prisma.itemGroup.create({
                        data: {
                            placement: itemGroup.placement,
                            isRepeatable: itemGroup.isRepeatable,
                            pageId: createdPage.id,
                            type: itemGroup.type,
                        },
                    });
                    for (const [tableColumnId, tableColumn] of itemGroup.tableColumns.entries()){
                        // Checks for duplicate placement values
                        for (const tableColumn of itemGroup.tableColumns) {
                            if (placementSet.has(tableColumn.placement))
                                throw new Error('Reapeated tableColumn placement type not allowed.');
                            placementSet.add(tableColumn.placement);
                        }
                        placementSet.clear();

                        const createdTableColumn = await prisma.tableColumn.create({
                            data: {
                                text: tableColumn.text,
                                placement: tableColumn.placement,
                                groupId: createdItemGroup.id,
                            },
                        });
                    }
                    for (const [itemId, item] of itemGroup.items.entries()) {
                        // Checks for duplicate placement values
                        for (const item of itemGroup.items) {
                            if (placementSet.has(item.placement))
                                throw new Error('Reapeated item placement type not allowed.');
                            placementSet.add(item.placement);
                        }
                        placementSet.clear();
                        // Checks if item has the allowed amount of itemOptions and tableColumns
                        await validateItem(item.type, item.itemOptions.length, itemGroup.tableColumns.length);
                        const itemFiles = files
                            .filter((file) => file.fieldname === `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][files]`)
                            .map((file) => {
                                return { path: file.path };
                            });
                        const createdItem = await prisma.item.create({
                            data: {
                                text: item.text,
                                description: item.description,
                                enabled: item.enabled,
                                groupId: createdItemGroup.id,
                                type: item.type,
                                placement: item.placement,
                                files: {
                                    create: itemFiles,
                                },
                            },
                        });
                        for (const [itemOptionId, itemOption] of item.itemOptions.entries()) {
                            // Checks for duplicate placement values
                            for (const itemOption of item.itemOptions) {
                                if (placementSet.has(itemOption.placement))
                                    throw new Error('Duplicate placement value found for item Option.');
                                placementSet.add(itemOption.placement);
                            }
                            placementSet.clear();

                            const itemOptionFiles = files
                                .filter(
                                    (file) =>
                                        file.fieldname ===
                                        `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][itemOptions][${itemOptionId}][files]`
                                )
                                .map((file) => {
                                    return { path: file.path };
                                });

                            const createdItemOption = await prisma.itemOption.create({
                                data: {
                                    text: itemOption.text,
                                    placement: itemOption.placement,
                                    itemId: createdItem.id,
                                    files: {
                                        create: itemOptionFiles,
                                    },
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
            return await prisma.protocol.findUnique({
                where: {
                    id: createdProtocol.id,
                },
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
                                    tableColumns : true, 
                                },
                            },
                        },
                    },
                },
            });
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
        const UpdatedTableColumnSchema = yup.
            object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255).required(),
                placement: yup.number().min(1).required(),
                groupId: yup.number(),
            })
            .noUnknown(); 
        
        const updateItemOptionsSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255),
                placement: yup.number().min(1).required(),
                itemId: yup.number(),
                filesIds: yup.array().of(yup.number()).default([]),
            })
            .noUnknown();

        const updateItemValidationsSchema = yup
            .object()
            .shape({
                id: yup.number(),
                type: yup.string().oneOf(Object.values(ItemValidationType)),
                argument: yup.string(),
                customMessage: yup.string(),
                itemId: yup.number(),
            })
            .noUnknown();

        const updateItemsSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(3000),
                description: yup.string().max(3000).notRequired(),
                enabled: yup.boolean(),
                groupId: yup.number(),
                type: yup.string().oneOf(Object.values(ItemType)).required(),
                placement: yup.number().min(1).required(),
                itemOptions: yup.array().of(updateItemOptionsSchema).default([]),
                itemValidations: yup.array().of(updateItemValidationsSchema).default([]),
                filesIds: yup.array().of(yup.number()).default([]),
            })
            .noUnknown();

        const updateItemGroupsSchema = yup
            .object()
            .shape({
                id: yup.number(),
                placement: yup.number().min(1).required(),
                isRepeatable: yup.boolean(),
                pageId: yup.number(),
                type: yup.string().oneOf(Object.values(ItemGroupType)),
                items: yup.array().of(updateItemsSchema).min(1).required(),
                tableColumns: yup.array().of(UpdatedTableColumnSchema).default([]),
            })
            .noUnknown();

        const updatePagesSchema = yup
            .object()
            .shape({
                id: yup.number(),
                placement: yup.number().min(1).required(),
                protocolId: yup.number(),
                type: yup.string().oneOf(Object.values(PageType)),
                itemGroups: yup.array().of(updateItemGroupsSchema).min(1).required(),
            })
            .noUnknown();

        const updateProtocolSchema = yup
            .object()
            .shape({
                id: yup.number().min(0),
                title: yup.string().min(3).max(3000),
                description: yup.string().max(3000).notRequired(),
                enabled: yup.boolean(),
                pages: yup.array().of(updatePagesSchema).min(1).required(),
                owners: yup.array().of(yup.number()).min(1).required(),
            })
            .noUnknown();

        // Yup parsing/validation
        const protocol = await updateProtocolSchema.validate(req.body, { stripUnknown: true });
        
        const user = req.user as User;

        // Check if user is included in the owners, or if user is admin
        await checkAuthorizationToUpdateAndDeleteProtocol(user, id);
       
        // Check if publisher remains the only owner
        if(user.role === UserRole.PUBLISHER)
            if(!protocol.owners.includes(user.id))
                throw new Error('This user is not authorized to remove themselves from owners.');
            else if(protocol.owners.length > 1)
                throw new Error('Publisher must be the only owner.');

        //Multer files
        const files = req.files as Express.Multer.File[];

        // Create a set to store encountered placement values to prevent duplicate placemets
        const placementSet = new Set<number>();

        // Prisma transaction
        const upsertedProtocol = await prismaClient.$transaction(async (prisma) => {
            // Update protocol
            await prisma.protocol.update({
                where: {
                    id: id,
                },
                data: {
                    title: protocol.title,
                    description: protocol.description,
                    enabled: protocol.enabled,
                    owners: {
                        set: [],
                        connect: protocol.owners.map((owner) => {
                            return { id: owner };
                        }),
                    },
                },
            });
            // Remove pages that are not in the updated protocol
            await prisma.page.deleteMany({
                where: {
                    id: {
                        notIn: protocol.pages.filter((page) => page.id).map((page) => page.id as number),
                    },
                    protocolId: id,
                },
            });
            // Update existing pages or create new ones
            for (const [pageId, page] of protocol.pages.entries()) {
                // Check if page has the correct protocolId
                if(page.protocolId !== protocol.id)
                    throw new Error('Page does not belong to current protocol.');
                // Checks for duplicate placement values
                for (const page of protocol.pages) {
                    if (placementSet.has(page.placement))
                        throw new Error('Duplicate placement value found for pages.');
                    placementSet.add(page.placement);
                }
                placementSet.clear();

                const upsertedPage = page.id
                    ? await prisma.page.update({
                          where: {
                              id: page.id,
                              protocolId: id,
                          },
                          data: {
                              placement: page.placement,
                              type: page.type,
                          },
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
                        id: {
                            notIn: page.itemGroups.filter((itemGroup) => itemGroup.id).map((itemGroup) => itemGroup.id as number),
                        },
                        pageId: upsertedPage.id,
                    },
                });
                // Update existing itemGroups or create new ones
                for (const [itemGroupId, itemGroup] of page.itemGroups.entries()) {
                    // Check if itemGroup has the correct pageId
                    if(itemGroup.pageId !== page.id)
                        throw new Error('Item Group does not belong to current page.');
                    // Checks for duplicate placement values
                    for (const itemGroup of page.itemGroups) {
                        if (placementSet.has(itemGroup.placement))
                            throw new Error('Duplicate placement value found for item Group.');
                        placementSet.add(itemGroup.placement);
                    }
                    placementSet.clear();

                    const upsertedItemGroup = itemGroup.id
                        ? await prisma.itemGroup.update({
                              where: {
                                  id: itemGroup.id,
                                  pageId: upsertedPage.id,
                              },
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
                                    notIn: itemGroup.tableColumns.filter((tableColumn) => tableColumn.id).map((tableColumn) => tableColumn.id as number),
                                },
                                groupId: upsertedItemGroup.id,
                            },
                        });
                        // Update existing tableColumns or create new ones
                        for (const [tableColumnId, tableColumn] of itemGroup.tableColumns.entries()){
                            // Check if tableColumn has the correct groupId
                            if(tableColumn.groupId !== itemGroup.id)
                                throw new Error('Table Column does not belong to current item group.');
                            // Checks for duplicate placement values
                            for (const tableColumn of itemGroup.tableColumns) {
                                if (placementSet.has(tableColumn.placement))
                                    throw new Error('Duplicate placement value found for table Column.');
                                placementSet.add(tableColumn.placement);
                            }
                            placementSet.clear();

                            const upsertedTableColumn = tableColumn.id 
                            ? await prisma.tableColumn.update({
                                where: {
                                    groupId: upsertedItemGroup.id,
                                    id: tableColumn.id,
                                },
                                data: {
                                    text: tableColumn.text,
                                    placement: tableColumn.placement,
                                    groupId: upsertedItemGroup.id as number,
                                },
                            })
                            : await prisma.tableColumn.create({
                                data: {
                                    text: tableColumn.text as string,
                                    placement: tableColumn.placement as number,
                                    groupId: upsertedItemGroup.id as number,
                                }
                            })
                        };
                    // Remove items that are not in the updated itemGroup
                    await prisma.item.deleteMany({
                        where: {
                            id: {
                                notIn: itemGroup.items.filter((item) => item.id).map((item) => item.id as number),
                            },
                            groupId: upsertedItemGroup.id,
                        },
                    });
                    // Update existing items or create new ones                    
                    for (const [itemId, item] of itemGroup.items.entries()) {
                        // Check if item has the correct groupId
                        if(item.groupId !== itemGroup.id)
                            throw new Error('Item does not belong to current item group.');
                        // Check if item has the allowed amount of itemOptions and tableColumns
                        await validateItem(item.type, item.itemOptions.length, itemGroup.tableColumns.length);
                        // Checks for duplicate placement values
                        for (const item of itemGroup.items) {
                            if (placementSet.has(item.placement))
                                throw new Error('Duplicate placement value found for item.');
                            placementSet.add(item.placement);
                        }
                        placementSet.clear();

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
                            where: {
                                id: {
                                    notIn: item.filesIds as number[],
                                },
                                itemId: upsertedItem.id,
                            },
                        });
                        const itemFiles = files
                            .filter((file) => file.fieldname === `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][files]`)
                            .map((file) => {
                                return { path: file.path, itemId: upsertedItem.id };
                            });

                        // Create new files (updating files is not supported)
                        await prisma.file.createMany({
                            data: itemFiles,
                        });
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
                            // Check if itemOption has the correct itemId
                            if(itemOption.itemId !== item.id)
                                throw new Error('Item Option does not belong to current item.');
                            // Checks for duplicate placement values
                            for (const itemOption of item.itemOptions) {
                                if (placementSet.has(itemOption.placement))
                                    throw new Error('Duplicate placement value found for item Option.');
                                placementSet.add(itemOption.placement);
                            }
                            placementSet.clear();

                            const upsertedItemOption = itemOption.id
                                ? await prisma.itemOption.update({
                                      where: {
                                          id: itemOption.id,
                                          itemId: upsertedItem.id,
                                      },
                                      data: {
                                          text: itemOption.text,
                                          placement: itemOption.placement,
                                      },
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
                                where: {
                                    id: {
                                        notIn: itemOption.filesIds as number[],
                                    },
                                    itemOptionId: upsertedItemOption.id,
                                },
                            });
                            const itemOptionFiles = files
                                .filter(
                                    (file) =>
                                        file.fieldname ===
                                        `pages[${pageId}][itemGroups][${itemGroupId}][items][${itemId}][itemOptions][${itemOptionId}][files]`
                                )
                                .map((file) => {
                                    return { path: file.path, itemOptionId: upsertedItemOption.id };
                                });
                            // Create new files (updating files is not supported)
                            await prisma.file.createMany({
                                data: itemOptionFiles,
                            });
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
                            // Check if itemValidation has the correct itemId
                            if(itemValidation.itemId !== item.id)
                                throw new Error('Item Validation does not belong to current item.');
                            
                            const upsertedItemValidation = itemValidation.id
                                ? await prisma.itemValidation.update({
                                      where: {
                                          id: itemValidation.id,
                                          itemId: upsertedItem.id,
                                      },
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
            return await prisma.protocol.findUnique({
                where: {
                    id: id,
                },
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
                                    tableColumns: true,
                                },
                            },
                        },
                    },
                },
            });
        });
        res.status(200).json({ message: 'Protocol updated.', data: upsertedProtocol });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllProtocols = async (req: Request, res: Response): Promise<void> => {
    try {
        // Get all protocols with nested content included
        const protocol: Protocol[] = await prismaClient.protocol.findMany({
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
                                tableColumns: true,
                            },
                        },
                    },
                },
            },
        });
        res.status(200).json({ message: 'All protocols found.', data: protocol });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.protocolId);

        // Get protocol with nested content included
        const protocol: Protocol = await prismaClient.protocol.findUniqueOrThrow({
            where: {
                id,
            },
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
                                tableColumns: true,
                            },
                        },
                    },
                },
            },
        });

        res.status(200).json({ message: 'Protocol found.', data: protocol });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.protocolId);

        // Check if user is included in the owners, or if user is admin
        await checkAuthorizationToUpdateAndDeleteProtocol(req.user as User, id);

        // Delete protocol
        const deletedProtocol: Protocol = await prismaClient.protocol.delete({
            where: {
                id,
            },
        });

        res.status(200).json({ message: 'Protocol deleted.', data: deletedProtocol });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
