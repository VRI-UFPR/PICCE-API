import { Response, Request } from 'express';
import { Protocol, ItemType, ItemGroupType, PageType } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';

export const createProtocol = async (req: Request, res: Response) => {
    try {
        const itemOptionsSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                placement: yup.number().min(1).required(),
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
            })
            .noUnknown();

        const itemGroupsSchema = yup
            .object()
            .shape({
                placement: yup.number().min(1).required(),
                isRepeatable: yup.boolean().required(),
                type: yup.string().oneOf(Object.values(ItemGroupType)).required(),
                items: yup.array().of(itemsSchema).min(1).required(),
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
                title: yup.string().min(3).max(255).required(),
                description: yup.string().min(3).max(255).notRequired(),
                enabled: yup.boolean().required(),
                pages: yup.array().of(pagesSchema).min(1).required(),
                owners: yup.array().of(yup.number()).min(1).required(),
            })
            .noUnknown();

        const protocol = await createProtocolSchema.validate(req.body);

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
            for (const [pageId, page] of protocol.pages.entries()) {
                const createdPage = await prisma.page.create({
                    data: {
                        placement: page.placement,
                        protocolId: createdProtocol.id,
                        type: page.type,
                    },
                });
                for (const [itemGroupId, itemGroup] of page.itemGroups.entries()) {
                    const createdItemGroup = await prisma.itemGroup.create({
                        data: {
                            placement: itemGroup.placement,
                            isRepeatable: itemGroup.isRepeatable,
                            pageId: createdPage.id,
                            type: itemGroup.type,
                        },
                    });
                    for (const [itemId, item] of itemGroup.items.entries()) {
                        const createdItem = await prisma.item.create({
                            data: {
                                text: item.text,
                                description: item.description,
                                enabled: item.enabled,
                                groupId: createdItemGroup.id,
                                type: item.type,
                                placement: item.placement,
                            },
                        });
                        for (const [itemOptionId, itemOption] of item.itemOptions.entries()) {
                            const createdItemOption = await prisma.itemOption.create({
                                data: {
                                    text: itemOption.text,
                                    placement: itemOption.placement,
                                    itemId: createdItem.id,
                                },
                            });
                        }
                    }
                }
            }
            return await prisma.protocol.findUnique({
                where: {
                    id: createdProtocol.id,
                },
            });
        });
        res.status(201).json({ message: 'Protocol created.', data: createdProtocol });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const updateProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.protocolId);

        const updateItemOptionsSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255),
                placement: yup.number().min(1),
                itemId: yup.number(),
            })
            .noUnknown();

        const updateItemsSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255),
                description: yup.string().min(3).max(255).notRequired(),
                enabled: yup.boolean(),
                groupId: yup.number(),
                type: yup.string().oneOf(Object.values(ItemType)),
                placement: yup.number().min(1),
                itemOptions: yup.array().of(updateItemOptionsSchema).default([]),
            })
            .noUnknown();

        const updateItemGroupsSchema = yup
            .object()
            .shape({
                id: yup.number(),
                placement: yup.number().min(1),
                isRepeatable: yup.boolean(),
                pageId: yup.number(),
                type: yup.string().oneOf(Object.values(ItemGroupType)),
                items: yup.array().of(updateItemsSchema).min(1).required(),
            })
            .noUnknown();

        const updatePagesSchema = yup
            .object()
            .shape({
                id: yup.number(),
                placement: yup.number().min(1),
                protocolId: yup.number(),
                type: yup.string().oneOf(Object.values(PageType)),
                itemGroups: yup.array().of(updateItemGroupsSchema).min(1).required(),
            })
            .noUnknown();

        const updateProtocolSchema = yup
            .object()
            .shape({
                title: yup.string().min(3).max(255),
                description: yup.string().min(3).max(255).notRequired(),
                enabled: yup.boolean(),
                pages: yup.array().of(updatePagesSchema).min(1).required(),
                owners: yup.array().of(yup.number()).min(1).required(),
            })
            .noUnknown();

        const protocol = await updateProtocolSchema.validate(req.body);

        const upsertedProtocol = await prismaClient.$transaction(async (prisma) => {
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
            prisma.page.deleteMany({
                where: {
                    id: {
                        notIn: protocol.pages.filter((page) => page.id).map((page) => page.id as number),
                    },
                },
            });
            for (const [pageId, page] of protocol.pages.entries()) {
                const upsertedPage = page.id
                    ? await prisma.page.update({
                          where: {
                              id: page.id,
                          },
                          data: {
                              protocolId: id,
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
                prisma.itemGroup.deleteMany({
                    where: {
                        id: {
                            notIn: page.itemGroups.filter((itemGroup) => itemGroup.id).map((itemGroup) => itemGroup.id as number),
                        },
                    },
                });
                for (const [itemGroupId, itemGroup] of page.itemGroups.entries()) {
                    const upsertedItemGroup = itemGroup.id
                        ? await prisma.itemGroup.update({
                              where: {
                                  id: itemGroup.id,
                              },
                              data: {
                                  placement: itemGroup.placement,
                                  isRepeatable: itemGroup.isRepeatable,
                                  pageId: upsertedPage.id,
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
                    prisma.item.deleteMany({
                        where: {
                            id: {
                                notIn: itemGroup.items.filter((item) => item.id).map((item) => item.id as number),
                            },
                        },
                    });
                    for (const [itemId, item] of itemGroup.items.entries()) {
                        const upsertedItem = item.id
                            ? await prisma.item.update({
                                  where: {
                                      id: item.id,
                                  },
                                  data: {
                                      text: item.text,
                                      description: item.description,
                                      enabled: item.enabled,
                                      groupId: upsertedItemGroup.id,
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
                        prisma.itemOption.deleteMany({
                            where: {
                                id: {
                                    notIn: item.itemOptions.filter((itemOption) => item.id).map((itemOption) => itemOption.id as number),
                                },
                            },
                        });
                        for (const [itemOptionId, itemOption] of item.itemOptions.entries()) {
                            const upsertedItemOption = itemOption.id
                                ? await prisma.itemOption.update({
                                      where: {
                                          id: itemOption.id,
                                      },
                                      data: {
                                          text: itemOption.text,
                                          placement: itemOption.placement,
                                          itemId: upsertedItem.id,
                                      },
                                  })
                                : await prisma.itemOption.create({
                                      data: {
                                          text: itemOption.text as string,
                                          placement: itemOption.placement as number,
                                          itemId: upsertedItem.id as number,
                                      },
                                  });
                        }
                    }
                }
            }
            return await prisma.protocol.findUnique({
                where: {
                    id: id,
                },
            });
        });
        res.status(200).json({ message: 'Protocol updated.', data: upsertedProtocol });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const getAllProtocols = async (req: Request, res: Response): Promise<void> => {
    try {
        const protocol: Protocol[] = await prismaClient.protocol.findMany();
        res.status(200).json({ message: 'All protocols found.', data: protocol });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const getProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.protocolId);

        const protocol: Protocol = await prismaClient.protocol.findUniqueOrThrow({
            where: {
                id,
            },
        });

        res.status(200).json({ message: 'Protocol found.', data: protocol });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const deleteProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.protocolId);

        const deletedProtocol: Protocol = await prismaClient.protocol.delete({
            where: {
                id,
            },
        });

        res.status(200).json({ message: 'Protocol deleted.', data: deletedProtocol });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};
