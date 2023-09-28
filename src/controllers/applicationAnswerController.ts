import { Response, Request } from "express"
import { ApplicationAnswer } from "@prisma/client"
import * as yup from "yup"
import prismaClient from "../services/prismaClient"

export const createApplicationAnswer = async (req: Request, res: Response) => {
    try {
        const createApplicationAnswerSchema = yup
            .object()
            .shape({
                date: yup.date().required(),
                user_id: yup.number().required(),
                application_id: yup.number().required(),
                address_id: yup.number().required(),
                item_answer_groups: yup
                    .array()
                    .of(
                        yup
                            .object()
                            .shape({
                                item_answers: yup
                                    .array()
                                    .of(
                                        yup
                                            .object()
                                            .shape({
                                                text: yup.string().min(3).max(255).required(),
                                                item_id: yup.number().required(),
                                                item_option_selections: yup
                                                    .array()
                                                    .of(
                                                        yup
                                                            .object()
                                                            .shape({
                                                                text: yup.string().min(3).max(255).required(),
                                                                item_option_id: yup.number().required(),
                                                            })
                                                            .noUnknown()
                                                    )
                                                    .default([]),
                                            })
                                            .noUnknown()
                                    )
                                    .min(1)
                                    .required(),
                            })
                            .noUnknown()
                    )
                    .min(1)
                    .required(),
            })
            .noUnknown()

        const applicationAnswer = await createApplicationAnswerSchema.validate(req.body)
        const createdApplicationAnswer: ApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            prisma.applicationAnswer.create({
                data: {
                    date: applicationAnswer.date,
                    user_id: applicationAnswer.user_id,
                    application_id: applicationAnswer.application_id,
                    address_id: applicationAnswer.address_id,
                },
            })
            for (const itemAnswerGroup of applicationAnswer.item_answer_groups) {
                const createdItemAnswerGroup = await prisma.itemAnswerGroup.create({
                    data: {
                        application_answer_id: createdApplicationAnswer.id,
                    },
                })
                for (const itemAnswer of itemAnswerGroup.item_answers) {
                    const createdItemAnswer = await prisma.itemAnswer.create({
                        data: {
                            text: itemAnswer.text,
                            item_id: itemAnswer.item_id,
                            group_id: createdItemAnswerGroup.id,
                        },
                    })
                    await prisma.itemOptionSelection.createMany({
                        data: itemAnswer.item_option_selections.map((itemOptionSelection) => {
                            return {
                                text: itemOptionSelection.text,
                                item_option_id: itemOptionSelection.item_option_id,
                                item_answer_id: createdItemAnswer.id,
                            }
                        }),
                    })
                }
            }
            return prismaClient.applicationAnswer.findUnique({
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
            })
        })
        res.status(201).json({ message: "Application answer created.", data: createdApplicationAnswer })
    } catch (error: any) {
        res.status(400).json({ error: error })
    }
}

