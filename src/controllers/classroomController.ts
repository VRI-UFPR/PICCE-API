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
import { Classroom, User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

// Fields to be selected from the database to the response
const fields = {
    id: true,
    name: true,
    institution: { select: { id: true, name: true } },
    users: { select: { id: true, name: true, username: true, role: true } },
    createdAt: true,
    updatedAt: true,
};

const publicFields = {
    id: true,
    name: true,
    users: { select: { id: true, name: true, username: true, role: true } },
};

const getClassroomUserRoles = async (user: User, classroom: any, classroomId: number | undefined) => {
    classroom =
        classroom ||
        (await prismaClient.classroom.findUniqueOrThrow({
            where: { id: classroomId },
            include: { users: { select: { id: true } } },
        }));

    const creator = classroom?.creatorId === user.id;
    const member = classroom?.users.some((u: any) => u.id === user.id);
    const institutionMember = classroom?.institutionId === user.institutionId;

    return { creator, member, institutionMember };
};

const getClassroomUserActions = async (user: User, classroom: any, classroomId: number | undefined) => {
    const roles = await getClassroomUserRoles(user, classroom, classroomId);

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
        (roles.institutionMember && user.role !== UserRole.USER && user.role !== UserRole.GUEST) ||
        user.role === UserRole.ADMIN;
    // No one can perform get all classrooms operation on classrooms
    const toGetAll = user.role === UserRole.ADMIN;
    // Anyone except users and guests can perform create operations on classrooms
    const toSearch = user.role !== UserRole.USER && user.role !== UserRole.GUEST;
    // Anyone can perform getMy operation on classrooms
    const toGetMy = true;

    return { toUpdate, toDelete, toGet, toGetAll, toSearch, toGetMy };
};

const checkAuthorization = async (user: User, classroomId: number | undefined, institutionId: number | undefined, action: string) => {
    if (user.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create':
            // Anyone except users and guests can perform create operations on classrooms (if institutionId is provided, the user must be from that institution)
            if (user.role === UserRole.USER || user.role === UserRole.GUEST || (institutionId && user.institutionId !== institutionId))
                throw new Error('This user is not authorized to perform this action');
            break;
        case 'update': {
            // Only institution members (except users and guests)/creator can perform update/delete operations on classrooms (if institutionId is provided, the user must be from that institution)
            const roles = await getClassroomUserRoles(user, undefined, classroomId);
            if (
                (!roles.creator && !roles.institutionMember) ||
                user.role === UserRole.USER ||
                user.role === UserRole.GUEST ||
                (institutionId && user.institutionId !== institutionId)
            )
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'getAll':
            // No one can perform get all classrooms operation on classrooms
            throw new Error('This user is not authorized to perform this action');
            break;
        case 'get':
        case 'delete': {
            // Only institution members (except users and guests)/creator can perform get/delete operations on classrooms
            const roles = await getClassroomUserRoles(user, undefined, classroomId);
            if ((!roles.creator && !roles.institutionMember) || user.role === UserRole.USER || user.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        }
        case 'search':
            // Anyone except USERS and GUESTS can perform search classrooms operation
            if (user.role === UserRole.USER || user.role === UserRole.GUEST)
                throw new Error('This user is not authorized to perform this action');
            break;
        case 'getMy':
            // Anyone can perform getMy operation on classrooms (since the result is filtered according to the user)
            break;
    }
};

const validateUsers = async (institutionId: number | undefined, users: number[]) => {
    const guestUsers = await prismaClient.user.findMany({ where: { id: { in: users }, role: UserRole.GUEST } });
    if (guestUsers.length > 0) throw new Error('A classroom can not contain GUEST users.');
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
        await checkAuthorization(user, undefined, classroom.institutionId, 'create');
        // Check if users are from the same institution
        await validateUsers(classroom.institutionId, classroom.users as number[]);
        // Prisma operation
        const createdClassroom: Classroom = await prismaClient.classroom.create({
            data: {
                name: classroom.name,
                institution: { connect: classroom.institutionId ? { id: classroom.institutionId } : undefined },
                users: { connect: classroom.users.map((id) => ({ id: id })) },
                creator: { connect: { id: user.id } },
            },
        });

        res.status(201).json({ message: 'Classroom created.', data: createdClassroom });
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
        await checkAuthorization(user, classroomId, classroom.institutionId, 'update');
        // Check if users are from the same institution
        await validateUsers(classroom.institutionId, classroom.users as number[]);
        // Prisma operation
        const updatedClassroom = await prismaClient.classroom.update({
            where: { id: classroomId },
            data: {
                name: classroom.name,
                institution: classroom.institutionId ? { connect: { id: classroom.institutionId } } : { disconnect: true },
                users: { set: [], connect: classroom.users?.map((id) => ({ id: id })) },
            },
            select: fields,
        });

        res.status(200).json({ message: 'Classroom updated.', data: updatedClassroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllClassrooms = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get all classrooms (only roles above USER)
        await checkAuthorization(user, undefined, undefined, 'getAll');
        // Prisma operation
        const classrooms = await prismaClient.classroom.findMany({ select: fields });

        res.status(200).json({ message: 'All classrooms found.', data: classrooms });
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
        await checkAuthorization(user, classroomId, undefined, 'get');
        // Prisma operation
        const classroom = await prismaClient.classroom.findUniqueOrThrow({ where: { id: classroomId }, select: fields });

        res.status(200).json({ message: 'Classroom found.', data: classroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getMyClassrooms = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get his classrooms
        await checkAuthorization(user, undefined, undefined, 'getMy');
        // Prisma operation
        const classrooms = await prismaClient.classroom.findMany({
            where: { users: { some: { id: user.id } } },
            select: fields,
        });

        res.status(200).json({ message: 'My classrooms found.', data: classrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const searchClassroomByName = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from passport-jwt
        const curUser = req.user as User;
        // Check if user is authorized to search users
        await checkAuthorization(curUser, undefined, undefined, 'search');
        // Yup schemas
        const searchUserSchema = yup
            .object()
            .shape({ term: yup.string().min(3).max(20).required() })
            .noUnknown();
        // Yup parsing/validation
        const { term } = await searchUserSchema.validate(req.body);
        // Prisma operation
        const classrooms = await prismaClient.classroom.findMany({
            where: { name: { startsWith: term } },
            select: publicFields,
        });

        res.status(200).json({ message: 'Searched classrooms found.', data: classrooms });
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
        await checkAuthorization(user, classroomId, undefined, 'delete');
        // Prisma operation
        const deletedClassroom = await prismaClient.classroom.delete({ where: { id: classroomId }, select: { id: true } });

        res.status(200).json({ message: 'Classroom deleted.', data: deletedClassroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
