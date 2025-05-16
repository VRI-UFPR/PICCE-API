/*
Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>
*/

import prismaClient from '../../src/services/prismaClient';

export const eventLogger = (req: any, res: any, next: any) => {
    res.on('finish', async () => {
        const { action, userId, message, metadata, type, resource } = res.locals;

        // Check if the required fields are present
        if (action && type) {
            const eventLog = await prismaClient.eventLog.create({
                data: { type, action, userId, message, metadata, resource },
            });

            console.log('Event logged:', eventLog);
        }
    });

    next();
};
