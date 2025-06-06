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
    createProtocol,
    updateProtocol,
    getAllProtocols,
    getProtocol,
    deleteProtocol,
    getMyProtocols,
    getVisibleProtocols,
    getProtocolWithAnswers,
    replicateProtocol,
} from '../controllers/protocolController';
import { setLoggerLocals } from '../services/eventLogger';
/**
 * @swagger
 * components:
 *   schemas:
 *     ItemValidation:
 *       type: object
 *       required:
 *         - type
 *         - argument
 *         - itemId
 *       properties:
 *         id:
 *           type: number
 *           description: The auto-generated id of the item validation
 *           example: 1
 *         type:
 *           type: string
 *           enum: [MANDATORY, MIN, MAX]
 *           description: The type of the item validation
 *           example: "MANDATORY"
 *         argument:
 *           type: string
 *           description: The argument of the item validation
 *           example: "true"
 *         itemId:
 *           type: number
 *           description: The id of the item being validated
 *           example: 1
 *       example:
 *         id: 1
 *         type: "MANDATORY"
 *         argument: "true"
 *         itemId: 1
 *     ItemOption:
 *       type: object
 *       required:
 *         - text
 *         - placement
 *         - itemId
 *       properties:
 *         id:
 *           type: number
 *           description: The auto-generated id of the item option
 *           example: 1
 *         text:
 *           type: string
 *           description: The text/proposition of the item option
 *           example: "Option 1"
 *         placement:
 *           type: number
 *           description: The placement of the item option in the item
 *           example: 1
 *         itemId:
 *           type: number
 *           description: The id of the item to which the item option belongs
 *           example: 1
 *         files:
 *          type: array
 *          items:
 *            type: string
 *          description: The files of the option
 *          example: ["file1.png", "file2.png"]
 *       example:
 *         id: 1
 *         text: "Option 1"
 *         placement: 1
 *         itemId: 1
 *     Item:
 *       type: object
 *       required:
 *         - type
 *         - text
 *         - placement
 *         - groupId
 *         - enabled
 *       properties:
 *         id:
 *           type: number
 *           description: The auto-generated id of the item
 *           example: 1
 *         type:
 *           type: string
 *           enum: [TEXTBOX, CHECKBOX, RADIO, SELECT, SCALE, DATEBOX, NUMBERBOX, TIMEBOX]
 *           description: The type of the item
 *           example: "TEXTBOX"
 *         text:
 *           type: string
 *           description: The text/proposition of the item
 *           example: "Item 1"
 *         description:
 *           type: string
 *           description: The description of the item
 *           example: "This is item 1"
 *         placement:
 *           type: number
 *           description: The placement of the item in the group
 *           example: 1
 *         groupId:
 *           type: number
 *           description: The id of the group to which the item belongs
 *           example: 1
 *         enabled:
 *           type: boolean
 *           description: The enabled status of the item
 *           example: true
 *         files:
 *          type: array
 *          items:
 *            type: string
 *          description: The files of the protocol
 *          example: ["file1.png", "file2.png"]
 *         validations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ItemValidation'
 *         options:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ItemOption'
 *       example:
 *         id: 1
 *         type: "TEXTBOX"
 *         text: "Item 1"
 *         description: "This is item 1"
 *         placement: 1
 *         groupId: 1
 *         enabled: true
 *     ItemGroup:
 *       type: object
 *       required:
 *         - type
 *         - placement
 *         - isRepeatable
 *         - pageId
 *       properties:
 *         id:
 *           type: number
 *           description: The auto-generated id of the item group
 *           example: 1
 *         type:
 *           type: string
 *           enum: [ITEMS, TEXT_TABLE, CHECKBOX_TABLE]
 *           description: The type of the item group
 *           example: "ITEMS"
 *         placement:
 *           type: number
 *           description: The placement of the item group in the page
 *           example: 1
 *         isRepeatable:
 *           type: boolean
 *           description: The definition if the item group could be answered multiple times
 *           example: true
 *         pageId:
 *           type: number
 *           description: The id of the page to which the item group belongs
 *           example: 1
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Item'
 *       example:
 *         id: 1
 *         type: "ITEMS"
 *         placement: 1
 *         isRepeatable: true
 *         pageId: 1
 *     Page:
 *       type: object
 *       required:
 *         - type
 *         - placement
 *         - protocolId
 *       properties:
 *         id:
 *           type: number
 *           description: The auto-generated id of the page
 *           example: 1
 *         type:
 *           type: string
 *           enum: [ITEMS, SUBPROTOCOL]
 *           description: The type of the page
 *           example: "ITEMS"
 *         placement:
 *           type: number
 *           description: The placement of the page in the protocol
 *           example: 1
 *         protocolId:
 *           type: number
 *           description: The id of the protocol to which the page belongs
 *           example: 1
 *         itemGroups:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ItemGroup'
 *       example:
 *         id: 1
 *         type: "ITEMS"
 *         placement: 1
 *         protocolId: 1
 *     Protocol:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - enabled
 *       properties:
 *         id:
 *           type: number
 *           description: The auto-generated id of the protocol
 *           example: 1
 *         title:
 *           type: string
 *           description: The title of the protocol
 *           example: "Protocol 1"
 *         description:
 *           type: string
 *           description: The description of the protocol
 *           example: "This is protocol 1"
 *         enabled:
 *           type: boolean
 *           description: The enabled status of the protocol
 *           example: true
 *         pages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Page'
 *       example:
 *         id: 1
 *         title: "Protocol 1"
 *         description: "This is protocol 1"
 *         enabled: true
 */
