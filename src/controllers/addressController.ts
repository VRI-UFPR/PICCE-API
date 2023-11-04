import { Response, Request } from 'express';
import { Address } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

export const createAddress = async (req: Request, res: Response) => {
    try {
        const createAddressSchema = yup
            .object()
            .shape({
                id: yup.number(),
                city: yup.string().min(3).max(255).required(),
                state: yup.string().min(3).max(255).required(),
                country: yup.string().min(3).max(255).required(),
            })
            .noUnknown();

        const address = await createAddressSchema.validate(req.body, { stripUnknown: false });

        const createdAddress: Address = await prismaClient.address.create({
            data: address,
        });

        res.status(201).json({ message: 'Address created.', data: createdAddress });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.addressId);

        const updateAddressSchema = yup
            .object()
            .shape({
                city: yup.string().min(1),
                state: yup.string().min(1),
                country: yup.string().min(1),
            })
            .noUnknown();

        const address = await updateAddressSchema.validate(req.body, { stripUnknown: false });

        const updatedAddress: Address = await prismaClient.address.update({
            where: {
                id,
            },
            data: {
                city: address.city,
                state: address.state,
                country: address.country,
            },
        });
        res.status(200).json({ message: 'Address updated.', data: updatedAddress });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllAddresses = async (req: Request, res: Response): Promise<void> => {
    try {
        const addresses: Address[] = await prismaClient.address.findMany();
        res.status(200).json({ message: 'All addresses found.', data: addresses });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.addressId);

        const address: Address = await prismaClient.address.findUniqueOrThrow({
            where: {
                id,
            },
            include: {
                institutions: true,
            },
        });
        res.status(200).json({ message: 'Address found.', data: address });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.addressId);

        const deletedAddress: Address = await prismaClient.address.delete({
            where: {
                id,
            },
        });
        res.status(200).json({ message: 'Address deleted.', data: deletedAddress });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
