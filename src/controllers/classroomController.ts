import { Response, Request } from 'express';
import { Classroom, User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

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

const checkAuthorization = (user: User, institutionId: number) => {
    if (user.role !== 'ADMIN' && (user.role !== 'COORDINATOR' || user.institutionId !== institutionId)) {
        throw new Error('This user is not authorized to perform this action');
    }
};

export const createClassroom = async (req: Request, res: Response) => {
    try {
        const createClassroomSchema = yup
            .object()
            .shape({
                institutionId: yup.number().required(),
                users: yup.array().of(yup.number()).min(2).required(),
            })
            .noUnknown();

        const classroom = await createClassroomSchema.validate(req.body);

        const user = req.user as User;

        checkAuthorization(user, classroom.institutionId);

        const createdClassroom: Classroom = await prismaClient.classroom.create({
            data: {
                institutionId: classroom.institutionId,
                users: {
                    connect: classroom.users.map((id) => ({ id: id })),
                },
            },
        });

        res.status(201).json({ message: 'Classroom created.', data: createdClassroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateClassroom = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.classroomId);

        const updateClassroomSchema = yup
            .object()
            .shape({
                users: yup.array().of(yup.number()).min(2),
            })
            .noUnknown();

        const classroom = await updateClassroomSchema.validate(req.body);

        const user = req.user as User;

        const updatedClassroom = await prismaClient.classroom.update({
            where: {
                id,
                institutionId: user.institutionId as number,
            },
            data: {
                users: {
                    set: [],
                    connect: classroom.users?.map((id) => ({ id: id })),
                },
            },
            select: fieldsWithNesting,
        });

        res.status(200).json({ message: 'Classroom updated.', data: updatedClassroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllClassrooms = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user as User;

        if (user.role === UserRole.USER) {
            throw new Error('This user is not authorized to perform this action');
        }

        const classrooms =
            user.role === UserRole.ADMIN
                ? await prismaClient.classroom.findMany({ select: fieldsWithNesting })
                : await prismaClient.classroom.findMany({
                      where: {
                          institutionId: user.institutionId as number,
                      },
                      select: fieldsWithNesting,
                  });

        res.status(200).json({ message: 'All classrooms found.', data: classrooms });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getClassroom = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.classroomId);

        const user = req.user as User;

        const classroom =
            user.role === UserRole.ADMIN
                ? await prismaClient.classroom.findUniqueOrThrow({ where: { id }, select: fieldsWithNesting })
                : await prismaClient.classroom.findUniqueOrThrow({
                      where: {
                          id,
                          institutionId: user.institutionId as number,
                      },
                      select: fieldsWithNesting,
                  });

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
        const id: number = parseInt(req.params.classroomId);

        const user = req.user as User;

        const deletedClassroom = await prismaClient.classroom.delete({
            where: {
                id,
                institutionId: user.institutionId as number,
            },
            select: { id: true },
        });

        res.status(200).json({ message: 'Classroom deleted.', data: deletedClassroom });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
