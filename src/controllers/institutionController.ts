import { Response, Request } from 'express';
import { InstitutionType, User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

// Fields to be selected from the database to the response
const fields = {
    id: true,
    name: true,
    type: true,
    address: { select: { id: true, city: true, state: true, country: true } },
    classrooms: { select: { id: true, users: { select: { id: true, name: true, username: true, role: true } } } },
    users: { select: { id: true, name: true, username: true, role: true } },
    createdAt: true,
    updateAt: true,
};

const checkAuthorization = async (user: User, institutionId: number | undefined, action: string) => {
    switch (action) {
        case 'create':
        case 'getAll':
            // Only ADMINs can perform create/getAll operations on institutions
            if (user.role !== UserRole.ADMIN) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
        case 'update':
        case 'delete':
            // Only ADMINs and COORDINATORs of an institution can perform update/delete operations on it
            if (user.role !== UserRole.ADMIN && (user.role !== UserRole.COORDINATOR || user.institutionId !== institutionId)) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
        case 'get':
        case 'getVisible':
            // Only ADMINs and members (except USERs) of an institution can perform get/getVisible operations on it (the result will be filtered based on user)
            if (user.role !== UserRole.ADMIN && (user.role === UserRole.USER || user.institutionId !== institutionId)) {
                throw new Error('This user is not authorized to perform this action');
            }
            break;
    }
};

export const createInstitution = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createInstitutionSchema = yup
            .object()
            .shape({
                id: yup.number(),
                name: yup.string().min(1).max(255).required(),
                type: yup.string().oneOf(Object.values(InstitutionType)).required(),
                addressId: yup.number().required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const institution = await createInstitutionSchema.validate(req.body);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to create an institution
        await checkAuthorization(user, undefined, 'create');
        // Prisma operation
        const createdInstitution = await prismaClient.institution.create({
            data: { id: institution.id, name: institution.name, type: institution.type, addressId: institution.addressId },
            select: fields,
        });

        res.status(201).json({ message: 'Institution created.', data: createdInstitution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateInstitution = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const institutionId: number = parseInt(req.params.institutionId);
        // Yup schemas
        const updateInstitutionSchema = yup
            .object()
            .shape({
                name: yup.string().min(1).max(255),
                type: yup.string().oneOf(Object.values(InstitutionType)),
                addressId: yup.number(),
            })
            .noUnknown();
        // Yup parsing/validation
        const institution = await updateInstitutionSchema.validate(req.body);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to update an institution
        await checkAuthorization(user, institutionId, 'update');
        // Prisma operation
        const updatedInstitution = await prismaClient.institution.update({
            where: { id: institutionId },
            data: { name: institution.name, type: institution.type, addressId: institution.addressId },
            select: fields,
        });

        res.status(200).json({ message: 'Institution updated.', data: updatedInstitution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllInstitutions = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get all institutions (only admins)
        await checkAuthorization(user, undefined, 'getAll');
        // Prisma operation
        const institutions = await prismaClient.institution.findMany({ select: fields });

        res.status(200).json({ message: 'All institutions found.', data: institutions });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getVisibleInstitutions = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get their institutions
        await checkAuthorization(user, undefined, 'getVisible');
        // Prisma operation
        const institutions =
            user.role === UserRole.ADMIN
                ? await prismaClient.institution.findMany({ select: fields })
                : await prismaClient.institution.findMany({ where: { users: { some: { id: user.id } } }, select: fields });

        res.status(200).json({ message: 'My institutions found.', data: institutions });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getInstitution = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const institutionId: number = parseInt(req.params.institutionId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get an institution
        await checkAuthorization(user, institutionId, 'get');
        // Prisma operation
        const institution = await prismaClient.institution.findUniqueOrThrow({ where: { id: institutionId }, select: fields });

        res.status(200).json({ message: 'Institution found.', data: institution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteInstitution = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const institutionId: number = parseInt(req.params.institutionId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to delete an institution
        await checkAuthorization(user, institutionId, 'delete');
        // Prisma operation
        const deletedInstitution = await prismaClient.institution.delete({ where: { id: institutionId }, select: { id: true } });

        res.status(200).json({ message: 'Institution deleted.', data: deletedInstitution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
