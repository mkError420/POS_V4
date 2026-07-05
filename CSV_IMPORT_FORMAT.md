# CSV Import Format for Products

## Required Columns
- **Product Name** - The name of the product
- **SKU** - Unique stock keeping unit code
- **Cost Price** - Purchase cost per unit (must be greater than 0)
- **Sale Price** - Selling price per unit (must be greater than 0)

## Optional Columns
- **Stock Quantity** - Initial stock quantity (default: 0)
- **Low Stock Threshold** - Alert threshold for low stock (default: 10)
- **Expiry Date** - Product expiry date in YYYY-MM-DD format
- **Supplier ID** - ID of the supplier (must exist in your suppliers list)
- **Unit** - Unit of measurement (default: piece)
  - Options: piece, kg, gm, liter, packet

## Example CSV File

```csv
Product Name,SKU,Cost Price,Sale Price,Stock Quantity,Low Stock Threshold,Expiry Date,Supplier ID,Unit
Rice Basmati,SKU001,45.00,55.00,100,10,2025-12-31,1,kg
Sugar Premium,SKU002,38.00,45.00,50,5,,2,kg
Cooking Oil,SKU003,120.00,150.00,30,10,2026-06-30,1,liter
Milk Fresh,SKU004,60.00,75.00,20,5,2025-07-10,,liter
Bread Whole Wheat,SKU005,25.00,35.00,40,8,2025-07-08,3,piece
Tea Leaves,SKU006,180.00,220.00,15,5,,1,packet
Salt Iodized,SKU007,12.00,18.00,200,20,,2,packet
Soap Bar,SKU008,35.00,45.00,60,10,2026-01-15,3,piece
Toothpaste,SKU009,45.00,60.00,40,8,2025-09-20,3,piece
Shampoo Bottle,SKU010,85.00,110.00,25,5,2026-03-10,3,piece
```

## Important Notes

1. **Column Names**: Column names are case-insensitive. You can use:
   - `Product Name` or `name`
   - `SKU` or `sku`
   - `Cost Price` or `cost_price`
   - `Sale Price` or `price`
   - `Stock Quantity` or `quantity` or `stock`
   - `Low Stock Threshold` or `low_stock_threshold`
   - `Expiry Date` or `expiry_date`
   - `Supplier ID` or `supplier_id`
   - `Unit` or `unit`

2. **Required Fields**: Product Name, SKU, Cost Price, and Sale Price are mandatory and cannot be empty.

3. **Price Values**: Both Cost Price and Sale Price must be greater than 0.

4. **SKU Uniqueness**: Each SKU must be unique within your shop. Duplicate SKUs will be skipped with an error.

5. **Date Format**: Expiry dates should be in YYYY-MM-DD format (e.g., 2025-12-31).

6. **Supplier ID**: The Supplier ID must correspond to an existing supplier in your system. Leave empty if not applicable.

7. **Empty Cells**: Optional columns can be left empty. The system will use default values.

## Common Errors and Solutions

| Error | Solution |
|-------|----------|
| "Missing required fields" | Ensure Product Name, SKU, Cost Price, and Sale Price are filled |
| "Invalid price (must be > 0)" | Ensure both Cost Price and Sale Price are positive numbers |
| "SKU already exists" | Use a unique SKU for each product or update existing product instead |
| "CSV must contain columns" | Check that your CSV has the required column headers |

## Tips for Successful Import

1. Save your CSV file with UTF-8 encoding
2. Remove any special characters from product names if possible
3. Test with a small batch (2-3 products) first
4. Check the error messages after upload to identify specific issues
5. Export your existing catalog first to see the correct format
