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
import uploader from '../services/multerUploader';
import {
    createInstitution,
    updateInstitution,
    getAllInstitutions,
    getInstitution,
    deleteInstitution,
    getVisibleInstitutions,
} from '../controllers/institutionController';
import passport from '../services/passportAuth';

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     CreateInstitution:
 *      type: object
 *      required:
 *        - name
 *        - type
 *        - addressId
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier of the institution (auto-generated by default)
 *          example: 1
 *        name:
 *          type: string
 *          description: The name of the institution
 *          example: "New York University"
 *        type:
 *          type: string
 *          enum: [PRIMARY, LOWER_SECONDARY, UPPER_SECONDARY, TERTIARY]
 *          description: The type of the institution
 *          example: "TERTIARY"
 *        addressId:
 *          type: integer
 *          description: The id of the address of the institution
 *          example: 1
 *     UpdateInstitution:
 *      type: object
 *      properties:
 *        name:
 *          type: string
 *          description: The name of the institution
 *          example: "New York University"
 *        type:
 *          type: string
 *          enum: [PRIMARY, LOWER_SECONDARY, UPPER_SECONDARY, TERTIARY]
 *          description: The type of the institution
 *          example: "TERTIARY"
 *        addressId:
 *          type: integer
 *          description: The id of the address of the institution
 *          example: 1
 *     GetInstitution:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier of the institution
 *          example: 1
 *        name:
 *          type: string
 *          description: The name of the institution
 *          example: "New York University"
 *        type:
 *          type: string
 *          enum: [PRIMARY, LOWER_SECONDARY, UPPER_SECONDARY, TERTIARY]
 *          description: The type of the institution
 *          example: "TERTIARY"
 *        address:
 *          type: object
 *          properties:
 *            id:
 *              type: integer
 *              description: Unique identifier of the address
 *              example: 1
 *            city:
 *              type: string
 *              description: The city of the address
 *              example: "New York"
 *            state:
 *              type: string
 *              description: The state of the address
 *              example: "New York"
 *            country:
 *              type: string
 *              description: The country of the address
 *              example: "United States"
 *        classrooms:
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              id:
 *                type: integer
 *                description: Unique identifier of the classroom
 *                example: 1
 *              users:
 *                type: array
 *                items:
 *                  type: object
 *                  properties:
 *                    id:
 *                      type: integer
 *                      description: Unique identifier of the user
 *                      example: 1
 *                    name:
 *                      type: string
 *                      description: The name of the user
 *                      example: "John Doe"
 *                    username:
 *                      type: string
 *                      description: The username of the user
 *                      example: "johndoe"
 *                    role:
 *                      type: string
 *                      enum: [USER, APPLIER, PUBLISHER, COORDINATOR, ADMIN]
 *                      description: The role of the user in the system environment
 *                      example: "USER"
 *        users:
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              id:
 *                type: integer
 *                description: Unique identifier of the user
 *                example: 1
 *              name:
 *                type: string
 *                description: The name of the user
 *                example: "John Doe"
 *              username:
 *                type: string
 *                description: The username of the user
 *                example: "johndoe"
 *              role:
 *                type: string
 *                enum: [USER, APPLIER, PUBLISHER, COORDINATOR, ADMIN]
 *                description: The role of the user in the system environment
 *                example: "USER"
 *        createdAt:
 *          type: string
 *          format: date-time
 *          description: The date and time the institution was created
 *          example: "2021-06-01T00:00:00Z"
 *        updatedAt:
 *          type: string
 *          format: date-time
 *          description: The date and time the institution was updated
 *          example: "2021-06-01T00:00:00Z"
 */

const router = express.Router();

/**
 * @swagger
 * /api/institution/createInstitution:
 *   post:
 *     summary: Create a new institution
 *     tags: [Institution]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CreateInstitution'
 *     responses:
 *       201:
 *         description: The institution was successfully created
 *         content:
 *           application/json:
 *             message: Institution created.
 *             data:
 *               $ref: '#/components/schemas/GetInstitution'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad request.
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.post('/createInstitution', passport.authenticate('jwt', { session: false }), uploader.none(), createInstitution);

/**
 * @swagger
 * /api/institution/updateInstitution/{institutionId}:
 *   put:
 *     summary: Update an existing institution
 *     tags: [Institution]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         schema:
 *           type: integer
 *           required: true
 *           description: The institution id
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateInstitution'
 *     responses:
 *       200:
 *         description: The institution was successfully updated
 *         content:
 *           application/json:
 *             message: Institution updated.
 *             data:
 *               $ref: '#/components/schemas/GetInstitution'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad request.
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.put('/updateInstitution/:institutionId', passport.authenticate('jwt', { session: false }), uploader.none(), updateInstitution);

/**
 * @swagger
 * /api/institution/getAllInstitutions:
 *   get:
 *     summary: Get all institutions
 *     tags: [Institution]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of all institutions
 *         content:
 *           application/json:
 *             message: All institutions found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GetInstitution'
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.get('/getAllInstitutions', passport.authenticate('jwt', { session: false }), uploader.none(), getAllInstitutions);

/**
 * @swagger
 * /api/institution/getVisibleInstitutions:
 *   get:
 *     summary: Get all institutions of the current user
 *     tags: [Institution]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of all institutions of the current user
 *         content:
 *           application/json:
 *             message: My institutions found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GetInstitution'
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.get('/getVisibleInstitutions', passport.authenticate('jwt', { session: false }), uploader.none(), getVisibleInstitutions);

/**
 * @swagger
 * /api/institution/getInstitution/{institutionId}:
 *   get:
 *     summary: Get an institution by id
 *     tags: [Institution]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         schema:
 *           type: integer
 *           required: true
 *           description: The institution id
 *     responses:
 *       200:
 *         description: The institution description by id
 *         content:
 *           application/json:
 *             message: Institution found.
 *             data:
 *               $ref: '#/components/schemas/GetInstitution'
 *       404:
 *         description: The institution was not found
 *         content:
 *           application/json:
 *             message: Institution not found.
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.get('/getInstitution/:institutionId', passport.authenticate('jwt', { session: false }), uploader.none(), getInstitution);

/**
 * @swagger
 * /api/institution/deleteInstitution/{institutionId}:
 *   delete:
 *     summary: Remove an institution by id
 *     tags: [Institution]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: institutionId
 *         schema:
 *           type: integer
 *           required: true
 *           description: The institution id
 *     responses:
 *       200:
 *         description: The institution was successfully deleted
 *         content:
 *           application/json:
 *             message: Institution deleted.
 *             data:
 *               $ref: '#/components/schemas/GetInstitution'
 *       404:
 *         description: The institution was not found
 *         content:
 *           application/json:
 *             message: Institution not found.
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.delete('/deleteInstitution/:institutionId', passport.authenticate('jwt', { session: false }), uploader.none(), deleteInstitution);

export default router;
