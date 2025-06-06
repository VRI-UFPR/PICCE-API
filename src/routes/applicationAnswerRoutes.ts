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
import passport from '../services/passportAuth';
import {
    createApplicationAnswer,
    updateApplicationAnswer,
    getAllApplicationAnswers,
    getMyApplicationAnswers,
    getApplicationAnswer,
    deleteApplicationAnswer,
    approveApplicationAnswer,
} from '../controllers/applicationAnswerController';
import { setLoggerLocals } from '../services/eventLogger';

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     CreateItemAnswer:
 *      type: object
 *      required:
 *        - text
 *        - itemId
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        text:
 *          type: string
 *          description: The text of the answer
 *          example: "This is the answer because..."
 *        itemId:
 *          type: integer
 *          description: The id of the item that the answer is for
 *          example: 1
 *     CreateOptionAnswer:
 *      type: object
 *      required:
 *        - itemId
 *        - optionId
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        text:
 *          type: string
 *          description: The text of the answer (if any)
 *          example: "This is the answer because..."
 *        itemId:
 *          type: integer
 *          description: The id of the item that the answer is for
 *          example: 1
 *        optionId:
 *          type: integer
 *          description: The id of the item option that the answer selects
 *          example: 1
 *     CreateTableAnswer:
 *      type: object
 *      required:
 *        - itemId
 *        - columnId
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        text:
 *          type: string
 *          description: The text of the answer (if any)
 *          example: "This is the answer because..."
 *        itemId:
 *          type: integer
 *          description: The id of the item (i.e. the table row) that the answer is for
 *          example: 1
 *        columnId:
 *          type: integer
 *          description: The id of the table column that the answer is for
 *          example: 1
 *     CreateItemAnswerGroup:
 *      type: object
 *      required:
 *        - itemAnswers
 *        - optionAnswers
 *        - tableAnswers
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the address
 *          example: 1
 *        itemAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/CreateItemAnswer'
 *          description: The item answers that belong to the group
 *        optionAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/CreateOptionAnswer'
 *          description: The option answers that belong to the group
 *        tableAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/CreateTableAnswer'
 *          description: The table answers that belong to the group
 *     CreateApplicationAnswer:
 *      type: object
 *      required:
 *        - date
 *        - applicationId
 *        - addressId
 *        - itemAnswerGroups
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        date:
 *          type: string
 *          description: The date that the application was submitted (using EN-US date format)
 *          example: "2021-01-01"
 *        userId:
 *          type: integer
 *          description: The id of the user that submitted the answer
 *          example: 1
 *          readOnly: true
 *        applicationId:
 *          type: integer
 *          description: The id of the application that the answer is for
 *          example: 1
 *        addressId:
 *          type: integer
 *          description: The id of the address where the application was submitted
 *          example: 1
 *        itemAnswerGroups:
 *          type: array
 *          description: The groups of item, option and table answers that belongs to the application answer
 *          items:
 *            $ref: '#/components/schemas/CreateItemAnswerGroup'
 *     UpdateItemAnswer:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        text:
 *          type: string
 *          description: The text of the answer
 *          example: "This is the answer because..."
 *        itemId:
 *          type: integer
 *          description: The id of the item that the answer is for
 *          example: 1
 *     UpdateOptionAnswer:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        text:
 *          type: string
 *          description: The text of the answer (if any)
 *          example: "This is the answer because..."
 *        itemId:
 *          type: integer
 *          description: The id of the item that the answer is for
 *          example: 1
 *        optionId:
 *          type: integer
 *          description: The id of the item option that the answer selects
 *          example: 1
 *     UpdateTableAnswer:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        text:
 *          type: string
 *          description: The text of the answer (if any)
 *          example: "This is the answer because..."
 *        itemId:
 *          type: integer
 *          description: The id of the item (i.e. the table row) that the answer is for
 *          example: 1
 *        columnId:
 *          type: integer
 *          description: The id of the table column that the answer is for
 *          example: 1
 *     UpdateItemAnswerGroup:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the address
 *          example: 1
 *        itemAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/UpdateItemAnswer'
 *          description: The item answers that belong to the group
 *        optionAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/UpdateOptionAnswer'
 *          description: The option answers that belong to the group
 *        tableAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/UpdateTableAnswer'
 *          description: The table answers that belong to the group
 *     UpdateApplicationAnswer:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        date:
 *          type: string
 *          description: The date that the application was submitted (using EN-US date format)
 *          example: "2021-01-01"
 *        userId:
 *          type: integer
 *          description: The id of the user that submitted the answer
 *          example: 1
 *          readOnly: true
 *        applicationId:
 *          type: integer
 *          description: The id of the application that the answer is for
 *          example: 1
 *        addressId:
 *          type: integer
 *          description: The id of the address where the application was submitted
 *          example: 1
 *        itemAnswerGroups:
 *          type: array
 *          description: The groups of item, option and table answers that belongs to the application answer
 *          items:
 *            $ref: '#/components/schemas/UpdateItemAnswerGroup'
 *        filesIds:
 *          type: array
 *          description: The ids of the existing that will remain attached to the application answer
 *          items:
 *            type: integer
 *            example: 1
 *     GetItemAnswer:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        text:
 *          type: string
 *          description: The text of the answer
 *          example: "This is the answer because..."
 *        itemId:
 *          type: integer
 *          description: The id of the item that the answer is for
 *          example: 1
 *        files:
 *          type: array
 *          description: The files attached to the answer
 *          items:
 *            type: object
 *            properties:
 *              path:
 *                type: string
 *                description: The path of the file
 *                example: "uploads/file.jpg"
 *     GetOptionAnswer:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        text:
 *          type: string
 *          description: The text of the answer (if any)
 *          example: "This is the answer because..."
 *        itemId:
 *          type: integer
 *          description: The id of the item that the answer is for
 *          example: 1
 *        optionId:
 *          type: integer
 *          description: The id of the item option that the answer selects
 *          example: 1
 *        files:
 *          type: array
 *          description: The files attached to the answer
 *          items:
 *            type: object
 *            properties:
 *              path:
 *                type: string
 *                description: The path of the file
 *                example: "uploads/file.jpg"
 *     GetTableAnswer:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        text:
 *          type: string
 *          description: The text of the answer (if any)
 *          example: "This is the answer because..."
 *        itemId:
 *          type: integer
 *          description: The id of the item (i.e. the table row) that the answer is for
 *          example: 1
 *        columnId:
 *          type: integer
 *          description: The id of the table column that the answer is for
 *          example: 1
 *        files:
 *          type: array
 *          description: The files attached to the answer
 *          items:
 *            type: object
 *            properties:
 *              path:
 *                type: string
 *                description: The path of the file
 *                example: "uploads/file.jpg"
 *     GetItemAnswerGroup:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the address
 *          example: 1
 *        itemAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/GetItemAnswer'
 *          description: The item answers that belong to the group
 *        optionAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/GetOptionAnswer'
 *          description: The option answers that belong to the group
 *        tableAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/GetTableAnswer'
 *          description: The table answers that belong to the group
 *     GetApplicationAnswer:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier for the answer (auto-generated by default)
 *          example: 1
 *        date:
 *          type: string
 *          format: date
 *          description: The date that the application was submitted (using EN-US date format)
 *          example: "2021-01-01"
 *        userId:
 *          type: integer
 *          description: The id of the user that submitted the answer
 *          example: 1
 *        applicationId:
 *          type: integer
 *          description: The id of the application that the answer is for
 *          example: 1
 *        addressId:
 *          type: integer
 *          description: The id of the address where the application was submitted
 *          example: 1
 *        itemAnswerGroups:
 *          type: array
 *          description: The groups of item, option and table answers that belongs to the application answer
 *          items:
 *            $ref: '#/components/schemas/GetItemAnswerGroup'
 */
