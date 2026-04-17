-- F.7: composite indexes for frequent query patterns
CREATE INDEX `Address_userId_zip_idx` ON `Address`(`userId`, `zip`);
CREATE INDEX `Service_userId_addressId_isActive_idx` ON `Service`(`userId`, `addressId`, `isActive`);