const router = express.Router();

/**
 * @swagger
 * /api/protocol/createProtocol:
 *   post:
 *     summary: Create a new protocol
 *     tags: [Protocol]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Protocol'
 *     responses:
 *       201:
 *         description: The protocol was successfully created
 *         content:
 *           application/json:
 *             message: protocol created.
 *             data:
 *               $ref: '#/components/schemas/Protocol'
 *       400:
 *         description: The request was malformed or invalid
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: A server-side error occurred while creating the protocol
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.post('/createProtocol', passport.authenticate('jwt', { session: false }), uploader.any(), setLoggerLocals, createProtocol);

/**
 * @swagger
 * /api/protocol/replicateProtocol:
 *   post:
 *     summary: Replicate an existing protocol by id
 *     tags: [Protocol]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: number
 *                 description: The id of the protocol to replicate
 *                 example: 1
 *     responses:
 *       201:
 *         description: The protocol was successfully replicated
 *         content:
 *           application/json:
 *             message: protocol replicated.
 *             data:
 *               $ref: '#/components/schemas/Protocol'
 *       400:
 *         description: The request was malformed or invalid
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: A server-side error occurred while replicating the protocol
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.post('/replicateProtocol', passport.authenticate('jwt', { session: false }), uploader.any(), setLoggerLocals, replicateProtocol);

/**
 * @swagger
 * /api/protocol/updateProtocol/{protocolId}:
 *   put:
 *     summary: Update an existing protocol by id. All the fields are optional. Performs individual update on nested objects. The items passed with an id will be kept or updated, and the items passed without an id will be created. The items that are not passed will be deleted.
 *     tags: [Protocol]
 *     parameters:
 *       - in: path
 *         name: protocolId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the protocol to update
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Protocol'
 *     responses:
 *       200:
 *         description: The protocol was successfully updated
 *         content:
 *           application/json:
 *             message: protocol updated.
 *             data:
 *               $ref: '#/components/schemas/Protocol'
 *       400:
 *         description: The request was malformed/invalid or the protocol with the specified id was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: An server-side error occurred while updating the protocol
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.put(
    '/updateProtocol/:protocolId',
    passport.authenticate('jwt', { session: false }),
    uploader.any(),
    setLoggerLocals,
    updateProtocol
);

/**
 * @swagger
 * /api/protocol/getAllProtocols:
 *   get:
 *     summary: Get all protocols
 *     tags: [Protocol]
 *     responses:
 *       200:
 *         description: The list of protocols was successfully retrieved
 *         content:
 *           application/json:
 *             message: All protocols found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Protocol'
 *       500:
 *         description: An error occurred while retrieving the list of protocols
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get('/getAllProtocols', passport.authenticate('jwt', { session: false }), uploader.none(), setLoggerLocals, getAllProtocols);

/**
 * @swagger
 * /api/protocol/getMyProtocols:
 *   get:
 *     summary: Get all protocols of the user
 *     tags: [Protocol]
 *     responses:
 *       200:
 *         description: The list of protocols was successfully retrieved
 *         content:
 *           application/json:
 *             message: My protocols found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Protocol'
 *       500:
 *         description: An error occurred while retrieving the list of protocols
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get('/getMyProtocols', passport.authenticate('jwt', { session: false }), uploader.none(), setLoggerLocals, getMyProtocols);

/**
 * @swagger
 * /api/protocol/getVisibleProtocols:
 *   get:
 *     summary: Get all visible protocols
 *     tags: [Protocol]
 *     responses:
 *       200:
 *         description: The list of protocols was successfully retrieved
 *         content:
 *           application/json:
 *             message: Visible protocols found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Protocol'
 *       500:
 *         description: An error occurred while retrieving the list of protocols
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get('/getVisibleProtocols', passport.authenticate('jwt', { session: false }), uploader.none(), setLoggerLocals, getVisibleProtocols);

/**
 * @swagger
 * /api/protocol/getProtocolWithAnswers/{protocolId}:
 *   get:
 *     summary: Get an protocol by id with answers
 *     tags: [Protocol]
 *     parameters:
 *       - in: path
 *         name: protocolId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the protocol to retrieve
 *     responses:
 *       200:
 *         description: The protocol was successfully retrieved
 *         content:
 *           application/json:
 *             message: protocol found.
 *             data:
 *               $ref: '#/components/schemas/Protocol'
 *       400:
 *         description: An protocol with the specified id was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: An error occurred while retrieving the protocol
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get(
    '/getProtocolWithAnswers/:protocolId',
    passport.authenticate('jwt', { session: false }),
    uploader.none(),
    getProtocolWithAnswers
);

/**
 * @swagger
 * /api/protocol/getProtocol/{protocolId}:
 *   get:
 *     summary: Get an protocol by id
 *     tags: [Protocol]
 *     parameters:
 *       - in: path
 *         name: protocolId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the protocol to retrieve
 *     responses:
 *       200:
 *         description: The protocol was successfully retrieved
 *         content:
 *           application/json:
 *             message: protocol found.
 *             data:
 *               $ref: '#/components/schemas/Protocol'
 *       400:
 *         description: An protocol with the specified id was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: An error occurred while retrieving the protocol
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get('/getProtocol/:protocolId', passport.authenticate('jwt', { session: false }), uploader.none(), setLoggerLocals, getProtocol);

/**
 * @swagger
 * /api/protocol/deleteProtocol/{protocolId}:
 *   delete:
 *     summary: Delete an protocol by id
 *     tags: [Protocol]
 *     parameters:
 *       - in: path
 *         name: protocolId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The id of the protocol to delete
 *     responses:
 *       200:
 *         description: The protocol was successfully deleted
 *         content:
 *           application/json:
 *             message: protocol deleted.
 *             data:
 *               $ref: '#/components/schemas/Protocol'
 *       400:
 *         description: An protocol with the specified id was not found
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       500:
 *         description: An error occurred while deleting the protocol
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.delete(
    '/deleteProtocol/:protocolId',
    passport.authenticate('jwt', { session: false }),
    uploader.none(),
    setLoggerLocals,
    deleteProtocol
);

export default router;
