-- Check column defaults on Orders
SELECT column_name, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Orders' 
  AND column_name IN ('Governorate', 'Area', 'StreetBuilding', 'AddressLine');

-- Check column defaults on UserAddresses
SELECT column_name, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'UserAddresses' 
  AND column_name IN ('Governorate', 'Area', 'StreetBuilding', 'AddressLine');

-- Check column defaults on Shipments
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'Shipments' 
  AND column_name = 'CodAmount';

-- Check FK_UserConsents_Users_UserId confdeltype ('r' = RESTRICT, 'c' = CASCADE, 'a' = NO ACTION)
SELECT conname, confdeltype 
FROM pg_constraint 
WHERE conname = 'FK_UserConsents_Users_UserId';
