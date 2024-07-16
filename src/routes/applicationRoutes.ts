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
    createApplication,
    updateApplication,
    getMyApplications,
    getVisibleApplications,
    getApplication,
    deleteApplication,
    getApplicationWithProtocol,
} from '../controllers/applicationController';
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
 *     Application:
 *      type: object
 *      required:
 *        - protocolId
 *        - applicatorId
 *        - viewersUser
 *        - viewersClassroom
 *        - visibilityMode
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the address
 *          example: 1
 *        protocolId:
 *          type: integer
 *          description: The id of the protocol which is being applied
 *          example: 1
 *        applicatorId:
 *          type: integer
 *          description: The id of the applicator who is applying the protocol
 *          example: 1
 *        viewersUser:
 *          type: array
 *          description: The ids of the users who can view the application
 *          items:
 *            type: integer
 *          example: [1, 2, 3]
 *        viewersClassroom:
 *          type: array
 *          description: The ids of the classrooms who can view the application
 *          items:
 *            type: integer
 *          example: [1, 2, 3]
 *        visibilityMode:
 *          type: string
 *          enum: [PUBLIC, RESTRICT]
 *          description: The visibility mode of the application
 *          example: PUBLIC
 */
const router = express.Router();

/**
 * @swagger
 * /api/application/createApplication:
 *   post:
 *     summary: Create a new application
 *     tags: [Application]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Application'
 *     responses:
 *       201:
 *         description: The application was successfully created
 *         content:
 *           application/json:
 *             message: Application created.
 *             data:
 *               $ref: '#/components/schemas/Application'
 *       400:
 *         description: The request was malformed or invalid
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: A server-side error occurred while creating the application
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.post('/createApplication', passport.authenticate('jwt', { session: false }), uploader.none(), createApplication);

/**
 * @swagger
 * /api/application/updateApplication/{applicationId}:
 *   put:
 *     summary: Update an existing application by id. All the fields are optional. The nested connected fields must be passed entirely, since all the existing connected objects that are not passed will be disconnected.
 *     tags: [Application]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the application to update
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Application'
 *     responses:
 *       200:
 *         description: The application was successfully updated
 *         content:
 *           application/json:
 *             message: Application updated.
 *             data:
 *               $ref: '#/components/schemas/Application'
 *       400:
 *         description: The request was malformed/invalid or the application with the specified id was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: An server-side error occurred while updating the application
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.put('/updateApplication/:applicationId', passport.authenticate('jwt', { session: false }), uploader.none(), updateApplication);

/**
 * @swagger
 * /api/application/getMyApplications:
 *   get:
 *     summary: Get all applications created by the user
 *     tags: [Application]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of applications was successfully retrieved
 *         content:
 *           application/json:
 *             message: All applications found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Application'
 *       500:
 *         description: An error occurred while retrieving the list of applications
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get('/getMyApplications', passport.authenticate('jwt', { session: false }), uploader.none(), getMyApplications);

/**
 * @swagger
 * /api/application/getVisibleApplications:
 *   get:
 *     summary: Get all applications that are visible to the user
 *     tags: [Application]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of applications was successfully retrieved
 *         content:
 *           application/json:
 *             message: All applications found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Application'
 *       500:
 *         description: An error occurred while retrieving the list of applications
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get('/getVisibleApplications', passport.authenticate('jwt', { session: false }), uploader.none(), getVisibleApplications);

/**
 * @swagger
 * /api/application/getApplication/{applicationId}:
 *   get:
 *     summary: Get an application by id
 *     tags: [Application]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the application to retrieve
 *     responses:
 *       200:
 *         description: The application was successfully retrieved
 *         content:
 *           application/json:
 *             message: Application found.
 *             data:
 *               $ref: '#/components/schemas/Application'
 *       400:
 *         description: An application with the specified id was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: An error occurred while retrieving the application
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get('/getApplication/:applicationId', passport.authenticate('jwt', { session: false }), uploader.none(), getApplication);

/**
 * @swagger
 * /api/application/getApplicationWithProtocol/{applicationId}:
 *   get:
 *     summary: Get an application by id with nested protocol
 *     tags: [Application]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the application to retrieve
 *     responses:
 *       200:
 *         description: The application was successfully retrieved
 *         content:
 *           application/json:
 *             message: Application found.
 *             data:
 *               $ref: '#/components/schemas/Application'
 *       400:
 *         description: An application with the specified id was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: An error occurred while retrieving the application
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get(
    '/getApplicationWithProtocol/:applicationId',
    passport.authenticate('jwt', { session: false }),
    uploader.none(),
    getApplicationWithProtocol
);

/**
 * @swagger
 * /api/application/deleteApplication/{applicationId}:
 *   delete:
 *     summary: Delete an application by id
 *     tags: [Application]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the application to delete
 *     responses:
 *       200:
 *         description: The application was successfully deleted
 *         content:
 *           application/json:
 *             message: Application deleted.
 *             data:
 *               $ref: '#/components/schemas/Application'
 *       400:
 *         description: An application with the specified id was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: An error occurred while deleting the application
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.delete('/deleteApplication/:applicationId', passport.authenticate('jwt', { session: false }), uploader.none(), deleteApplication);

export default router;
