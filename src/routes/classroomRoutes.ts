import express from 'express';
import uploader from '../services/multerUploader';
import {
    createClassroom,
    updateClassroom,
    getAllClassrooms,
    getClassroom,
    deleteClassroom,
    getMyClassrooms,
} from '../controllers/classroomController';
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
 *     CreateClassroom:
 *       type: object
 *       required:
 *         - institutionId
 *         - users
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier of the classroom (auto-generated by default).
 *           example: 1
 *         institutionId:
 *           type: integer
 *           description: The institution id.
 *           example: 1
 *         users:
 *           type: array
 *           items:
 *             type: integer
 *           minItems: 2
 *           description: List of users ids.
 *           example: [1, 2]
 *     UpdateClassroom:
 *       type: object
 *       properties:
 *         users:
 *           type: array
 *           items:
 *             type: integer
 *           minItems: 2
 *           description: List of users ids.
 *           example: [1, 2]
 *     GetClassroom:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier of the classroom (auto-generated by default).
 *           example: 1
 *         institution:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               description: Unique identifier of the institution.
 *               example: 1
 *             name:
 *               type: string
 *               description: The institution name.
 *               example: 'New York University'
 *         users:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 description: Unique identifier of the user.
 *                 example: 1
 *               name:
 *                 type: string
 *                 description: The user name.
 *                 example: 'John Doe'
 *               username:
 *                 type: string
 *                 description: The user username.
 *                 example: 'johndoe'
 *               role:
 *                 type: string
 *                 enum: [USER, APPLIER, PUBLISHER, COORDINATOR, ADMIN]
 *                 description: The role of the user in the system environment
 *                 example: "USER"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date-time when the classroom was created.
 *           example: '2021-09-01T12:00:00Z'
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date-time when the classroom was last updated.
 *           example: '2021-09-01T12:00:00Z'
 */
const router = express.Router();

/**
 * @swagger
 * /api/classroom/createClassroom:
 *   post:
 *     summary: Create a new classroom
 *     tags: [Classroom]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CreateClassroom'
 *     responses:
 *       201:
 *         description: The classroom was successfully created
 *         content:
 *           application/json:
 *             message: Classroom created.
 *             data:
 *               $ref: '#/components/schemas/GetClassroom'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad Request.
 *       500:
 *         description: Some error occurred while creating the classroom.
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.post('/createClassroom', passport.authenticate('jwt', { session: false }), uploader.none(), createClassroom);

/**
 * @swagger
 * /api/classroom/updateClassroom/{classroomId}:
 *   put:
 *     summary: Update an existing classroom
 *     tags: [Classroom]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classroomId
 *         schema:
 *           type: integer
 *           required: true
 *           description: The classroom id
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateClassroom'
 *     responses:
 *       200:
 *         description: The classroom was updated
 *         content:
 *           application/json:
 *             message: Classroom updated.
 *             data:
 *               $ref: '#/components/schemas/GetClassroom'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad Request.
 *       500:
 *         description: Some error occurred while updating the classroom.
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.put('/updateClassroom/:classroomId', passport.authenticate('jwt', { session: false }), uploader.none(), updateClassroom);

/**
 * @swagger
 * /api/classroom/getAllClassrooms:
 *   get:
 *     summary: Get all classrooms
 *     tags: [Classroom]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of all classrooms
 *         content:
 *           application/json:
 *             message: All classrooms found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GetClassroom'
 *       500:
 *         description: Some error occurred while retrieving classrooms.
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.get('/getAllClassrooms', passport.authenticate('jwt', { session: false }), uploader.none(), getAllClassrooms);

/**
 * @swagger
 * /api/classroom/getMyClassrooms:
 *   get:
 *     summary: Get all classrooms of the current user
 *     tags: [Classroom]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The list of all classrooms of the current user
 *         content:
 *           application/json:
 *             message: My classrooms found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GetClassroom'
 *       500:
 *         description: Some error occurred while retrieving my classrooms.
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.get('/getMyClassrooms', passport.authenticate('jwt', { session: false }), uploader.none(), getMyClassrooms);

/**
 * @swagger
 * /api/classroom/getClassroom/{classroomId}:
 *   get:
 *     summary: Get the classroom by id
 *     tags: [Classroom]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classroomId
 *         schema:
 *           type: integer
 *           required: true
 *           description: The classroom id
 *     responses:
 *       200:
 *         description: The classroom description by id
 *         content:
 *           application/json:
 *             message: Classroom found.
 *             data:
 *               $ref: '#/components/schemas/GetClassroom'
 *       404:
 *         description: The classroom was not found
 *         content:
 *           application/json:
 *             error:
 *               message: Classroom not found.
 *       500:
 *         description: Some error occurred while retrieving classroom.
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.get('/getClassroom/:classroomId', passport.authenticate('jwt', { session: false }), uploader.none(), getClassroom);

/**
 * @swagger
 * /api/classroom/deleteClassroom/{classroomId}:
 *   delete:
 *     summary: Delete the classroom by id
 *     tags: [Classroom]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classroomId
 *         schema:
 *           type: integer
 *           required: true
 *           description: The classroom id
 *     responses:
 *       200:
 *         description: The classroom was deleted
 *         content:
 *           application/json:
 *             message: Classroom deleted.
 *             data:
 *               $ref: '#/components/schemas/GetClassroom'
 *       404:
 *         description: The classroom was not found
 *         content:
 *           application/json:
 *             error:
 *               message: Classroom not found.
 *       500:
 *         description: Some error occurred while deleting classroom.
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 */
router.delete('/deleteClassroom/:classroomId', passport.authenticate('jwt', { session: false }), uploader.none(), deleteClassroom);

export default router;
