-- Indexes used by the application and analytics queries
CREATE INDEX IF NOT EXISTS idx_user_phone ON "User"(phone);
CREATE INDEX IF NOT EXISTS idx_vehicle_vin_license ON "Vehicle"(vin, "licensePlate");
CREATE INDEX IF NOT EXISTS idx_order_main ON "Order"("orderDate", status, "clientId");
CREATE INDEX IF NOT EXISTS idx_order_box_date ON "Order"("boxId", "orderDate");
CREATE INDEX IF NOT EXISTS idx_order_part_part_id ON "OrderPart"("partId");

-- Stock synchronization for order parts.
CREATE OR REPLACE FUNCTION trg_sync_stock_on_order_part()
RETURNS TRIGGER AS $$
DECLARE
    v_previous_quantity INT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE "Part"
        SET "stockQuantity" = GREATEST(0, "stockQuantity" - NEW.quantity)
        WHERE id = NEW."partId";

        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        v_previous_quantity := COALESCE(OLD.quantity, 0);

        IF NEW."partId" = OLD."partId" THEN
            UPDATE "Part"
            SET "stockQuantity" = GREATEST(0, "stockQuantity" + v_previous_quantity - NEW.quantity)
            WHERE id = NEW."partId";
        ELSE
            UPDATE "Part"
            SET "stockQuantity" = "stockQuantity" + v_previous_quantity
            WHERE id = OLD."partId";

            UPDATE "Part"
            SET "stockQuantity" = GREATEST(0, "stockQuantity" - NEW.quantity)
            WHERE id = NEW."partId";
        END IF;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE "Part"
        SET "stockQuantity" = "stockQuantity" + OLD.quantity
        WHERE id = OLD."partId";

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS TRG_update_stock_after_order_part ON "OrderPart";
CREATE TRIGGER TRG_sync_stock_after_order_part
AFTER INSERT OR UPDATE OR DELETE ON "OrderPart"
FOR EACH ROW
EXECUTE FUNCTION trg_sync_stock_on_order_part();

-- Order total and duration recalculation.
CREATE OR REPLACE FUNCTION trg_calculate_order_total()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id INT;
BEGIN
    v_order_id := COALESCE(NEW."orderId", OLD."orderId");

    UPDATE "Order"
    SET
        "totalAmount" = (
            SELECT COALESCE(SUM(os."actualCost"), 0) FROM "OrderService" os
            WHERE os."orderId" = v_order_id
        ) + (
            SELECT COALESCE(SUM(op.quantity * op."unitPrice"), 0) FROM "OrderPart" op
            WHERE op."orderId" = v_order_id
        ),
        "totalDurationMinutes" = (
            SELECT COALESCE(SUM(os."actualDurationMinutes"), 0)
            FROM "OrderService" os
            WHERE os."orderId" = v_order_id
        )
    WHERE id = v_order_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS TRG_calculate_order_total_services ON "OrderService";
CREATE TRIGGER TRG_calculate_order_total_services
AFTER INSERT OR UPDATE OR DELETE ON "OrderService"
FOR EACH ROW
EXECUTE FUNCTION trg_calculate_order_total();

DROP TRIGGER IF EXISTS TRG_calculate_order_total_parts ON "OrderPart";
CREATE TRIGGER TRG_calculate_order_total_parts
AFTER INSERT OR UPDATE OR DELETE ON "OrderPart"
FOR EACH ROW
EXECUTE FUNCTION trg_calculate_order_total();

-- Box reservation helper that mirrors the application-side overlap logic.
CREATE OR REPLACE FUNCTION PROC_reserve_box_and_time(
    p_box_id INT,
    p_start_time TIMESTAMP,
    p_duration_minutes INT DEFAULT 60,
    p_exclude_order_id INT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Order"
        WHERE "boxId" = p_box_id
          AND status IN ('planned', 'in_progress', 'ready_for_delivery', 'completed')
          AND (p_exclude_order_id IS NULL OR id <> p_exclude_order_id)
          AND p_start_time < ("startTime" + (COALESCE("totalDurationMinutes", p_duration_minutes) || ' minutes')::interval)
          AND (p_start_time + (p_duration_minutes || ' minutes')::interval) > "startTime"
    ) THEN
        RAISE EXCEPTION 'Box is already reserved at this time';
    END IF;

    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Summary view for order detail/reporting screens.
DROP VIEW IF EXISTS vw_order_detailed_summary;

CREATE OR REPLACE VIEW vw_order_detailed_summary AS
SELECT
    o.id,
    o."orderDate",
    o.status,
    o."totalAmount",
    o."totalDurationMinutes",
    u.username AS client_name,
    u.email,
    v.make,
    v.model,
    v."licensePlate",
    b."boxNumber",
    COUNT(DISTINCT os."serviceId") AS services_count,
    COUNT(DISTINCT op."partId") AS parts_count,
    COUNT(DISTINCT os."workerId") AS workers_count,
    COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS collected_amount,
    COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'pending'), 0) AS pending_amount,
    COUNT(DISTINCT p.id) AS payments_count
FROM "Order" o
JOIN "Client" c ON o."clientId" = c.id
JOIN "User" u ON c."userId" = u.id
JOIN "Vehicle" v ON o."vehicleId" = v.id
JOIN "Box" b ON o."boxId" = b.id
LEFT JOIN "OrderService" os ON o.id = os."orderId"
LEFT JOIN "OrderPart" op ON o.id = op."orderId"
LEFT JOIN "Payment" p ON o.id = p."orderId"
GROUP BY o.id, o."orderDate", o.status, o."totalAmount", o."totalDurationMinutes", u.username, u.email, v.make, v.model, v."licensePlate", b."boxNumber";
