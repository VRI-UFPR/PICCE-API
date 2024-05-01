import express from 'express';
import uploader from '../services/multerUploader';
import passport from '../services/passportAuth';
import {
    createApplicationAnswer,
    updateApplicationAnswer,
    getAllApplicationAnswers,
    getApplicationAnswer,
    deleteApplicationAnswer,
    getApplicationWithAnswers,
} from '../controllers/applicationAnswerController';

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     ItemAnswer:
 *      type: object
 *      required:
 *        - text
 *        - itemId
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the address
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
 *          items:
 *            type: string
 *          description: The files of the answer
 *          example: ["file1.png", "file2.png"]
 *      example:
 *        text: "This is the answer because..."
 *        itemId: 1
 *     OptionAnswer:
 *      type: object
 *      required:
 *        - itemId
 *        - optionId
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the address
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
 *      example:
 *        itemId: 1
 *        optionId: 1
 *     TableAnswer:
 *      type: object
 *      required:
 *        - itemId
 *        - columnId
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the address
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
 *      example:
 *        itemId: 1
 *        columnId: 1
 *     ItemAnswerGroup:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the address
 *          example: 1
 *        itemAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/ItemAnswer'
 *        optionAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/OptionAnswer'
 *        tableAnswers:
 *          type: array
 *          items:
 *            $ref: '#/components/schemas/TableAnswer'
 *     ApplicationAnswer:
 *      type: object
 *      required:
 *        - date
 *        - applicationId
 *        - addressId
 *        - itemAnswerGroups
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the address
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
 *            $ref: '#/components/schemas/ItemAnswerGroup'
 *      example:
 *        date: "2021-01-01"
 *        userId: 1
 *        applicationId: 1
 *        addressId: 1
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
 *             $ref: '#/components/schemas/ApplicationAnswer'
 *     responses:
 *       201:
 *         description: The application answer was successfully created
 *         content:
 *           application/json:
 *             message: Application answer created.
 *             data:
 *               $ref: '#/components/schemas/ApplicationAnswer'
 *       400:
 *         description: The request was malformed or invalid
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: A server-side error occurred while creating the application answer
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.post('/createApplicationAnswer', passport.authenticate('jwt', { session: false }), uploader.any(), createApplicationAnswer);

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
 *             $ref: '#/components/schemas/ApplicationAnswer'
 *     responses:
 *       200:
 *         description: The application answer was successfully updated
 *         content:
 *           application/json:
 *             message: Application answer updated.
 *             data:
 *               $ref: '#/components/schemas/ApplicationAnswer'
 *       400:
 *         description: The request was malformed/invalid or the application answer with the specified id was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: An server-side error occurred while updating the application answer
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
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
 *                 $ref: '#/components/schemas/ApplicationAnswer'
 *       500:
 *         description: An error occurred while retrieving the list of application answers
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get('/getAllApplicationAnswers', passport.authenticate('jwt', { session: false }), uploader.none(), getAllApplicationAnswers);

router.get(
    '/getApplicationWithAnswers/:applicationId',
    passport.authenticate('jwt', { session: false }),
    uploader.none(),
    getApplicationWithAnswers
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
 *               $ref: '#/components/schemas/ApplicationAnswer'
 *       400:
 *         description: An application answer with the specified id was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: An error occurred while retrieving the application answer
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
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
 *               $ref: '#/components/schemas/ApplicationAnswer'
 *       400:
 *         description: An application answer with the specified id was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: An error occurred while deleting the application answer
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.delete(
    '/deleteApplicationAnswer/:applicationAnswerId',
    passport.authenticate('jwt', { session: false }),
    uploader.none(),
    deleteApplicationAnswer
);

export default router;
