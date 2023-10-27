/*
  Warnings:

  - You are about to drop the `ProtocolOwner` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_groupId_fkey";

-- DropForeignKey
ALTER TABLE "ItemGroup" DROP CONSTRAINT "ItemGroup_pageId_fkey";

-- DropForeignKey
ALTER TABLE "ItemOption" DROP CONSTRAINT "ItemOption_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Page" DROP CONSTRAINT "Page_protocolId_fkey";

-- DropForeignKey
ALTER TABLE "ProtocolOwner" DROP CONSTRAINT "ProtocolOwner_protocol_id_fkey";

-- DropForeignKey
ALTER TABLE "ProtocolOwner" DROP CONSTRAINT "ProtocolOwner_userId_fkey";

-- DropTable
DROP TABLE "ProtocolOwner";

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
ALTER TABLE "Page" ADD CONSTRAINT "Page_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGroup" ADD CONSTRAINT "ItemGroup_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ItemGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOption" ADD CONSTRAINT "ItemOption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProtocolToUser" ADD CONSTRAINT "_ProtocolToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProtocolToUser" ADD CONSTRAINT "_ProtocolToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
