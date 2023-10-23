import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes';
import path from 'path';
import swaggerDocs from './config/openAPISpec';
import swaggerUi from 'swagger-ui-express';

// Express configuration
const app = express();
app.use(express.json());
app.use(bodyParser.json());

// Swagger UI route
app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocs, {
        explorer: true,
    })
);

// API routes
app.use('/api', routes);
app.use('/uploads', express.static(path.basename('uploads')));

// Server starting point
const server = app.listen(3000);
console.log('Server running on port 3000');
