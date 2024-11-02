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

// Only admins or the coordinator of the institution can perform C-UD operations on classrooms
const checkAuthorization = async (user: User, classroomId: number | undefined, institutionId: number | undefined, action: string) => {
    if (user.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create':
            // Only ADMINs or members of an institution can perform create operations on its classrooms
            if (user.role === UserRole.USER || (institutionId && user.institutionId !== institutionId))
                throw new Error('This user is not authorized to perform this action');
            break;
        case 'update':
        case 'delete':
            // Only ADMINs, COORDINATORs and PUBLISHERs of an institution can perform update/delete operations on its classrooms
            const deleteClassroom = await prismaClient.classroom.findUnique({
                where: user.institutionId ? { id: classroomId, institutionId: user.institutionId } : { id: classroomId },
            });
            if (
                user.role === UserRole.USER ||
                user.role === UserRole.APPLIER ||
                (institutionId && institutionId !== user.institutionId) ||
                !deleteClassroom
            )
                throw new Error('This user is not authorized to perform this action');

            break;
        case 'getAll':
            // Only ADMINs can perform get all classrooms operation
            throw new Error('This user is not authorized to perform this action');
            break;
        case 'get': // Only ADMINs or members (except USERs) of an institution can perform get operations on its classrooms
            const getClassroom = await prismaClient.classroom.findUnique({
                where: user.institutionId ? { id: classroomId, institutionId: user.institutionId } : { id: classroomId },
            });
            if (user.role === UserRole.USER || !user.institutionId || !getClassroom)
                throw new Error('This user is not authorized to perform this action');
            break;
        case 'search':
            if (user.role === UserRole.USER) throw new Error('This user is not authorized to perform this action');
            break;
        case 'getMy':
            // All users can perform get my classrooms operation (the result will be filtered based on the user)
            break;
    }
};

export const createClassroom = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createClassroomSchema = yup
            .object()
            .shape({
                name: yup.string().min(3).max(255).required(),
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
        // Prisma operation
        const createdClassroom: Classroom = await prismaClient.classroom.create({
            data: {
                name: classroom.name,
                institution: { connect: classroom.institutionId ? { id: classroom.institutionId } : undefined },
                users: { connect: classroom.users.map((id) => ({ id: id })) },
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
                name: yup.string().min(3).max(255),
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
        // Prisma operation
        const updatedClassroom = await prismaClient.classroom.update({
            where: { id: classroomId },
            data: {
                name: classroom.name,
                institution: { disconnect: true, connect: classroom.institutionId ? { id: classroom.institutionId } : undefined },
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
            .shape({
                term: yup.string().min(3).max(20).required(),
            })
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
