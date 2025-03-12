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
import { Address, User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';
import { count } from 'console';

const checkAuthorization = async (user: User, addressId: number | undefined, action: string) => {
    if (user.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create':
        case 'update':
        case 'delete':
            // Only ADMINs can perform create/update/delete operations on addresses
            throw new Error('This user is not authorized to perform this action');
            break;
        case 'getAll':
        case 'get':
        case 'getByState':
        case 'getId':
            // Everyone can perform get/getAll/getByState operations on addresses
            break;
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
        await checkAuthorization(user, undefined, 'create');
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
        const addressId: number = parseInt(req.params.addressId);
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
        await checkAuthorization(user, addressId, 'update');
        // Prisma operation
        const updatedAddress: Address = await prismaClient.address.update({
            where: { id: addressId },
            data: { city: address.city, state: address.state, country: address.country },
        });

        res.status(200).json({ message: 'Address updated.', data: updatedAddress });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAllAddresses = async (req: Request, res: Response): Promise<void> => {
    try {
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get all addresses
        await checkAuthorization(user, undefined, 'getAll');
        // Prisma operation
        const addresses: Address[] = await prismaClient.address.findMany();

        res.status(200).json({ message: 'All addresses found.', data: addresses });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAddressesByState = async (req: Request, res: Response): Promise<void> => {
    try {
        // Yup schemas
        const getAddressesByStateSchema = yup
            .object()
            .shape({ state: yup.string().min(1).required(), country: yup.string().min(1).required() })
            .noUnknown();
        // Yup parsing/validation
        const searchParams = await getAddressesByStateSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get addresses by state
        await checkAuthorization(user, undefined, 'getByState');
        // Prisma operation
        const addresses = await prismaClient.address.findMany({
            where: { state: searchParams.state, country: searchParams.country },
            select: { id: true, city: true },
        });

        res.status(200).json({ message: 'Addresses found.', data: addresses });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAddressId = async (req: Request, res: Response): Promise<void> => {
    try {
        // Yup schemas
        const getCityIdSchema = yup
            .object()
            .shape({
                city: yup.string().min(1).required(),
                state: yup.string().min(1).required(),
                country: yup.string().min(1).required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const searchParams = await getCityIdSchema.validate(req.body, { stripUnknown: false });
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get a city ID
        await checkAuthorization(user, undefined, 'getId');
        // Prisma operation
        const { id: cityId } = await prismaClient.address.findUniqueOrThrow({
            where: { city_state_country: { city: searchParams.city, state: searchParams.state, country: searchParams.country } },
            select: { id: true },
        });

        res.status(200).json({ message: 'City ID found.', data: cityId });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const getAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const addressId: number = parseInt(req.params.addressId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get an address
        await checkAuthorization(user, addressId, 'get');
        // Prisma operation
        const address: Address = await prismaClient.address.findUniqueOrThrow({ where: { id: addressId } });

        res.status(200).json({ message: 'Address found.', data: address });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const addressId: number = parseInt(req.params.addressId);
        // User from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to delete an address
        await checkAuthorization(user, addressId, 'delete');
        // Prisma operation
        const deletedAddress = await prismaClient.address.delete({ where: { id: addressId }, select: { id: true } });
        res.status(200).json({ message: 'Address deleted.', data: deletedAddress });
    } catch (error: any) {
        res.status(400).json(errorFormatter(error));
    }
};
