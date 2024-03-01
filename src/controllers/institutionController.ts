import { Response, Request } from 'express';
import { InstitutionType, User } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

const fieldsWithNesting = {
    id: true,
    name: true,
    type: true,
    address: {
        select: {
            id: true,
            city: true,
            state: true,
            country: true,
        },
    },
    classrooms: {
        select: {
            id: true,
        },
    },
    createdAt: true,
    updateAt: true,
};

const checkAuthorization = (user: User, id: number) => {
    if (user.role !== 'ADMIN' && (user.institutionId !== id || user.role !== 'COORDINATOR')) {
        throw new Error('This user is not authorized to perform this action');
    }
};

export const createInstitution = async (req: Request, res: Response) => {
    try {
        const createInstitutionSchema = yup
            .object()
            .shape({
                id: yup.number(),
                name: yup.string().min(1).max(255).required(),
                type: yup.string().oneOf(Object.values(InstitutionType)).required(),
                addressId: yup.number().required(),
            })
            .noUnknown();

        const institution = await createInstitutionSchema.validate(req.body);

        const user = req.user as User;

        if (user.role !== 'ADMIN') {
            throw new Error('This user is not authorized to perform this action');
        }

        const createdInstitution = await prismaClient.institution.create({
            data: {
                id: institution.id,
                name: institution.name,
                type: institution.type,
                addressId: institution.addressId,
            },
            select: fieldsWithNesting,
        });

        res.status(201).json({ message: 'Institution created.', data: createdInstitution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateInstitution = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.institutionId);

        const updateInstitutionSchema = yup
            .object()
            .shape({
                name: yup.string().min(1).max(255),
                type: yup.string().oneOf(Object.values(InstitutionType)),
                addressId: yup.number(),
            })
            .noUnknown();

        const institution = await updateInstitutionSchema.validate(req.body);

        const user = req.user as User;

        checkAuthorization(user, id);

        const updatedInstitution = await prismaClient.institution.update({
            where: {
                id,
            },
            data: {
                name: institution.name,
                type: institution.type,
                addressId: institution.addressId,
            },
            select: fieldsWithNesting,
        });

        res.status(200).json({ message: 'Institution updated.', data: updatedInstitution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllInstitutions = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user as User;

        if (user.role !== 'ADMIN') {
            throw new Error('This user is not authorized to perform this action');
        }

        const institutions = await prismaClient.institution.findMany({ select: fieldsWithNesting });

        res.status(200).json({ message: 'All institutions found.', data: institutions });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getInstitution = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.institutionId);

        const user = req.user as User;

        checkAuthorization(user, id);

        const institution = await prismaClient.institution.findUniqueOrThrow({
            where: {
                id,
            },
            select: fieldsWithNesting,
        });

        res.status(200).json({ message: 'Institution found.', data: institution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteInstitution = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.institutionId);

        const user = req.user as User;

        checkAuthorization(user, id);

        const deletedInstitution = await prismaClient.institution.delete({
            where: { id },
            select: { id: true },
        });

        res.status(200).json({ message: 'Institution deleted.', data: deletedInstitution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
