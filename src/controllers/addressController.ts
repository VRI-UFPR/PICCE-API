import { Response, Request } from "express";
import { Address } from "@prisma/client";
import prismaClient from "../services/prismaClient";

export const createAddress = async (req: Request, res: Response) => {
    try {
        const { city, state, country } = req.body;

        const createdAddress: Address = await prismaClient.address.create({
            data: {
                city,
                state,
                country,
            },
        });

        res.status(201).json({ message: "Address created.", data: createdAddress });
    } catch (error) {
        res.status(400).json({ error: error });
    }
};

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.addressId);
        const { city, state, country } = req.body;

        const updatedAddress: Address = await prismaClient.address.update({
            where: {
                id,
            },
            data: {
                city,
                state,
                country,
            },
        });

        res.status(200).json({ message: "Address updated.", data: updatedAddress });
    } catch (error) {
        res.status(400).json({ error: error });
    }
};

export const getAllAddresses = async (req: Request, res: Response): Promise<void> => {
    try {
        const addresses: Address[] = await prismaClient.address.findMany();
        res.status(200).json({ message: "All addresses found.", data: addresses });
    } catch (error) {
        res.status(400).json({ error: error });
    }
};

export const getAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.addressId);

        const address: Address = await prismaClient.address.findUniqueOrThrow({
            where: {
                id,
            },
        });

        res.status(200).json({ message: "Address found.", data: address });
    } catch (error) {
        res.status(400).json({ error: error });
    }
};

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.addressId);

        const deletedAddress: Address = await prismaClient.address.delete({
            where: {
                id,
            },
        });

        res.status(200).json({ message: "Address deleted.", data: deletedAddress });
    } catch (error) {
        res.status(400).json({ error: error });
    }
};
