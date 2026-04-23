-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Client', 'Manager', 'Mechanic', 'Accountant', 'Admin');

-- CreateEnum
CREATE TYPE "PartFieldType" AS ENUM ('text', 'number', 'date', 'boolean');

-- CreateEnum
CREATE TYPE "BoxStatus" AS ENUM ('free', 'busy', 'maintenance');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('planned', 'in_progress', 'ready_for_delivery', 'completed', 'canceled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'transfer');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed');

-- DropView
DROP VIEW IF EXISTS "vw_order_detailed_summary";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "username" TYPE VARCHAR(50);
ALTER TABLE "User" ALTER COLUMN "email" TYPE VARCHAR(255);
ALTER TABLE "User" ALTER COLUMN "passwordHash" TYPE VARCHAR(255);
ALTER TABLE "User" ALTER COLUMN "phone" TYPE VARCHAR(32);
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";

-- AlterTable
ALTER TABLE "PartCategory" ALTER COLUMN "name" TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "Part" ALTER COLUMN "article" TYPE VARCHAR(100);
ALTER TABLE "Part" ALTER COLUMN "name" TYPE VARCHAR(255);
ALTER TABLE "Part" ALTER COLUMN "supplier" TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "PartCategoryField" ALTER COLUMN "fieldName" TYPE VARCHAR(255);
ALTER TABLE "PartCategoryField" ALTER COLUMN "fieldType" TYPE "PartFieldType" USING "fieldType"::"PartFieldType";

-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "name" TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "Box" ALTER COLUMN "boxNumber" TYPE VARCHAR(32);
ALTER TABLE "Box" ALTER COLUMN "status" TYPE "BoxStatus" USING "status"::"BoxStatus";

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::"OrderStatus";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'planned';

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING "paymentMethod"::"PaymentMethod";
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Vehicle" ALTER COLUMN "make" TYPE VARCHAR(100);
ALTER TABLE "Vehicle" ALTER COLUMN "model" TYPE VARCHAR(100);
ALTER TABLE "Vehicle" ALTER COLUMN "vin" TYPE VARCHAR(32);
ALTER TABLE "Vehicle" ALTER COLUMN "licensePlate" TYPE VARCHAR(32);

-- AddCheckConstraint
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_hourlyRate_non_negative" CHECK ("hourlyRate" >= 0);

-- AddCheckConstraint
ALTER TABLE "Part" ADD CONSTRAINT "Part_stockQuantity_non_negative" CHECK ("stockQuantity" >= 0);
ALTER TABLE "Part" ADD CONSTRAINT "Part_basePrice_non_negative" CHECK ("basePrice" >= 0);

-- AddCheckConstraint
ALTER TABLE "Service" ADD CONSTRAINT "Service_standardPrice_non_negative" CHECK ("standardPrice" >= 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_durationMinutes_positive" CHECK ("durationMinutes" >= 1);

-- AddCheckConstraint
ALTER TABLE "Box" ADD CONSTRAINT "Box_capacity_positive" CHECK ("capacity" >= 1);

-- AddCheckConstraint
UPDATE "Order" SET "totalDurationMinutes" = 60 WHERE "totalDurationMinutes" = 0;
ALTER TABLE "Order" ADD CONSTRAINT "Order_totalDurationMinutes_positive" CHECK ("totalDurationMinutes" IS NULL OR "totalDurationMinutes" >= 1);
ALTER TABLE "Order" ADD CONSTRAINT "Order_totalAmount_non_negative" CHECK ("totalAmount" >= 0);

-- AddCheckConstraint
ALTER TABLE "OrderService" ADD CONSTRAINT "OrderService_actualDurationMinutes_positive" CHECK ("actualDurationMinutes" IS NULL OR "actualDurationMinutes" >= 1);
ALTER TABLE "OrderService" ADD CONSTRAINT "OrderService_actualCost_non_negative" CHECK ("actualCost" IS NULL OR "actualCost" >= 0);

-- AddCheckConstraint
ALTER TABLE "OrderPart" ADD CONSTRAINT "OrderPart_quantity_positive" CHECK ("quantity" >= 1);
ALTER TABLE "OrderPart" ADD CONSTRAINT "OrderPart_unitPrice_non_negative" CHECK ("unitPrice" >= 0);

-- AddCheckConstraint
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_non_negative" CHECK ("amount" >= 0);

-- AddCheckConstraint
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_year_minimum" CHECK ("year" >= 1980);
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_kilometrage_non_negative" CHECK ("kilometrage" IS NULL OR "kilometrage" >= 0);

-- CreateView
CREATE VIEW "vw_order_detailed_summary" AS
SELECT o.id,
    o."orderDate",
    o.status,
    o."totalAmount",
    u.username AS client_name,
    u.email,
    v.make,
    v.model,
    v."licensePlate",
    b."boxNumber",
    count(DISTINCT os."serviceId") AS services_count,
    count(DISTINCT op."partId") AS parts_count,
    count(DISTINCT os."workerId") AS workers_count
   FROM "Order" o
   JOIN "Client" c ON o."clientId" = c.id
   JOIN "User" u ON c."userId" = u.id
   JOIN "Vehicle" v ON o."vehicleId" = v.id
   JOIN "Box" b ON o."boxId" = b.id
   LEFT JOIN "OrderService" os ON o.id = os."orderId"
   LEFT JOIN "OrderPart" op ON o.id = op."orderId"
  GROUP BY o.id, u.username, u.email, v.make, v.model, v."licensePlate", b."boxNumber";
