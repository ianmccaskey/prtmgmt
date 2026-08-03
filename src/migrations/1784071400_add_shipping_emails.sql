-- Dedicated sender emails for Shippo labels. USPS Ground Advantage refuses
-- label purchases without address_from.email; Ian explicitly does NOT want
-- the UI Bakery login email used, so each sender block carries its own:
-- the user's personal label return address and the warehouse ship-from.
ALTER TABLE user_profiles ADD COLUMN label_return_email TEXT;
ALTER TABLE warehouses ADD COLUMN ship_from_email TEXT;
