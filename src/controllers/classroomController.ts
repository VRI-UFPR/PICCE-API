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
import { User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';
import { getPeerUserActions, getVisibleFields as getUsersVisibleFields } from './userController';

const detailedClassroomFields = {
    users: { include: { institution: { select: { id: true } }, creator: { select: { id: true } } } },
    institution: { select: { id: true } },
    creator: { select: { id: true } },
};

const getDetailedClassrooms = async (classroomsIds: number[]) => {
    return await prismaClient.classroom.findMany({ where: { id: { in: classroomsIds } }, include: detailedClassroomFields });
};

export const getVisibleFields = async (user: User, classrooms: Awaited<ReturnType<typeof getDetailedClassrooms>>) => {
    const classroomRoles = await getClassroomUserRoles(user, classrooms);

    const visibleFields = classroomRoles.map((roles) => {
        const fullAccess = roles.creator || user.role === UserRole.ADMIN;
        const baseAccess =
            ((roles.viewer || roles.member) && user.role !== UserRole.GUEST && user.role !== UserRole.USER) ||
            roles.institutionMember ||
            roles.creator ||
            user.role === UserRole.ADMIN;

        const fields = {
            id: baseAccess,
            createdAt: baseAccess,
            updatedAt: baseAccess,
            name: baseAccess,
            users: { select: { id: baseAccess } },
            creator: { select: { id: fullAccess, username: fullAccess } },
        };

        return fields;
    });

    return visibleFields;
};

const getClassroomUserRoles = async (user: User, classrooms: Awaited<ReturnType<typeof getDetailedClassrooms>>) => {
    const roles = classrooms.map((classroom) => {
        const creator = classroom.creator.id === user.id;
        const member = classroom.users.some(({ id }) => id === user.id);
        const institutionMember = user.institutionId && classroom.institution?.id === user.institutionId;
        const viewer = !classroom.institution && user.role !== UserRole.GUEST && user.role !== UserRole.USER;

        return { creator, institutionMember, member, viewer };
    });

    return roles;
};

export const getClassroomUserActions = async (user: User, classrooms: Awaited<ReturnType<typeof getDetailedClassrooms>>) => {
    const classroomsRoles = await getClassroomUserRoles(user, classrooms);

    const actions = classroomsRoles.map((roles) => {
        // Only institution members (except users and guests)/creator can perform update operations on classrooms
        const toUpdate =
            roles.creator ||
            (roles.institutionMember && user.role !== UserRole.USER && user.role !== UserRole.GUEST) ||
            user.role === UserRole.ADMIN;
        // Only institution members (except users and guests)/creator can perform delete operations on classrooms
        const toDelete =
            roles.creator ||
            (roles.institutionMember && user.role !== UserRole.USER && user.role !== UserRole.GUEST) ||
            user.role === UserRole.ADMIN;
        // Only institution members (except users and guests)/creator can perform get operations on classrooms
        const toGet =
            roles.creator ||
            roles.viewer ||
            (roles.institutionMember && user.role !== UserRole.USER && user.role !== UserRole.GUEST) ||
            user.role === UserRole.ADMIN;
        // No one can perform get all classrooms operation on classrooms
        const toGetAll = user.role === UserRole.ADMIN;
        // Anyone except users and guests can perform create operations on classrooms
        const toSearch = user.role !== UserRole.USER && user.role !== UserRole.GUEST;
        // Anyone can perform getMy operation on classrooms
        const toGetMy = true;
        // Anyone can perform getManaged operation on classrooms
        const toGetManaged = true;

        return { toDelete, toGet, toUpdate };
    });

    return actions;
};

const validateInstitution = (user: User, institutionId: number | undefined) => {
    if (institutionId && user.institutionId !== institutionId) throw new Error('This user is not authorized to perform this action');
};

const checkAuthorization = async (user: User, classroomsIds: number[], action: string) => {
    if (user.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create': {
            // Anyone except users and guests can perform create operations on classrooms (if institutionId is provided, the user must be from that institution)
            if (user.role === UserRole.USER || user.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'update': {
            if ((await getClassroomUserActions(user, await getDetailedClassrooms(classroomsIds))).some(({ toUpdate }) => !toUpdate))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getAll':
            // No one can perform get all classrooms operation on classrooms
            throw new Error('This user is not authorized to perform this action');
        case 'get': {
            if ((await getClassroomUserActions(user, await getDetailedClassrooms(classroomsIds))).some(({ toGet }) => !toGet))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'delete': {
            if ((await getClassroomUserActions(user, await getDetailedClassrooms(classroomsIds))).some(({ toDelete }) => !toDelete))
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'search':
            // Anyone except USERS and GUESTS can perform search classrooms operation
            if (user.role === UserRole.USER || user.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        case 'getMy':
        case 'getManaged':
            // Anyone can perform getMy operation on classrooms (since the result is filtered according to the user)
            break;
    }
};

const validateUsers = async (institutionId: number | undefined, users: number[]) => {
    const guestUsers = await prismaClient.user.findMany({ where: { id: { in: users }, role: { in: [UserRole.GUEST, UserRole.ADMIN] } } });
    if (guestUsers.length > 0) throw new Error('A classroom can not contain GUEST or ADMIN users.');
    if (institutionId) {
        const invalidUsers = await prismaClient.user.findMany({ where: { id: { in: users }, institutionId: { not: institutionId } } });
        if (invalidUsers.length > 0) throw new Error('An institution classroom can only contain users from the institution.');
    }
};

export const createClassroom = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createClassroomSchema = yup
            .object()
            .shape({
                name: yup.string().min(3).max(20).required(),
                institutionId: yup.number(),
                users: yup.array().of(yup.number()).min(2).required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const classroom = await createClassroomSchema.validate(req.body);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to create a classroom
        await checkAuthorization(user, [], 'create');
        // Check if users are from the same institution
        await validateUsers(classroom.institutionId, classroom.users as number[]);
        // Check if user is authorized to create a classroom in this institution
        validateInstitution(user, classroom.institutionId);
        // Prisma operation
        const detailedCreatedClassroom = await prismaClient.classroom.create({
            data: {
                name: classroom.name,
                institution: { connect: classroom.institutionId ? { id: classroom.institutionId } : undefined },
                users: { connect: classroom.users.map((id) => ({ id: id })) },
                creator: { connect: { id: user.id } },
            },
            include: detailedClassroomFields,
        });
        // Get classroom only with visible fields and with embedded actions
        const visibleClassroom = {
            ...(await prismaClient.classroom.findUnique({
                where: { id: detailedCreatedClassroom.id },
                select: (await getVisibleFields(user, [detailedCreatedClassroom]))[0],
            })),
            actions: (await getClassroomUserActions(user, [detailedCreatedClassroom]))[0],
        };
        // Get users only with visible fields and with embedded actions
        const detailedUsers = detailedCreatedClassroom.users;
        const userActions = await getPeerUserActions(user, detailedUsers);
        const userFields = await getUsersVisibleFields(user, detailedUsers);
        const visibleClassroomWUsers = {
            ...visibleClassroom,
            users: await Promise.all(
                detailedUsers.map(async (user, i) => ({
                    ...(await prismaClient.user.findUnique({ where: { id: user.id }, select: userFields[i] })),
                    actions: userActions[i],
                }))
            ),
        };

        res.status(201).json({ message: 'Classroom created.', data: visibleClassroomWUsers });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateClassroom = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const classroomId: number = parseInt(req.params.classroomId);
        // Yup schemas
        const updateClassroomSchema = yup
            .object()
            .shape({
                name: yup.string().min(3).max(20),
                institutionId: yup.number(),
                users: yup.array().of(yup.number()).min(2),
            })
            .noUnknown();
        // Yup parsing/validation
        const classroom = await updateClassroomSchema.validate(req.body);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to update this classroom
        await checkAuthorization(user, [classroomId], 'update');
        // Check if users are from the same institution
        await validateUsers(classroom.institutionId, classroom.users as number[]);
        // Check if user is authorized to update this classroom in this institution
        validateInstitution(user, classroom.institutionId);
        // Prisma operation
        const detailedUpdatedClassroom = await prismaClient.classroom.update({
            where: { id: classroomId },
            data: {
                name: classroom.name,
                institution: classroom.institutionId ? { connect: { id: classroom.institutionId } } : { disconnect: true },
                users: { set: [], connect: classroom.users?.map((id) => ({ id: id })) },
            },
            include: detailedClassroomFields,
        });

        // Get classroom only with visible fields and with embedded actions
        const visibleClassroom = {
            ...(await prismaClient.classroom.findUnique({
                where: { id: classroomId },
                select: (await getVisibleFields(user, [detailedUpdatedClassroom]))[0],
            })),
            actions: (await getClassroomUserActions(user, [detailedUpdatedClassroom]))[0],
        };
        // Get users only with visible fields and with embedded actions
        const detailedUsers = detailedUpdatedClassroom.users;
        const userActions = await getPeerUserActions(user, detailedUsers);
        const userFields = await getUsersVisibleFields(user, detailedUsers);
        const visibleClassroomWUsers = {
            ...visibleClassroom,
            users: await Promise.all(
                detailedUsers.map(async (user, i) => ({
                    ...(await prismaClient.user.findUnique({ where: { id: user.id }, select: userFields[i] })),
                    actions: userActions[i],
                }))
            ),
        };
        res.status(200).json({ message: 'Classroom updated.', data: visibleClassroomWUsers });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllClassrooms = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get all classrooms (only roles above USER)
        await checkAuthorization(user, [], 'getAll');
        // Prisma operation
        const classrooms = await prismaClient.classroom.findMany({ include: detailedClassroomFields });
        // Get classrooms only with visible fields and with embedded actions
        const actions = await getClassroomUserActions(user, classrooms);
        const fields = await getVisibleFields(user, classrooms);
        const visibleClassrooms = await Promise.all(
            classrooms.map(async (classroom, i) => {
                const visibleClassroom = {
                    ...(await prismaClient.classroom.findUnique({ where: { id: classroom.id }, select: fields[i] })),
                    actions: actions[i],
                };

                // Get users only with visible fields and with embedded actions
                const detailedUsers = classroom.users;
                const userActions = await getPeerUserActions(user, detailedUsers);
                const userFields = await getUsersVisibleFields(user, detailedUsers);
                const visibleClassroomWUsers = {
                    ...visibleClassroom,
                    users: await Promise.all(
                        detailedUsers.map(async (user, i) => ({
                            ...(await prismaClient.user.findUnique({ where: { id: user.id }, select: userFields[i] })),
                            actions: userActions[i],
                        }))
                    ),
                };

                return visibleClassroomWUsers;
            })
        );

        res.status(200).json({ message: 'All classrooms found.', data: visibleClassrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getClassroom = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const classroomId: number = parseInt(req.params.classroomId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get this classroom
        await checkAuthorization(user, [classroomId], 'get');
        // Prisma operation
        const detailedClassroom = await prismaClient.classroom.findUniqueOrThrow({
            where: { id: classroomId },
            include: detailedClassroomFields,
        });
        // Get classroom only with visible fields and with embedded actions
        const visibleClassroom = {
            ...(await prismaClient.classroom.findUnique({
                where: { id: classroomId },
                select: (await getVisibleFields(user, [detailedClassroom]))[0],
            })),
            actions: (await getClassroomUserActions(user, [detailedClassroom]))[0],
        };

        // Get users only with visible fields and with embedded actions
        const detailedUsers = detailedClassroom.users;
        const userActions = await getPeerUserActions(user, detailedUsers);
        const userFields = await getUsersVisibleFields(user, detailedUsers);
        const visibleClassroomWUsers = {
            ...visibleClassroom,
            users: await Promise.all(
                detailedUsers.map(async (user, i) => ({
                    ...(await prismaClient.user.findUnique({ where: { id: user.id }, select: userFields[i] })),
                    actions: userActions[i],
                }))
            ),
        };

        res.status(200).json({ message: 'Classroom found.', data: visibleClassroomWUsers });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getMyClassrooms = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get his classrooms
        await checkAuthorization(user, [], 'getMy');
        // Prisma operation
        const detailedClassrooms = await prismaClient.classroom.findMany({
            where: { users: { some: { id: user.id } } },
            include: detailedClassroomFields,
        });
        // Get classrooms only with visible fields and with embedded actions
        const actions = await getClassroomUserActions(user, detailedClassrooms);
        const fields = await getVisibleFields(user, detailedClassrooms);
        const visibleClassrooms = await Promise.all(
            detailedClassrooms.map(async (classroom, i) => {
                const visibleClassroom = {
                    ...(await prismaClient.classroom.findUnique({ where: { id: classroom.id }, select: fields[i] })),
                    actions: actions[i],
                };

                // Get users only with visible fields and with embedded actions
                const detailedUsers = classroom.users;
                const userActions = await getPeerUserActions(user, detailedUsers);
                const userFields = await getUsersVisibleFields(user, detailedUsers);
                const visibleClassroomWUsers = {
                    ...visibleClassroom,
                    users: await Promise.all(
                        detailedUsers.map(async (user, i) => ({
                            ...(await prismaClient.user.findUnique({ where: { id: user.id }, select: userFields[i] })),
                            actions: userActions[i],
                        }))
                    ),
                };

                return visibleClassroomWUsers;
            })
        );

        res.status(200).json({ message: 'My classrooms found.', data: visibleClassrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getManagedClassrooms = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get his managed classrooms
        await checkAuthorization(user, [], 'getManaged');
        // Prisma operation
        const detailedClassrooms = await prismaClient.classroom.findMany({
            where: {
                ...(user.role !== UserRole.ADMIN && {
                    // Admins can manage all classrooms
                    OR: [
                        ...(user.role === UserRole.COORDINATOR ? [{ institutionId: user.institutionId }] : []), // Coordinators can manage classrooms from their institutions and users they created
                        { creatorId: user.id }, // Publishers and appliers can only manage classrooms they created
                    ],
                }),
            },
            include: detailedClassroomFields,
        });
        // Get classrooms only with visible fields and with embedded actions
        const actions = await getClassroomUserActions(user, detailedClassrooms);
        const fields = await getVisibleFields(user, detailedClassrooms);
        const visibleClassrooms = await Promise.all(
            detailedClassrooms.map(async (classroom, i) => {
                const visibleClassroom = {
                    ...(await prismaClient.classroom.findUnique({ where: { id: classroom.id }, select: fields[i] })),
                    actions: actions[i],
                };

                // Get users only with visible fields and with embedded actions
                const detailedUsers = classroom.users;
                const userActions = await getPeerUserActions(user, detailedUsers);
                const userFields = await getUsersVisibleFields(user, detailedUsers);
                const visibleClassroomWUsers = {
                    ...visibleClassroom,
                    users: await Promise.all(
                        detailedUsers.map(async (user, i) => ({
                            ...(await prismaClient.user.findUnique({ where: { id: user.id }, select: userFields[i] })),
                            actions: userActions[i],
                        }))
                    ),
                };

                return visibleClassroomWUsers;
            })
        );

        res.status(200).json({ message: 'My managed classrooms found.', data: visibleClassrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const searchClassroomByName = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from passport-jwt
        const user = req.user as User;
        // Check if user is authorized to search users
        await checkAuthorization(user, [], 'search');
        // Yup schemas
        const searchUserSchema = yup
            .object()
            .shape({ term: yup.string().min(3).max(20).required() })
            .noUnknown();
        // Yup parsing/validation
        const { term } = await searchUserSchema.validate(req.body);
        // Prisma operation
        const detailedClassrooms = await prismaClient.classroom.findMany({
            where: {
                name: { startsWith: term },
                ...(user.role !== UserRole.ADMIN && {
                    OR: [{ institutionId: user.institutionId }, { institutionId: null }],
                }),
            },
            include: detailedClassroomFields,
        });
        // Get classrooms only with visible fields and with embedded actions
        const actions = await getClassroomUserActions(user, detailedClassrooms);
        const fields = await getVisibleFields(user, detailedClassrooms);
        const visibleClassrooms = await Promise.all(
            detailedClassrooms.map(async (classroom, i) => {
                const visibleClassroom = {
                    ...(await prismaClient.classroom.findUnique({ where: { id: classroom.id }, select: fields[i] })),
                    actions: actions[i],
                };

                // Get users only with visible fields and with embedded actions
                const detailedUsers = classroom.users;
                const userActions = await getPeerUserActions(user, detailedUsers);
                const userFields = await getUsersVisibleFields(user, detailedUsers);
                const visibleClassroomWUsers = {
                    ...visibleClassroom,
                    users: await Promise.all(
                        detailedUsers.map(async (user, i) => ({
                            ...(await prismaClient.user.findUnique({ where: { id: user.id }, select: userFields[i] })),
                            actions: userActions[i],
                        }))
                    ),
                };

                return visibleClassroomWUsers;
            })
        );

        res.status(200).json({ message: 'Searched classrooms found.', data: visibleClassrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteClassroom = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const classroomId: number = parseInt(req.params.classroomId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to delete this classroom
        await checkAuthorization(user, [classroomId], 'delete');
        // Prisma operation
        const deletedClassroom = await prismaClient.classroom.delete({ where: { id: classroomId }, select: { id: true } });

        res.status(200).json({ message: 'Classroom deleted.', data: deletedClassroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
