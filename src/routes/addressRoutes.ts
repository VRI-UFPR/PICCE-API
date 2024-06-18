import express from 'express';
import uploader from '../services/multerUploader';
import { createAddress, updateAddress, getAllAddresses, getAddress, deleteAddress } from '../controllers/addressController';
import passport from '../services/passportAuth';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateAddress:
 *      type: object
 *      required:
 *        - city
 *        - state
 *        - country
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the address
 *          example: 1
 *        city:
 *          type: string
 *          description: The city of the address
 *          example: "New York"
 *        state:
 *          type: string
 *          description: The state of the address
 *          example: "New York"
 *        country:
 *          type: string
 *          description: The country of the address
 *          example: "USA"
 *     UpdateGetAddress:
 *      type: object
 *      properties:
 *        id:
 *          type: integer
 *          description: The auto-generated id of the address
 *          example: 1
 *        city:
 *          type: string
 *          description: The city of the address
 *          example: "New York"
 *        state:
 *          type: string
 *          description: The state of the address
 *          example: "New York"
 *        country:
 *          type: string
 *          description: The country of the address
 *          example: "USA"
 */

/**
 * @swagger
 * /api/address/createAddress:
 *   post:
 *     summary: Create a new address
 *     tags: [Address]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CreateAddress'
 *     responses:
 *       201:
 *         description: The address was successfully created
 *         content:
 *           application/json:
 *             message: Address created.
 *             data:
 *               $ref: '#/components/schemas/UpdateGetAddress'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad request.
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.post('/createAddress', passport.authenticate('jwt', { session: false }), uploader.none(), createAddress);

/**
 * @swagger
 * /api/address/updateAddress/{addressId}:
 *   put:
 *     summary: Update an existing address
 *     tags: [Address]
 *     parameters:
 *       - in: path
 *         name: addressId
 *         schema:
 *           type: integer
 *           required: true
 *           description: The address id
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateGetAddress'
 *     responses:
 *       200:
 *         description: The address was successfully updated
 *         content:
 *           application/json:
 *             message: Address updated.
 *             data:
 *               $ref: '#/components/schemas/UpdateGetAddress'
 *       400:
 *         description: Request data validation failed
 *         content:
 *           application/json:
 *             error:
 *               message: Bad request.
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.put('/updateAddress/:addressId', passport.authenticate('jwt', { session: false }), uploader.none(), updateAddress);

/**
 * @swagger
 * /api/address/getAllAddresses:
 *   get:
 *     summary: Get all addresses
 *     tags: [Address]
 *     responses:
 *       200:
 *         description: The list of all addresses
 *         content:
 *           application/json:
 *             message: All addresses found.
 *             data:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UpdateGetAddress'
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.get('/getAllAddresses', passport.authenticate('jwt', { session: false }), uploader.none(), getAllAddresses);

/**
 * @swagger
 * /api/address/getAddress/{addressId}:
 *   get:
 *     summary: Get address by id
 *     tags: [Address]
 *     parameters:
 *       - in: path
 *         name: addressId
 *         schema:
 *           type: integer
 *           required: true
 *           description: The address id
 *     responses:
 *       200:
 *         description: The address description by id
 *         content:
 *           application/json:
 *             message: Address found.
 *             data:
 *               $ref: '#/components/schemas/UpdateGetAddress'
 *       404:
 *         description: The address was not found
 *         content:
 *           application/json:
 *             error:
 *               message: Address not found.
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.get('/getAddress/:addressId', passport.authenticate('jwt', { session: false }), uploader.none(), getAddress);

/**
 * @swagger
 * /api/address/deleteAddress/{addressId}:
 *   delete:
 *     summary: Remove the address by id
 *     tags: [Address]
 *     parameters:
 *       - in: path
 *         name: addressId
 *         schema:
 *           type: integer
 *           required: true
 *           description: The address id
 *     responses:
 *       200:
 *         description: The address was deleted
 *         content:
 *           application/json:
 *             message: Address deleted.
 *             data:
 *               $ref: '#/components/schemas/Address'
 *       404:
 *         description: The address was not found
 *         content:
 *           application/json:
 *             error:
 *               message: Address not found.
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               message: Internal server error.
 */
router.delete('/deleteAddress/:addressId', passport.authenticate('jwt', { session: false }), uploader.none(), deleteAddress);

export default router;
