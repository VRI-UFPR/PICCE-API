import { Response, Request } from "express";
import { Protocol, Item_type, Item_group_type, Page_type } from "@prisma/client";
import * as yup from "yup";
import prismaClient from "../services/prismaClient";

export const createProtocol = async  (req: Request, res: Response) => {
    try {
        const item_optionsSchema = yup.object().shape({
            text: yup.string().min(3).max(255).required(),//n sei limite
            placement: yup.number().min(1).required(),
            item_id: yup.number().required(),
        }).noUnknown()
        
        const itemsSchema = yup.object().shape({
            text: yup.string().min(3).max(255).required(),//n sei limite
            description: yup.string().min(3).max(255).notRequired(),//n sei o tamanho
            enabled: yup.boolean().required(),//default?
            group_id: yup.number().required(),
            type: yup.string().oneOf(Object.values(Item_type)).required(),
            placement: yup.number().min(1).required(),
            item_options: yup.array().of(item_optionsSchema).min(1).required(),//nseidefault
        }).noUnknown()

        const item_groupsSchema = yup.object().shape({
            placement: yup.number().min(1).required(),
            isRepeatable: yup.boolean().required(),
            page_id: yup.number().required(),
            type: yup.string().oneOf(Object.values(Item_group_type)).required(),
            items: yup.array().of(itemsSchema).min(1).required(),
        }).noUnknown()

        const pagesSchema = yup.object().shape({
            placement: yup.number().min(1).required(),
            protocol_id: yup.number().required(),
            type: yup.string().oneOf(Object.values(Page_type)).required(),
            item_groups: yup.array().of(item_groupsSchema).default([]),
        }).noUnknown()

        const ownerSchema = yup.object().shape({
            protocol_id: yup.number().required(),
        }).noUnknown()

        const createProtocolSchema = yup.object().shape({
            title:  yup.string().min(3).max(255).required(),
            description: yup.string().min(3).max(255).notRequired(),//n sei o tamanho
            enabled: yup.boolean().required(),
            pages: yup.array().of(pagesSchema).min(1).required(),
            owner: yup.array().of(ownerSchema).min(1).required(),
        }).noUnknown()
        
        const protocol = await createProtocolSchema.validate(req.body)
        const createdProtocol: Protocol = await prismaClient.$transaction(async (prisma) => {
            const createdProtocol = await prismaClient.protocol.create({
                data:{
                    title: protocol.title,
                    description: protocol.description,
                    enabled: protocol.enabled,
                }
            })
            for(const page of protocol.pages){
                const createdPage = await prismaClient.page.create({
                    data:{
                        placement: page.placement,
                        protocol_id: createdProtocol.id,
                        type: page.type,
                    }
                })
                for(const item_group of page.item_groups){
                    const createdItem_group = await prismaClient.item_group.create({
                        data:{
                            placement: item_group.placement,
                            isRepeatable: item_group.isRepeatable,
                            page_id: createdPage.id,
                            type: item_group.type,
                        }
                    })
                    for(const item of item_group.items){
                        const createdItem = await prismaClient.item.create({
                            data:{
                                text: item.text,
                                description: item.description,
                                enabled: item.enabled,
                                group_id: createdItem_group.id,
                                type: item.type, 
                                placement: item.placement,
                            }
                        })
                        for(const item_option of item.item_options){
                            const createdItem_option = await prismaClient.item_option.create({
                                data:{
                                    text: item_option.text,
                                    placement: item_option.placement,
                                    item_id: createdItem.id,
                                }
                            })
                        }
                    }
                }
            }
            return createdProtocol
        })
        res.status(201).json({ message: "Protocol created.", data: createdProtocol })
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const updateProtocol = async  (req: Request, res: Response): Promise<void> => {
    try {
        const id:number = parseInt(req.params.protocolId)

        const item_optionsSchema = yup.object().shape({
            id: yup.number().required(),
            text: yup.string().min(3).max(255).required(),//n sei limite
            placement: yup.number().min(1).required(),
            item_id: yup.number().required(),
        }).noUnknown()
        
        const itemsSchema = yup.object().shape({
            id: yup.number().required(),
            text: yup.string().min(3).max(255).required(),//n sei limite
            description: yup.string().min(3).max(255).notRequired(),//n sei o tamanho
            enabled: yup.boolean().required(),//default?
            group_id: yup.number().required(),
            type: yup.string().oneOf(Object.values(Item_type)).required(),
            placement: yup.number().min(1).required(),
            item_options: yup.array().of(item_optionsSchema).min(1).required(),//nseidefault
        }).noUnknown()

        const item_groupsSchema = yup.object().shape({
            id: yup.number().required(),
            placement: yup.number().min(1).required(),
            isRepeatable: yup.boolean().required(),
            page_id: yup.number().required(),
            type: yup.string().oneOf(Object.values(Item_group_type)).required(),
            items: yup.array().of(itemsSchema).min(1).required(),
        }).noUnknown()

        const pagesSchema = yup.object().shape({
            id: yup.number().required(),
            placement: yup.number().min(1).required(),
            protocol_id: yup.number().required(),
            type: yup.string().oneOf(Object.values(Page_type)).required(),
            item_groups: yup.array().of(item_groupsSchema).default([]),
        }).noUnknown()

        const ownerSchema = yup.object().shape({
            id: yup.number().required(),
            protocol_id: yup.number().required(),
        }).noUnknown()

        const updateProtocolSchema = yup.object().shape({
            id: yup.number().required(),
            title:  yup.string().min(3).max(255).required(),
            description: yup.string().min(3).max(255).notRequired(),//n sei o tamanho
            enabled: yup.boolean().required(),
            pages: yup.array().of(pagesSchema).min(1).required(),
            owner: yup.array().of(ownerSchema).min(1).required(),
        }).noUnknown()

        const protocol = await updateProtocolSchema.validate(req.body)

        const currentProtocol: Protocol = await prismaClient.protocol.findUnique({
            where:{
                id: id,
            },
        })

        const updatedProtocol: Protocol = await prismaClient.$transaction(async (prisma) => {
            prismaClient.protocol.update({
                where:{
                    id: id,
                },
                data:{
                    title: protocol.title,
                    description: protocol.description,
                    enabled: protocol.enabled,
                },
            })
            prismaClient.protocol_owner.deleteMany({
                where:{
                    id: { notIn: protocol.owner.map((protocol_owner) => protocol_owner.id)},
                },
            })
            for(const protocol_owner of protocol.owner){
                const createdProtocol_owner = await prismaClient.protocol_owner.upsert({
                    where:{
                        id: protocol_owner.id,
                    },
                    create:{
                        protocol_id: updatedProtocol.id,
                    },
                    update:{
                        protocol_id: updatedProtocol.id,
                    },
                })
            }
            prismaClient.page.deleteMany({
                where:{
                    id: { notIn: protocol.pages.map((page) => page.id)},
                },
            })
            for(const page of protocol.pages){
                const createdPage = await prismaClient.page.upsert({
                    where:{
                        id: page.id,
                    },
                    create:{
                        protocol_id: updatedProtocol.id,
                        placement: page.placement,
                        type: page.type,
                    },
                    update:{
                        protocol_id: updatedProtocol.id,
                        placement: page.placement,
                        type: page.type,
                    },
                })
                prismaClient.item_group.deleteMany({
                    where:{
                        id: { notIn: page.item_groups.map((item_group) => item_group.id)},
                    },
                })
                for(const item_group of page.item_groups){
                    const createdItemGroup = await prismaClient.item_group.upsert({
                        where:{
                            id: item_group.id,
                        },
                        create:{
                            placement: item_group.placement,
                            isRepeatable: item_group.isRepeatable,
                            page_id: createdPage.id,
                            type: item_group.type,
                        },
                        update:{
                            placement: item_group.placement,
                            isRepeatable: item_group.isRepeatable,
                            page_id: createdPage.id,
                            type: item_group.type,
                        },
                    })
                    prismaClient.item.deleteMany({
                        where:{
                            id: { notIn: item_group.items.map((item) => item.id)},
                        },
                    })
                    for(const item of item_group.items){
                        const createdItem = await prismaClient.item.upsert({
                            where:{
                                id: item.id,
                            },
                            create:{
                                text: item.text,
                                description: item.description,
                                enabled: item.enabled,
                                group_id: createdItemGroup.id,
                                type: item.type,
                                placement: item.placement,
                            },
                            update:{
                                text: item.text,
                                description: item.description,
                                enabled: item.enabled,
                                group_id: createdItemGroup.id,
                                type: item.type,
                                placement: item.placement,
                            },
                        })
                        prismaClient.item_option.deleteMany({
                            where:{
                                id: { notIn:item.item_options.map((item_option) => item_option.id)},
                            },
                        })
                        for(const item_option of item.item_options){
                            const createdItemOption = await prismaClient.item_option.upsert({
                                where:{
                                    id: item_option.id,
                                },
                                create:{
                                    text: item_option.text,
                                    placement: item_option.placement,
                                    item_id: createdItem.id,
                                },
                                update:{
                                    text: item_option.text,
                                    placement: item_option.placement,
                                    item_id: createdItem.id,
                                },
                            })
                        }
                    }
                }
            }
            return prismaClient.protocol.findUnique({
                where:{
                    id: id,
                },
            })
        })
        res.status(200).json({ message: "Protocol updated.", data: updatedProtocol })
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const getAllProtocols = async (req: Request, res: Response): Promise<void> => {
    try {
        const protocol: Protocol[] = await prismaClient.protocol.findMany()
        res.status(200).json({ message: "All protocolsfound.", data: protocol })
    } catch (error: any) {
        res.status(400).json({ error: error })
    }
};

export const getProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.protocol_id);

        const protocol: Protocol = await prismaClient.protocol.findUniqueOrThrow({
            where: {
                id,
            },
        });

        res.status(200).json({ message: "Protocol found.", data: protocol });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};

export const deleteProtocol = async (req: Request, res: Response): Promise<void> => {
    try {
        const id: number = parseInt(req.params.addressId);

        const deletedProtocol: Protocol = await prismaClient.protocol.delete({
            where: {
                id,
            },
        });

        res.status(200).json({ message: "Protocol deleted.", data: deletedProtocol });
    } catch (error: any) {
        res.status(400).json({ error: error });
    }
};