const router = express.Router();

/**
 * @swagger
 * /api/applicationAnswer/createApplicationAnswer:
 *   post:
 *     summary: Create a new application answer
 *     tags: [ApplicationAnswer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CreateApplicationAnswer'
 *     responses:
 *       201:
 *         description: The application answer was successfully created
 *         content:
 *           application/json:
 *             message: Application answer created.
 *             data:
 *               $ref: '#/components/schemas/ApplicationAnswer'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad request.
 *       500:
 *         description: A server-side error occurred while creating the application answer
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.post(
    '/createApplicationAnswer',
    passport.authenticate('jwt', { session: false }),
    uploader.any(),
    setLoggerLocals,
    createApplicationAnswer
);

/**
 * @swagger
 * /api/applicationAnswer/approveApplicationAnswer/{applicationAnswerId}:
 *   put:
 *     summary: Approve an application answer by id
 *     tags: [ApplicationAnswer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationAnswerId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the application answer to approve
 *     responses:
 *       200:
 *         description: The application answer was successfully approved
 *         content:
 *           application/json:
 *             message: Application answer approved.
 *             data:
 *               $ref: '#/components/schemas/GetApplicationAnswer'
 *       404:
 *         description: Application answer not found
 *         content:
 *           application/json:
 *             error:
 *               message: Application answer not found.
 *       500:
 *         description: An error occurred while approving the application answer
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.put(
    '/approveApplicationAnswer/:applicationAnswerId',
    passport.authenticate('jwt', { session: false }),
    uploader.none(),
    approveApplicationAnswer
);

/**
 * @swagger
 * /api/applicationAnswer/updateApplicationAnswer/{applicationAnswerId}:
 *   put:
 *     summary: Update an existing application answer by id. All the fields are optional. Performs individual update on nested objects. The items passed with an id will be kept or updated, and the items passed without an id will be created. The items that are not passed will be deleted.
 *     tags: [ApplicationAnswer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationAnswerId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the application answer to update
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateApplicationAnswer'
 *     responses:
 *       200:
 *         description: The application answer was successfully updated
 *         content:
 *           application/json:
 *             message: Application answer updated.
 *             data:
 *               $ref: '#/components/schemas/GetApplicationAnswer'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad request.
 *       500:
 *         description: An server-side error occurred while updating the application answer
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.put(
    '/updateApplicationAnswer/:applicationAnswerId',
    passport.authenticate('jwt', { session: false }),
    uploader.any(),
    updateApplicationAnswer
);

/**
 * @swagger
 * /api/applicationAnswer/getAllApplicationAnswers:
 *   get:
 *     summary: Get all application answers
 *     tags: [ApplicationAnswer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of application answers was successfully retrieved
 *         content:
 *           application/json:
 *             message: All application answers found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GetApplicationAnswer'
 *       500:
 *         description: An error occurred while retrieving the list of application answers
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.get(
    '/getAllApplicationAnswers',
    passport.authenticate('jwt', { session: false }),
    uploader.none(),
    setLoggerLocals,
    getAllApplicationAnswers
);

/**
 * @swagger
 * /api/applicationAnswer/getMyApplicationAnswers:
 *   get:
 *     summary: Get all application answers submitted by the user
 *     tags: [ApplicationAnswer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of application answers was successfully retrieved
 *         content:
 *           application/json:
 *             message: My application answers found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GetApplicationAnswer'
 *       500:
 *         description: An error occurred while retrieving the list of application answers
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.get(
    '/getMyApplicationAnswers',
    passport.authenticate('jwt', { session: false }),
    uploader.none(),
    setLoggerLocals,
    getMyApplicationAnswers
);

/**
 * @swagger
 * /api/applicationAnswer/getApplicationAnswer/{applicationAnswerId}:
 *   get:
 *     summary: Get an application answer by id
 *     tags: [ApplicationAnswer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationAnswerId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the application answer to retrieve
 *     responses:
 *       200:
 *         description: The application answer was successfully retrieved
 *         content:
 *           application/json:
 *             message: Application answer found.
 *             data:
 *               $ref: '#/components/schemas/GetApplicationAnswer'
 *       404:
 *         description: Application answer not found
 *         content:
 *           application/json:
 *             error:
 *               message: Application answer not found.
 *       500:
 *         description: An error occurred while retrieving the application answer
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.get(
    '/getApplicationAnswer/:applicationAnswerId',
    passport.authenticate('jwt', { session: false }),
    uploader.none(),
    getApplicationAnswer
);

/**
 * @swagger
 * /api/applicationAnswer/deleteApplicationAnswer/{applicationAnswerId}:
 *   delete:
 *     summary: Delete an application answer by id
 *     tags: [ApplicationAnswer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationAnswerId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the application answer to delete
 *     responses:
 *       200:
 *         description: The application answer was successfully deleted
 *         content:
 *           application/json:
 *             message: Application answer deleted.
 *             data:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: The id of the deleted application answer
 *                   example: 1
 *       404:
 *         description: Application answer not found
 *         content:
 *           application/json:
 *             error:
 *               message: Application answer not found.
 *       500:
 *         description: An error occurred while deleting the application answer
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.delete(
    '/deleteApplicationAnswer/:applicationAnswerId',
    passport.authenticate('jwt', { session: false }),
    uploader.none(),
    deleteApplicationAnswer
);

export default router;
