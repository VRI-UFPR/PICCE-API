-- DropForeignKey
ALTER TABLE "ApplicationAnswer" DROP CONSTRAINT "ApplicationAnswer_userId_fkey";

-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_groupId_fkey";

-- DropForeignKey
ALTER TABLE "ItemAnswer" DROP CONSTRAINT "ItemAnswer_itemId_fkey";

-- DropForeignKey
ALTER TABLE "ItemGroup" DROP CONSTRAINT "ItemGroup_pageId_fkey";

-- DropForeignKey
ALTER TABLE "ItemOption" DROP CONSTRAINT "ItemOption_itemId_fkey";

-- DropForeignKey
ALTER TABLE "OptionAnswer" DROP CONSTRAINT "OptionAnswer_itemId_fkey";

-- DropForeignKey
ALTER TABLE "OptionAnswer" DROP CONSTRAINT "OptionAnswer_optionId_fkey";

-- DropForeignKey
ALTER TABLE "Page" DROP CONSTRAINT "Page_protocolId_fkey";

-- DropForeignKey
ALTER TABLE "TableAnswer" DROP CONSTRAINT "TableAnswer_columnId_fkey";

-- DropForeignKey
ALTER TABLE "TableAnswer" DROP CONSTRAINT "TableAnswer_itemId_fkey";

-- DropForeignKey
ALTER TABLE "TableColumn" DROP CONSTRAINT "TableColumn_groupId_fkey";

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAnswer" ADD CONSTRAINT "ItemAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionAnswer" ADD CONSTRAINT "OptionAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionAnswer" ADD CONSTRAINT "OptionAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ItemOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAnswer" ADD CONSTRAINT "TableAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAnswer" ADD CONSTRAINT "TableAnswer_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "TableColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGroup" ADD CONSTRAINT "ItemGroup_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ItemGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOption" ADD CONSTRAINT "ItemOption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableColumn" ADD CONSTRAINT "TableColumn_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ItemGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
