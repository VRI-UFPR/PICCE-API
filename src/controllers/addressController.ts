import { Response, Request } from 'express';
import { Address, User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

// Only admin can perform C-UD operations on addresses
const checkAuthorization = (user: User) => {
    if (user.role !== UserRole.ADMIN) {
        throw new Error('This user is not authorized to perform this action');
    }
};

export const createAddress = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createAddressSchema = yup
            .object()
            .shape({
                id: yup.number().min(1),
                city: yup.string().min(1).required(),
                state: yup.string().min(1).required(),
                country: yup.string().min(1).required(),
            })
            .noUnknown();

        // Yup parsing/validation
        const address = await createAddressSchema.validate(req.body, { stripUnknown: false });

        // User from Passport-JWT
        const user = req.user as User;

        // Check if user is authorized to create an address
        checkAuthorization(user);
        // Prisma operation
        const createdAddress: Address = await prismaClient.address.create({
            data: { id: address.id, city: address.city, state: address.state, country: address.country },
        });

        res.status(201).json({ message: 'Address created.', data: createdAddress });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.addressId);

        // Yup schemas
        const updateAddressSchema = yup
            .object()
            .shape({ city: yup.string().min(1), state: yup.string().min(1), country: yup.string().min(1) })
            .noUnknown();

        // Yup parsing/validation
        const address = await updateAddressSchema.validate(req.body, { stripUnknown: false });

        // User from Passport-JWT
        const user = req.user as User;

        // Check if user is authorized to update an address
        checkAuthorization(user);

        // Prisma operation
        const updatedAddress: Address = await prismaClient.address.update({
            where: { id },
            data: { city: address.city, state: address.state, country: address.country },
        });

        res.status(200).json({ message: 'Address updated.', data: updatedAddress });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllAddresses = async (req: Request, res: Response): Promise<void> => {
    try {
        // Prisma operation
        const addresses: Address[] = await prismaClient.address.findMany();

        res.status(200).json({ message: 'All addresses found.', data: addresses });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.addressId);

        // Prisma operation
        const address: Address = await prismaClient.address.findUniqueOrThrow({ where: { id } });

        res.status(200).json({ message: 'Address found.', data: address });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const id: number = parseInt(req.params.addressId);

        // User from Passport-JWT
        const user = req.user as User;

        // Check if user is authorized to delete an address
        checkAuthorization(user);

        // Prisma operation
        const deletedAddress = await prismaClient.address.delete({ where: { id }, select: { id: true } });

        res.status(200).json({ message: 'Address deleted.', data: deletedAddress });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
