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