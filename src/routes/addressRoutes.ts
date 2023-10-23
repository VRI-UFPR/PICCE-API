import express from 'express';
import uploader from '../services/multerUploader';
import { createAddress, updateAddress, getAllAddresses, getAddress, deleteAddress } from '../controllers/addressController';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Address:
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
 *             $ref: '#/components/schemas/Address'
 *     responses:
 *       201:
 *         description: The address was successfully created
 *         content:
 *           application/json:
 *             message: Address created.
 *             data:
 *               $ref: '#/components/schemas/Address'
 *       400:
 *         description: Some required fields are missing or the address already exists
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
router.post('/createAddress', uploader.none(), createAddress);

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
 *             $ref: '#/components/schemas/Address'
 *     responses:
 *       200:
 *         description: The address was successfully updated
 *         content:
 *           application/json:
 *             message: Address updated.
 *             data:
 *               $ref: '#/components/schemas/Address'
 *       400:
 *         description: Some required fields are missing
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 *       404:
 *         description: The address was not found
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
router.put('/updateAddress/:addressId', uploader.none(), updateAddress);

/**
 * @swagger
 * /api/address/getAllAddresss:
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
 *                 $ref: '#/components/schemas/Address'
 *       500:
 *         description: Some server error happened
 *         content:
 *           application/json:
 *             error:
 *               type: string
 *               description: Error message
 */
router.get('/getAllAddresss', uploader.none(), getAllAddresses);

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
 *               $ref: '#/components/schemas/Address'
 *       404:
 *         description: The address was not found
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
router.get('/getAddress/:addressId', uploader.none(), getAddress);

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
router.delete('/deleteAddress/:addressId', uploader.none(), deleteAddress);

export default router;
