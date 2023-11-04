-- CreateEnum
CREATE TYPE "ItemValidationType" AS ENUM ('MANDATORY', 'MIN', 'MAX', 'MAX_ANSWERS');

-- CreateTable
CREATE TABLE "ItemValidation" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "type" "ItemValidationType" NOT NULL,
    "argument" TEXT NOT NULL,
    "customMessage" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,

    CONSTRAINT "ItemValidation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ItemValidation" ADD CONSTRAINT "ItemValidation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
