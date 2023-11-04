import express from 'express';
import uploader from '../services/multerUploader';
import { createClassroom, updateClassroom, getAllClassrooms, getClassroom, deleteClassroom } from '../controllers/classroomController';

/**
 * @swagger
 * components:
 *   schemas:
 *     Classroom:
 *       type: object
 *       required:
 *         - institutionId
 *         - users
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the classroom.
 *         institutionId:
 *           type: integer
 *           description: The institution id.
 *         users:
 *           type: array
 *           items:
 *             type: integer
 *           minItems: 2
 *           description: List of users id.
 */
const router = express.Router();

/**
 * @swagger
 * /api/classroom/createClassroom:
 *   post:
 *     summary: Create a new classroom
 *     tags: [Classroom]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Classroom'
 *     responses:
 *       201:
 *         description: The classroom was successfully created
 *         content:
 *           application/json:
 *             message: Classroom created.
 *             data:
 *               $ref: '#/components/schemas/Classroom'
 *       400:
 *         description: Some required fields are missing or the classroom already exists
 *         content:
 *           application/json:
 *             error:
 *               message: Bad Request.
 *               data:
 *                 $ref: '#/components/schemas/Classroom'
 *       500:
 *         description: Some error occurred while creating the classroom.
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 *               data:
 *                 $ref: '#/components/schemas/Classroom'
 */
router.post('/createClassroom', uploader.none(), createClassroom);

/**
 * @swagger
 * /api/classroom/updateClassroom/{classroomId}:
 *   put:
 *     summary: Update an existing classroom
 *     tags: [Classroom]
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
 *             $ref: '#/components/schemas/Classroom'
 *     responses:
 *       200:
 *         description: The classroom was updated
 *         content:
 *           application/json:
 *             message: Classroom updated.
 *             data:
 *               $ref: '#/components/schemas/Classroom'
 *       400:
 *         description: Some required fields are missing or the classroom does not exists
 *         content:
 *           application/json:
 *             error:
 *               message: Bad Request.
 *               data:
 *                 $ref: '#/components/schemas/Classroom'
 *       500:
 *         description: Some error occurred while updating the classroom.
 *         content:
 *           application/json:
 *             error:
 *               message: Internal Server Error.
 *               data:
 *                 $ref: '#/components/schemas/Classroom'
 */
router.put('/updateClassroom/:classroomId', uploader.none(), updateClassroom);

/**
 * @swagger
 * /api/classroom/getAllClassrooms:
 *  get:
 *    summary: Get all classrooms
 *    tags: [Classroom]
 *    responses:
 *      200:
 *        description: The list of all classrooms
 *        content:
 *          application/json:
 *            message: All classrooms found.
 *            data:
 *              $ref: '#/components/schemas/Classroom'
 *      500:
 *        description: Some error occurred while retrieving classrooms.
 *        content:
 *          application/json:
 *            message: Internal Server Error.
 *            data:
 *              $ref: '#/components/schemas/Classroom'
 */
router.get('/getAllClassrooms', uploader.none(), getAllClassrooms);

/**
 * @swagger
 * /api/classroom/getClassroom/{classroomId}:
 *  get:
 *    summary: Get the classroom by id
 *    tags: [Classroom]
 *    parameters:
 *      - in: path
 *        name: classroomId
 *        schema:
 *          type: integer
 *          required: true
 *          description: The classroom id
 *    responses:
 *      200:
 *        description: The classroom description by id
 *        content:
 *          application/json:
 *            message: Classroom found.
 *            data:
 *              $ref: '#/components/schemas/Classroom'
 *      404:
 *        description: The classroom was not found
 *        content:
 *          application/json:
 *            error:
 *              message: Not Found.
 *              data:
 *                $ref: '#/components/schemas/Classroom'
 *      500:
 *        description: Some error occurred while retrieving classroom.
 *        content:
 *          application/json:
 *            error:
 *              message: Internal Server Error.
 *              data:
 *                $ref: '#/components/schemas/Classroom'
 */
router.get('/getClassroom/:classroomId', uploader.none(), getClassroom);

/**
 * @swagger
 * /api/classroom/deleteClassroom/{classroomId}:
 *  delete:
 *    summary: Delete the classroom by id
 *    tags: [Classroom]
 *    parameters:
 *      - in: path
 *        name: classroomId
 *        schema:
 *          type: integer
 *          required: true
 *          description: The classroom id
 *    responses:
 *      200:
 *        description: The classroom was deleted
 *        content:
 *          application/json:
 *            message: Classroom deleted.
 *            data:
 *              $ref: '#/components/schemas/Classroom'
 *      404:
 *        description: The classroom was not found
 *        content:
 *          application/json:
 *            error:
 *              message: Not Found.
 *              data:
 *                $ref: '#/components/schemas/Classroom'
 *      500:
 *        description: Some error occurred while deleting classroom.
 *        content:
 *          application/json:
 *            error:
 *              message: Internal Server Error.
 *              data:
 *                $ref: '#/components/schemas/Classroom'
 */
router.delete('/deleteClassroom/:classroomId', uploader.none(), deleteClassroom);

export default router;
