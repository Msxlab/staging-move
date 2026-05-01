-- ==========================================================================
-- Blog system (M14)
-- ==========================================================================
-- Public-facing content surface. Source of truth lives in MySQL so the
-- admin can edit/schedule/translate posts without code deploys, and the
-- same data feeds /blog (web), the mobile Blog tab, the homepage
-- "Latest" section, and /llms.txt for AI crawlers.
--
-- Locale is constrained to en|es at the application layer (US-only
-- launch). The (slug, locale) unique pair lets the same article live
-- in both languages without slug collisions; hreflang alternates link
-- the two together.
--
-- Security:
--   * `contentJson` holds the editor's Tiptap output (canonical).
--   * `contentHtml` is what the server actually renders — written only
--     after sanitize-html + DOMPurify whitelist on the server.
--   * `contentText` is plain text for search indexing and AI crawlers.
-- All three are written together inside the publish transaction; we
-- never trust client-supplied HTML.

-- ----------------------- BlogCategory ------------------------------------
CREATE TABLE `BlogCategory` (
  `id`          VARCHAR(30)  NOT NULL,
  `slug`        VARCHAR(100) NOT NULL,
  `locale`      VARCHAR(8)   NOT NULL DEFAULT 'en',
  `name`        VARCHAR(100) NOT NULL,
  `description` VARCHAR(500) NULL,
  `order`       INTEGER      NOT NULL DEFAULT 0,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL,

  UNIQUE INDEX `BlogCategory_slug_locale_key` (`slug`, `locale`),
  INDEX `BlogCategory_locale_order_idx` (`locale`, `order`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ----------------------- BlogTag -----------------------------------------
CREATE TABLE `BlogTag` (
  `id`        VARCHAR(30)  NOT NULL,
  `slug`      VARCHAR(100) NOT NULL,
  `locale`    VARCHAR(8)   NOT NULL DEFAULT 'en',
  `name`      VARCHAR(100) NOT NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL,

  UNIQUE INDEX `BlogTag_slug_locale_key` (`slug`, `locale`),
  INDEX `BlogTag_locale_idx` (`locale`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ----------------------- BlogPost ----------------------------------------
CREATE TABLE `BlogPost` (
  `id`             VARCHAR(30)  NOT NULL,
  `slug`           VARCHAR(191) NOT NULL,
  `locale`         VARCHAR(8)   NOT NULL DEFAULT 'en',
  `title`          VARCHAR(200) NOT NULL,
  `excerpt`        VARCHAR(500) NOT NULL,
  `contentJson`    JSON         NOT NULL,
  `contentHtml`    LONGTEXT     NOT NULL,
  `contentText`    LONGTEXT     NOT NULL,
  `readingMinutes` INTEGER      NOT NULL DEFAULT 3,

  -- SEO
  `seoTitle`       VARCHAR(200) NULL,
  `seoDescription` VARCHAR(320) NULL,
  `canonicalUrl`   VARCHAR(500) NULL,
  `noIndex`        BOOLEAN      NOT NULL DEFAULT false,
  `ogImageKey`     VARCHAR(500) NULL,
  `ogImageAlt`     VARCHAR(200) NULL,

  -- Lifecycle
  `status`      ENUM('DRAFT','SCHEDULED','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `publishedAt` DATETIME(3) NULL,
  `scheduledAt` DATETIME(3) NULL,

  -- Authorship + taxonomy
  `authorId`   VARCHAR(30) NOT NULL,
  `categoryId` VARCHAR(30) NULL,

  -- Lightweight stats (denormalized — heavy queries hit BlogView)
  `viewCount`  INTEGER NOT NULL DEFAULT 0,
  `shareCount` INTEGER NOT NULL DEFAULT 0,

  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  UNIQUE INDEX `BlogPost_slug_locale_key` (`slug`, `locale`),
  INDEX `BlogPost_status_publishedAt_idx` (`status`, `publishedAt`),
  INDEX `BlogPost_locale_status_publishedAt_idx` (`locale`, `status`, `publishedAt`),
  INDEX `BlogPost_categoryId_idx` (`categoryId`),
  INDEX `BlogPost_scheduledAt_idx` (`scheduledAt`),
  INDEX `BlogPost_authorId_idx` (`authorId`),
  INDEX `BlogPost_deletedAt_idx` (`deletedAt`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ----------------------- BlogPostTag (M2M join) --------------------------
CREATE TABLE `BlogPostTag` (
  `postId` VARCHAR(30) NOT NULL,
  `tagId`  VARCHAR(30) NOT NULL,

  INDEX `BlogPostTag_tagId_idx` (`tagId`),

  PRIMARY KEY (`postId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ----------------------- BlogRevision ------------------------------------
-- Snapshot of every save — lets editors roll back, gives admin a
-- changelog for moderation. Cron prunes after 90 days for inactive
-- posts to keep the table small (handled by cron/blog-cleanup).
CREATE TABLE `BlogRevision` (
  `id`          VARCHAR(30)  NOT NULL,
  `postId`      VARCHAR(30)  NOT NULL,
  `authorId`    VARCHAR(30)  NOT NULL,
  `title`       VARCHAR(200) NOT NULL,
  `contentJson` JSON         NOT NULL,
  `note`        VARCHAR(500) NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `BlogRevision_postId_createdAt_idx` (`postId`, `createdAt`),
  INDEX `BlogRevision_authorId_idx` (`authorId`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ----------------------- BlogView ----------------------------------------
-- Privacy-friendly analytics. IP is hashed with a daily-rotating salt
-- so we cannot reconstruct visitor identity. The `isBot` column lets
-- the admin dashboard split organic / AI / scraper traffic without
-- storing raw user-agents long-term (cron purges after 90 days).
CREATE TABLE `BlogView` (
  `id`        VARCHAR(30)  NOT NULL,
  `postId`    VARCHAR(30)  NOT NULL,
  `ipHash`    VARCHAR(64)  NOT NULL,
  `userAgent` VARCHAR(300) NULL,
  `referrer`  VARCHAR(500) NULL,
  `locale`    VARCHAR(8)   NULL,
  `isBot`     BOOLEAN      NOT NULL DEFAULT false,
  `viewDay`   VARCHAR(10)  NOT NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `BlogView_postId_createdAt_idx` (`postId`, `createdAt`),
  INDEX `BlogView_createdAt_idx` (`createdAt`),
  UNIQUE INDEX `BlogView_postId_ipHash_viewDay_key` (`postId`, `ipHash`, `viewDay`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ----------------------- Foreign keys ------------------------------------
ALTER TABLE `BlogPost`
  ADD CONSTRAINT `BlogPost_authorId_fkey`
    FOREIGN KEY (`authorId`) REFERENCES `AdminUser`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `BlogPost_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `BlogCategory`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BlogPostTag`
  ADD CONSTRAINT `BlogPostTag_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `BlogPost`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BlogPostTag_tagId_fkey`
    FOREIGN KEY (`tagId`) REFERENCES `BlogTag`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BlogRevision`
  ADD CONSTRAINT `BlogRevision_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `BlogPost`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BlogRevision_authorId_fkey`
    FOREIGN KEY (`authorId`) REFERENCES `AdminUser`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BlogView`
  ADD CONSTRAINT `BlogView_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `BlogPost`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing admin accounts predate the `blog` resource. Runtime auth
-- fails closed when a permission row is missing, so backfill the new
-- resource in the same shape as apps/admin/src/lib/admin-permissions.ts.
INSERT IGNORE INTO `AdminPermission` (
  `id`,
  `adminUserId`,
  `resource`,
  `canRead`,
  `canCreate`,
  `canUpdate`,
  `canDelete`
)
SELECT
  CONCAT('perm_', SUBSTRING(SHA2(CONCAT(`id`, ':blog'), 256), 1, 24)),
  `id`,
  'blog',
  true,
  CASE WHEN `role` IN ('SUPER_ADMIN', 'ADMIN', 'MODERATOR') THEN true ELSE false END,
  CASE WHEN `role` IN ('SUPER_ADMIN', 'ADMIN', 'MODERATOR') THEN true ELSE false END,
  CASE WHEN `role` IN ('SUPER_ADMIN', 'ADMIN') THEN true ELSE false END
FROM `AdminUser`;
