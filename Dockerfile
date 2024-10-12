# Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
# Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
# This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
# General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
# PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
# of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>

FROM node:20-alpine

WORKDIR /back/

COPY prisma/ /back/prisma
COPY src/ /back/src
COPY package.json /back/
COPY .env /back/

# RUN npm install
# Run Prisma commands
# RUN npx prisma generate
# RUN npx prisma db push
# RUN npx prisma db seed

# CMD ["npm", "start"]