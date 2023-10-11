import { Response, Request } from "express";
import { ApplicationAnswer } from "@prisma/client";
import * as yup from "yup";
import prismaClient from "../services/prismaClient";

export const createApplicationAnswer = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createItemAnswerSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                item_id: yup.number().required(),
            })
            .noUnknown();

        const createOptionAnswerSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                item_id: yup.number().required(),
                option_id: yup.number().required(),
            })
            .noUnknown();

        const createTableAnswerSchema = yup
            .object()
            .shape({
                text: yup.string().min(3).max(255).required(),
                item_id: yup.number().required(),
                column_id: yup.number().required(),
            })
            .noUnknown();

        const createItemAnswerGroupSchema = yup
            .object()
            .shape({
                item_answers: yup.array().of(createItemAnswerSchema).min(1).required(),
                table_answers: yup.array().of(createTableAnswerSchema).min(1).required(),
                option_answers: yup.array().of(createOptionAnswerSchema).min(1).required(),
            })
            .noUnknown();

        const createApplicationAnswerSchema = yup
            .object()
            .shape({
                date: yup.date().required(),
                user_id: yup.number().required(),
                application_id: yup.number().required(),
                address_id: yup.number().required(),
                item_answer_groups: yup.array().of(createItemAnswerGroupSchema).min(1).required(),
            })
            .noUnknown();

        // Yup parsing/validation
        const applicationAnswer = await createApplicationAnswerSchema.validate(req.body);

        // Prisma transaction
        const createdApplicationAnswer: ApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            const createdApplicationAnswer = prisma.applicationAnswer.create({
                data: {
                    date: applicationAnswer.date,
                    user_id: applicationAnswer.user_id,
                    application_id: applicationAnswer.application_id,
                    address_id: applicationAnswer.address_id,
                },
            });
            for (const itemAnswerGroup of applicationAnswer.item_answer_groups) {
                await prisma.itemAnswerGroup.create({
                    data: {
                        application_answer_id: createdApplicationAnswer.id,
                        itemAnswers: {
                            createMany: itemAnswerGroup.item_answers.map((itemAnswer) => {
                                return {
                                    text: itemAnswer.text,
                                    item_id: itemAnswer.item_id,
                                };
                            }),
                        },
                        optionAnswers: {
                            createMany: itemAnswerGroup.option_answers.map((optionAnswer) => {
                                return {
                                    text: optionAnswer.text,
                                    item_id: optionAnswer.item_id,
                                    option_id: optionAnswer.option_id,
                                };
                            }),
                        },
                        tableAnswers: {
                            createMany: itemAnswerGroup.table_answers.map((tableAnswer) => {
                                return {
                                    text: tableAnswer.text,
                                    item_id: tableAnswer.item_id,
                                    column_id: tableAnswer.column_id,
                                };
                            }),
                        },
                    },
                });
            }
            return prisma.applicationAnswer.findUnique({
                where: {
                    id: createdApplicationAnswer.id,
                },
                include: {
                    item_answer_groups: {
                        include: {
                            item_answers: {
                                include: {
                                    item_option_selections: true,
                                },
                            },
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
                item_id: yup.number(),
            })
            .noUnknown();

        const updateOptionAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255),
                item_id: yup.number(),
                option_id: yup.number(),
            })
            .noUnknown();

        const updateTableAnswerSchema = yup
            .object()
            .shape({
                id: yup.number(),
                text: yup.string().min(3).max(255),
                item_id: yup.number(),
                column_id: yup.number(),
            })
            .noUnknown();

        const updateItemAnswerGroupSchema = yup
            .object()
            .shape({
                id: yup.number(),
                item_answers: yup.array().of(updateItemAnswerSchema).min(1).required(),
                table_answers: yup.array().of(updateTableAnswerSchema).min(1).required(),
                option_answers: yup.array().of(updateOptionAnswerSchema).min(1).required(),
            })
            .noUnknown();

        const updateApplicationAnswerSchema = yup
            .object()
            .shape({
                date: yup.date(),
                user_id: yup.number(),
                application_id: yup.number(),
                address_id: yup.number(),
                item_answer_groups: yup.array().of(updateItemAnswerGroupSchema).min(1).required(),
            })
            .noUnknown();

        // Yup parsing/validation
        const applicationAnswer = await updateApplicationAnswerSchema.validate(req.body);

        // Prisma transaction
        const upsertedApplicationAnswer: ApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            prisma.applicationAnswer.update({
                where: {
                    id: id,
                },
                data: {
                    date: applicationAnswer.date,
                    user_id: applicationAnswer.user_id,
                    application_id: applicationAnswer.application_id,
                    address_id: applicationAnswer.address_id,
                },
            });
            prisma.itemAnswerGroup.deleteMany({
                where: {
                    id: { notIn: applicationAnswer.item_answer_groups.map((itemAnswerGroup) => itemAnswerGroup.id) },
                },
            });
            for (const itemAnswerGroup of applicationAnswer.item_answer_groups) {
                const upsertedItemAnswerGroup = await prisma.itemAnswerGroup.upsert({
                    where: {
                        id: itemAnswerGroup.id,
                    },
                    create: {
                        application_answer_id: id,
                    },
                    update: {
                        application_answer_id: id,
                    },
                });
                prisma.itemAnswer.deleteMany({
                    where: {
                        id: { notIn: itemAnswerGroup.item_answers.map((itemAnswer) => itemAnswer.id) },
                    },
                });
                for (const itemAnswer of itemAnswerGroup.item_answers) {
                    await prisma.itemAnswer.upsert({
                        where: {
                            id: itemAnswer.id,
                        },
                        create: {
                            text: itemAnswer.text,
                            item_id: itemAnswer.item_id,
                            group_id: upsertedItemAnswerGroup.id,
                        },
                        update: {
                            text: itemAnswer.text,
                            item_id: itemAnswer.item_id,
                            group_id: upsertedItemAnswerGroup.id,
                        },
                    });
                }
                prisma.optionAnswer.deleteMany({
                    where: {
                        id: { notIn: itemAnswerGroup.option_answers.map((optionAnswer) => optionAnswer.id) },
                    },
                });
                for (const optionAnswer of itemAnswerGroup.option_answers) {
                    await prisma.optionAnswer.upsert({
                        where: {
                            id: optionAnswer.id,
                        },
                        create: {
                            text: optionAnswer.text,
                            item_id: optionAnswer.item_id,
                            option_id: optionAnswer.option_id,
                            group_id: upsertedItemAnswerGroup.id,
                        },
                        update: {
                            text: optionAnswer.text,
                            item_id: optionAnswer.item_id,
                            option_id: optionAnswer.option_id,
                            group_id: upsertedItemAnswerGroup.id,
                        },
                    });
                }
                prisma.tableAnswer.deleteMany({
                    where: {
                        id: { notIn: itemAnswerGroup.table_answers.map((tableAnswer) => tableAnswer.id) },
                    },
                });
                for (const tableAnswer of itemAnswerGroup.table_answers) {
                    await prisma.tableAnswer.upsert({
                        where: {
                            id: tableAnswer.id,
                        },
                        create: {
                            text: tableAnswer.text,
                            item_id: tableAnswer.item_id,
                            column_id: tableAnswer.column_id,
                            group_id: upsertedItemAnswerGroup.id,
                        },
                        update: {
                            text: tableAnswer.text,
                            item_id: tableAnswer.item_id,
                            column_id: tableAnswer.column_id,
                            group_id: upsertedItemAnswerGroup.id,
                        },
                    });
                }
            }
            return prisma.applicationAnswer.findUnique({
                where: {
                    id: id,
                },
                include: {
                    item_answer_groups: {
                        include: {
                            item_answers: {
                                include: {
                                    item_option_selections: true,
                                },
                            },
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
                item_answer_groups: {
                    include: {
                        item_answers: {
                            include: {
                                item_option_selections: true,
                            },
                        },
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
                item_answer_groups: {
                    include: {
                        item_answers: {
                            include: {
                                item_option_selections: true,
                            },
                        },
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
