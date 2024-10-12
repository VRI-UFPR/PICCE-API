/*
Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>
*/

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
