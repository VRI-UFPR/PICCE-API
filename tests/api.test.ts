import request from 'supertest';
import express from 'express';
import routes from '../src/routes';
import prismaClient from '../src/services/prismaClient';
import { addresses, applicationAnswers } from './constants';
import { serialize } from 'object-to-formdata';
import e from 'express';

const app = express();
app.use('/api', routes);
const authorization = { id: 0, token: '' };

describe('Auth tests', () => {
    it('Should sign in a user', async () => {
        const expectedResponse = {
            message: 'User signed in.',
            data: {
                id: expect.any(Number),
                token: expect.any(String),
            },
        };

        const response = await request(app).post('/api/auth/signIn').field('username', 'johndoe').field('hash', '123456');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject(expectedResponse);

        authorization.id = response.body.data.id as number;
        authorization.token = response.body.data.token as string;
    });
});

describe('ApplicationAnswer tests', () => {
    beforeAll(async () => {
        await prismaClient.applicationAnswer.deleteMany();
    });

    for (const applicationAnswer of applicationAnswers) {
        it('Should create an ApplicationAnswer', async () => {
            const expectedResponse = {
                message: 'Application answer created.',
                data: {
                    ...applicationAnswer.original,
                    itemAnswerGroups: expect.any(Array),
                },
            };

            const req = request(app)
                .post('/api/applicationAnswer/createApplicationAnswer')
                .set('Authorization', `Bearer ${authorization.token}`);

            for (const [name, value] of serialize(applicationAnswer.original, { indices: true })) {
                req.field(name, value.toString());
            }

            const response = await req;

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject(expectedResponse);
        });

        it('Should update an ApplicationAnswer', async () => {
            const expectedResponse = {
                message: 'Application answer updated.',
                data: {
                    ...applicationAnswer.original,
                    ...applicationAnswer.updated,
                    itemAnswerGroups: expect.any(Array),
                },
            };

            const req = request(app)
                .put(`/api/applicationAnswer/updateApplicationAnswer/${applicationAnswer.original.id}`)
                .set('Authorization', `Bearer ${authorization.token}`);

            for (const [name, value] of serialize(applicationAnswer.updated, { indices: true })) {
                req.field(name, value.toString());
            }

            const response = await req;

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject(expectedResponse);
        });

        it('Should get all ApplicationAnswers', async () => {
            const expectedResponse = {
                message: 'All application answers found.',
                data: [
                    {
                        ...applicationAnswer.original,
                        ...applicationAnswer.updated,
                        itemAnswerGroups: expect.any(Array),
                    },
                ],
            };

            const response = await request(app)
                .get('/api/applicationAnswer/getAllApplicationAnswers')
                .set('Authorization', `Bearer ${authorization.token}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject(expectedResponse);
        });

        it('Should get an ApplicationAnswer by id', async () => {
            const expectedResponse = {
                message: 'Application answer found.',
                data: {
                    ...applicationAnswer.original,
                    ...applicationAnswer.updated,
                },
            };

            const response = await request(app)
                .get(`/api/applicationAnswer/getApplicationAnswer/${applicationAnswer.original.id}`)
                .set('Authorization', `Bearer ${authorization.token}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject(expectedResponse);
        });

        it('Should delete an ApplicationAnswer', async () => {
            const expectedResponse = {
                message: 'Application answer deleted.',
                data: {
                    ...applicationAnswer.original,
                    ...applicationAnswer.updated,
                    createdAt: expect.any(String),
                    updateAt: expect.any(String),
                    userId: expect.any(Number),
                    itemAnswerGroups: undefined,
                },
            };

            const response = await request(app)
                .delete(`/api/applicationAnswer/deleteApplicationAnswer/${applicationAnswer.original.id}`)
                .set('Authorization', `Bearer ${authorization.token}`);

            expect(response.status).toBe(200);
            expect(response.body).toEqual(expectedResponse);
        });
    }
});

describe('Address tests', () => {
    beforeAll(async () => {
        await prismaClient.address.deleteMany();
    });

    for (const address of addresses) {
        it('Should create an Address', async () => {
            const expectedResponse = {
                message: 'Address created.',
                data: {
                    ...address.original,
                },
            };

            const req = request(app).post('/api/address/createAddress');

            for (const [name, value] of serialize(address.original, { indices: true })) {
                req.field(name, value.toString());
            }

            const response = await req;

            expect(response.status).toBe(201);
            expect(response.body).toMatchObject(expectedResponse);
        });

        it('Should update an Address', async () => {
            const expectedResponse = {
                message: 'Address updated.',
                data: {
                    id: address.original.id,
                    ...address.updated,
                },
            };

            const req = request(app).put(`/api/address/updateAddress/${address.original.id}`);

            for (const [name, value] of serialize(address.updated, { indices: true })) {
                req.field(name, value.toString());
            }

            const response = await req;

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject(expectedResponse);
        });

        it('Should get all Addresses', async () => {
            const expectedResponse = {
                message: 'All addresses found.',
                data: [
                    {
                        id: address.original.id,
                        ...address.updated,
                    },
                ],
            };

            const response = await request(app).get('/api/address/getAllAddresses');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject(expectedResponse);
        });

        it('Should get an Address by id', async () => {
            const expectedResponse = {
                message: 'Address found.',
                data: {
                    id: address.original.id,
                    ...address.updated,
                    institutions: expect.any(Array),
                },
            };

            const response = await request(app).get(`/api/address/getAddress/${address.original.id}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject(expectedResponse);
        });

        it('Should delete an Address', async () => {
            const expectedResponse = {
                message: 'Address deleted.',
                data: {
                    id: address.original.id,
                    ...address.updated,
                },
            };

            const response = await request(app).delete(`/api/address/deleteAddress/${address.original.id}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject(expectedResponse);
        });
    }
});

afterAll(async () => {
    await prismaClient.$disconnect();
});