export const updateApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.applicationAnswerId)

        const updateApplicationAnswerSchema = yup
            .object()
            .shape({
                date: yup.date(),
                user_id: yup.number(),
                application_id: yup.number(),
                address_id: yup.number(),
                item_answer_groups: yup
                    .array()
                    .of(
                        yup
                            .object()
                            .shape({
                                id: yup.number(),
                                item_answers: yup
                                    .array()
                                    .of(
                                        yup
                                            .object()
                                            .shape({
                                                id: yup.number(),
                                                text: yup.string().min(3).max(255),
                                                item_id: yup.number(),
                                                item_option_selections: yup
                                                    .array()
                                                    .of(
                                                        yup
                                                            .object()
                                                            .shape({
                                                                id: yup.number(),
                                                                text: yup.string().min(3).max(255),
                                                                item_option_id: yup.number(),
                                                            })
                                                            .noUnknown()
                                                    )
                                                    .default([]),
                                            })
                                            .noUnknown()
                                    )
                                    .min(1)
                                    .required(),
                            })
                            .noUnknown()
                    )
                    .min(1)
                    .required(),
            })
            .noUnknown()

        const applicationAnswer = await updateApplicationAnswerSchema.validate(req.body)

        const currentApplicationAnswer: ApplicationAnswer = await prismaClient.applicationAnswer.findUnique({
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
        })

        const updatedApplicationAnswer: ApplicationAnswer = await prismaClient.$transaction(async (prisma) => {
            prismaClient.applicationAnswer.update({
                where: {
                    id: id,
                },
                data: {
                    date: applicationAnswer.date,
                    user_id: applicationAnswer.user_id,
                    application_id: applicationAnswer.application_id,
                    address_id: applicationAnswer.address_id,
                },
            })
            prismaClient.itemAnswerGroup.deleteMany({
                where: {
                    id: { notIn: applicationAnswer.item_answer_groups.map((itemAnswerGroup) => itemAnswerGroup.id) },
                },
            })
            for (const itemAnswerGroup of applicationAnswer.item_answer_groups) {
                const createdItemAnswerGroup = await prismaClient.itemAnswerGroup.upsert({
                    where: {
                        id: itemAnswerGroup.id,
                    },
                    create: {
                        application_answer_id: updatedApplicationAnswer.id,
                    },
                    update: {
                        application_answer_id: updatedApplicationAnswer.id,
                    },
                })
                prismaClient.itemAnswer.deleteMany({
                    where: {
                        id: { notIn: itemAnswerGroup.item_answers.map((itemAnswer) => itemAnswer.id) },
                    },
                })
                for (const itemAnswer of itemAnswerGroup.item_answers) {
                    const createdItemAnswer = await prismaClient.itemAnswer.upsert({
                        where: {
                            id: itemAnswer.id,
                        },
                        create: {
                            text: itemAnswer.text,
                            item_id: itemAnswer.item_id,
                            group_id: createdItemAnswerGroup.id,
                        },
                        update: {
                            text: itemAnswer.text,
                            item_id: itemAnswer.item_id,
                            group_id: createdItemAnswerGroup.id,
                        },
                    })
                    prismaClient.itemOptionSelection.deleteMany({
                        where: {
                            id: {
                                notIn: itemAnswer.item_option_selections.map((itemOptionSelection) => itemOptionSelection.id),
                            },
                        },
                    })
                    for (const itemOptionSelection of itemAnswer.item_option_selections) {
                        await prismaClient.itemOptionSelection.upsert({
                            where: {
                                id: itemOptionSelection.id,
                            },
                            create: {
                                text: itemOptionSelection.text,
                                item_option_id: itemOptionSelection.item_option_id,
                                item_answer_id: createdItemAnswer.id,
                            },
                            update: {
                                text: itemOptionSelection.text,
                                item_option_id: itemOptionSelection.item_option_id,
                                item_answer_id: createdItemAnswer.id,
                            },
                        })
                    }
                }
            }
            return prismaClient.applicationAnswer.findUnique({
                where: {
                    id: updatedApplicationAnswer.id,
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
            })
        })
        res.status(200).json({ message: "Application answer updated.", data: updatedApplicationAnswer })
    } catch (error: any) {
        res.status(400).json({ error: error })
    }
}

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
        })
        res.status(200).json({ message: "All application answers found.", data: applicationAnswers })
    } catch (error: any) {
        res.status(400).json({ error: error })
    }
}

export const getApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.applicationAnswerId)

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
        })

        res.status(200).json({ message: "Application answer found.", data: applicationAnswer })
    } catch (error: any) {
        res.status(400).json({ error: error })
    }
}

export const deleteApplicationAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
        const applicationAnswerId: number = parseInt(req.params.applicationAnswerId)

        const deletedApplicationAnswer: ApplicationAnswer = await prismaClient.applicationAnswer.delete({
            where: {
                id: applicationAnswerId,
            },
        })

        res.status(200).json({ message: "Application answer deleted.", data: deletedApplicationAnswer })
    } catch (error: any) {
        res.status(400).json({ error: error })
    }
}
