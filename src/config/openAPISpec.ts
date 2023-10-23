import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.1',
        info: {
            title: 'PICCE API',
            version: '1.0.0',
        },
    },
    apis: ['./src/routes/*.ts'],
};

const openAPISpec = swaggerJsdoc(options);
export default openAPISpec;
