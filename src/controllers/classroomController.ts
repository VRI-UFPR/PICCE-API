import { Response, Request } from 'express';
import { Classroom, User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

// Fields to be selected from the database to the response
const fieldsWithNesting = {
    id: true,
    institution: {
        select: {
            id: true,
            name: true,
        },
    },
    users: {
        select: {
            id: true,
            name: true,
            role: true,
        },
    },
    createdAt: true,
    updateAt: true,
};

// Only admins or the coordinator of the institution can perform C-UD operations on classrooms
const checkAuthorization = (user: User, institutionId: number) => {
    if (user.role !== 'ADMIN' && (user.role !== 'COORDINATOR' || user.institutionId !== institutionId)) {
        throw new Error('This user is not authorized to perform this action');
    }
};

export const createClassroom = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createClassroomSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                institutionId: yup.number().required(),
                users: yup.array().of(yup.number()).min(2).required(),
            })
            .noUnknown();

        // Yup parsing/validation
        const classroom = await createClassroomSchema.validate(req.body);

        // User from Passport-JWT
        const user = req.user as User;

        // Check if user is authorized to create a classroom
        checkAuthorization(user, classroom.institutionId);

        // Prisma operation
        const createdClassroom: Classroom = await prismaClient.classroom.create({
            data: {
                id: classroom.id,
                institutionId: classroom.institutionId,
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
        const id: number = parseInt(req.params.classroomId);

        // Yup schemas
        const updateClassroomSchema = yup
            .object()
            .shape({
                users: yup.array().of(yup.number()).min(2),
            })
            .noUnknown();

        // Yup parsing/validation
        const classroom = await updateClassroomSchema.validate(req.body);

        // User from Passport-JWT
        const user = req.user as User;

        // Prisma operation with authorization check - admin can update all classrooms, coordinator can update only their institution classrooms
        const updatedClassroom =
            user.role === UserRole.ADMIN
                ? await prismaClient.classroom.update({
                      where: { id },
                      data: { users: { set: [], connect: classroom.users?.map((id) => ({ id: id })) } },
                      select: fieldsWithNesting,
                  })
                : await prismaClient.classroom.update({
                      where: { id, institutionId: user.institutionId as number },
                      data: { users: { set: [], connect: classroom.users?.map((id) => ({ id: id })) } },
                      select: fieldsWithNesting,
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
        if (user.role === UserRole.USER) {
            throw new Error('This user is not authorized to perform this action');
        }

        // Prisma operation with authorization check - admin can see all classrooms, coordinator can see only their institution classrooms
        const classrooms =
            user.role === UserRole.ADMIN
                ? await prismaClient.classroom.findMany({ select: fieldsWithNesting })
                : await prismaClient.classroom.findMany({
                      where: { institutionId: user.institutionId as number },
                      select: fieldsWithNesting,
                  });

        res.status(200).json({ message: 'All classrooms found.', data: classrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getInstitutionClassrooms = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const institutionId: number = parseInt(req.params.institutionId);

        // User from Passport-JWT
        const user = req.user as User;

        // Check if user is authorized to get all classrooms from the institution
        if (user.role === UserRole.USER || user.institutionId !== institutionId) {
            throw new Error('This user is not authorized to perform this action');
        }

        // Prisma operation
        const classrooms = await prismaClient.classroom.findMany({
            where: { institutionId: user.institutionId as number },
            select: fieldsWithNesting,
        });

        res.status(200).json({ message: 'Institution classrooms found.', data: classrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getClassroom = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.classroomId);

        // User from Passport-JWT
        const user = req.user as User;

        // Prisma operation with authorization check - admin can see all classrooms, coordinator can see only their institution classrooms
        const classroom =
            user.role === UserRole.ADMIN
                ? await prismaClient.classroom.findUniqueOrThrow({ where: { id }, select: fieldsWithNesting })
                : await prismaClient.classroom.findUniqueOrThrow({
                      where: { id, institutionId: user.institutionId as number },
                      select: fieldsWithNesting,
                  });

        // Check if user with role user is authorized to get this classroom (only users in the classroom)
        if (user.role === UserRole.USER && !classroom.users?.some((user) => user.id === user.id)) {
            throw new Error('This user is not authorized to perform this action');
        }

        res.status(200).json({ message: 'Classroom found.', data: classroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteClassroom = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.classroomId);

        // User from Passport-JWT
        const user = req.user as User;

        // Prisma operation with authorization check - admin can delete all classrooms, coordinator can delete only their institution classrooms
        const deletedClassroom =
            user.role === UserRole.ADMIN
                ? await prismaClient.classroom.delete({ where: { id }, select: { id: true } })
                : await prismaClient.classroom.delete({ where: { id, institutionId: user.institutionId as number }, select: { id: true } });

        res.status(200).json({ message: 'Classroom deleted.', data: deletedClassroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
