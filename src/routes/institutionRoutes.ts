import express from 'express';
import uploader from '../services/multerUploader';
import {
    createInstitution,
    updateInstitution,
    getAllInstitutions,
    getInstitution,
    deleteInstitution,
} from '../controllers/institutionController';

/**
 * @swagger
 * components:
 *   schemas:
 *     Institution:
 *      type: object
 *      required:
 *        - name
 *        - type
 *        - addressId
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the institution
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
 */

const router = express.Router();

/**
 * @swagger
 * /api/institution/createInstitution:
 *   post:
 *     summary: Create a new institution
 *     tags: [Institution]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Institution'
 *     responses:
 *       201:
 *         description: The institution was successfully created
 *         content:
 *           application/json:
 *             message: Institution created.
 *             data:
 *               $ref: '#/components/schemas/Institution'
 *       400:
 *         description: Some required fields are missing or the institution already exists
 *         content:
 *           application/json:
 *             error:
 *               message: error message
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: error message
 */
router.post('/createInstitution', uploader.none(), createInstitution);

/**
 * @swagger
 * /api/institution/updateInstitution/{institutionId}:
 *   put:
 *     summary: Update an existing institution
 *     tags: [Institution]
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
 *             $ref: '#/components/schemas/Institution'
 *     responses:
 *       200:
 *         description: The institution was successfully updated
 *         content:
 *           application/json:
 *             message: Institution updated.
 *             data:
 *               $ref: '#/components/schemas/Institution'
 *       400:
 *         description: Some required fields are missing or the institution does not exist
 *         content:
 *           application/json:
 *             error:
 *               message: error message
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: error message
 */
router.put('/updateInstitution/:institutionId', uploader.none(), updateInstitution);

/**
 * @swagger
 * /api/institution/getAllInstitutions:
 *   get:
 *     summary: Get all institutions
 *     tags: [Institution]
 *     responses:
 *       200:
 *         description: The list of all institutions
 *         content:
 *           application/json:
 *             message: All institutions found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Institution'
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: error message
 */
router.get('/getAllInstitutions', uploader.none(), getAllInstitutions);

/**
 * @swagger
 * /api/institution/getInstitution/{institutionId}:
 *   get:
 *     summary: Get an institution by id
 *     tags: [Institution]
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
 *               $ref: '#/components/schemas/Institution'
 *       404:
 *         description: The institution was not found
 *         content:
 *           application/json:
 *             message: error message
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             message: error message
 */
router.get('/getInstitution/:institutionId', uploader.none(), getInstitution);

/**
 * @swagger
 * /api/institution/deleteInstitution/{institutionId}:
 *   delete:
 *     summary: Remove an institution by id
 *     tags: [Institution]
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
 *               $ref: '#/components/schemas/Institution'
 *       404:
 *         description: The institution was not found
 *         content:
 *           application/json:
 *             message: error message
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             message: error message
 */
router.delete('/deleteInstitution/:institutionId', uploader.none(), deleteInstitution);

export default router;
