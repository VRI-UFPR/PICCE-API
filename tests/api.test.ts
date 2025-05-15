/*
Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>
*/

import request from 'supertest';
import express from 'express';
import routes from '../src/routes';
import prismaClient from '../src/services/prismaClient';
import { hashSync } from 'bcrypt';
import {
    DependencyType,
    InstitutionType,
    ItemGroupType,
    ItemType,
    ItemValidationType,
    PageType,
    UserRole,
    VisibilityMode,
} from '@prisma/client';
import * as matchers from 'jest-extended';
import { faker } from '@faker-js/faker';
expect.extend(matchers);

const app = express();
app.use('/api', routes);

/**
 * Creates a new user with the specified password and role, authenticates the user,
 * and returns the created user along with an authentication token.
 *
 * @param options - Optional configuration options for creating the user.
 * @param options.role - The role to assign to the created user.
 * @param options.institutionId - The institution ID to assign to the created user.
 * @param options.creatorId - The ID of the user creating the new user.
 * @returns A promise that resolves to an object containing the created user data and an authentication token.
 */
const getAuthenticatedNewUser = async ({
    role,
    institutionId,
    creatorId,
}: { role?: UserRole; institutionId?: number; creatorId?: number } = {}) => {
    const storedUser = (await createFakerUsers({ role, institutionId, creatorId }))[0];
    const authenticationResponse =
        role === UserRole.GUEST
            ? await request(app).get('/api/auth/passwordlessSignIn')
            : await request(app)
                  .post('/api/auth/signIn')
                  .field('username', storedUser.username)
                  .field('hash', hashSync(storedUser.password, process.env.FRONTEND_SALT as string));
    const { token } = authenticationResponse.body.data;
    return { ...storedUser, token };
};

/**
 * Generates a specified number of fake user objects with random data using the Faker library.
 *
 * @param options - Optional configuration options for generating users.
 * @param options.count - The number of fake users to generate. Defaults to 1.
 * @param options.institutionId - The institution ID to assign to the created users.
 * @param options.role - The role to assign to the created users.
 * @param options.creatorId - The ID of the user creating the fake users.
 * @returns A promise that resolves to an array of user objects, each containing a name, username, and password.
 */
const getFakerUsers = async ({
    count = 1,
    institutionId,
    role,
    creatorId,
}: { count?: number; institutionId?: number; role?: UserRole; creatorId?: number } = {}) => {
    const users = Array.from({ length: count }, () => ({
        name: faker.person.fullName(),
        username: faker.internet.username().substring(0, 20),
        password: faker.internet.password(),
        institutionId,
        creatorId,
        role: role ? role : faker.helpers.arrayElement(Object.values(UserRole)),
    }));

    return users;
};

/**
 * Creates and stores a specified number of fake users with random data and a given role using the Faker library.
 *
 * @param role - The role to assign to the created users.
 * @param options - Optional configuration options for generating users.
 * @param options.count - The number of fake users to create. Defaults to 1.
 * @param options.institutionId - The institution ID to assign to the created users.
 * @param options.creatorId - The ID of the user creating the fake users.
 * @returns A promise that resolves to an array of stored user objects.
 */
