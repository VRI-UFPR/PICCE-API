/*
  Warnings:

  - You are about to drop the `ProtocolOwner` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProtocolOwner" DROP CONSTRAINT "ProtocolOwner_protocolId_fkey";

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
ALTER TABLE "_ProtocolToUser" ADD CONSTRAINT "_ProtocolToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProtocolToUser" ADD CONSTRAINT "_ProtocolToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
