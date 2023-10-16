import { Response, Request } from "express";
import { Institution, InstitutionType } from "@prisma/client";
import * as yup from "yup";
import prismaClient from "../services/prismaClient";

export const createInstitution = async (req: Request, res: Response) => {
  try {
    const createInstitutionSchema = yup
      .object()
      .shape({
        name: yup.string().min(3).max(255).required(),
        type: yup
          .string()
          .oneOf(["PRIMARY", "LOWER_SECONDARY", "UPPER_SECONDARY", "TERTIARY"])
          .required(),
        addressId: yup.number().required(),
        classrooms: yup.array().of(yup.number()).required(),
      })
      .noUnknown();

    const institution = await createInstitutionSchema.validate(req.body);

    const createdInstitution: Institution =
      await prismaClient.institution.create({
        data: {
          name: institution.name,
          type: institution.type,
          addressId: institution.addressId,
          classrooms: {
            connect: institution.classrooms
              .filter((classroomId): classroomId is number =>
                Boolean(classroomId)
              )
              .map((classroomId: number) => {
                return { id: classroomId };
              }),
          },
        },
      });

    res
      .status(201)
      .json({ message: "Institution created.", data: createdInstitution });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const updateInstitution = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id: number = parseInt(req.params.institutionId);

    const createInstitutionSchema = yup
      .object()
      .shape({
        name: yup.string().min(3).max(255),
        type: yup
          .string()
          .oneOf(["PRIMARY", "LOWER_SECONDARY", "UPPER_SECONDARY", "TERTIARY"]),
        addressId: yup.number(),
        classrooms: yup.array().of(yup.number()),
      })
      .noUnknown();

    const institution = await createInstitutionSchema.validate(req.body);

    const typeEnum: InstitutionType = institution.type as InstitutionType;

    const updatedInstitution: Institution =
      await prismaClient.institution.update({
        where: {
          id,
        },
        data: {
          name: institution.name,
          type: typeEnum,
          addressId: institution.addressId,
          classrooms: {
            connect: institution.classrooms
              ?.filter((classroomId): classroomId is number =>
                Boolean(classroomId)
              )
              .map((classroomId: number) => {
                return { id: classroomId };
              }),
          },
        },
      });

    res
      .status(200)
      .json({ message: "Institution updated.", data: updatedInstitution });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const getAllInstitutions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const institutions: Institution[] = await prismaClient.institution.findMany(
      {
        include: {
          classrooms: true,
        },
      }
    );
    res
      .status(200)
      .json({ message: "All institutions found.", data: institutions });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const getInstitution = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id: number = parseInt(req.params.institutionId);

    const institution: Institution =
      await prismaClient.institution.findUniqueOrThrow({
        where: {
          id,
        },
        include: {
          classrooms: true,
        },
      });

    res.status(200).json({ message: "Institution found.", data: institution });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};

export const deleteInstitution = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id: number = parseInt(req.params.institutionId);

    const deletedInstitution: Institution =
      await prismaClient.institution.delete({
        where: {
          id,
        },
      });

    res
      .status(200)
      .json({ message: "Institution deleted.", data: deletedInstitution });
  } catch (error: any) {
    res.status(400).json({ error: error });
  }
};
