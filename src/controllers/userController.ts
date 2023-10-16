import { Response, Request } from "express";
import { User, UserRole } from "@prisma/client";
import * as yup from "yup";
import prismaClient from "../services/prismaClient";

export const createUser = async (req: Request, res: Response) => {
  try {
    const createUserSchema = yup
      .object()
      .shape({
        name: yup.string().min(3).max(255).required(),
        username: yup.string().min(3).max(255).required(),
        hash: yup.string().min(8).max(255).required(),
        role: yup
          .string()
          .oneOf(["USER", "APLICATOR", "PUBLISHER", "COORDINATOR", "ADMIN"])
          .required(),
        institutionId: yup.number().required(),
        classrooms: yup.array().of(yup.number()).required(),
      })
      .noUnknown();

    const user = await createUserSchema.validate(req.body);

    const createdUser: User = await prismaClient.user.create({
      data: {
        name: user.name,
        username: user.username,
        hash: user.hash,
        role: user.role,
        institutionId: user.institutionId,
        classrooms: {
          connect: user.classrooms
            .filter((classroomId): classroomId is number =>
              Boolean(classroomId)
            )
            .map((classroomId: number) => {
              return { id: classroomId };
            }),
        },
      },
    });

    res.status(201).json({ message: "User created.", data: createdUser });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const updateUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id: number = parseInt(req.params.userId);

    const createUserSchema = yup
      .object()
      .shape({
        name: yup.string().min(3).max(255),
        username: yup.string().min(3).max(255),
        hash: yup.string().min(8).max(255),
        role: yup
          .string()
          .oneOf(["USER", "APLICATOR", "PUBLISHER", "COORDINATOR", "ADMIN"]),
        institutionId: yup.number(),
        classrooms: yup.array().of(yup.number()),
      })
      .noUnknown();

    const user = await createUserSchema.validate(req.body);

    const roleEnum: UserRole = user.role as UserRole;

    const updatedUser: User = await prismaClient.user.update({
      where: {
        id,
      },
      data: {
        name: user.name,
        username: user.username,
        hash: user.hash,
        role: roleEnum,
        institutionId: user.institutionId,
        classrooms: {
          connect: user.classrooms
            ?.filter((classroomId): classroomId is number =>
              Boolean(classroomId)
            )
            .map((classroomId: number) => {
              return { id: classroomId };
            }),
        },
      },
    });

    res.status(200).json({ message: "User updated.", data: updatedUser });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const users: User[] = await prismaClient.user.findMany({
      include: {
        classrooms: true,
      },
    });
    res.status(200).json({ message: "All users found.", data: users });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id: number = parseInt(req.params.userId);

    const user: User = await prismaClient.user.findUniqueOrThrow({
      where: {
        id,
      },
      include: {
        classrooms: true,
      },
    });

    res.status(200).json({ message: "User found.", data: user });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const deleteUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id: number = parseInt(req.params.userId);

    const deletedUser: User = await prismaClient.user.delete({
      where: {
        id,
      },
    });

    res.status(200).json({ message: "User deleted.", data: deletedUser });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};
