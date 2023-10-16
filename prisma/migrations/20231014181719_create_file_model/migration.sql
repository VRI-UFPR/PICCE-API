-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,
    "path" TEXT NOT NULL,
    "itemId" INTEGER,
    "itemOptionId" INTEGER,
    "itemAnswerId" INTEGER,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_itemOptionId_fkey" FOREIGN KEY ("itemOptionId") REFERENCES "ItemOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_itemAnswerId_fkey" FOREIGN KEY ("itemAnswerId") REFERENCES "ItemAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
