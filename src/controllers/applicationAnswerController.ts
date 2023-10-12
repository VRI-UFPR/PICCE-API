import { Response, Request } from "express";
import { ApplicationAnswer, ItemAnswer, OptionAnswer, TableAnswer } from "@prisma/client";
import * as yup from "yup";
import prismaClient from "../services/prismaClient";

export const createApplicationAnswer = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createItemAnswerSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                itemId: yup.number().required(),
            })
            .noUnknown();

        const createOptionAnswerSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                itemId: yup.number().required(),
                optionId: yup.number().required(),
            })
            .noUnknown();

        const createTableAnswerSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                itemId: yup.number().required(),
                columnId: yup.number().required(),
            })
            .noUnknown();

        const createItemAnswerGroupSchema = yup
            .object()
            .shape({
                itemAnswers: yup.array().of(createItemAnswerSchema).min(1).required(),
                tableAnswers: yup.array().of(createTableAnswerSchema).min(1).required(),
                optionAnswers: yup.array().of(createOptionAnswerSchema).min(1).required(),
            })
            .noUnknown();

        const createApplicationAnswerSchema = yup
            .object()
            .shape({
                date: yup.date().required(),
                userId: yup.number().required(),
                applicationId: yup.number().required(),
                addressId: yup.number().required(),
                itemAnswerGroups: yup.array().of(createItemAnswerGroupSchema).min(1).required(),
            })
            .noUnknown();

        // Yup parsing/validation
        const applicationAnswer = await createApplicationAnswerSchema.validate(req.body);

        // Prisma transaction
        const createdApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            const createdApplicationAnswer: ApplicationAnswer = await prisma.applicationAnswer.create({
                data: {
                    date: applicationAnswer.date,
                    userId: applicationAnswer.userId,
                    applicationId: applicationAnswer.applicationId,
                    addressId: applicationAnswer.addressId,
                },
            });

            for (const itemAnswerGroup of applicationAnswer.itemAnswerGroups) {
                await prisma.itemAnswerGroup.create({
                    data: {
                        applicationAnswerId: createdApplicationAnswer.id,
                        itemAnswers: {
                            createMany: {
                                data: itemAnswerGroup.itemAnswers.map((itemAnswer) => {
                                    return {
                                        text: itemAnswer.text,
                                        itemId: itemAnswer.itemId,
                                    };
                                }),
                            },
                        },
                        optionAnswers: {
                            createMany: {
                                data: itemAnswerGroup.optionAnswers.map((optionAnswer) => {
                                    return {
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
                                        text: tableAnswer.text,
                                        itemId: tableAnswer.itemId,
                                        columnId: tableAnswer.columnId,
                                    };
                                }),
                            },
                        },
                    },
                });
            }
            return prisma.applicationAnswer.findUnique({
                where: {
                    id: createdApplicationAnswer.id,
                },
                include: {
                    itemAnswerGroups: {
                        include: {
                            itemAnswers: true,
                            optionAnswers: true,
                            tableAnswers: true,
                        },
                    },
                },
            });
        });
        res.status(201).json({ message: "Application answer created.", data: createdApplicationAnswer });
    } catch (error: any) {
        res.status(400).json({ error: error });
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
        const applicationAnswer = await updateApplicationAnswerSchema.validate(req.body);

        // Prisma transaction
        const upsertedApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            prisma.applicationAnswer.update({
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
            prisma.itemAnswerGroup.deleteMany({
                where: {
                    id: {
                        notIn: applicationAnswer.itemAnswerGroups
                            .filter((itemAnswerGroup) => itemAnswerGroup.id)
                            .map((itemAnswerGroup) => itemAnswerGroup.id as number),
                    },
                },
            });
            for (const itemAnswerGroup of applicationAnswer.itemAnswerGroups) {
                const upsertedItemAnswerGroup = await prisma.itemAnswerGroup.upsert({
                    where: {
                        id: itemAnswerGroup.id,
                    },
                    create: {
                        applicationAnswerId: id,
                    },
                    update: {
                        applicationAnswerId: id,
                    },
                });
                prisma.itemAnswer.deleteMany({
                    where: {
                        id: {
                            notIn: itemAnswerGroup.itemAnswers
                                .filter((itemAnswer) => itemAnswer.id)
                                .map((itemAnswer) => itemAnswer.id as number),
                        },
                    },
                });
                for (const itemAnswer of itemAnswerGroup.itemAnswers) {
                    await prisma.itemAnswer.upsert({
                        where: {
                            id: itemAnswer.id,
                        },
                        create: {
                            text: itemAnswer.text as string,
                            itemId: itemAnswer.itemId as number,
                            groupId: upsertedItemAnswerGroup.id as number,
                        },
                        update: {
                            text: itemAnswer.text,
                            itemId: itemAnswer.itemId,
                            groupId: upsertedItemAnswerGroup.id,
                        },
                    });
                }
                prisma.optionAnswer.deleteMany({
                    where: {
                        id: {
                            notIn: itemAnswerGroup.optionAnswers
                                .filter((optionAnswer) => optionAnswer.id)
                                .map((optionAnswer) => optionAnswer.id as number),
                        },
                    },
                });
                for (const optionAnswer of itemAnswerGroup.optionAnswers) {
                    await prisma.optionAnswer.upsert({
                        where: {
                            id: optionAnswer.id,
                        },
                        create: {
                            text: optionAnswer.text as string,
                            itemId: optionAnswer.itemId as number,
                            optionId: optionAnswer.optionId as number,
                            groupId: upsertedItemAnswerGroup.id as number,
                        },
                        update: {
                            text: optionAnswer.text,
                            itemId: optionAnswer.itemId,
                            optionId: optionAnswer.optionId,
                            groupId: upsertedItemAnswerGroup.id,
                        },
                    });
                }
                prisma.tableAnswer.deleteMany({
                    where: {
                        id: {
                            notIn: itemAnswerGroup.tableAnswers
                                .filter((tableAnswer) => tableAnswer.id)
                                .map((tableAnswer) => tableAnswer.id as number),
                        },
                    },
                });
                for (const tableAnswer of itemAnswerGroup.tableAnswers) {
                    await prisma.tableAnswer.upsert({
                        where: {
                            id: tableAnswer.id,
                        },
                        create: {
                            text: tableAnswer.text as string,
                            itemId: tableAnswer.itemId as number,
                            columnId: tableAnswer.columnId as number,
                            groupId: upsertedItemAnswerGroup.id as number,
                        },
                        update: {
                            text: tableAnswer.text,
                            itemId: tableAnswer.itemId,
                            columnId: tableAnswer.columnId,
                            groupId: upsertedItemAnswerGroup.id,
                        },
                    });
                }
            }
            return prisma.applicationAnswer.findUnique({
                where: {
                    id: id,
                },
                include: {
                    itemAnswerGroups: {
                        include: {
                            itemAnswers: true,
                            optionAnswers: true,
                            tableAnswers: true,
                        },
                    },
                },
            });
        });
        res.status(200).json({ message: "Application answer updated.", data: upsertedApplicationAnswer });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const getAllApplicationAnswers = async (req: Request, res: Response): Promise<void> => {
    try {
        const applicationAnswers: ApplicationAnswer[] = await prismaClient.applicationAnswer.findMany({
            include: {
                itemAnswerGroups: {
                    include: {
                        itemAnswers: true,
                        optionAnswers: true,
                        tableAnswers: true,
                    },
                },
            },
        });
        res.status(200).json({ message: "All application answers found.", data: applicationAnswers });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const getApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.applicationAnswerId);

        const applicationAnswer: ApplicationAnswer = await prismaClient.applicationAnswer.findUniqueOrThrow({
            where: {
                id,
            },
            include: {
                itemAnswerGroups: {
                    include: {
                        itemAnswers: true,
                        optionAnswers: true,
                        tableAnswers: true,
                    },
                },
            },
        });

        res.status(200).json({ message: "Application answer found.", data: applicationAnswer });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const deleteApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        const applicationAnswerId: number = parseInt(req.params.applicationAnswerId);

        const deletedApplicationAnswer: ApplicationAnswer = await prismaClient.applicationAnswer.delete({
            where: {
                id: applicationAnswerId,
            },
        });

        res.status(200).json({ message: "Application answer deleted.", data: deletedApplicationAnswer });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};
