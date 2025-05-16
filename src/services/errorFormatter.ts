/*
Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>
*/

import { EventType } from '@prisma/client';

export const errorFormatter = (error: any) => {
    const message = error.message.split('\n');
    return {
        message: message[message.length - 1].charAt(0).toUpperCase() + message[message.length - 1].slice(1),
        details: error,
    };
};

export const errorFormatterMiddleware = (error: any, req: any, res: any, next: any) => {
    const formattedError = errorFormatter(error);
    res.locals = {
        ...res.locals,
        type: EventType.ERROR,
        metadata: {
            request: {
                method: req.method,
                path: req.originalUrl,
                body: req.body,
                userAgent: req.headers['user-agent'],
            },
            status: res.statusCode,
        },
        message: formattedError.message,
    };
    res.status(error.status || 500).json(formattedError);
};

export default errorFormatter;
