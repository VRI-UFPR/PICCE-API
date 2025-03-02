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

const detailedInstitutionFields = {
    users: { select: { id: true, role: true, institution: { select: { id: true } } } },
    classrooms: { select: { id: true, users: { select: { id: true, role: true, institution: { select: { id: true } } } } } },
};

const getDetailedInstitutions = async (institutionsIds: number[]) => {
    return await prismaClient.institution.findMany({
        where: { id: { in: institutionsIds } },
        include: detailedInstitutionFields,
    });
};

const getInstitutionUserRoles = async (user: User, institutions: Awaited<ReturnType<typeof getDetailedInstitutions>>) => {
    const roles = institutions.map((institution) => {
        const member = institution.id === user.institutionId;
        const coordinator = institution.id === user.institutionId && user.role === UserRole.COORDINATOR;
        return { member, coordinator };
    });
    return roles;
};

const getVisibleFields = async (user: User, institutions: Awaited<ReturnType<typeof getDetailedInstitutions>>) => {
    const roles = await getInstitutionUserRoles(user, institutions);

    const fields = roles.map((roles) => {
        const fullAccess = roles.coordinator || user.role === UserRole.ADMIN;
        const creatorAccess =
            (roles.member && user.role !== UserRole.GUEST && user.role !== UserRole.USER) ||
            roles.coordinator ||
            user.role === UserRole.ADMIN;
        const baseAccess = roles.member || roles.coordinator || user.role === UserRole.ADMIN;

        const fields = {
            id: baseAccess,
            createdAt: baseAccess,
            updatedAt: baseAccess,
            name: baseAccess,
            type: baseAccess,
            address: {
                select: {
                    city: baseAccess,
                    state: baseAccess,
                    country: baseAccess,
                },
            },
            users: {
                select: {
                    id: creatorAccess,
                    name: creatorAccess,
                    username: creatorAccess,
                    role: creatorAccess,
                },
            },
            classrooms: {
                select: {
                    id: creatorAccess,
                    name: creatorAccess,
                    users: {
                        select: {
                            id: creatorAccess,
                            name: creatorAccess,
                            username: creatorAccess,
                            role: creatorAccess,
                        },
                    },
                },
            },
        };

        return fields;
    });

    return fields;
};

const getInstitutionUserActions = async (user: User, institutions: Awaited<ReturnType<typeof getDetailedInstitutions>>) => {
    const institutionsRoles = await getInstitutionUserRoles(user, institutions);

    const actions = institutionsRoles.map((roles) => {
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

        return { toDelete, toGet, toUpdate };
    });

    return actions;
};

