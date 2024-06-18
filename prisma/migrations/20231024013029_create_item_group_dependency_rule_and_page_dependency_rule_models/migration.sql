/*
  Warnings:

  - You are about to drop the `ProtocolOwner` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('EXACT_ANSWER', 'OPTION_SELECTED', 'MIN_SELECTED');

-- DropForeignKey
ALTER TABLE "ProtocolOwner" DROP CONSTRAINT "ProtocolOwner_protocol_id_fkey";

-- DropForeignKey
ALTER TABLE "ProtocolOwner" DROP CONSTRAINT "ProtocolOwner_userId_fkey";

-- DropTable
DROP TABLE "ProtocolOwner";

-- CreateTable
CREATE TABLE "ItemGroupDependencyRule" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "type" "DependencyType" NOT NULL,
    "argument" TEXT NOT NULL,
    "customMessage" TEXT,
    "itemGroupId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,

    CONSTRAINT "ItemGroupDependencyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageDependencyRule" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "type" "DependencyType" NOT NULL,
    "argument" TEXT NOT NULL,
    "customMessage" TEXT,
    "pageId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,

    CONSTRAINT "PageDependencyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProtocolToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ProtocolToUser_AB_unique" ON "_ProtocolToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_ProtocolToUser_B_index" ON "_ProtocolToUser"("B");

-- AddForeignKey
ALTER TABLE "ItemGroupDependencyRule" ADD CONSTRAINT "ItemGroupDependencyRule_itemGroupId_fkey" FOREIGN KEY ("itemGroupId") REFERENCES "ItemGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGroupDependencyRule" ADD CONSTRAINT "ItemGroupDependencyRule_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageDependencyRule" ADD CONSTRAINT "PageDependencyRule_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageDependencyRule" ADD CONSTRAINT "PageDependencyRule_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProtocolToUser" ADD CONSTRAINT "_ProtocolToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProtocolToUser" ADD CONSTRAINT "_ProtocolToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
