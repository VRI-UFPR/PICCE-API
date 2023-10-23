import express from 'express';
import uploader from '../services/multerUploader';
import {
    createApplication,
    updateApplication,
    getAllApplications,
    getApplication,
    deleteApplication,
} from '../controllers/applicationController';

/**
 * @swagger
 * components:
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
router.post('/createApplication', uploader.none(), createApplication);

/**
 * @swagger
 * /api/application/updateApplication/{applicationId}:
 *   put:
 *     summary: Update an existing application by id. All the fields are optional. The nested connected fields must be passed entirely, since all the existing connected objects that are not passed will be disconnected.
 *     tags: [Application]
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
router.put('/updateApplication/:applicationId', uploader.none(), updateApplication);

/**
 * @swagger
 * /api/application/getAllApplications:
 *   get:
 *     summary: Get all application s
 *     tags: [Application]
 *     responses:
 *       200:
 *         description: The list of application s was successfully retrieved
 *         content:
 *           application/json:
 *             message: All application s found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Application'
 *       500:
 *         description: An error occurred while retrieving the list of application s
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get('/getAllApplications', uploader.none(), getAllApplications);

/**
 * @swagger
 * /api/application/getApplication/{applicationId}:
 *   get:
 *     summary: Get an application by id
 *     tags: [Application]
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
router.get('/getApplication/:applicationId', uploader.none(), getApplication);

/**
 * @swagger
 * /api/application/deleteApplication/{applicationId}:
 *   delete:
 *     summary: Delete an application by id
 *     tags: [Application]
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
router.delete('/deleteApplication/:applicationId', uploader.none(), deleteApplication);

export default router;
