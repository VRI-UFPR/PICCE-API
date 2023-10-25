import request from 'supertest';
import express from 'express';
import routes from '../src/routes';
import prismaClient from '../src/services/prismaClient';
import { addresses, dbDefaults } from './constants';

const app = express();
app.use('/api', routes);

beforeAll(async () => {
    await prismaClient.address.deleteMany();
});

describe('Address tests', () => {
    for (const address of addresses) {
        it('Should create an Address', async () => {
            const expectedResponse = {
                message: 'Address created.',
                data: {
                    ...dbDefaults,
                    ...address.original,
                },
            };

            const response = await request(app)
                .post('/api/address/createAddress')
                .field('id', address.original.id)
                .field('city', address.original.city)
                .field('state', address.original.state)
                .field('country', address.original.country);

            expect(response.status).toBe(201);
            expect(response.body).toEqual(expectedResponse);
        });

        it('Should update an Address', async () => {
            const expectedResponse = {
                message: 'Address updated.',
                data: {
                    id: address.original.id,
                    ...dbDefaults,
                    ...address.updated,
                },
            };

            const response = await request(app)
                .put(`/api/address/updateAddress/${address.original.id}`)
                .field('city', address.updated.city)
                .field('state', address.updated.state)
                .field('country', address.updated.country);

            expect(response.status).toBe(200);
            expect(response.body).toEqual(expectedResponse);
        });

        it('Should get all Addresses', async () => {
            const expectedResponse = {
                message: 'All addresses found.',
                data: [
                    {
                        id: address.original.id,
                        ...address.updated,
                        ...dbDefaults,
                    },
                ],
            };

            const response = await request(app).get('/api/address/getAllAddresss');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(expectedResponse);
        });

        it('Should get an Address by id', async () => {
            const expectedResponse = {
                message: 'Address found.',
                data: {
                    id: address.original.id,
                    ...dbDefaults,
                    ...address.updated,
                },
            };

            const response = await request(app).get(`/api/address/getAddress/${address.original.id}`);

            expect(response.status).toBe(200);
            expect(response.body).toEqual(expectedResponse);
        });

        it('Should delete an Address', async () => {
            const expectedResponse = {
                message: 'Address deleted.',
                data: {
                    id: address.original.id,
                    ...dbDefaults,
                    ...address.updated,
                },
            };

            const response = await request(app).delete(`/api/address/deleteAddress/${address.original.id}`);

            expect(response.status).toBe(200);
            expect(response.body).toEqual(expectedResponse);
        });
    }
});

prismaClient.$disconnect();
