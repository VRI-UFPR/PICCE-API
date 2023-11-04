import {
    Address,
    Application,
    ApplicationAnswer,
    Classroom,
    Institution,
    InstitutionType,
    Item,
    ItemAnswer,
    ItemAnswerGroup,
    ItemGroup,
    ItemGroupType,
    ItemOption,
    ItemType,
    OptionAnswer,
    Page,
    PageType,
    Protocol,
    TableColumn,
    User,
    UserRole,
    VisibilityMode,
} from '@prisma/client';
import prismaClient from '../../src/services/prismaClient';

async function main() {
    const addresses: Omit<Address, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            city: 'New York',
            state: 'New York',
            country: 'United States',
        },
        {
            id: 2,
            city: 'Los Angeles',
            state: 'California',
            country: 'United States',
        },
    ];

    const institutions: Omit<Institution, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            name: 'New York University',
            addressId: 1,
            type: 'TERTIARY' as InstitutionType,
        },
        {
            id: 2,
            name: 'University of California',
            addressId: 2,
            type: 'TERTIARY' as InstitutionType,
        },
    ];

    const classrooms: Omit<Classroom, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            institutionId: 2,
        },
    ];

    const users: (Omit<User, 'createdAt' | 'updateAt'> & { classrooms: number[] })[] = [
        {
            id: 1,
            name: 'John Doe',
            username: 'johndoe',
            hash: '123456',
            role: 'ADMIN' as UserRole,
            institutionId: 1,
            classrooms: [],
        },
        {
            id: 2,
            name: 'Jane Doe',
            username: 'janedoe',
            hash: '123456',
            role: 'ADMIN' as UserRole,
            institutionId: 1,
            classrooms: [],
        },
        {
            id: 3,
            name: 'John Smith',
            username: 'johnsmith',
            hash: '123456',
            role: 'USER' as UserRole,
            institutionId: 2,
            classrooms: [1],
        },
        {
            id: 4,
            name: 'Jane Smith',
            username: 'janesmith',
            hash: '123456',
            role: 'USER' as UserRole,
            institutionId: 2,
            classrooms: [1],
        },
    ];

    const protocols: Omit<Protocol, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            title: 'Protocol 1',
            description: 'Protocol 1 description',
            enabled: true,
        },
        {
            id: 2,
            title: 'Protocol 2',
            description: 'Protocol 2 description',
            enabled: true,
        },
    ];

    const pages: Omit<Page, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            type: 'ITEMS' as PageType,
            placement: 1,
            protocolId: 1,
        },
        {
            id: 2,
            type: 'ITEMS' as PageType,
            placement: 2,
            protocolId: 1,
        },
        {
            id: 3,
            type: 'ITEMS' as PageType,
            placement: 1,
            protocolId: 2,
        },
        {
            id: 4,
            type: 'ITEMS' as PageType,
            placement: 2,
            protocolId: 2,
        },
    ];

    const itemGroups: Omit<ItemGroup, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            type: 'SINGLE_ITEM' as ItemGroupType,
            placement: 1,
            isRepeatable: false,
            pageId: 1,
        },
        {
            id: 2,
            type: 'SINGLE_ITEM' as ItemGroupType,
            placement: 1,
            isRepeatable: false,
            pageId: 2,
        },
        {
            id: 3,
            type: 'SINGLE_ITEM' as ItemGroupType,
            placement: 1,
            isRepeatable: false,
            pageId: 3,
        },
        {
            id: 4,
            type: 'SINGLE_ITEM' as ItemGroupType,
            placement: 1,
            isRepeatable: false,
            pageId: 4,
        },
    ];

    const items: Omit<Item, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            text: 'Item 1',
            description: 'Item 1 description',
            groupId: 1,
            placement: 1,
            enabled: true,
            type: 'TEXTBOX' as ItemType,
        },
        {
            id: 2,
            text: 'Item 2',
            description: 'Item 2 description',
            groupId: 2,
            placement: 1,
            enabled: true,
            type: 'CHECKBOX' as ItemType,
        },
        {
            id: 3,
            text: 'Item 3',
            description: 'Item 3 description',
            groupId: 3,
            placement: 1,
            enabled: true,
            type: 'SCALE' as ItemType,
        },
        {
            id: 4,
            text: 'Item 4',
            description: 'Item 4 description',
            groupId: 4,
            placement: 1,
            enabled: true,
            type: 'RADIO' as ItemType,
        },
    ];

    const itemOptions: Omit<ItemOption, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            text: 'Option 2.1',
            placement: 1,
            itemId: 2,
        },
        {
            id: 2,
            text: 'Option 2.2',
            placement: 2,
            itemId: 2,
        },
        {
            id: 3,
            text: 'Option 4.1',
            placement: 1,
            itemId: 4,
        },
        {
            id: 4,
            text: 'Option 4.2',
            placement: 2,
            itemId: 4,
        },
    ];

    const applications: (Omit<Application, 'createdAt' | 'updatedAt'> & { viewersUser: number[]; viewersClassroom: number[] })[] = [
        {
            id: 1,
            protocolId: 1,
            applicatorId: 2,
            visibilityMode: 'PUBLIC' as VisibilityMode,
            viewersUser: [3, 4],
            viewersClassroom: [],
        },
        {
            id: 2,
            protocolId: 2,
            applicatorId: 2,
            visibilityMode: 'PUBLIC' as VisibilityMode,
            viewersUser: [],
            viewersClassroom: [1],
        },
    ];

    const applicationAnswers: Omit<ApplicationAnswer, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            date: new Date(),
            userId: 3,
            applicationId: 1,
            addressId: 1,
        },
        {
            id: 2,
            date: new Date(),
            userId: 4,
            applicationId: 2,
            addressId: 1,
        },
    ];

    const itemAnswerGroups: Omit<ItemAnswerGroup, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            applicationAnswerId: 1,
        },
        {
            id: 2,
            applicationAnswerId: 1,
        },
        {
            id: 3,
            applicationAnswerId: 2,
        },
        {
            id: 4,
            applicationAnswerId: 2,
        },
    ];

    const itemAnswers: Omit<ItemAnswer, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            text: 'Answer 1',
            groupId: 1,
            itemId: 1,
        },
        {
            id: 2,
            text: 'Answer 3',
            groupId: 3,
            itemId: 3,
        },
    ];

    const optionAnswers: Omit<OptionAnswer, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            text: '',
            itemId: 2,
            optionId: 1,
            groupId: 2,
        },
        {
            id: 2,
            text: '',
            itemId: 4,
            optionId: 3,
            groupId: 4,
        },
    ];

    const tableColums: Omit<TableColumn, 'createdAt' | 'updateAt'>[] = [
        {
            id: 1,
            text: 'Column 1',
            placement: 1,
            groupId: 1,
        },
        {
            id: 2,
            text: 'Column 2',
            placement: 2,
            groupId: 1,
        },
    ];

    await prismaClient.optionAnswer.deleteMany();
    await prismaClient.itemAnswer.deleteMany();
    await prismaClient.itemAnswerGroup.deleteMany();
    await prismaClient.applicationAnswer.deleteMany();
    await prismaClient.application.deleteMany();
    await prismaClient.itemOption.deleteMany();
    await prismaClient.item.deleteMany();
    await prismaClient.itemGroup.deleteMany();
    await prismaClient.page.deleteMany();
    await prismaClient.protocol.deleteMany();
    await prismaClient.user.deleteMany();
    await prismaClient.classroom.deleteMany();
    await prismaClient.institution.deleteMany();
    await prismaClient.address.deleteMany();
    await prismaClient.tableColumn.deleteMany();

    await prismaClient.address.createMany({
        data: addresses,
    });

    await prismaClient.institution.createMany({
        data: institutions,
    });

    await prismaClient.classroom.createMany({
        data: classrooms,
    });

    await prismaClient.user.createMany({
        data: users.map(({ classrooms, ...user }) => user),
    });

    for (const user of users) {
        await prismaClient.user.update({
            where: {
                id: user.id,
            },
            data: {
                classrooms: {
                    connect: user.classrooms.map((classroomId) => ({ id: classroomId })),
                },
            },
        });
    }

    await prismaClient.protocol.createMany({
        data: protocols,
    });
    await prismaClient.page.createMany({
        data: pages,
    });

    await prismaClient.itemGroup.createMany({
        data: itemGroups,
    });

    await prismaClient.tableColumn.createMany({
        data: tableColums,
    });

    await prismaClient.item.createMany({
        data: items,
    });

    await prismaClient.itemOption.createMany({
        data: itemOptions,
    });

    await prismaClient.application.createMany({
        data: applications.map(({ viewersUser, viewersClassroom, ...application }) => application),
    });

    for (const application of applications) {
        await prismaClient.application.update({
            where: {
                id: application.id,
            },
            data: {
                viewersUser: {
                    connect: application.viewersUser.map((userId) => ({ id: userId })),
                },
                viewersClassroom: {
                    connect: application.viewersClassroom.map((classroomId) => ({ id: classroomId })),
                },
            },
        });
    }

    await prismaClient.applicationAnswer.createMany({
        data: applicationAnswers,
    });

    await prismaClient.itemAnswerGroup.createMany({
        data: itemAnswerGroups,
    });

    await prismaClient.itemAnswer.createMany({
        data: itemAnswers,
    });

    await prismaClient.optionAnswer.createMany({
        data: optionAnswers,
    });
}

main()
    .then(async () => {
        await prismaClient.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prismaClient.$disconnect();
        process.exit(1);
    });
