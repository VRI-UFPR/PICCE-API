import { Response, Request } from "express";
import { Classroom } from "@prisma/client";
import * as yup from "yup";
import prismaClient from "../services/prismaClient";

export const createClassroom = async (req: Request, res: Response) => {
  try {
    const createClassroomSchema = yup
      .object()
      .shape({
        institutionId: yup.number().required(),
        users: yup.array().of(yup.number()).required(),
      })
      .noUnknown();

    const classroom = await createClassroomSchema.validate(req.body);

    const createdClassroom: Classroom = await prismaClient.classroom.create({
      data: {
        institutionId: classroom.institutionId,
        users: {
          connect: classroom.users
            .filter((userId): userId is number => Boolean(userId))
            .map((userId: number) => {
              return { id: userId };
            }),
        },
      },
    });

    res
      .status(201)
      .json({ message: "Classroom created.", data: createdClassroom });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const updateClassroom = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id: number = parseInt(req.params.classroomId);

    const createClassroomSchema = yup
      .object()
      .shape({
        institutionId: yup.number(),
        users: yup.array().of(yup.number()),
      })
      .noUnknown();

    const classroom = await createClassroomSchema.validate(req.body);

    const updatedClassroom: Classroom = await prismaClient.classroom.update({
      where: {
        id,
      },
      data: {
        institutionId: classroom.institutionId,
        users: {
          connect: classroom.users
            ?.filter((userId): userId is number => Boolean(userId))
            .map((userId: number) => {
              return { id: userId };
            }),
        },
      },
    });

    res
      .status(200)
      .json({ message: "Classroom updated.", data: updatedClassroom });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const getAllClassrooms = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const classrooms: Classroom[] = await prismaClient.classroom.findMany({
      include: {
        users: true,
      },
    });
    res
      .status(200)
      .json({ message: "All classrooms found.", data: classrooms });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const getClassroom = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id: number = parseInt(req.params.classroomId);

    const classroom: Classroom = await prismaClient.classroom.findUniqueOrThrow(
      {
        where: {
          id,
        },
        include: {
          users: true,
        },
      }
    );

    res.status(200).json({ message: "Classroom found.", data: classroom });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const deleteClassroom = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id: number = parseInt(req.params.classroomId);

    const deletedClassroom: Classroom = await prismaClient.classroom.delete({
      where: {
        id,
      },
    });

    res
      .status(200)
      .json({ message: "Classroom deleted.", data: deletedClassroom });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};
