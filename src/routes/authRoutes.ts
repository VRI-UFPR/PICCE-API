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
import { signIn, renewSignIn, checkSignIn, passwordlessSignIn, acceptTerms } from '../controllers/authController';
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
 *     SignUp:
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
 *        hash:
 *          type: string
 *          description: The hash of the user's password (encrypted)
 *          example: "f70adf6b3777a760085e89144c3e817f"
 *        role:
 *          type: string
 *          enum: [USER, APLICATOR, PUBLISHER, COORDINATOR, ADMIN]
 *          description: The role of the user
 *          example: "USER"
 *        institutionId:
 *          type: integer
 *          description: The id of the institution of the user
 *          example: 1
 *        classrooms:
 *          type: array
 *          items:
 *            type: integer
 *          description: The ids of the classrooms the user is part of
 *          example: [1, 2]
 *     SignIn:
 *      type: object
 *      required:
 *        - username
 *        - hash
 *      properties:
 *        username:
 *          type: string
 *          description: The username of the user
 *          example: "johndoe"
 *        hash:
 *          type: string
 *          description: The hash of the user's password (encrypted)
 *          example: "f70adf6b3777a760085e89144c3e817f"
 *     GetAuth:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: The id of the user who signed in
 *          example: 1
 *        role:
 *          type: string
 *          enum: [USER, APPLIER, PUBLISHER, COORDINATOR, ADMIN]
 *          description: The role of the user in the system environment
 *          example: "USER"
 *        acceptedTerms:
 *          type: boolean
 *          description: User acceptance of the terms of use
 *          example: true
 *        token:
 *          type: string
 *          description: The JWT token of the user who signed in
 *          example: "eyJhbGcdla8sds89ds89d98u5cCI6IkpXVCJ9"
 *        expiresIn:
 *          type: integer
 *          description: The expiration time of the JWT token in seconds
 *          example: 3600
 *        institutionId:
 *          type: integer
 *          description: The id of the institution of the user
 *          example: 1
 */
const router = express.Router();

/**
 * @swagger
 * /api/auth/signIn:
 *   post:
 *     summary: Sign in to the application
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/SignIn'
 *     responses:
 *       200:
 *         description: The user was successfully signed in
 *         content:
 *           application/json:
 *             message: User signed in.
 *             data:
 *               $ref: '#/components/schemas/GetAuth'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad Request.
 *       500:
 *         description: A server-side error occurred while signing in the user
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.post('/signIn', uploader.none(), setLoggerLocals, signIn);

// /**
//  * @swagger
//  * /api/auth/signUp:
//  *   post:
//  *     summary: Sign up to the application
//  *     tags: [Auth]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         multipart/form-data:
//  *           schema:
//  *             $ref: '#/components/schemas/SignUp'
//  *     responses:
//  *       201:
//  *         description: The user was successfully signed up
//  *         content:
//  *           application/json:
//  *             message: User signed up.
//  *             data:
//  *               $ref: '#/components/schemas/GetAuth'
//  *       400:
//  *         description: Request data validation failed
//  *         content:
//  *           application/json:
//  *             error:
//  *               message: Bad Request.
//  *       500:
//  *         description: A server-side error occurred while signing up the user
//  *         content:
//  *           application/json:
//  *             error:
//  *               message: Internal Server Error.
//  */
// router.post('/signUp', uploader.none(), signUp);

/**
 * @swagger
 * /api/auth/passwordlessSignIn:
 *   get:
 *     summary: Sign in to the application without a password
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: The user was successfully signed in without a password
 *         content:
 *           application/json:
 *             message: User signed in.
 *             data:
 *               $ref: '#/components/schemas/GetAuth'
 *       500:
 *         description: A server-side error occurred while signing in the user without a password
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.get('/passwordlessSignIn', uploader.none(), setLoggerLocals, passwordlessSignIn);

/**
 * @swagger
 * /api/auth/renewSignIn:
 *   post:
 *     summary: Renew the user's sign in
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The user's sign in was successfully renewed
 *         content:
 *           application/json:
 *             message: User signed in.
 *             data:
 *               $ref: '#/components/schemas/GetAuth'
 *       500:
 *         description: A server-side error occurred while renewing the user's sign in
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.post('/renewSignIn', passport.authenticate('jwt', { session: false }), uploader.none(), setLoggerLocals, renewSignIn);

/**
 * @swagger
 * /api/auth/checkSignIn:
 *   get:
 *     summary: Check if the user is signed in
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The user is currently signed in
 *         content:
 *           application/json:
 *             message: User currently signed in.
 *             data:
 *               id:
 *                 type: integer
 *                 description: The id of the user who signed in
 *                 example: 1
 *       500:
 *         description: A server-side error occurred while checking if the user is signed in
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.get('/checkSignIn', passport.authenticate('jwt', { session: false }), uploader.none(), setLoggerLocals, checkSignIn);

/**
 * @swagger
 * /api/auth/acceptTerms:
 *   get:
 *     summary: Accept the terms of use
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The user accepted the terms of use
 *         content:
 *           application/json:
 *             message: User accepted terms.
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad Request.
 *       500:
 *         description: A server-side error occurred while accepting the terms of use
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.get('/acceptTerms', passport.authenticate('jwt', { session: false }), uploader.none(), setLoggerLocals, acceptTerms);

export default router;
