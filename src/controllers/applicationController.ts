import { Response, Request } from "express";
import { Application } from "@prisma/client";
import * as yup from "yup";
import prismaClient from "../services/prismaClient";

export const createApplication = async (req: Request, res: Response) => {
    try {
        const createApplicationSchema = yup
            .object()
            .shape({
                protocolId: yup.number().required(),
                applicatorId: yup.number().required(),
                visibilityMode: yup.string().required(),
                viewersUser: yup.array().of(yup.number()).min(1).required(),
                viewersClassroom: yup.array().of(yup.number()).min(1).required(),
            })
            .noUnknown();

        const application = await createApplicationSchema.validate(req.body);

        const createdApplication: Application = await prismaClient.application.create({
            data: {
                protocolId: application.protocolId,
                applicatorId: application.applicatorId,
                visibilityMode: application.viewersClassroom,
                viewersUser: {
                    connect: application.viewersUser.map((id) => ({ id: id })),
                },
                viewersClassroom: {
                    connect: application.viewersUser.map((id) => ({ id: id })),
                },
            },
        });

        res.status(201).json({ message: "Application created.", data: createdApplication });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const updateApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.applicationId);

        const updateApplicationSchema = yup
            .object()
            .shape({
                protocolId: yup.number(),
                applicatorId: yup.number(),
                visibilityMode: yup.string(),
                viewersUser: yup.array().of(yup.number()).min(1).required(),
                viewersClassroom: yup.array().of(yup.number()).min(1).required(),
            })
            .noUnknown();

        const application = await updateApplicationSchema.validate(req.body);

        const updatedApplication: Application = await prismaClient.application.update({
            where: {
                id,
            },
            data: {
                protocolId: application.protocolId,
                applicatorId: application.applicatorId,
                visibilityMode: application.visibilityMode,
                viewersUser: {
                    set: [],
                    connect: application.viewersUser.map((id) => ({ id: id })),
                },
                viewersClassroom: {
                    set: [],
                    connect: application.viewersUser.map((id) => ({ id: id })),
                },
            },
        });

        res.status(200).json({ message: "Application updated.", data: updatedApplication });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const getAllApplications = async (req: Request, res: Response): Promise<void> => {
    try {
        const applicationes: Application[] = await prismaClient.application.findMany();
        res.status(200).json({ message: "All applicationes found.", data: applicationes });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const getApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.applicationId);

        const application: Application = await prismaClient.application.findUniqueOrThrow({
            where: {
                id,
            },
        });

        res.status(200).json({ message: "Application found.", data: application });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const deleteApplication = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.applicationId);

        const deletedApplication: Application = await prismaClient.application.delete({
            where: {
                id,
            },
        });

        res.status(200).json({ message: "Application deleted.", data: deletedApplication });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};
