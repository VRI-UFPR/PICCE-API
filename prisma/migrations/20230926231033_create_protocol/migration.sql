-- CreateEnum
CREATE TYPE "Page_type" AS ENUM ('ITEMS', 'SUBPROTOCOL');

-- CreateEnum
CREATE TYPE "Item_group_type" AS ENUM ('SINGLE_ITEM', 'MULTIPLE_ITEMS', 'TABLE');

-- CreateEnum
CREATE TYPE "Item_type" AS ENUM ('TEXTBOX', 'CHECKBOX', 'RADIO', 'SELECT');

-- CreateTable
CREATE TABLE "Protocol" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL,

    CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "type" "Page_type" NOT NULL,
    "placement" INTEGER NOT NULL,
    "protocol_id" INTEGER NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protocol_owner" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "protocol_id" INTEGER NOT NULL,

    CONSTRAINT "Protocol_owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item_group" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "type" "Item_group_type" NOT NULL,
    "placement" INTEGER NOT NULL,
    "isRepeatable" BOOLEAN NOT NULL,
    "page_id" INTEGER NOT NULL,

    CONSTRAINT "Item_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "text" TEXT NOT NULL,
    "description" TEXT,
    "type" "Item_type" NOT NULL,
    "placement" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "group_id" INTEGER NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item_option" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "text" TEXT NOT NULL,
    "placement" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,

    CONSTRAINT "Item_option_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "Protocol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol_owner" ADD CONSTRAINT "Protocol_owner_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "Protocol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item_group" ADD CONSTRAINT "Item_group_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Item_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item_option" ADD CONSTRAINT "Item_option_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
