-- One-time data fix: move iPad assets out of Desktop category
-- Safe behavior:
-- 1) Creates iPad category only if missing
-- 2) Updates only assets that look like iPad and are currently Desktop-like

INSERT INTO CATEGORY (Category)
SELECT 'iPad'
WHERE NOT EXISTS (
  SELECT 1 FROM CATEGORY WHERE LOWER(Category) = 'ipad'
);

SET @ipad_category_id := (
  SELECT Category_ID
  FROM CATEGORY
  WHERE LOWER(Category) = 'ipad'
  ORDER BY Category_ID ASC
  LIMIT 1
);

UPDATE ASSET a
LEFT JOIN MODEL m ON m.Model_ID = a.Model_ID
LEFT JOIN CATEGORY c ON c.Category_ID = a.Category_ID
SET a.Category_ID = @ipad_category_id
WHERE (
  LOWER(COALESCE(a.Item_Name, '')) LIKE '%ipad%'
  OR LOWER(COALESCE(m.Model_Name, '')) LIKE '%ipad%'
)
AND LOWER(COALESCE(c.Category, '')) IN ('desktop', 'desktop/aio', 'komputer meja', 'computer');

-- Optional verification query:
-- SELECT a.Asset_ID, a.Asset_Tag_ID, a.Item_Name, m.Model_Name, c.Category
-- FROM ASSET a
-- LEFT JOIN MODEL m ON m.Model_ID = a.Model_ID
-- LEFT JOIN CATEGORY c ON c.Category_ID = a.Category_ID
-- WHERE LOWER(COALESCE(a.Item_Name, '')) LIKE '%ipad%'
--    OR LOWER(COALESCE(m.Model_Name, '')) LIKE '%ipad%';
