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
    createUser,
    updateUser,
    getAllUsers,
    getUser,
    deleteUser,
    searchUserByUsername,
    getManagedUsers,
} from '../controllers/userController';
import passport from '../services/passportAuth';
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
 *     CreateUser:
 *      type: object
 *      required:
 *        - name
 *        - username
 *        - hash
 *        - role
 *        - institutionId
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier of the user (auto-generated by default)
 *          example: 1
 *        name:
 *          type: string
 *          description: The name of the user
 *          example: "John Doe"
 *        username:
 *          type: string
 *          description: The username of the user
 *          example: "johndoe"
 *        hash:
 *          type: string
 *          description: The hash of the user
 *          example: "123456"
 *        role:
 *          type: string
 *          enum: [USER, APPLIER, PUBLISHER, COORDINATOR, ADMIN]
 *          description: The role of the user in the system environment
 *          example: "USER"
 *        institutionId:
 *          type: integer
 *          description: The id of the institution the user belongs to
 *          example: 1
 *        classrooms:
 *          type: array
 *          items:
 *            type: integer
 *          description: The list of classrooms the user belongs to
 *          example: [1, 2]
 *     UpdateUser:
 *      type: object
 *      properties:
 *        name:
 *          type: string
 *          description: The name of the user
 *          example: "John Doe"
 *        username:
 *          type: string
 *          description: The username of the user
 *          example: "johndoe"
 *        hash:
 *          type: string
 *          description: The hash of the user
 *          example: "123456"
 *        role:
 *          type: string
 *          enum: [USER, APPLIER, PUBLISHER, COORDINATOR, ADMIN]
 *          description: The role of the user in the system environment
 *          example: "USER"
 *        institutionId:
 *          type: integer
 *          description: The id of the institution the user belongs to
 *          example: 1
 *        classrooms:
 *          type: array
 *          items:
 *            type: integer
 *          description: The list of classrooms the user belongs to
 *          example: [1, 2]
 *     GetUser:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: Unique identifier of the user
 *          example: 1
 *        name:
 *          type: string
 *          description: The name of the user
 *          example: "John Doe"
 *        username:
 *          type: string
 *          description: The username of the user
 *          example: "johndoe"
 *        role:
 *          type: string
 *          enum: [USER, APPLIER, PUBLISHER, COORDINATOR, ADMIN]
 *          description: The role of the user in the system environment
 *          example: "USER"
 *        institution:
 *          type: object
 *          properties:
 *            id:
 *              type: integer
 *              description: Unique identifier of the institution
 *              example: 1
 *            name:
 *              type: string
 *              description: The name of the institution
 *              example: "New York University"
 *        classrooms:
 *          type: array
 *          items:
 *            type: object
 *            properties:
 *              id:
 *                type: integer
 *                description: Unique identifier of the classroom
 *                example: 1
 *        acceptedTerms:
 *          type: boolean
 *          description: The user acceptance of the terms of use
 *          example: true
 *        createdAt:
 *          type: string
 *          format: date-time
 *          description: The date and time the user was created
 *          example: "2021-09-01T12:00:00Z"
 *        updatedAt:
 *          type: string
 *          format: date-time
 *          description: The date and time the user was last updated
 *          example: "2021-09-01T12:00:00Z"
 */
const router = express.Router();

/**
 * @swagger
 * /api/user/createUser:
 *   post:
 *     summary: Create a new user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CreateUser'
 *     responses:
 *       201:
 *         description: The user was successfully created
 *         content:
 *           application/json:
 *             message: User created.
 *             data:
 *               $ref: '#/components/schemas/GetUser'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad Request.
 *       500:
 *         description: Some error occurred while creating the user.
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.post('/createUser', passport.authenticate('jwt', { session: false }), uploader.single('profileImage'), setLoggerLocals, createUser);

/**
 * @swagger
 * /api/user/updateUser/{userId}:
 *   put:
 *     summary: Update an existing user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: integer
 *           required: true
 *           description: Unique identifier of the user
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUser'
 *     responses:
 *       200:
 *         description: The user was successfully updated
 *         content:
 *           application/json:
 *             message: User updated.
 *             data:
 *               $ref: '#/components/schemas/GetUser'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad Request.
 *       500:
 *         description: Some error occurred while updating the user.
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.put(
    '/updateUser/:userId',
    passport.authenticate('jwt', { session: false }),
    uploader.single('profileImage'),
    setLoggerLocals,
    updateUser
);

/**
 * @swagger
 * /api/user/getManagedUsers:
 *   get:
 *     summary: Get all managed users
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of all managed users
 *         content:
 *           application/json:
 *             message: Managed users found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GetUser'
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.get('/getManagedUsers', passport.authenticate('jwt', { session: false }), uploader.none(), setLoggerLocals, getManagedUsers);

/**
 * @swagger
 * /api/user/getAllUsers:
 *   get:
 *     summary: Get all users
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of all users
 *         content:
 *           application/json:
 *             message: All users found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GetUser'
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.get('/getAllUsers', passport.authenticate('jwt', { session: false }), uploader.none(), setLoggerLocals, getAllUsers);

/**
 * @swagger
 * /api/user/getUser/{userId}:
 *   get:
 *     summary: Get an user by id
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: integer
 *           required: true
 *           description: Unique identifier of the user
 *           example: 1
 *     responses:
 *       200:
 *         description: The user was successfully found
 *         content:
 *           application/json:
 *             message: User found.
 *             data:
 *               $ref: '#/components/schemas/GetUser'
 *       404:
 *         description: The user was not found
 *         content:
 *           application/json:
 *             error:
 *               message: User not found.
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.get('/getUser/:userId', passport.authenticate('jwt', { session: false }), uploader.none(), setLoggerLocals, getUser);

/**
 * @swagger
 * /api/user/searchUserByUsername:
 *   post:
 *     summary: Search users by username
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - term
 *             properties:
 *               term:
 *                 type: string
 *                 description: The term to search for
 *                 example: "john"
 *     responses:
 *       200:
 *         description: The list of users found
 *         content:
 *           application/json:
 *             message: Users found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GetUser'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad Request.
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.post(
    '/searchUserByUsername',
    passport.authenticate('jwt', { session: false }),
    uploader.none(),
    setLoggerLocals,
    searchUserByUsername
);

/**
 * @swagger
 * /api/user/deleteUser/{userId}:
 *  delete:
 *     summary: Remove an user by id
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: integer
 *           required: true
 *           description: Unique identifier of the user
 *           example: 1
 *     responses:
 *       200:
 *         description: The user was successfully deleted
 *         content:
 *           application/json:
 *             message: User deleted.
 *             data:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Unique identifier of the user
 *                   example: 1
 *       404:
 *         description: The user was not found
 *         content:
 *           application/json:
 *             error:
 *               message: User not found.
 *       500:
 *         description: Some error occurred while deleting the user.
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.delete('/deleteUser/:userId', passport.authenticate('jwt', { session: false }), uploader.none(), setLoggerLocals, deleteUser);

export default router;
