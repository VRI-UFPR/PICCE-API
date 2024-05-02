import express from 'express';
import uploader from '../services/multerUploader';
import { createUser, updateUser, getAllUsers, getUser, deleteUser, getInstitutionUsers } from '../controllers/userController';
import passport from '../services/passportAuth';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
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
 *          description: The auto-generated id of the user
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
 *          enum: [USER, APLICATOR, PUBLISHER, COORDINATOR, ADMIN]
 *          description: The role of the user
 *          example: "USER"
 *        institutionId:
 *          type: integer
 *          description: The id of the institution of the user
 *          example: 1
 */
const router = express.Router();

/**
 * @swagger
 * /api/user/createUser:
 *  post:
 *    summary: Create a new user
 *    tags: [User]
 *    requestBody:
 *      required: true
 *      content:
 *        multipart/form-data:
 *          schema:
 *            $ref: '#/components/schemas/User'
 *    responses:
 *      201:
 *        description: The user was successfully created
 *        content:
 *          application/json:
 *            message: User created.
 *            data:
 *              $ref: '#/components/schemas/User'
 *      400:
 *        description: Some required fields are missing or the user already exists
 *        content:
 *          application/json:
 *            error:
 *              message: Bad Request.
 *              data:
 *                $ref: '#/components/schemas/User'
 *      500:
 *        description: Some error occurred while creating the user.
 *        content:
 *          application/json:
 *            error:
 *              message: Internal Server Error.
 *              data:
 *                $ref: '#/components/schemas/User'
 */
router.post('/createUser', passport.authenticate('jwt', { session: false }), uploader.none(), createUser);

/**
 * @swagger
 * /api/user/updateUser/{userId}:
 *  put:
 *    summary: Update an existing user
 *    tags: [User]
 *    parameters:
 *      - in: path
 *        name: userId
 *        schema:
 *          type: integer
 *          required: true
 *          description: The user id
 *    requestBody:
 *      required: true
 *      content:
 *        multipart/form-data:
 *          schema:
 *            $ref: '#/components/schemas/User'
 *    responses:
 *      200:
 *        description: The user was successfully updated
 *        content:
 *          application/json:
 *            message: User updated.
 *            data:
 *              $ref: '#/components/schemas/User'
 *      400:
 *        description: Some required fields are missing or the user does not exist
 *        content:
 *          application/json:
 *            error:
 *              message: Bad Request.
 *              data:
 *                $ref: '#/components/schemas/User'
 *      500:
 *        description: Some error occurred while updating the user.
 *        content:
 *          application/json:
 *            error:
 *              message: Internal Server Error.
 *              data:
 *                $ref: '#/components/schemas/User'
 */
router.put('/updateUser/:userId', passport.authenticate('jwt', { session: false }), uploader.none(), updateUser);

/**
 * @swagger
 * /api/user/getAllUsers:
 *   get:
 *     summary: Get all users
 *     tags: [User]
 *     responses:
 *       200:
 *         description: The list of all users
 *         content:
 *           application/json:
 *             message: All users found.
 *             data:
 *               $ref: '#/components/schemas/User'
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: error message
 */
router.get('/getAllUsers', passport.authenticate('jwt', { session: false }), uploader.none(), getAllUsers);

router.get('/getInstitutionUsers', passport.authenticate('jwt', { session: false }), uploader.none(), getInstitutionUsers);

/**
 * @swagger
 * /api/user/getUser/{userId}:
 *   get:
 *     summary: Get an user by id
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: integer
 *           required: true
 *           description: The user id
 *     responses:
 *       200:
 *         description: The user was successfully found
 *         content:
 *           application/json:
 *             message: User found.
 *             data:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: The user was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get('/getUser/:userId', passport.authenticate('jwt', { session: false }), uploader.none(), getUser);

/**
 * @swagger
 * /api/user/deleteUser/{userId}:
 *  delete:
 *    summary: Remove an user by id
 *    tags: [User]
 *    parameters:
 *      - in: path
 *        name: userId
 *        schema:
 *          type: integer
 *          required: true
 *          description: The user id
 *    responses:
 *      200:
 *        description: The user was successfully deleted
 *        content:
 *          application/json:
 *            message: User deleted.
 *            data:
 *              $ref: '#/components/schemas/User'
 *      404:
 *        description: Some required fields are missing or the user does not exists
 *        content:
 *          application/json:
 *            error:
 *              message: Bad Request.
 *              data:
 *                $ref: '#/components/schemas/User'
 *      500:
 *        description: Some error occurred while deleting the user.
 *        content:
 *          application/json:
 *            error:
 *              message: Internal Server Error.
 *              data:
 *                $ref: '#/components/schemas/User'
 */
router.delete('/deleteUser/:userId', passport.authenticate('jwt', { session: false }), uploader.none(), deleteUser);

export default router;
