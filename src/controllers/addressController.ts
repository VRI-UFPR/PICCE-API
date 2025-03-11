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
import { User, UserRole } from '@prisma/client';
import * as yup from 'yup';
import prismaClient from '../services/prismaClient';
import errorFormatter from '../services/errorFormatter';

/**
 * Checks if the user is authorized to perform a specific action on an address.
 *
 * @param requester - The user object containing requester user details.
 * @param action - The action the user wants to perform (e.g., 'create', 'update', 'delete', 'getAll', 'get', 'getByState', 'getId').
 *
 * @throws Will throw an error if the user is not authorized to perform the action.
 * @returns A promise that resolves if the user is authorized to perform the action.
 */
const checkAuthorization = async (requester: User, action: string) => {
    // ADMINs can perform all actions
    if (requester.role === UserRole.ADMIN) return;

    switch (action) {
        case 'create':
        case 'update':
        case 'delete': {
            // No one can perform create/update/delete operations on addresses
            throw new Error('This user is not authorized to perform this action');
        }
        case 'getAll':
        case 'get':
        case 'getByState':
        case 'getId': {
            // Everyone can perform get/getAll/getByState operations on addresses
            break;
        }
    }
};

/**
 * Creates a new address in the database.
 *
 * This function handles the creation of a new address, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the address data in the body and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const createAddress = async (req: Request, res: Response) => {
    try {
        // Yup schemas
        const createAddressSchema = yup
            .object()
            .shape({
                city: yup.string().min(1).required(),
                state: yup.string().min(1).required(),
                country: yup.string().min(1).required(),
            })
            .noUnknown();
        // Yup parsing/validation
        const addressData = await createAddressSchema.validate(req.body, { stripUnknown: false });
        // Requester user from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to create an address
        await checkAuthorization(requester, 'create');
        // Prisma operation
        const storedAddress = await prismaClient.address.create({ data: addressData });
        // Express success response
        res.status(201).json({ message: 'Address created.', data: storedAddress });
    } catch (error: any) {
        console.error(error);
        // Express error response
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Updates an existing address in the database.
 *
 * This function handles the update of a existing address, validating the body of the request and
 * the user performing the action to then persist the object in the database using Prisma.
 *
 * @param req - The request object, containing the address data in the body, the user object from Passport-JWT and the address ID in the params.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const updateAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const addressId = parseInt(req.params.addressId);
        // Yup schemas
        const updateAddressSchema = yup
            .object()
            .shape({ city: yup.string().min(1), state: yup.string().min(1), country: yup.string().min(1) })
            .noUnknown();
        // Yup parsing/validation
        const addressData = await updateAddressSchema.validate(req.body, { stripUnknown: false });
        // Requester user from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to update an address
        await checkAuthorization(requester, 'update');
        // Prisma operation
        const storedAddress = await prismaClient.address.update({ where: { id: addressId }, data: addressData });
        // Express success response
        res.status(200).json({ message: 'Address updated.', data: storedAddress });
    } catch (error: any) {
        console.error(error);
        // Express error response
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all addresses from the database.
 *
 * This function handles the retrieval of all addresses in the database, validating the user
 * performing the action to then retrieve all addresses using Prisma.
 *
 * @param req - The request object, containing the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getAllAddresses = async (req: Request, res: Response): Promise<void> => {
    try {
        // Requester user from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get all addresses
        await checkAuthorization(requester, 'getAll');
        // Prisma operation
        const storedAddresses = await prismaClient.address.findMany();
        // Express success response
        res.status(200).json({ message: 'All addresses found.', data: storedAddresses });
    } catch (error: any) {
        console.error(error);
        // Express error response
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets all addresses from the database by state.
 *
 * This function handles the retrieval of all addresses in the database by state, validating the user
 * performing the action to then retrieve all addresses using Prisma.
 *
 * @param req - The request object, containing the search parameters in the body and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getAddressesByState = async (req: Request, res: Response): Promise<void> => {
    try {
        // Yup schemas
        const searchParamsSchema = yup.object().shape({ state: yup.string().min(1).required(), country: yup.string().min(1).required() });
        // Yup parsing/validation
        const searchParams = await searchParamsSchema.validate(req.body, { stripUnknown: false });
        // Requester user from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get addresses by state
        await checkAuthorization(requester, 'getByState');
        // Prisma operation
        const storedAddresses = await prismaClient.address.findMany({ where: searchParams, select: { id: true, city: true } });
        // Express success response
        res.status(200).json({ message: 'Addresses found.', data: storedAddresses });
    } catch (error: any) {
        console.error(error);
        // Express error response
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets the ID of an address from the database by city, state and country.
 *
 * This function handles the retrieval of an address ID in the database by city, state and country, validating the user
 * performing the action to then retrieve the address ID using Prisma.
 *
 * @param req - The request object, containing the search parameters in the body and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getAddressId = async (req: Request, res: Response): Promise<void> => {
    try {
        // Yup schemas
        const searchParamsSchema = yup.object().shape({
            city: yup.string().min(1).required(),
            state: yup.string().min(1).required(),
            country: yup.string().min(1).required(),
        });
        // Yup parsing/validation
        const searchParams = await searchParamsSchema.validate(req.body, { stripUnknown: false });
        // Requester user from Passport-JWT
        const user = req.user as User;
        // Check if user is authorized to get a city ID
        await checkAuthorization(user, 'getId');
        // Prisma operation
        const storedAddress = await prismaClient.address.findUniqueOrThrow({
            where: { city_state_country: searchParams },
            select: { id: true },
        });
        // Express success response
        res.status(200).json({ message: 'City ID found.', data: storedAddress.id });
    } catch (error: any) {
        console.error(error);
        // Express error response
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Gets an address from the database by ID.
 *
 * This function handles the retrieval of an address in the database by ID, validating the user
 * performing the action to then retrieve the address using Prisma.
 *
 * @param req - The request object, containing the address ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const getAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const addressId = parseInt(req.params.addressId);
        // Requester user from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to get an address
        await checkAuthorization(requester, 'get');
        // Prisma operation
        const storedAddress = await prismaClient.address.findUniqueOrThrow({ where: { id: addressId } });
        // Express success response
        res.status(200).json({ message: 'Address found.', data: storedAddress });
    } catch (error: any) {
        console.error(error);
        // Express error response
        res.status(400).json(errorFormatter(error));
    }
};

/**
 * Deletes an address from the database by ID.
 *
 * This function handles the deletion of an address in the database by ID, validating the user
 * performing the action to then delete the address using Prisma.
 *
 * @param req - The request object, containing the address ID in the params and the user object from Passport-JWT.
 * @param res - The response object, used to send the response back to the client.
 *
 * @returns A promise that resolves when the function sets the response to the client.
 */
export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        // ID from params
        const addressId = parseInt(req.params.addressId);
        // Requester user from Passport-JWT
        const requester = req.user as User;
        // Check if user is authorized to delete an address
        await checkAuthorization(requester, 'delete');
        // Prisma operation
        const deletedAddress = await prismaClient.address.delete({ where: { id: addressId }, select: { id: true } });
        // Express success response
        res.status(200).json({ message: 'Address deleted.', data: deletedAddress });
    } catch (error: any) {
        console.error(error);
        // Express error response
        res.status(400).json(errorFormatter(error));
    }
};
