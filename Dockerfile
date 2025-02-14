# Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
# Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
# This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
# General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
# PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
# of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>

FROM node:22.14.0-alpine

WORKDIR /back/

COPY prisma/ ./prisma/
COPY src/ /back/src
COPY uploads/ /back/uploads
COPY package.json /back/
COPY .env /back/

# Adicionar dependências para OpenSSL
RUN apk add --no-cache openssl3 libssl3
# RUN npm install
# Run Prisma commands
# RUN npx prisma generate
# RUN npx prisma migrate dev
# RUN npx prisma db seed

# CMD ["npm", "start"]