import express from 'express';
import uploader from '../services/multerUploader';
import { signIn, signUp } from '../controllers/authController';

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
 *      example:
 *        name: "John Doe"
 *        username: "johndoe"
 *        hash: "f70adf6b3777a760085e89144c3e817f"
 *        role: "USER"
 *        institutionId: 1
 *     UserLogin:
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
 *      example:
 *        username: "johndoe"
 *        hash: "f70adf6b3777a760085e89144c3e817f"
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
 *             $ref: '#/components/schemas/UserLogin'
 *     responses:
 *       200:
 *         description: The user was successfully signed in
 *         content:
 *           application/json:
 *             message: User signed in.
 *             data:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: The id of the user who signed in
 *                   example: 1
 *                 token:
 *                   type: string
 *                   description: The JWT token of the user who signed in
 *       400:
 *         description: The request was malformed/invalid or the credentials were wrong
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: A server-side error occurred while signing in the user
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.post('/signIn', uploader.none(), signIn);

/**
 * @swagger
 * /api/auth/signUp:
 *   post:
 *     summary: Sign up to the application
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: The user was successfully signed up
 *         content:
 *           application/json:
 *             message: User signed up.
 *             data:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: The request was malformed/invalid
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: A server-side error occurred while signing up the user
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.post('/signUp', uploader.none(), signUp);

export default router;