const checkAuthorization = async (user: User, institutionsIds: number[], action: string) => {
    if (user.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create':
        case 'getAll': {
            // No one can perform create/getAll operations on institutions
            throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'update': {
            if ((await getInstitutionUserActions(user, await getDetailedInstitutions(institutionsIds))).some(({ toUpdate }) => !toUpdate))
                throw new Error('This user is not authorized to perform this action');
        }
        case 'delete': {
            if ((await getInstitutionUserActions(user, await getDetailedInstitutions(institutionsIds))).some(({ toDelete }) => !toDelete))
                throw new Error('This user is not authorized to perform this action');
        }
        case 'get': {
            if ((await getInstitutionUserActions(user, await getDetailedInstitutions(institutionsIds))).some(({ toGet }) => !toGet))
                throw new Error('This user is not authorized to perform this action');
        }
        case 'getVisible': {
            // Anyone (except users and guests) can perform getVisible operations on institutions
            if (user.role === UserRole.USER || user.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        }
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
        await checkAuthorization(user, [], 'create');
        // Prisma operation
        const detailedCreatedInstitution = await prismaClient.institution.create({
            data: { id: institution.id, name: institution.name, type: institution.type, addressId: institution.addressId },
            include: detailedInstitutionFields,
        });
        // Get institution only with visible fields and with embedded actions
        const visibleInstitution = {
            ...(await prismaClient.institution.findUnique({
                where: { id: detailedCreatedInstitution.id },
                select: (await getVisibleFields(user, [detailedCreatedInstitution]))[0],
            })),
            actions: (await getInstitutionUserActions(user, [detailedCreatedInstitution]))[0],
        };

        res.status(201).json({ message: 'Institution created.', data: visibleInstitution });
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
        await checkAuthorization(user, [institutionId], 'update');
        // Prisma operation
        const detailedUpdatedInstitution = await prismaClient.institution.update({
            where: { id: institutionId },
            data: { name: institution.name, type: institution.type, addressId: institution.addressId },
            include: detailedInstitutionFields,
        });
        // Get institution only with visible fields and with embedded actions
        const visibleInstitution = {
            ...(await prismaClient.institution.findUnique({
                where: { id: detailedUpdatedInstitution.id },
                select: (await getVisibleFields(user, [detailedUpdatedInstitution]))[0],
            })),
            actions: (await getInstitutionUserActions(user, [detailedUpdatedInstitution]))[0],
        };

        res.status(200).json({ message: 'Institution updated.', data: visibleInstitution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllInstitutions = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get all institutions (only admins)
        await checkAuthorization(user, [], 'getAll');
        // Prisma operation
        const detailedInstitutions = await prismaClient.institution.findMany({ include: detailedInstitutionFields });
        // Get institutions only with visible fields and with embedded actions
        const actions = await getInstitutionUserActions(user, detailedInstitutions);
        const fields = await getVisibleFields(user, detailedInstitutions);
        const visibleInstitutions = await Promise.all(
            detailedInstitutions.map(async (institution, index) => ({
                ...(await prismaClient.institution.findUnique({ where: { id: institution.id }, select: fields[index] })),
                actions: actions[index],
            }))
        );

        res.status(200).json({ message: 'All institutions found.', data: visibleInstitutions });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getVisibleInstitutions = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get their institutions
        await checkAuthorization(user, [], 'getVisible');
        // Prisma operation
        const detailedInstitutions =
            user.role === UserRole.ADMIN
                ? // Admins can see all institutions
                  await prismaClient.institution.findMany({ include: detailedInstitutionFields })
                : // Other users can see only their institutions
                  await prismaClient.institution.findMany({
                      where: { users: { some: { id: user.id } } },
                      include: detailedInstitutionFields,
                  });
        // Get institutions only with visible fields and with embedded actions
        const actions = await getInstitutionUserActions(user, detailedInstitutions);
        const fields = await getVisibleFields(user, detailedInstitutions);
        const visibleInstitutions = await Promise.all(
            detailedInstitutions.map(async (institution, index) => ({
                ...(await prismaClient.institution.findUnique({ where: { id: institution.id }, select: fields[index] })),
                actions: actions[index],
            }))
        );

        res.status(200).json({ message: 'Visible institutions found.', data: visibleInstitutions });
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
        await checkAuthorization(user, [institutionId], 'get');
        // Prisma operation
        const detailedInstitution = await prismaClient.institution.findUniqueOrThrow({
            where: { id: institutionId },
            include: detailedInstitutionFields,
        });
        // Get institution only with visible fields and with embedded actions
        const visibleInstitution = {
            ...(await prismaClient.institution.findUnique({
                where: { id: detailedInstitution.id },
                select: (await getVisibleFields(user, [detailedInstitution]))[0],
            })),
            actions: (await getInstitutionUserActions(user, [detailedInstitution]))[0],
        };

        res.status(200).json({ message: 'Institution found.', data: visibleInstitution });
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
        await checkAuthorization(user, [institutionId], 'delete');
        // Prisma operation
        const deletedInstitution = await prismaClient.institution.delete({ where: { id: institutionId }, select: { id: true } });

        res.status(200).json({ message: 'Institution deleted.', data: deletedInstitution });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
