import { Response, Request } from 'express';
import { ApplicationAnswer, User } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

export const createApplicationAnswer = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createItemAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255).required(),
                itemId: yup.number().required(),
            })
            .noUnknown();

        const createOptionAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255).required(),
                itemId: yup.number().required(),
                optionId: yup.number().required(),
            })
            .noUnknown();

        const createTableAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255).required(),
                itemId: yup.number().required(),
                columnId: yup.number().required(),
            })
            .noUnknown();

        const createItemAnswerGroupSchema = yup
            .object()
            .shape({
                id: yup.number(),
                itemAnswers: yup.array().of(createItemAnswerSchema).min(1).required(),
                tableAnswers: yup.array().of(createTableAnswerSchema).min(1).required(),
                optionAnswers: yup.array().of(createOptionAnswerSchema).min(1).required(),
            })
            .noUnknown();

        const createApplicationAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                date: yup.date().required(),
                userId: yup.number().required(),
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
        if (user.role !== 'ADMIN') {
            await prismaClient.application.findUniqueOrThrow({
                where: {
                    id: applicationAnswer.applicationId,
                    OR: [
                        {
                            viewersClassroom: {
                                some: {
                                    users: {
                                        some: {
                                            id: user.id,
                                        },
                                    },
                                },
                            },
                        },
                        {
                            viewersUser: {
                                some: {
                                    id: user.id,
                                },
                            },
                        },
                        {
                            applicator: {
                                id: user.id,
                            },
                        },
                    ],
                },
            });
        }

        // Prisma transaction
        const createdApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            const createdApplicationAnswer: ApplicationAnswer = await prisma.applicationAnswer.create({
                data: {
                    id: applicationAnswer.id,
                    date: applicationAnswer.date,
                    userId: applicationAnswer.userId,
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
                        .filter(
                            (file) => file.fieldname === `itemAnswerGroups[${itemAnswerGroupIndex}][itemAnswers][${itemAnswerIndex}][files]`
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
                            files: {
                                createMany: {
                                    data: itemAnswerFiles,
                                },
                            },
                        },
                    });
                }
            }
            // Return the created application answer with nested content included
            return await prisma.applicationAnswer.findUnique({
                where: {
                    id: createdApplicationAnswer.id,
                },
                include: {
                    itemAnswerGroups: {
                        include: {
                            itemAnswers: {
                                include: {
                                    files: true,
                                },
                            },
                            optionAnswers: true,
                            tableAnswers: true,
                        },
                    },
                },
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
                id: yup.number(),
                text: yup.string().min(3).max(255),
                itemId: yup.number(),
                filesIds: yup.array().of(yup.number()).default([]),
            })
            .noUnknown();

        const updateOptionAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255),
                itemId: yup.number(),
                optionId: yup.number(),
            })
            .noUnknown();

        const updateTableAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255),
                itemId: yup.number(),
                columnId: yup.number(),
            })
            .noUnknown();

        const updateItemAnswerGroupSchema = yup
            .object()
            .shape({
                id: yup.number(),
                itemAnswers: yup.array().of(updateItemAnswerSchema).min(1).required(),
                tableAnswers: yup.array().of(updateTableAnswerSchema).min(1).required(),
                optionAnswers: yup.array().of(updateOptionAnswerSchema).min(1).required(),
            })
            .noUnknown();

        const updateApplicationAnswerSchema = yup
            .object()
            .shape({
                date: yup.date(),
                userId: yup.number(),
                applicationId: yup.number(),
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

        // Check if user is allowed to update the application answer
        if (user.role !== 'ADMIN') {
            await prismaClient.applicationAnswer.findUniqueOrThrow({
                where: {
                    id: id,
                    userId: user.id,
                },
            });
        }

        // Prisma transaction
        const upsertedApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            // Update application answer
            await prisma.applicationAnswer.update({
                where: {
                    id: id,
                },
                data: {
                    date: applicationAnswer.date,
                    userId: applicationAnswer.userId,
                    applicationId: applicationAnswer.applicationId,
                    addressId: applicationAnswer.addressId,
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
                    applicationAnswerId: id,
                },
            });
            for (const [itemAnswerGroupIndex, itemAnswerGroup] of applicationAnswer.itemAnswerGroups.entries()) {
                // Update existing item answer groups or create new ones
                const upsertedItemAnswerGroup = itemAnswerGroup.id
                    ? await prisma.itemAnswerGroup.update({
                          where: {
                              id: itemAnswerGroup.id,
                              applicationAnswerId: id,
                          },
                          data: {
                              applicationAnswerId: id,
                          },
                      })
                    : await prisma.itemAnswerGroup.create({
                          data: {
                              applicationAnswerId: id,
                          },
                      });
                // Remove item answers that are not in the updated item answer group
                await prisma.itemAnswer.deleteMany({
                    where: {
                        id: {
                            notIn: itemAnswerGroup.itemAnswers
                                .filter((itemAnswer) => itemAnswer.id)
                                .map((itemAnswer) => itemAnswer.id as number),
                        },
                        group: {
                            applicationAnswerId: id,
                        },
                    },
                });
                for (const [itemAnswerIndex, itemAnswer] of itemAnswerGroup.itemAnswers.entries()) {
                    // Update existing item answers or create new ones
                    const upsertedItemAnswer = itemAnswer.id
                        ? await prisma.itemAnswer.update({
                              where: {
                                  id: itemAnswer.id,
                                  group: {
                                      applicationAnswerId: id,
                                  },
                              },
                              data: {
                                  text: itemAnswer.text,
                                  itemId: itemAnswer.itemId,
                                  groupId: upsertedItemAnswerGroup.id,
                              },
                          })
                        : await prisma.itemAnswer.create({
                              data: {
                                  text: itemAnswer.text as string,
                                  itemId: itemAnswer.itemId as number,
                                  groupId: upsertedItemAnswerGroup.id as number,
                              },
                          });
                    //Remove files that are not in the updated item answer
                    await prisma.file.deleteMany({
                        where: {
                            id: {
                                notIn: itemAnswer.filesIds.filter((fileId) => fileId).map((fileId) => fileId as number),
                            },
                            itemAnswer: {
                                group: {
                                    applicationAnswerId: id,
                                },
                            },
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
                    await prisma.file.createMany({
                        data: itemAnswerFiles,
                    });
                }
                // Remove option answers that are not in the updated item answer group
                await prisma.optionAnswer.deleteMany({
                    where: {
                        id: {
                            notIn: itemAnswerGroup.optionAnswers
                                .filter((optionAnswer) => optionAnswer.id)
                                .map((optionAnswer) => optionAnswer.id as number),
                        },
                        group: {
                            applicationAnswerId: id,
                        },
                    },
                });
                for (const optionAnswer of itemAnswerGroup.optionAnswers) {
                    // Update existing option answers or create new ones
                    optionAnswer.id
                        ? await prisma.optionAnswer.update({
                              where: {
                                  id: optionAnswer.id,
                                  group: {
                                      applicationAnswerId: id,
                                  },
                              },
                              data: {
                                  text: optionAnswer.text,
                                  itemId: optionAnswer.itemId,
                                  optionId: optionAnswer.optionId,
                                  groupId: upsertedItemAnswerGroup.id,
                              },
                          })
                        : await prisma.optionAnswer.create({
                              data: {
                                  text: optionAnswer.text as string,
                                  itemId: optionAnswer.itemId as number,
                                  optionId: optionAnswer.optionId as number,
                                  groupId: upsertedItemAnswerGroup.id as number,
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
                        group: {
                            applicationAnswerId: id,
                        },
                    },
                });
                for (const tableAnswer of itemAnswerGroup.tableAnswers) {
                    // Update existing table answers or create new ones
                    tableAnswer.id
                        ? await prisma.tableAnswer.update({
                              where: {
                                  id: tableAnswer.id,
                                  group: {
                                      applicationAnswerId: id,
                                  },
                              },
                              data: {
                                  text: tableAnswer.text,
                                  itemId: tableAnswer.itemId,
                                  columnId: tableAnswer.columnId,
                                  groupId: upsertedItemAnswerGroup.id,
                              },
                          })
                        : await prisma.tableAnswer.create({
                              data: {
                                  text: tableAnswer.text as string,
                                  itemId: tableAnswer.itemId as number,
                                  columnId: tableAnswer.columnId as number,
                                  groupId: upsertedItemAnswerGroup.id as number,
                              },
                          });
                }
            }
            // Return the updated application answer with nested content included
            return await prisma.applicationAnswer.findUnique({
                where: {
                    id: id,
                },
                include: {
                    itemAnswerGroups: {
                        include: {
                            itemAnswers: {
                                include: {
                                    files: true,
                                },
                            },
                            optionAnswers: true,
                            tableAnswers: true,
                        },
                    },
                },
            });
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
                ? await prismaClient.applicationAnswer.findMany({
                      include: {
                          itemAnswerGroups: {
                              include: {
                                  itemAnswers: {
                                      include: {
                                          files: true,
                                      },
                                  },
                                  optionAnswers: true,
                                  tableAnswers: true,
                              },
                          },
                      },
                  })
                : await prismaClient.applicationAnswer.findMany({
                      where: {
                          userId: user.id,
                      },
                      include: {
                          itemAnswerGroups: {
                              include: {
                                  itemAnswers: {
                                      include: {
                                          files: true,
                                      },
                                  },
                                  optionAnswers: true,
                                  tableAnswers: true,
                              },
                          },
                      },
                  });
        res.status(200).json({ message: 'All application answers found.', data: applicationAnswers });
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
                ? await prismaClient.applicationAnswer.findUniqueOrThrow({
                      where: {
                          id,
                      },
                      include: {
                          itemAnswerGroups: {
                              include: {
                                  itemAnswers: {
                                      include: {
                                          files: true,
                                      },
                                  },
                                  optionAnswers: true,
                                  tableAnswers: true,
                              },
                          },
                      },
                  })
                : await prismaClient.applicationAnswer.findUniqueOrThrow({
                      where: {
                          id,
                          userId: user.id,
                      },
                      include: {
                          itemAnswerGroups: {
                              include: {
                                  itemAnswers: {
                                      include: {
                                          files: true,
                                      },
                                  },
                                  optionAnswers: true,
                                  tableAnswers: true,
                              },
                          },
                      },
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
                ? await prismaClient.applicationAnswer.delete({
                      where: {
                          id: id,
                      },
                  })
                : await prismaClient.applicationAnswer.delete({
                      where: {
                          id: id,
                          userId: user.id,
                      },
                  });

        res.status(200).json({ message: 'Application answer deleted.', data: deletedApplicationAnswer });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
