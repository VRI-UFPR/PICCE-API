/*
Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>
*/

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
    classrooms: { select: { id: true, name: true, users: { select: { id: true, name: true, username: true, role: true } } } },
    users: { select: { id: true, name: true, username: true, role: true } },
    createdAt: true,
    updatedAt: true,
};

const getInstitutionUserRoles = async (user: User, institution: any, institutionId: number | undefined) => {
    institution =
        institution ||
        (await prismaClient.institution.findUniqueOrThrow({
            where: { id: institutionId },
            include: { users: { select: { id: true } } },
        }));

    const member = institution.users.some((u: any) => u.id === user.id);
    const coordinator = institution.users.some((u: any) => u.id === user.id && u.role === UserRole.COORDINATOR);

    return { member, coordinator };
};

const getInstitutionUserActions = async (user: User, institution: any, institutionId: number | undefined) => {
    const roles = await getInstitutionUserRoles(user, institution, institutionId);

    // Only the coordinator can perform update operations on an institution
    const toUpdate = roles.coordinator || user.role === UserRole.ADMIN;
    // Only the coordinator can perform delete operations on an institution
    const toDelete = roles.coordinator || user.role === UserRole.ADMIN;
    // Only members (except users and guests) can perform get operations on institutions
    const toGet = (roles.member && user.role !== UserRole.USER && user.role !== UserRole.GUEST) || user.role === UserRole.ADMIN;
    // No one can perform getAll operations on institutions
    const toGetAll = user.role === UserRole.ADMIN;
    // Anyone (except users and guests) can perform getVisible operations on institutions
    const toGetVisible = user.role !== UserRole.USER && user.role !== UserRole.GUEST;

    return { toUpdate, toDelete, toGet, toGetAll, toGetVisible };
};

const checkAuthorization = async (user: User, institutionId: number | undefined, action: string) => {
    if (user.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create':
        case 'getAll':
            // No one can perform create/getAll operations on institutions
            throw new Error('This user is not authorized to perform this action');
            break;
        case 'update':
        case 'delete': {
            // Only the coordinator can perform update/delete operations on an institution
            const roles = await getInstitutionUserRoles(user, undefined, institutionId);
            if (!roles.coordinator) throw new Error('This user is not authorized to perform this action');
        }
        case 'get': {
            // Only members (except users and guests) can perform get operations on institutions
            const roles = await getInstitutionUserRoles(user, undefined, institutionId);
            if (!roles.member || user.role === UserRole.USER || user.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
        }
        case 'getVisible':
            // Anyone (except users and guests) can perform getVisible operations on institutions
            if (user.role === UserRole.USER || user.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
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
