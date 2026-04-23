# External Data Import

This folder contains a standalone import script that pulls real public automotive data into the existing schema without changing the database structure.

Sources used:
- Abhionlyone US car models CSV dataset for vehicles
- Wikipedia `List_of_auto_parts` for part/category names
- Wikipedia `List_of_current_automotive_parts_suppliers` for supplier names
- Wikipedia `Service (motor vehicle)` for maintenance/service names
- Wikipedia `Maintenance`
- Wikipedia `Operational maintenance`

What it seeds:
- `Vehicle`
- `PartCategory`
- `Part`
- `Service`
- `Order`
- `OrderService`
- `OrderPart`
- `Payment`
- plus demo `Client`/`User` rows and boxes needed to attach the imported vehicles

Run it from `backend`:

```bash
tsx src/tools/external-data-import/index.ts
```

You can also trigger the same import from the admin panel with the new `Імпортувати демодані` button.

The script is idempotent for the demo clients, boxes, categories, and unique vehicle/part keys.