const createFakerUsers = async ({
    count = 1,
    role,
    institutionId,
    creatorId,
}: { count?: number; role?: UserRole; institutionId?: number; creatorId?: number } = {}) => {
    const fakerUsers = await getFakerUsers({ count: count, institutionId: institutionId, role: role });

    const storedUsers = await Promise.all(
        fakerUsers.map(async ({ name, username, institutionId, password }) => {
            const { createdAt, updatedAt, ...storedUser } = await prismaClient.user.create({
                data: {
                    name,
                    creatorId,
                    username,
                    role: role || faker.helpers.arrayElement(Object.values(UserRole)),
                    institutionId,
                    hash: hashSync(hashSync(password, process.env.FRONTEND_SALT as string), 10),
                },
                include: { profileImage: true },
            });
            return { ...storedUser, password, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
        })
    );

    return storedUsers;
};

/**
 * Generates a specified number of fake address objects with random data using the Faker library.
 *
 * @param options - Optional configuration options for generating addresses.
 * @param options.count - The number of fake addresses to generate. Defaults to 1.
 * @returns A promise that resolves to an array of address objects, each containing a city, state, and country.
 */
const getFakerAddresses = async ({ count = 1 }: { count?: number } = {}) => {
    const addresses = Array.from({ length: count }, () => ({
        city: faker.location.city(),
        state: faker.location.state(),
        country: faker.location.country(),
    }));

    return addresses;
};

/**
 * Creates and stores a specified number of fake addresses with random data using the Faker library.
 *
 * @param options - Optional configuration options for generating addresses.
 * @param options.count - The number of fake addresses to create. Defaults to 1.
 * @returns A promise that resolves to an array of stored address objects.
 */
const createFakerAddresses = async ({ count = 1 }: { count?: number } = {}) => {
    const fakerAddresses = await getFakerAddresses({ count: count });
    const storedAddresses = await Promise.all(
        fakerAddresses.map(async (address) => {
            const storedAddress = await prismaClient.address.create({ data: address });
            return { ...storedAddress, createdAt: storedAddress.createdAt.toISOString(), updatedAt: storedAddress.updatedAt.toISOString() };
        })
    );
    return storedAddresses;
};

/**
 * Generates a specified number of fake institution objects with random data using the Faker library.
 *
 * @param options - Optional configuration options for generating institutions.
 * @param options.count - The number of fake institutions to generate. Defaults to 1.
 * @returns A promise that resolves to an array of institution objects, each containing a name, type, and address.
 */
const getFakerInstitutions = async ({ count = 1 }: { count?: number } = {}) => {
    const institutions = Promise.all(
        Array.from({ length: count }, async () => ({
            name: faker.company.name(),
            type: faker.helpers.arrayElement(Object.values(InstitutionType)),
            address: (await getFakerAddresses({ count: 1 }))[0],
        }))
    );

    return institutions;
};

/**
 * Creates and stores a specified number of fake institutions with random data using the Faker library.
 *
 * @param options - Optional configuration options for generating institutions.
 * @param options.count - The number of fake institutions to create. Defaults to 1.
 * @returns A promise that resolves to an array of stored institution objects.
 */
const createFakerInstitutions = async ({ count = 1 }: { count?: number } = {}) => {
    const fakerInstitutions = await getFakerInstitutions({ count: count });
    const storedInstitutions = await Promise.all(
        fakerInstitutions.map(async ({ name, type, address }) => {
            const { createdAt, updatedAt, ...storedInstitution } = await prismaClient.institution.create({
                data: { name, type, address: { create: address } },
                include: { address: true },
            });
            return { ...storedInstitution, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
        })
    );
    return storedInstitutions;
};

/**
 * Generates a specified number of fake classroom objects with random data using the Faker library.
 *
 * @param creatorId - The ID of the user creating the classrooms.
 * @param options - Optional configuration options for generating classrooms.
 * @param options.count - The number of fake classrooms to generate. Defaults to 1.
 * @param options.usersCount - The number of fake users to associate with each classroom. Defaults to 0.
 * @param options.institutionId - The institution ID to assign to the created classrooms and possibly to the users.
 * @param options.assignInstitutionToUsers - Whether to assign the institution ID to the users. Defaults to false.
 * @param options.usersRole - The role to assign to the users associated with the classrooms.
 * @returns A promise that resolves to an array of classroom objects, each containing a name and associated users.
 */
const getFakerClassrooms = async ({
    creatorId,
    count = 1,
    usersCount = 0,
    institutionId,
    usersInstitutionId,
    usersRole,
}: {
    creatorId?: number;
    count?: number;
    usersCount?: number;
    institutionId?: number;
    usersInstitutionId?: number;
    usersRole?: UserRole;
} = {}) => {
    creatorId = creatorId || (await getAuthenticatedNewUser({ role: UserRole.ADMIN })).id;
    const classrooms = await Promise.all(
        Array.from({ length: count }, async () => ({
            name: faker.lorem.words(2).substring(0, 20),
            creatorId,
            institutionId,
            users: await createFakerUsers({
                count: usersCount,
                institutionId: usersInstitutionId,
                role: usersRole,
                creatorId,
            }),
        }))
    );
    return classrooms;
};

/**
 * Creates and stores a specified number of fake classrooms with random data using the Faker library.
 *
 * @param creatorId - The ID of the user creating the classrooms.
 * @param options - Optional configuration options for generating classrooms.
 * @param options.count - The number of fake classrooms to create. Defaults to 1.
 * @param options.usersCount - The number of fake users to associate with each classroom. Defaults to 0.
 * @param options.institutionId - The institution ID to assign to the created classrooms and possibly to the users.
 * @param options.assignInstitutionToUsers - Whether to assign the institution ID to the users. Defaults to false.
 * @returns A promise that resolves to an array of stored classroom objects.
 */
const createFakerClassrooms = async ({
    creatorId,
    count = 1,
    usersCount = 0,
    institutionId,
    usersInstitutionId,
    usersRole,
}: {
    creatorId?: number;
    count?: number;
    usersCount?: number;
    institutionId?: number;
    usersInstitutionId?: number;
    usersRole?: UserRole;
} = {}) => {
    const fakerClassrooms = await getFakerClassrooms({ creatorId, count, usersCount, institutionId, usersInstitutionId, usersRole });
    const storedClassrooms = await Promise.all(
        fakerClassrooms.map(async ({ name, creatorId, institutionId, users }) => {
            const {
                createdAt,
                updatedAt,
                users: storedUsers,
                ...storedClassroom
            } = await prismaClient.classroom.create({
                data: { name, creatorId: creatorId as number, institutionId, users: { connect: users.map(({ id }) => ({ id })) } },
                include: { users: true },
            });
            return {
                ...storedClassroom,
                createdAt: createdAt.toISOString(),
                updatedAt: updatedAt.toISOString(),
                users: storedUsers.map(({ createdAt, updatedAt, ...user }) => ({
                    ...user,
                    createdAt: createdAt.toISOString(),
                    updatedAt: updatedAt.toISOString(),
                })),
            };
        })
    );
    return storedClassrooms;
};

/**
 *
 * Clears all data from the specified tables in the database and resets their identity sequences.
 *
 * @param tablesToClear - An object specifying which tables to clear. Each key represents a table name, and the value is a boolean indicating whether to clear that table.
 * @returns A promise that resolves when the database has been cleared.
 */
const clearDatabase = async (
    tablesToClear: {
        Address?: boolean;
        ApplicationAnswer?: boolean;
        ItemAnswer?: boolean;
        ItemAnswerGroup?: boolean;
        OptionAnswer?: boolean;
        TableAnswer?: boolean;
        Institution?: boolean;
        User?: boolean;
        Classroom?: boolean;
        Application?: boolean;
        Protocol?: boolean;
        Page?: boolean;
        ItemGroup?: boolean;
        Item?: boolean;
        ItemValidation?: boolean;
        ItemOption?: boolean;
        TableColumn?: boolean;
        File?: boolean;
        ItemGroupDependencyRule?: boolean;
        PageDependencyRule?: boolean;
    } = {}
) => {
    const selectedTables = Object.entries(tablesToClear)
        .filter(([_, shouldClear]) => shouldClear)
        .map(([tableName]) => `"public"."${tableName}"`);

    if (selectedTables.length === 0) return;

    await prismaClient.$executeRawUnsafe(`TRUNCATE TABLE ${selectedTables.join(', ')} RESTART IDENTITY CASCADE`);
};

// const clearDatabase = async () =>
//     prismaClient.$executeRawUnsafe(
//         `TRUNCATE TABLE "public"."Address", "public"."ApplicationAnswer", "public"."ItemAnswer", "public"."ItemAnswerGroup", "public"."OptionAnswer", "public"."TableAnswer", "public"."Institution", "public"."User", "public"."Classroom", "public"."Application", "public"."Protocol", "public"."Page", "public"."ItemGroup", "public"."Item", "public"."ItemValidation", "public"."ItemOption", "public"."TableColumn", "public"."File", "public"."ItemGroupDependencyRule", "public"."PageDependencyRule" RESTART IDENTITY CASCADE`
//     );

/**
 * Operations to be performed before all tests
 *
 * Before running the tests, clear the database and create the necessary data for testing.
 *
 * @return {Promise<void>}
 */
beforeAll(async () => {
    // Clear the database
    await clearDatabase({
        Address: true,
        ApplicationAnswer: true,
        ItemAnswer: true,
        ItemAnswerGroup: true,
        OptionAnswer: true,
        TableAnswer: true,
        Institution: true,
        User: true,
        Classroom: true,
        Application: true,
        Protocol: true,
        Page: true,
        ItemGroup: true,
        Item: true,
        ItemValidation: true,
        ItemOption: true,
        TableColumn: true,
        File: true,
        ItemGroupDependencyRule: true,
        PageDependencyRule: true,
    });
    // Create the guest user that is mandatory for the system to work
    // await prismaClient.user.createMany({
    //     data: [
    //         {
    //             name: 'Guest',
    //             username: 'guest',
    //             hash: hashSync(hashSync(String(process.env.SEED_USERS_PASSWORD), process.env.FRONTEND_SALT as string), 10),
    //             role: UserRole.GUEST,
    //             acceptedTerms: false,
    //         },
    //     ],
    // });
}, 1000000);

describe('AuthController tests', () => {
    describe('SignIn endpoint', () => {
        describe('Sign in with valid credentials', () => {
            it('Should sign in with valid credentials as an unauthenticated user', async () => {
                const storedUser = (await createFakerUsers({ role: UserRole.USER }))[0];
                const expectedResponse = {
                    message: 'User signed in.',
                    data: {
                        id: storedUser.id,
                        role: storedUser.role,
                        acceptedTerms: storedUser.acceptedTerms,
                        token: expect.any(String),
                        expiresIn: Number(process.env.JWT_EXPIRATION),
                        institutionId: storedUser.institutionId,
                        profileImage: storedUser.profileImage,
                    },
                };
                const response = await request(app)
                    .post('/api/auth/signIn')
                    .field('username', storedUser.username)
                    .field('hash', hashSync(storedUser.password, process.env.FRONTEND_SALT as string));
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });
        });

        describe('Sign in with invalid credentials', () => {
            it('Should not sign in an existing user with invalid credentials as an unauthenticated user', async () => {
                const storedUser = (await createFakerUsers({ role: UserRole.USER }))[0];
                const response = await request(app)
                    .post('/api/auth/signIn')
                    .field('username', storedUser.username)
                    .field('hash', 'invalidHash');
                expect(response.body).toEqual({
                    message: 'Invalid credentials.',
                    details: {},
                });
                expect(response.status).toBe(400);
            });

            it('Should not sign in an non-existing user as an unauthenticated user', async () => {
                const response = await request(app)
                    .post('/api/auth/signIn')
                    .field('username', 'nonExistingUser')
                    .field('hash', 'invalidHash');
                expect(response.body).toEqual({
                    details: {
                        clientVersion: '5.3.1',
                        code: 'P2025',
                        name: 'NotFoundError',
                    },
                    message: 'No User found',
                });
                expect(response.status).toBe(400);
            });

            it('Should not sign in as an existing user with guest role as an unauthenticated user', async () => {
                const storedUser = (await createFakerUsers({ role: UserRole.GUEST }))[0];
                const response = await request(app)
                    .post('/api/auth/signIn')
                    .field('username', storedUser.username)
                    .field('hash', hashSync(storedUser.password, process.env.FRONTEND_SALT as string));
                expect(response.body).toEqual({
                    message: 'Invalid credentials.',
                    details: {},
                });
                expect(response.status).toBe(400);
            });
        });
    });

    describe('PasswordlessSignIn endpoint', () => {
        describe('Sign in without password', () => {
            it('Should sign in as guest without password as an unauthenticated user', async () => {
                const expectedResponse = {
                    message: 'User signed in.',
                    data: {
                        id: expect.any(Number),
                        role: UserRole.GUEST,
                        token: expect.any(String),
                        expiresIn: Number(process.env.JWT_EXPIRATION),
                    },
                };
                const response = await request(app).get('/api/auth/passwordlessSignIn');
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });
        });
    });

    describe('RenewSignIn endpoint', () => {
        describe('Renew sign', () => {
            it('Should renew sign in as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const expectedResponse = {
                    message: 'User signed in.',
                    data: {
                        id: requester.id,
                        role: UserRole.ADMIN,
                        token: expect.any(String),
                        expiresIn: Number(process.env.JWT_EXPIRATION),
                        acceptedTerms: false,
                        institutionId: null,
                    },
                };
                const response = await request(app).post('/api/auth/renewSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should renew sign in as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const expectedResponse = {
                    message: 'User signed in.',
                    data: {
                        id: requester.id,
                        role: UserRole.COORDINATOR,
                        token: expect.any(String),
                        expiresIn: Number(process.env.JWT_EXPIRATION),
                        acceptedTerms: false,
                        institutionId: null,
                    },
                };
                const response = await request(app).post('/api/auth/renewSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should renew sign in as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const expectedResponse = {
                    message: 'User signed in.',
                    data: {
                        id: requester.id,
                        role: UserRole.PUBLISHER,
                        token: expect.any(String),
                        expiresIn: Number(process.env.JWT_EXPIRATION),
                        acceptedTerms: false,
                        institutionId: null,
                    },
                };
                const response = await request(app).post('/api/auth/renewSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should renew sign in as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const expectedResponse = {
                    message: 'User signed in.',
                    data: {
                        id: requester.id,
                        role: UserRole.APPLIER,
                        token: expect.any(String),
                        expiresIn: Number(process.env.JWT_EXPIRATION),
                        acceptedTerms: false,
                        institutionId: null,
                    },
                };
                const response = await request(app).post('/api/auth/renewSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should renew sign in as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = {
                    message: 'User signed in.',
                    data: {
                        id: requester.id,
                        role: UserRole.USER,
                        token: expect.any(String),
                        expiresIn: Number(process.env.JWT_EXPIRATION),
                        acceptedTerms: false,
                        institutionId: null,
                    },
                };
                const response = await request(app).post('/api/auth/renewSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should renew sign in as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = {
                    message: 'User signed in.',
                    data: {
                        id: expect.any(Number),
                        role: UserRole.GUEST,
                        token: expect.any(String),
                        expiresIn: Number(process.env.JWT_EXPIRATION),
                        acceptedTerms: false,
                        institutionId: null,
                    },
                };
                const response = await request(app).post('/api/auth/renewSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not renew sign in as an unauthenticated user', async () => {
                const response = await request(app).post('/api/auth/renewSignIn');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('CheckAuthentication endpoint', () => {
        describe('Check authentication', () => {
            it('Should confirm authentication as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const expectedResponse = {
                    message: 'User currently signed in.',
                    data: { id: requester.id },
                };
                const response = await request(app).get('/api/auth/checkSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should confirm authentication as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const expectedResponse = {
                    message: 'User currently signed in.',
                    data: { id: requester.id },
                };
                const response = await request(app).get('/api/auth/checkSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should confirm authentication as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const expectedResponse = {
                    message: 'User currently signed in.',
                    data: { id: requester.id },
                };
                const response = await request(app).get('/api/auth/checkSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should confirm authentication as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const expectedResponse = {
                    message: 'User currently signed in.',
                    data: { id: requester.id },
                };
                const response = await request(app).get('/api/auth/checkSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should confirm authentication as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = {
                    message: 'User currently signed in.',
                    data: { id: requester.id },
                };
                const response = await request(app).get('/api/auth/checkSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should confirm authentication as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = {
                    message: 'User currently signed in.',
                    data: { id: expect.any(Number) },
                };
                const response = await request(app).get('/api/auth/checkSignIn').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not confirm authentication as an unauthenticated user', async () => {
                const response = await request(app).get('/api/auth/checkSignIn');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('AcceptTerms endpoint', () => {
        describe('Accept terms', () => {
            it('Should accept terms as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const expectedResponse = {
                    message: 'Terms accepted.',
                    data: {
                        id: requester.id,
                        acceptedTerms: true,
                    },
                };
                const response = await request(app).get('/api/auth/acceptTerms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should accept terms as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const expectedResponse = {
                    message: 'Terms accepted.',
                    data: {
                        id: requester.id,
                        acceptedTerms: true,
                    },
                };
                const response = await request(app).get('/api/auth/acceptTerms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should accept terms as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const expectedResponse = {
                    message: 'Terms accepted.',
                    data: {
                        id: requester.id,
                        acceptedTerms: true,
                    },
                };
                const response = await request(app).get('/api/auth/acceptTerms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should accept terms as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const expectedResponse = {
                    message: 'Terms accepted.',
                    data: {
                        id: requester.id,
                        acceptedTerms: true,
                    },
                };
                const response = await request(app).get('/api/auth/acceptTerms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should accept terms as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = {
                    message: 'Terms accepted.',
                    data: {
                        id: requester.id,
                        acceptedTerms: true,
                    },
                };
                const response = await request(app).get('/api/auth/acceptTerms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not accept terms as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = {
                    message: 'Cannot accept terms as guest.',
                    details: {},
                };
                const response: any = await request(app).get('/api/auth/acceptTerms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not accept terms as an unauthenticated user', async () => {
                const response = await request(app).get('/api/auth/acceptTerms');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });
});

describe('AddressController tests', () => {
    describe('CreateAddress endpoint', () => {
        describe('Create address', () => {
            it('Should create address as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const fakerAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'Address created.',
                    data: {
                        id: expect.any(Number),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                        ...fakerAddress,
                    },
                };
                const response = await request(app)
                    .post('/api/address/createAddress')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', fakerAddress.city)
                    .field('state', fakerAddress.state)
                    .field('country', fakerAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(201);
            });

            it('Should not create address as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const fakerAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/address/createAddress')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', fakerAddress.city)
                    .field('state', fakerAddress.state)
                    .field('country', fakerAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create address as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const fakerAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/address/createAddress')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', fakerAddress.city)
                    .field('state', fakerAddress.state)
                    .field('country', fakerAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create address as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const fakerAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/address/createAddress')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', fakerAddress.city)
                    .field('state', fakerAddress.state)
                    .field('country', fakerAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create address as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const fakerAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/address/createAddress')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', fakerAddress.city)
                    .field('state', fakerAddress.state)
                    .field('country', fakerAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create address as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const fakerAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/address/createAddress')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', fakerAddress.city)
                    .field('state', fakerAddress.state)
                    .field('country', fakerAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create address as an unauthenticated user', async () => {
                const fakerAddress = (await getFakerAddresses())[0];
                const response = await request(app)
                    .post('/api/address/createAddress')
                    .field('city', fakerAddress.city)
                    .field('state', fakerAddress.state)
                    .field('country', fakerAddress.country);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('UpdateAddress endpoint', () => {
        describe('Update address', () => {
            it('Should update address as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedAddress = (await createFakerAddresses())[0];
                const updatedAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'Address updated.',
                    data: {
                        id: storedAddress.id,
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                        ...updatedAddress,
                    },
                };
                const response = await request(app)
                    .put(`/api/address/updateAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', updatedAddress.city)
                    .field('state', updatedAddress.state)
                    .field('country', updatedAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not update address as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedAddress = (await createFakerAddresses())[0];
                const updatedAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/address/updateAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', updatedAddress.city)
                    .field('state', updatedAddress.state)
                    .field('country', updatedAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update address as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedAddress = (await createFakerAddresses())[0];
                const updatedAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/address/updateAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', updatedAddress.city)
                    .field('state', updatedAddress.state)
                    .field('country', updatedAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update address as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedAddress = (await createFakerAddresses())[0];
                const updatedAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/address/updateAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', updatedAddress.city)
                    .field('state', updatedAddress.state)
                    .field('country', updatedAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update address as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedAddress = (await createFakerAddresses())[0];
                const updatedAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/address/updateAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', updatedAddress.city)
                    .field('state', updatedAddress.state)
                    .field('country', updatedAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update address as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const storedAddress = (await createFakerAddresses())[0];
                const updatedAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/address/updateAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', updatedAddress.city)
                    .field('state', updatedAddress.state)
                    .field('country', updatedAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update address as an unauthenticated user', async () => {
                const storedAddress = (await createFakerAddresses())[0];
                const updatedAddress = (await getFakerAddresses())[0];
                const response = await request(app)
                    .put(`/api/address/updateAddress/${storedAddress.id}`)
                    .field('city', updatedAddress.city)
                    .field('state', updatedAddress.state)
                    .field('country', updatedAddress.country);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });

            it('Should not update address with invalid id', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const updatedAddress = (await getFakerAddresses())[0];

                const expectedResponse = {
                    message:
                        'An operation failed because it depends on one or more records that were required but not found. Record to update not found.',
                    details: {
                        clientVersion: '5.3.1',
                        code: 'P2025',
                        name: 'PrismaClientKnownRequestError',
                        meta: { cause: 'Record to update not found.' },
                    },
                };
                const response = await request(app)
                    .put('/api/address/updateAddress/99999999')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', updatedAddress.city)
                    .field('state', updatedAddress.state)
                    .field('country', updatedAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });
    });

    describe('GetAllAddresses endpoint', () => {
        describe('Get all addresses', () => {
            it('Should get all addresses as an authenticated user with admin role', async () => {
                await clearDatabase({ Address: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedAddresses = await createFakerAddresses({ count: 5 });
                const expectedResponse = {
                    message: 'All addresses found.',
                    data: expect.arrayContaining(storedAddresses),
                };
                const response = await request(app).get('/api/address/getAllAddresses').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(storedAddresses.length);
                expect(response.status).toBe(200);
            });

            it('Should get all addresses as an authenticated user with coordinator role', async () => {
                await clearDatabase({ Address: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedAddresses = await createFakerAddresses({ count: 5 });
                const expectedResponse = {
                    message: 'All addresses found.',
                    data: expect.arrayContaining(storedAddresses),
                };
                const response = await request(app).get('/api/address/getAllAddresses').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(storedAddresses.length);
                expect(response.status).toBe(200);
            });

            it('Should get all addresses as an authenticated user with publisher role', async () => {
                await clearDatabase({ Address: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedAddresses = await createFakerAddresses({ count: 5 });
                const expectedResponse = {
                    message: 'All addresses found.',
                    data: expect.arrayContaining(storedAddresses),
                };
                const response = await request(app).get('/api/address/getAllAddresses').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(storedAddresses.length);
                expect(response.status).toBe(200);
            });

            it('Should get all addresses as an authenticated user with applier role', async () => {
                await clearDatabase({ Address: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedAddresses = await createFakerAddresses({ count: 5 });
                const expectedResponse = {
                    message: 'All addresses found.',
                    data: expect.arrayContaining(storedAddresses),
                };
                const response = await request(app).get('/api/address/getAllAddresses').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(storedAddresses.length);
                expect(response.status).toBe(200);
            });

            it('Should not get all addresses as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app).get('/api/address/getAllAddresses').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all addresses as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app).get('/api/address/getAllAddresses').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all addresses as an unauthenticated user', async () => {
                const response = await request(app).get('/api/address/getAllAddresses');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('GetAddressesByState endpoint', () => {
        describe('Get addresses by state', () => {
            it('Should get addresses by state as an authenticated user with admin role', async () => {
                await clearDatabase({ Address: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedAddresses = await createFakerAddresses({ count: 5 });
                const filteredAddresses = storedAddresses
                    .filter((address) => address.state === storedAddresses[0].state && address.country === storedAddresses[0].country)
                    .map(({ id, city }) => ({ id, city }));
                const expectedResponse = {
                    message: 'Addresses found.',
                    data: expect.arrayContaining(filteredAddresses),
                };
                const response = await request(app)
                    .post('/api/address/getAddressesByState/')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('state', storedAddresses[0].state)
                    .field('country', storedAddresses[0].country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(filteredAddresses.length);
                expect(response.status).toBe(200);
            });

            it('Should get addresses by state as an authenticated user with coordinator role', async () => {
                await clearDatabase({ Address: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedAddresses = await createFakerAddresses({ count: 5 });
                const filteredAddresses = storedAddresses
                    .filter((address) => address.state === storedAddresses[0].state && address.country === storedAddresses[0].country)
                    .map(({ id, city }) => ({ id, city }));
                const expectedResponse = {
                    message: 'Addresses found.',
                    data: expect.arrayContaining(filteredAddresses),
                };
                const response = await request(app)
                    .post('/api/address/getAddressesByState/')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('state', storedAddresses[0].state)
                    .field('country', storedAddresses[0].country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(filteredAddresses.length);
                expect(response.status).toBe(200);
            });

            it('Should get addresses by state as an authenticated user with publisher role', async () => {
                await clearDatabase({ Address: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedAddresses = await createFakerAddresses({ count: 5 });
                const filteredAddresses = storedAddresses
                    .filter((address) => address.state === storedAddresses[0].state && address.country === storedAddresses[0].country)
                    .map(({ id, city }) => ({ id, city }));
                const expectedResponse = {
                    message: 'Addresses found.',
                    data: expect.arrayContaining(filteredAddresses),
                };
                const response = await request(app)
                    .post('/api/address/getAddressesByState/')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('state', storedAddresses[0].state)
                    .field('country', storedAddresses[0].country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(filteredAddresses.length);
                expect(response.status).toBe(200);
            });

            it('Should get addresses by state as an authenticated user with applier role', async () => {
                await clearDatabase({ Address: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedAddresses = await createFakerAddresses({ count: 5 });
                const filteredAddresses = storedAddresses
                    .filter((address) => address.state === storedAddresses[0].state && address.country === storedAddresses[0].country)
                    .map(({ id, city }) => ({ id, city }));
                const expectedResponse = {
                    message: 'Addresses found.',
                    data: expect.arrayContaining(filteredAddresses),
                };
                const response = await request(app)
                    .post('/api/address/getAddressesByState/')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('state', storedAddresses[0].state)
                    .field('country', storedAddresses[0].country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(filteredAddresses.length);
                expect(response.status).toBe(200);
            });

            it('Should not get addresses by state as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/address/getAddressesByState/')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('state', 'any')
                    .field('country', 'any');
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get addresses by state as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/address/getAddressesByState/')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('state', 'any')
                    .field('country', 'any');
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get addresses by state as an unauthenticated user', async () => {
                const response = await request(app).post('/api/address/getAddressesByState/').field('state', 'any').field('country', 'any');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('getAddressId endpoint', () => {
        describe('Get the address id', () => {
            it('Should get the address id as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'City ID found.',
                    data: storedAddress.id,
                };
                const response = await request(app)
                    .post(`/api/address/getAddressId`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', storedAddress.city)
                    .field('state', storedAddress.state)
                    .field('country', storedAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get the address id as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'City ID found.',
                    data: storedAddress.id,
                };
                const response = await request(app)
                    .post(`/api/address/getAddressId`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', storedAddress.city)
                    .field('state', storedAddress.state)
                    .field('country', storedAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get the address id as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'City ID found.',
                    data: storedAddress.id,
                };
                const response = await request(app)
                    .post(`/api/address/getAddressId`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', storedAddress.city)
                    .field('state', storedAddress.state)
                    .field('country', storedAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get the address id as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'City ID found.',
                    data: storedAddress.id,
                };
                const response = await request(app)
                    .post(`/api/address/getAddressId`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', storedAddress.city)
                    .field('state', storedAddress.state)
                    .field('country', storedAddress.country);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not get the address id as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post(`/api/address/getAddressId`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', 'any')
                    .field('state', 'any')
                    .field('country', 'any');
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get the address id as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post(`/api/address/getAddressId`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('city', 'any')
                    .field('state', 'any')
                    .field('country', 'any');
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get the address id as an unauthenticated user', async () => {
                const response = await request(app)
                    .post(`/api/address/getAddressId`)
                    .field('city', 'any')
                    .field('state', 'any')
                    .field('country', 'any');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('GetAddress endpoint', () => {
        describe('Get address by id', () => {
            it('Should get address by id as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'Address found.',
                    data: storedAddress,
                };
                const response = await request(app)
                    .get(`/api/address/getAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get address by id as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'Address found.',
                    data: storedAddress,
                };
                const response = await request(app)
                    .get(`/api/address/getAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get address by id as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'Address found.',
                    data: storedAddress,
                };
                const response = await request(app)
                    .get(`/api/address/getAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get address by id as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'Address found.',
                    data: storedAddress,
                };
                const response = await request(app)
                    .get(`/api/address/getAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not get address by id as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get(`/api/address/getAddress/99999999`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get address by id as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get(`/api/address/getAddress/99999999`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get address by id as an unauthenticated user', async () => {
                const response = await request(app).get(`/api/address/getAddress/99999999`);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('DeleteAddress endpoint', () => {
        describe('Delete address', () => {
            it('Should delete address as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'Address deleted.',
                    data: { id: storedAddress.id },
                };
                const response = await request(app)
                    .delete(`/api/address/deleteAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not delete address as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/address/deleteAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete address as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/address/deleteAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete address as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/address/deleteAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete address as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/address/deleteAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete address as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/address/deleteAddress/${storedAddress.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete address as an unauthenticated user', async () => {
                const storedAddress = (await createFakerAddresses())[0];
                const response = await request(app).delete(`/api/address/deleteAddress/${storedAddress.id}`);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });

            it('Should not delete address with invalid id', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const expectedResponse = {
                    message:
                        'An operation failed because it depends on one or more records that were required but not found. Record to delete does not exist.',
                    details: {
                        clientVersion: '5.3.1',
                        code: 'P2025',
                        name: 'PrismaClientKnownRequestError',
                        meta: { cause: 'Record to delete does not exist.' },
                    },
                };
                const response = await request(app)
                    .delete('/api/address/deleteAddress/99999999')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });
    });
});

describe('InstitutionController tests', () => {
    describe('CreateInstitution endpoint', () => {
        describe('Create institution', () => {
            it('Should create institution as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const institution = (await getFakerInstitutions())[0];
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'Institution created.',
                    data: {
                        ...institution,
                        address: (({ createdAt, updatedAt, id, ...address }) => address)(storedAddress),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        id: expect.any(Number),
                        users: [],
                        classrooms: [],
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    },
                };
                const response = await request(app)
                    .post('/api/institution/createInstitution')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', institution.name)
                    .field('type', institution.type)
                    .field('addressId', storedAddress.id);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(201);
            });

            it('Should not create institution as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const institution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/institution/createInstitution')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', institution.name)
                    .field('type', institution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create institution as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const institution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/institution/createInstitution')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', institution.name)
                    .field('type', institution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create institution as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const institution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/institution/createInstitution')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', institution.name)
                    .field('type', institution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create institution as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const institution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/institution/createInstitution')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', institution.name)
                    .field('type', institution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create institution as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const institution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/institution/createInstitution')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', institution.name)
                    .field('type', institution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create institution as an unauthenticated user', async () => {
                const institution = (await getFakerInstitutions())[0];
                const response = await request(app)
                    .post('/api/institution/createInstitution')
                    .field('name', institution.name)
                    .field('type', institution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('UpdateInstitution endpoint', () => {
        describe('Update institution', () => {
            it('Should update institution as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedInstitution = (await createFakerInstitutions())[0];
                const updatedInstitution = (await getFakerInstitutions())[0];
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'Institution updated.',
                    data: {
                        ...updatedInstitution,
                        address: (({ createdAt, updatedAt, id, ...address }) => address)(storedAddress),
                        id: storedInstitution.id,
                        users: [],
                        classrooms: [],
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                    },
                };
                const response = await request(app)
                    .put(`/api/institution/updateInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedInstitution.name)
                    .field('type', updatedInstitution.type)
                    .field('addressId', storedAddress.id);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not update institution as an authenticated user with coordinator role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedInstitution = (await createFakerInstitutions())[0];
                const updatedInstitution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/institution/updateInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedInstitution.name)
                    .field('type', updatedInstitution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should update institution as an authenticated user with coordinator role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitution.id });
                const updatedInstitution = (await getFakerInstitutions())[0];
                const storedAddress = (await createFakerAddresses())[0];
                const expectedResponse = {
                    message: 'Institution updated.',
                    data: {
                        ...updatedInstitution,
                        address: (({ id, createdAt, updatedAt, ...address }) => address)(storedAddress),
                        id: storedInstitution.id,
                        users: [
                            (({ password, creatorId, hash, profileImageId, institutionId, token, ...user }) => ({
                                ...user,
                                actions: {
                                    toUpdate: true,
                                    toGet: true,
                                    toDelete: true,
                                },
                            }))(requester),
                        ],
                        classrooms: [],
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                        actions: { toDelete: false, toUpdate: true, toGet: true },
                    },
                };
                const response = await request(app)
                    .put(`/api/institution/updateInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedInstitution.name)
                    .field('type', updatedInstitution.type)
                    .field('addressId', storedAddress.id);
                expect(response.body).toEqual(expectedResponse);
            });

            it('Should not update institution as an authenticated user with publisher role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const updatedInstitution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/institution/updateInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedInstitution.name)
                    .field('type', updatedInstitution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update institution as an authenticated user with publisher role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitution.id });
                const updatedInstitution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/institution/updateInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedInstitution.name)
                    .field('type', updatedInstitution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update institution as an authenticated user with applier role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const updatedInstitution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/institution/updateInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedInstitution.name)
                    .field('type', updatedInstitution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update institution as an authenticated user with applier role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitution.id });
                const updatedInstitution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/institution/updateInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedInstitution.name)
                    .field('type', updatedInstitution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update institution as an authenticated user with user role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const updatedInstitution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/institution/updateInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedInstitution.name)
                    .field('type', updatedInstitution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update institution as an authenticated user with user role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER, institutionId: storedInstitution.id });
                const updatedInstitution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/institution/updateInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedInstitution.name)
                    .field('type', updatedInstitution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update institution as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const storedInstitution = (await createFakerInstitutions())[0];
                const updatedInstitution = (await getFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .put(`/api/institution/updateInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedInstitution.name)
                    .field('type', updatedInstitution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update institution as an unauthenticated user', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const updatedInstitution = (await getFakerInstitutions())[0];
                const response = await request(app)
                    .put(`/api/institution/updateInstitution/${storedInstitution.id}`)
                    .field('name', updatedInstitution.name)
                    .field('type', updatedInstitution.type)
                    .field('addressId', 1);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('GetAllInstitutions endpoint', () => {
        describe('Get all institutions', () => {
            it('Should get all institutions as an authenticated user with admin role', async () => {
                await clearDatabase({ Institution: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedInstitutions = await createFakerInstitutions({ count: 5 });
                const expectedResponse = {
                    message: 'All institutions found.',
                    data: expect.arrayContaining(
                        storedInstitutions.map(({ addressId, ...institution }) => ({
                            ...institution,
                            address: institution.address
                                ? (({ createdAt, updatedAt, id, ...address }) => address)(institution.address)
                                : undefined,
                            actions: { toDelete: true, toUpdate: true, toGet: true },
                            users: [],
                            classrooms: [],
                        }))
                    ),
                };
                const response = await request(app)
                    .get('/api/institution/getAllInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(storedInstitutions.length);
                expect(response.status).toBe(200);
            });

            it('Should not get all institutions as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get('/api/institution/getAllInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all institutions as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get('/api/institution/getAllInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all institutions as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get('/api/institution/getAllInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all institutions as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get('/api/institution/getAllInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all institutions as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get('/api/institution/getAllInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all institutions as an unauthenticated user', async () => {
                const response = await request(app).get('/api/institution/getAllInstitutions');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('GetVisibleInstitutions endpoint', () => {
        describe('Get visible institutions', () => {
            it('Should get visible institutions as an authenticated user with admin role', async () => {
                await clearDatabase({ Institution: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedInstitutions = await createFakerInstitutions({ count: 5 });
                const expectedResponse = {
                    message: 'Visible institutions found.',
                    data: expect.arrayContaining(
                        storedInstitutions.map(({ addressId, ...institution }) => ({
                            ...institution,
                            address: institution.address
                                ? (({ createdAt, updatedAt, id, ...address }) => address)(institution.address)
                                : undefined,
                            actions: { toDelete: true, toUpdate: true, toGet: true },
                            users: [],
                            classrooms: [],
                        }))
                    ),
                };
                const response = await request(app)
                    .get('/api/institution/getVisibleInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(storedInstitutions.length);
                expect(response.status).toBe(200);
            });

            it('Should get visible institutions as an authenticated user with coordinator role', async () => {
                await clearDatabase({ Institution: true });
                const storedInstitutions = await createFakerInstitutions({ count: 5 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitutions[0].id });
                const expectedResponse = {
                    message: 'Visible institutions found.',
                    data: expect.arrayContaining([
                        (({ addressId, ...institution }) => ({
                            ...institution,
                            address: institution.address
                                ? (({ createdAt, updatedAt, id, ...address }) => address)(institution.address)
                                : undefined,
                            actions: { toDelete: false, toUpdate: true, toGet: true },
                            users: [
                                (({ password, creatorId, hash, profileImageId, institutionId, token, ...user }) => ({
                                    ...user,
                                    actions: {
                                        toUpdate: true,
                                        toGet: true,
                                        toDelete: true,
                                    },
                                }))(requester),
                            ],
                            classrooms: [],
                        }))(storedInstitutions[0]),
                    ]),
                };
                const response = await request(app)
                    .get('/api/institution/getVisibleInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should get visible institutions as an authenticated user with publisher role', async () => {
                await clearDatabase({ Institution: true });
                const storedInstitutions = await createFakerInstitutions({ count: 5 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitutions[0].id });
                const expectedResponse = {
                    message: 'Visible institutions found.',
                    data: expect.arrayContaining([
                        (({ addressId, ...institution }) => ({
                            ...institution,
                            address: institution.address
                                ? (({ createdAt, updatedAt, id, ...address }) => address)(institution.address)
                                : undefined,
                            actions: { toDelete: false, toUpdate: false, toGet: true },
                            users: [
                                (({ password, creatorId, hash, profileImageId, institutionId, token, ...user }) => ({
                                    ...user,
                                    actions: {
                                        toUpdate: true,
                                        toGet: true,
                                        toDelete: true,
                                    },
                                }))(requester),
                            ],
                            classrooms: [],
                        }))(storedInstitutions[0]),
                    ]),
                };
                const response = await request(app)
                    .get('/api/institution/getVisibleInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should get visible institutions as an authenticated user with applier role', async () => {
                await clearDatabase({ Institution: true });
                const storedInstitutions = await createFakerInstitutions({ count: 5 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitutions[0].id });
                const expectedResponse = {
                    message: 'Visible institutions found.',
                    data: expect.arrayContaining([
                        (({ addressId, ...institution }) => ({
                            ...institution,
                            address: institution.address
                                ? (({ createdAt, updatedAt, id, ...address }) => address)(institution.address)
                                : undefined,
                            actions: { toDelete: false, toUpdate: false, toGet: true },
                            users: [
                                (({ password, creatorId, hash, profileImageId, institutionId, token, ...user }) => ({
                                    ...user,
                                    actions: {
                                        toUpdate: true,
                                        toGet: true,
                                        toDelete: true,
                                    },
                                }))(requester),
                            ],
                            classrooms: [],
                        }))(storedInstitutions[0]),
                    ]),
                };
                const response = await request(app)
                    .get('/api/institution/getVisibleInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should not get visible institutions as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get('/api/institution/getVisibleInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get visible institutions as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get('/api/institution/getVisibleInstitutions')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get visible institutions as an unauthenticated user', async () => {
                const response = await request(app).get('/api/institution/getVisibleInstitutions');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('GetInstitution endpoint', () => {
        describe('Get institution', () => {
            it('Should get institution as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'Institution found.',
                    data: (({ addressId, ...institution }) => ({
                        ...institution,
                        address: institution.address
                            ? (({ createdAt, updatedAt, id, ...address }) => address)(institution.address)
                            : undefined,
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        users: [],
                        classrooms: [],
                    }))(storedInstitution),
                };
                const response = await request(app)
                    .get(`/api/institution/getInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not get institution as an authenticated user with coordinator role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get(`/api/institution/getInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should get institution as an authenticated user with coordinator role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitution.id });
                const expectedResponse = {
                    message: 'Institution found.',
                    data: (({ addressId, ...institution }) => ({
                        ...institution,
                        address: institution.address
                            ? (({ createdAt, updatedAt, id, ...address }) => address)(institution.address)
                            : undefined,
                        actions: { toDelete: false, toUpdate: true, toGet: true },
                        users: [
                            (({ password, creatorId, hash, profileImageId, institutionId, token, ...user }) => ({
                                ...user,
                                actions: {
                                    toUpdate: true,
                                    toGet: true,
                                    toDelete: true,
                                },
                            }))(requester),
                        ],
                        classrooms: [],
                    }))(storedInstitution),
                };
                const response = await request(app)
                    .get(`/api/institution/getInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
            });

            it('Should not get institution as an authenticated user with publisher role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get(`/api/institution/getInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should get institution as an authenticated user with publisher role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitution.id });
                const expectedResponse = {
                    message: 'Institution found.',
                    data: (({ addressId, ...institution }) => ({
                        ...institution,
                        address: institution.address
                            ? (({ createdAt, updatedAt, id, ...address }) => address)(institution.address)
                            : undefined,
                        actions: { toDelete: false, toUpdate: false, toGet: true },
                        users: [
                            (({ password, creatorId, hash, profileImageId, institutionId, token, ...user }) => ({
                                ...user,
                                actions: {
                                    toUpdate: true,
                                    toGet: true,
                                    toDelete: true,
                                },
                            }))(requester),
                        ],
                        classrooms: [],
                    }))(storedInstitution),
                };
                const response = await request(app)
                    .get(`/api/institution/getInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not get institution as an authenticated user with applier role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get(`/api/institution/getInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should get institution as an authenticated user with applier role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitution.id });
                const expectedResponse = {
                    message: 'Institution found.',
                    data: (({ addressId, ...institution }) => ({
                        ...institution,
                        address: institution.address
                            ? (({ createdAt, updatedAt, id, ...address }) => address)(institution.address)
                            : undefined,
                        actions: { toDelete: false, toUpdate: false, toGet: true },
                        users: [
                            (({ password, creatorId, hash, profileImageId, institutionId, token, ...user }) => ({
                                ...user,
                                actions: {
                                    toUpdate: true,
                                    toGet: true,
                                    toDelete: true,
                                },
                            }))(requester),
                        ],
                        classrooms: [],
                    }))(storedInstitution),
                };
                const response = await request(app)
                    .get(`/api/institution/getInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not get institution as an authenticated user with user role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get(`/api/institution/getInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get institution as an authenticated user with user role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER, institutionId: storedInstitution.id });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get(`/api/institution/getInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get institution as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .get(`/api/institution/getInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get institution as an unauthenticated user', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const response = await request(app).get(`/api/institution/getInstitution/${storedInstitution.id}`);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('DeleteInstitution endpoint', () => {
        describe('Delete institution', () => {
            it('Should delete institution as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = { message: 'Institution deleted.', data: { id: storedInstitution.id } };
                const response = await request(app)
                    .delete(`/api/institution/deleteInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not delete institution as an authenticated user with coordinator role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/institution/deleteInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete institution as an authenticated user with coordinator role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitution.id });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/institution/deleteInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete institution as an authenticated user with publisher role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/institution/deleteInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete institution as an authenticated user with publisher role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitution.id });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/institution/deleteInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete institution as an authenticated user with applier role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/institution/deleteInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete institution as an authenticated user with applier role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitution.id });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/institution/deleteInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete institution as an authenticated user with user role that does not belong to the institution', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/institution/deleteInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete institution as an authenticated user with user role that belongs to the institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER, institutionId: storedInstitution.id });
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/institution/deleteInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete institution as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const storedInstitution = (await createFakerInstitutions())[0];
                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .delete(`/api/institution/deleteInstitution/${storedInstitution.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete institution as an unauthenticated user', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const response = await request(app).delete(`/api/institution/deleteInstitution/${storedInstitution.id}`);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });
});

describe('ClassroomController tests', () => {
    describe('CreateClassroom endpoint', () => {
        describe('Create a classroom without institution and with users without institution', () => {
            it('Should create a classroom as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER }))[0];
                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should create a classroom as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER }))[0];

                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should create a classroom as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER }))[0];

                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should create a classroom as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER }))[0];

                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should not create a classroom as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id }))[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('users', [1, 2]);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create a classroom as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id }))[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('users', [1, 2]);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create a classroom as an unauthenticated user', async () => {
                await clearDatabase({ Classroom: true });
                const classroom = (await getFakerClassrooms())[0];
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .field('name', classroom.name)
                    .field('users', [1, 2]);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });

        describe('Create a classroom without institution and with users with institution', () => {
            it('Should create a classroom as an authenticated user with admin role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedInstitution = (await createFakerInstitutions())[0];
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should create a classroom as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedInstitution = (await createFakerInstitutions())[0];
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should create a classroom as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should create a classroom as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should not create a classroom as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id }))[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('users', [1, 2]);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create a classroom as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id }))[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('users', [1, 2]);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create a classroom as an unauthenticated user', async () => {
                await clearDatabase({ Classroom: true });
                const classroom = (await getFakerClassrooms())[0];
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .field('name', classroom.name)
                    .field('users', [1, 2]);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });

        describe('Create a classroom in own institution and with users without institution', () => {
            it('Should not create a classroom as an authenticated user with coordinator role (and presumably all other roles)', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitution.id });
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        institutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];

                const expectedResponse = {
                    message: 'An institution classroom can only contain users from the institution.',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Create a classroom in own institution and with users from the institution', () => {
            it('Should create a classroom as an authenticated user with coordinator role', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitution.id });
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        institutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should create a classroom as an authenticated user with publisher role', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitution.id });
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        institutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should create a classroom as an authenticated user with applier role', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitution.id });
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        institutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should not create a classroom as an authenticated user with user role', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER, institutionId: storedInstitution.id });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id, institutionId: storedInstitution.id }))[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field('users', [1, 2]);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Create a classroom in own institution and with users from other institution', () => {
            it('Should not create a classroom as an authenticated user with coordinator role (and presumably all other roles)', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitutions[0].id });
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        institutionId: storedInstitutions[0].id,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'An institution classroom can only contain users from the institution.',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Create a classroom in other institution and with users from the institution', () => {
            it('Should create a classroom as an authenticated user with admin role', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN, institutionId: storedInstitutions[0].id });
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        institutionId: storedInstitutions[1].id,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'Classroom created.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(classroom),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(classroom.users.length);
                expect(response.status).toBe(201);
            });

            it('Should not create a classroom as an authenticated user with coordinator role', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitutions[0].id });
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        institutionId: storedInstitutions[1].id,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create a classroom as an authenticated user with publisher role', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitutions[0].id });
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        institutionId: storedInstitutions[1].id,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create a classroom as an authenticated user with applier role', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitutions[0].id });
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        institutionId: storedInstitutions[1].id,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'This user is not authorized to perform this action',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create a classroom as an authenticated user with user role', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER, institutionId: storedInstitutions[0].id });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id, institutionId: storedInstitutions[1].id }))[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field('users', [1, 2]);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create a classroom as an authenticated user with guest role', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST, institutionId: storedInstitutions[0].id });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id, institutionId: storedInstitutions[1].id }))[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field('users', [1, 2]);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not create a classroom as an unauthenticated user', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const classroom = (await getFakerClassrooms({ institutionId: storedInstitutions[1].id }))[0];
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field('users', [1, 2]);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });

        describe('Create a classroom in other institution and with users from other institution', () => {
            it('Should not create a classroom as an authenticated user with admin role (and presumably all other roles)', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN, institutionId: storedInstitutions[0].id });
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        institutionId: storedInstitutions[1].id,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[0].id,
                    })
                )[0];

                const expectedResponse = {
                    message: 'An institution classroom can only contain users from the institution.',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Create a classroom in other institution and with users without institution', () => {
            it('Should not create a classroom as an authenticated user with admin role (and presumably all other roles)', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN, institutionId: storedInstitutions[0].id });
                const classroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        institutionId: storedInstitutions[1].id,
                        usersRole: UserRole.USER,
                    })
                )[0];

                const expectedResponse = {
                    message: 'An institution classroom can only contain users from the institution.',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('institutionId', classroom.institutionId as number)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Create a classroom with less than 2 users', () => {
            it('Should not create a classroom as an authenticated user with admin role (and presumably all other roles)', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id, usersCount: 1 }))[0];

                const expectedResponse = {
                    message: 'Users field must have at least 2 items',
                    details: expect.any(Object),
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field('users[0]', [classroom.users[0].id]);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Create a classroom with ADMIN members', () => {
            it('Should not create a classroom as an authenticated user with admin role (and presumably all other roles)', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.ADMIN }))[0];

                const expectedResponse = {
                    message: 'A classroom can not contain COORDINATOR, GUEST or ADMIN users.',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Create a classroom with GUEST members', () => {
            it('Should not create a classroom as an authenticated user with admin role (and presumably all other roles)', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const classroom = (await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.GUEST }))[0];

                const expectedResponse = {
                    message: 'A classroom can not contain COORDINATOR, GUEST or ADMIN users.',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Create a classroom with COORDINATOR members', () => {
            it('Should not create a classroom as an authenticated user with admin role (and presumably all other roles)', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const classroom = (
                    await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.COORDINATOR })
                )[0];

                const expectedResponse = {
                    message: 'A classroom can not contain COORDINATOR, GUEST or ADMIN users.',
                    details: {},
                };
                const response = await request(app)
                    .post('/api/classroom/createClassroom')
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', classroom.name)
                    .field(
                        'users',
                        classroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });
    });

    describe('UpdateClassroom endpoint', () => {
        describe('Update a classroom without institution and with users without institution', () => {
            it('Should update a classroom as an authenticated user with admin role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassroom = (await createFakerClassrooms({ usersCount: 2, usersRole: UserRole.USER }))[0];
                const updatedClassroom = (
                    await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: storedClassroom.creatorId, username: expect.any(String) },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should update a classroom as an authenticated user with admin role that is the creator of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassroom = (
                    await createFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should not update a classroom as an authenticated user with coordinator role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedClassroom = (await createFakerClassrooms({ usersCount: 2, usersRole: UserRole.USER }))[0];
                const updatedClassroom = (
                    await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should update a classroom as an authenticated user with coordinator role that is the creator of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedClassroom = (
                    await createFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should not update a classroom as an authenticated user with publisher role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassroom = (await createFakerClassrooms({ usersCount: 2, usersRole: UserRole.USER }))[0];
                const updatedClassroom = (
                    await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should update a classroom as an authenticated user with publisher role that is the creator of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassroom = (
                    await createFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should not update a classroom as an authenticated user with applier role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassroom = (await createFakerClassrooms({ usersCount: 2, usersRole: UserRole.USER }))[0];
                const updatedClassroom = (
                    await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should update a classroom as an authenticated user with applier role that is the creator of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassroom = (
                    await createFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should not update a classroom as an authenticated user with user role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedClassroom = (await createFakerClassrooms({ usersCount: 2, usersRole: UserRole.USER }))[0];
                const updatedClassroom = (
                    await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with guest role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const storedClassroom = (await createFakerClassrooms({ usersCount: 2, usersRole: UserRole.USER }))[0];
                const updatedClassroom = (
                    await getFakerClassrooms({ creatorId: requester.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an unauthenticated user', async () => {
                const storedClassroom = (await createFakerClassrooms({ usersCount: 2, usersRole: UserRole.USER }))[0];
                const updatedClassroom = (await getFakerClassrooms({ usersCount: 2, usersRole: UserRole.USER }))[0];
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });

        describe('Update a classroom without institution and with users with institution', () => {
            it('Should update a classroom as an authenticated user with admin role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({ usersInstitutionId: storedInstitution.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: storedClassroom.creatorId, username: expect.any(String) },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should update a classroom as an authenticated user with admin role that is the creator of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({
                        creatorId: requester.id,
                        usersInstitutionId: storedInstitution.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should not update a classroom as an authenticated user with coordinator role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({ usersInstitutionId: storedInstitution.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should update a classroom as an authenticated user with coordinator role that is the creator of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({
                        creatorId: requester.id,
                        usersInstitutionId: storedInstitution.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should not update a classroom as an authenticated user with publisher role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({ usersInstitutionId: storedInstitution.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should update a classroom as an authenticated user with publisher role that is the creator of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({
                        creatorId: requester.id,
                        usersInstitutionId: storedInstitution.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should not update a classroom as an authenticated user with publisher role that is a member of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({ usersInstitutionId: storedInstitution.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with applier role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({ usersInstitutionId: storedInstitution.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should update a classroom as an authenticated user with applier role that is the creator of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({
                        creatorId: requester.id,
                        usersInstitutionId: storedInstitution.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should not update a classroom as an authenticated user with applier role that is a member of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({ usersInstitutionId: storedInstitution.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with user role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({ usersInstitutionId: storedInstitution.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with user role that is a member of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({ usersInstitutionId: storedInstitution.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with guest role that has no association with the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({ usersInstitutionId: storedInstitution.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an unauthenticated user', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({ usersInstitutionId: storedInstitution.id, usersCount: 2, usersRole: UserRole.USER })
                )[0];
                const updatedClassroom = (await getFakerClassrooms({ usersCount: 2, usersRole: UserRole.USER }))[0];
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .field('name', updatedClassroom.name)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });

        describe('Update a classroom in own institution and with users from the institution', () => {
            it('Should update a classroom as an authenticated user with coordinator role that is the creator of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should update a classroom as an authenticated user with coordinator role that is a coordinator in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: storedClassroom.creatorId, username: expect.any(String) },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should update a classroom as an authenticated user with publisher role that is the creator of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should update a classroom as an authenticated user with publisher role that is a member in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitution.id,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: false, toUpdate: true, toGet: true },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not update a classroom as an authenticated user with publisher role that is a member of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersInstitutionId: storedInstitution.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should update a classroom as an authenticated user with applier role that is the creator of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: requester.id, username: requester.username },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should update a classroom as an authenticated user with applier role that is a member in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersInstitutionId: storedInstitution.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: false, toUpdate: true, toGet: true },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not update a classroom as an authenticated user with applier role that is a member of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersInstitutionId: storedInstitution.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with user role that is a member in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersInstitutionId: storedInstitution.id,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with user role that is a member of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({
                    role: UserRole.USER,
                    institutionId: storedInstitution.id,
                });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersInstitutionId: storedInstitution.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with guest role that is a member in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersInstitutionId: storedInstitution.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with guest role that is a member of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersInstitutionId: storedInstitution.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an unauthenticated user', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersInstitutionId: storedInstitution.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({ usersCount: 2, usersInstitutionId: storedInstitution.id, usersRole: UserRole.USER })
                )[0];
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });

        describe('Update a classroom in own institution and with users without institution', () => {
            it('Should not update a classroom as an authenticated user with coordinator role that is the coordinator of the classrooms institution (and presumably all other roles)', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'An institution classroom can only contain users from the institution.', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Update a classroom in own institution and with users from other institution', () => {
            it('Should not update a classroom as an authenticated user with coordinator role that is the coordinator of the classrooms institution (and presumably all other roles)', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitutions[0].id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[0].id,
                        usersInstitutionId: storedInstitutions[0].id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                    })
                )[0];
                const expectedResponse = { message: 'An institution classroom can only contain users from the institution.', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', updatedClassroom.institutionId as number)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Update a classroom in other institution and with users from the institution', () => {
            it('Should update a classroom as an authenticated user with admin role that has no association with the classroom', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN, institutionId: storedInstitutions[0].id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[1].id,
                        institutionId: storedInstitutions[1].id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom updated.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: storedClassroom.creatorId, username: expect.any(String) },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, password, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(updatedClassroom),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitutions[1].id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data.users).toHaveLength(updatedClassroom.users.length);
                expect(response.status).toBe(200);
            });

            it('Should not update a classroom as an authenticated user with coordinator role that has no association with the classroom', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitutions[0].id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[1].id,
                        institutionId: storedInstitutions[1].id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', updatedClassroom.institutionId as number)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with publisher role that has no association with the classroom', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitutions[0].id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[1].id,
                        institutionId: storedInstitutions[1].id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', updatedClassroom.institutionId as number)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with applier role that has no association with the classroom', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitutions[0].id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[1].id,
                        institutionId: storedInstitutions[1].id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', updatedClassroom.institutionId as number)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with user role that has no association with the classroom', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER, institutionId: storedInstitutions[0].id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[1].id,
                        institutionId: storedInstitutions[1].id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', updatedClassroom.institutionId as number)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an authenticated user with guest role that has no association with the classroom', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST, institutionId: storedInstitutions[0].id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        usersInstitutionId: storedInstitutions[1].id,
                        institutionId: storedInstitutions[1].id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', updatedClassroom.institutionId as number)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not update a classroom as an unauthenticated user', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        usersCount: 2,
                        usersInstitutionId: storedInstitutions[1].id,
                        institutionId: storedInstitutions[1].id,
                        usersRole: UserRole.USER,
                    })
                )[0];
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitutions[1].id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });

        describe('Update a classrom in other institution and with user without institution', () => {
            it('Should not update a classroom as an authenticated user with admin role that has no association with the classroom (and presumably all other roles)', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN, institutionId: storedInstitutions[0].id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                    })
                )[0];
                const expectedResponse = { message: 'An institution classroom can only contain users from the institution.', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', updatedClassroom.institutionId as number)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Update a classroom in other institution and with users from other institution', () => {
            it('Should not update a classroom as an authenticated user with admin role that has no association with the classroom (and presumably all other roles)', async () => {
                const storedInstitutions = await createFakerInstitutions({ count: 2 });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN, institutionId: storedInstitutions[0].id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                        usersInstitutionId: storedInstitutions[1].id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitutions[1].id,
                        usersInstitutionId: storedInstitutions[0].id,
                    })
                )[0];
                const expectedResponse = { message: 'An institution classroom can only contain users from the institution.', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', updatedClassroom.institutionId as number)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Update a classroom with less than 2 users', () => {
            it('Should not update a classroom as an authenticated user with admin role that is the creator of the classroom (and presumably all other roles)', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 1,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Users field must have at least 2 items',
                    details: expect.any(Object),
                };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field('users[0]', updatedClassroom.users[0].id);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Update a classroom with GUEST members', () => {
            it('Should not update a classroom as an authenticated user with admin role that is the creator of the classroom (and presumably all other roles)', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.GUEST,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'A classroom can not contain COORDINATOR, GUEST or ADMIN users.', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Update a classroom with ADMIN members', () => {
            it('Should not update a classroom as an authenticated user with admin role that is the creator of the classroom (and presumably all other roles)', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.ADMIN,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'A classroom can not contain COORDINATOR, GUEST or ADMIN users.', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });

        describe('Update a classroom with COORDINATOR members', () => {
            it('Should not update a classroom as an authenticated user with admin role that is the creator of the classroom (and presumably all other roles)', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersCount: 2,
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        usersInstitutionId: storedInstitution.id,
                    })
                )[0];
                const updatedClassroom = (
                    await getFakerClassrooms({
                        creatorId: requester.id,
                        usersCount: 2,
                        usersRole: UserRole.COORDINATOR,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'A classroom can not contain COORDINATOR, GUEST or ADMIN users.', details: {} };
                const response = await request(app)
                    .put(`/api/classroom/updateClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('name', updatedClassroom.name)
                    .field('institutionId', storedInstitution.id)
                    .field(
                        'users',
                        updatedClassroom.users.map(({ id }) => id)
                    );
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });
        });
    });

    describe('GetAllClassrooms endpoint', () => {
        describe('Get all classrooms', () => {
            it('Should get all classrooms as an authenticated user with admin role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                });
                const expectedResponse = {
                    message: 'All classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms.map(({ creatorId, institutionId, ...classroom }) => ({
                            ...classroom,
                            id: expect.any(Number),
                            actions: { toDelete: true, toUpdate: true, toGet: true },
                            creator: { id: creatorId, username: expect.any(String) },
                            users: expect.arrayContaining(
                                classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                    ...user,
                                    actions: { toDelete: true, toUpdate: true, toGet: true },
                                    profileImage: null,
                                }))
                            ),
                            createdAt: expect.any(String),
                            updatedAt: expect.any(String),
                        }))
                    ),
                };
                const response = await request(app)
                    .get('/api/classroom/getAllClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(storedClassrooms.length);
                expect(response.status).toBe(200);
            });

            it('Should not get all classrooms as an authenticated user with coordinator role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get('/api/classroom/getAllClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all classrooms as an authenticated user with publisher role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get('/api/classroom/getAllClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all classrooms as an authenticated user with applier role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get('/api/classroom/getAllClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all classrooms as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get('/api/classroom/getAllClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all classrooms as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get('/api/classroom/getAllClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get all classrooms as an unauthenticated user', async () => {
                const response = await request(app).get('/api/classroom/getAllClassrooms');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('GetMyClassrooms endpoint', () => {
        describe('Get my classrooms', () => {
            it('Should get my classrooms as an authenticated user with admin role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassrooms[0].id } } },
                });
                const expectedResponse = {
                    message: 'My classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ id }) => id === storedClassrooms[0].id)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app).get('/api/classroom/getMyClassrooms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should get my classrooms as an authenticated user with coordinator role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassrooms[0].id } } },
                });
                const expectedResponse = {
                    message: 'My classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ id }) => id === storedClassrooms[0].id)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app).get('/api/classroom/getMyClassrooms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should get my classrooms as an authenticated user with publisher role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassrooms[0].id } } },
                });
                const expectedResponse = {
                    message: 'My classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ id }) => id === storedClassrooms[0].id)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app).get('/api/classroom/getMyClassrooms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should get my classrooms as an authenticated user with applier role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassrooms[0].id } } },
                });
                const expectedResponse = {
                    message: 'My classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ id }) => id === storedClassrooms[0].id)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app).get('/api/classroom/getMyClassrooms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should get my classrooms as an authenticated user with user role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassrooms[0].id } } },
                });
                const expectedResponse = {
                    message: 'My classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ id }) => id === storedClassrooms[0].id)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app).get('/api/classroom/getMyClassrooms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should not get my classrooms as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app).get('/api/classroom/getMyClassrooms').set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get my classrooms as an unauthenticated user', async () => {
                const response = await request(app).get('/api/classroom/getMyClassrooms');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('GetManagedClassrooms endpoint', () => {
        describe('Get managed classrooms', () => {
            it('Should get managed classrooms as an authenticated user with admin role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                const expectedResponse = {
                    message: 'My managed classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ id }) => id === storedClassrooms[0].id)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app)
                    .get('/api/classroom/getManagedClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(storedClassrooms.length);
                expect(response.status).toBe(200);
            });

            it('Should get managed classrooms as an authenticated user with coordinator role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                const expectedResponse = {
                    message: 'My managed classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ id }) => id === storedClassrooms[0].id)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app)
                    .get('/api/classroom/getManagedClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(storedClassrooms.length);
                expect(response.status).toBe(200);
            });

            it('Should get managed classrooms as an authenticated user with publisher role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                const expectedResponse = {
                    message: 'My managed classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ id }) => id === storedClassrooms[0].id)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app)
                    .get('/api/classroom/getManagedClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(storedClassrooms.length);
                expect(response.status).toBe(200);
            });

            it('Should get managed classrooms as an authenticated user with applier role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                const expectedResponse = {
                    message: 'My managed classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ id }) => id === storedClassrooms[0].id)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app)
                    .get('/api/classroom/getManagedClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(storedClassrooms.length);
                expect(response.status).toBe(200);
            });

            it('Should not get managed classrooms as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get('/api/classroom/getManagedClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get managed classrooms as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get('/api/classroom/getManagedClassrooms')
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get managed classrooms as an unauthenticated user', async () => {
                const response = await request(app).get('/api/classroom/getManagedClassrooms');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('SearchClassroomByName endpoint', () => {
        describe('Search classrooms by name', () => {
            it('Should search classrooms by name as an authenticated user with admin role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                const expectedResponse = {
                    message: 'Searched classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ name }) => name === storedClassrooms[0].name)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app)
                    .post(`/api/classroom/searchClassroomByName`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('term', storedClassrooms[0].name);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should search classrooms by name as an authenticated user with coordinator role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                const expectedResponse = {
                    message: 'Searched classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ name }) => name === storedClassrooms[0].name)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app)
                    .post(`/api/classroom/searchClassroomByName`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('term', storedClassrooms[0].name);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should search classrooms by name as an authenticated user with publisher role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                const expectedResponse = {
                    message: 'Searched classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ name }) => name === storedClassrooms[0].name)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app)
                    .post(`/api/classroom/searchClassroomByName`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('term', storedClassrooms[0].name);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should search classrooms by name as an authenticated user with applier role', async () => {
                await clearDatabase({ Classroom: true });
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassrooms = await createFakerClassrooms({
                    count: 2,
                    usersCount: 2,
                    usersRole: UserRole.USER,
                    creatorId: requester.id,
                });
                const expectedResponse = {
                    message: 'Searched classrooms found.',
                    data: expect.arrayContaining(
                        storedClassrooms
                            .filter(({ name }) => name === storedClassrooms[0].name)
                            .map(({ creatorId, institutionId, ...classroom }) => ({
                                ...classroom,
                                id: expect.any(Number),
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                creator: { id: creatorId, username: expect.any(String) },
                                users: expect.arrayContaining(
                                    classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                        ...user,
                                        actions: { toDelete: true, toUpdate: true, toGet: true },
                                        profileImage: null,
                                    }))
                                ),
                                createdAt: expect.any(String),
                                updatedAt: expect.any(String),
                            }))
                    ),
                };
                const response = await request(app)
                    .post(`/api/classroom/searchClassroomByName`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('term', storedClassrooms[0].name);
                expect(response.body).toEqual(expectedResponse);
                expect(response.body.data).toHaveLength(1);
                expect(response.status).toBe(200);
            });

            it('Should not search classrooms by name as an authenticated user with user role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .post(`/api/classroom/searchClassroomByName`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('term', 'test');
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not search classrooms by name as an authenticated user with guest role', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .post(`/api/classroom/searchClassroomByName`)
                    .set('Authorization', `Bearer ${requester.token}`)
                    .field('term', 'test');
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not search classrooms by name as an unauthenticated user', async () => {
                const response = await request(app).post('/api/classroom/searchClassroomByName').field('term', 'test');
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('GetClassroom endpoint', () => {
        describe('Get classroom', () => {
            it('Should get classroom as an authenticated user with admin role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: creatorId, username: expect.any(String) },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get classroom as an authenticated user with admin role that is the creator of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        creatorId: requester.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: creatorId, username: expect.any(String) },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get classroom as an authenticated user with admin role that is a viewer of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: creatorId, username: expect.any(String) },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not get classroom as an authenticated user with coordinator role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should get classroom as an authenticated user with coordinator role that is the creator of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        creatorId: requester.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: creatorId, username: expect.any(String) },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get classroom as an authenticated user with coordinator role that is a viewer of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: false, toUpdate: false, toGet: true },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: false, toUpdate: false, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get classroom as an authenticated user with coordinator role that is a coordinator in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: creatorId, username: expect.any(String) },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not get classroom as an authenticated user with publisher role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should get classroom as an authenticated user with publisher role that is the creator of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        creatorId: requester.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: creatorId, username: expect.any(String) },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get classroom as an authenticated user with publisher role that is a viewer of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: false, toUpdate: false, toGet: true },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: false, toUpdate: false, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get classroom as an authenticated user with publisher role that is a member in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitution.id });
                const storedClassroom = (await createFakerClassrooms({ usersRole: UserRole.USER, institutionId: storedInstitution.id }))[0];
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: false, toUpdate: true, toGet: true },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: false, toUpdate: false, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get classroom as an authenticated user with publisher role that is a member of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: false, toUpdate: false, toGet: true },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: false, toUpdate: false, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not get classroom as an authenticated user with applier role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should get classroom as an authenticated user with applier role that is the creator of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        creatorId: requester.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: true, toUpdate: true, toGet: true },
                        creator: { id: creatorId, username: expect.any(String) },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: true, toUpdate: true, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get classroom as an authenticated user with applier role that is a viewer of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: false, toUpdate: false, toGet: true },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: false, toUpdate: false, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get classroom as an authenticated user with applier role that is a member in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: false, toUpdate: true, toGet: true },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: false, toUpdate: false, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should get classroom as an authenticated user with applier role that is a member of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const expectedResponse = {
                    message: 'Classroom found.',
                    data: (({ creatorId, institutionId, ...classroom }) => ({
                        ...classroom,
                        id: expect.any(Number),
                        actions: { toDelete: false, toUpdate: false, toGet: true },
                        users: expect.arrayContaining(
                            classroom.users.map(({ hash, creatorId, profileImageId, institutionId, ...user }) => ({
                                ...user,
                                actions: { toDelete: false, toUpdate: false, toGet: true },
                                profileImage: null,
                            }))
                        ),
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String),
                    }))(storedClassroom),
                };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not get classroom as an authenticated user with user role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get classroom as an authenticated user with user role that is a member in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get classroom as an authenticated user with user role that is a member of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get classroom as an authenticated user with guest role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .get(`/api/classroom/getClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not get classroom as an unauthenticated user', async () => {
                const storedClassroom = (await createFakerClassrooms({ usersRole: UserRole.USER }))[0];
                const response = await request(app).get(`/api/classroom/getClassroom/${storedClassroom.id}`);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });

    describe('DeleteClassroom endpoint', () => {
        describe('Delete classroom', () => {
            it('Should delete classroom as an authenticated user with admin role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'Classroom deleted.', data: { id: expect.any(Number) } };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should delete classroom as an authenticated user with admin role that is the creator of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        creatorId: requester.id,
                    })
                )[0];
                const expectedResponse = { message: 'Classroom deleted.', data: { id: expect.any(Number) } };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should delete classroom as an authenticated user with admin role that is a viewer of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.ADMIN });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = { message: 'Classroom deleted.', data: { id: expect.any(Number) } };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not delete classroom as an authenticated user with coordinator role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should delete classroom as an authenticated user with coordinator role that is the creator of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        creatorId: requester.id,
                    })
                )[0];
                const expectedResponse = { message: 'Classroom deleted.', data: { id: expect.any(Number) } };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should delete classroom as an authenticated user with coordinator role that is a coordinator in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'Classroom deleted.', data: { id: expect.any(Number) } };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not delete classroom as an authenticated user with coordinator role that is a viewer of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.COORDINATOR });
                const storedClassroom = (await createFakerClassrooms({ usersRole: UserRole.USER }))[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete classroom as an authenticated user with publisher role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should delete classroom as an authenticated user with publisher role that is the creator of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        creatorId: requester.id,
                    })
                )[0];
                const expectedResponse = { message: 'Classroom deleted.', data: { id: expect.any(Number) } };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not delete classroom as an authenticated user with publisher role that is member in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete classroom as an authenticated user with publisher role that is a member of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete classroom as an authenticated user with publisher role that is a viewer of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.PUBLISHER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete classroom as an authenticated user with applier role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should delete classroom as an authenticated user with applier role that is the creator of the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                        creatorId: requester.id,
                    })
                )[0];
                const expectedResponse = { message: 'Classroom deleted.', data: { id: expect.any(Number) } };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(200);
            });

            it('Should not delete classroom as an authenticated user with applier role that is member in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete classroom as an authenticated user with applier role that is a member of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                await prismaClient.user.update({
                    where: { id: requester.id },
                    data: { classrooms: { connect: { id: storedClassroom.id } } },
                });
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete classroom as an authenticated user with applier role that is a viewer of the classroom', async () => {
                const requester = await getAuthenticatedNewUser({ role: UserRole.APPLIER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete classroom as an authenticated user with user role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete classroom as an authenticated user with user role that is a member in the classrooms institution', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.USER, institutionId: storedInstitution.id });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete classroom as an authenticated user with guest role that has no association with the classroom', async () => {
                const storedInstitution = (await createFakerInstitutions())[0];
                const requester = await getAuthenticatedNewUser({ role: UserRole.GUEST });
                const storedClassroom = (
                    await createFakerClassrooms({
                        usersRole: UserRole.USER,
                        institutionId: storedInstitution.id,
                    })
                )[0];
                const expectedResponse = { message: 'This user is not authorized to perform this action', details: {} };
                const response = await request(app)
                    .delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`)
                    .set('Authorization', `Bearer ${requester.token}`);
                expect(response.body).toEqual(expectedResponse);
                expect(response.status).toBe(400);
            });

            it('Should not delete classroom as an unauthenticated user', async () => {
                const storedClassroom = (await createFakerClassrooms({ usersRole: UserRole.USER }))[0];
                const response = await request(app).delete(`/api/classroom/deleteClassroom/${storedClassroom.id}`);
                expect(response.body).toEqual({});
                expect(response.status).toBe(401);
            });
        });
    });
});

afterAll(async () => {
    await prismaClient.$disconnect();
});
