/*
Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>
*/

import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes';
import path from 'path';
import swaggerDocs from './config/openAPISpec';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';
import { errorFormatterMiddleware } from './services/errorFormatter';

// Express configuration
const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

// Swagger UI route
app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocs, {
        swaggerOptions: {
            supportedSubmitMethods: ['get'],
        },
    })
);

// API routes
app.use('/api', routes, errorFormatterMiddleware);
app.use('/uploads', express.static(path.basename('uploads')));

// Server starting point
const server = app.listen(3000);
console.log('Server running on port 3000 (CORS enabled)');
