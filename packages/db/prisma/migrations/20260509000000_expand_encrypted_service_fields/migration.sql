ALTER TABLE `Service`
    MODIFY `accountNumber` TEXT NULL,
    MODIFY `username` TEXT NULL,
    MODIFY `phone` TEXT NULL,
    MODIFY `email` TEXT NULL;

ALTER TABLE `Address`
    MODIFY `formattedAddress` TEXT NULL;
