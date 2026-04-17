-- LocateFlow MySQL 8.0 initialization
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

ALTER DATABASE locateflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant all privileges to the app user
GRANT ALL PRIVILEGES ON locateflow.* TO 'locateflow'@'%';
FLUSH PRIVILEGES;
