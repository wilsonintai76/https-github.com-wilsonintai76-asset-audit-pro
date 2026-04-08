-- Create a temporary table to store the mappings from duplicate to canonical IDs
CREATE TABLE temp_dept_map (
  old_id TEXT,
  new_id TEXT
);

-- For each department name, pick the MIN(id) as the canonical one
INSERT INTO temp_dept_map (old_id, new_id)
SELECT d.id AS old_id, canonical.min_id AS new_id
FROM departments d
JOIN (
  SELECT name, MIN(id) as min_id
  FROM departments
  GROUP BY name
) canonical ON d.name = canonical.name;

-- Now map everything
UPDATE locations 
SET department_id = (SELECT new_id FROM temp_dept_map WHERE temp_dept_map.old_id = locations.department_id)
WHERE EXISTS (SELECT 1 FROM temp_dept_map WHERE temp_dept_map.old_id = locations.department_id);

UPDATE users 
SET department_id = (SELECT new_id FROM temp_dept_map WHERE temp_dept_map.old_id = users.department_id)
WHERE EXISTS (SELECT 1 FROM temp_dept_map WHERE temp_dept_map.old_id = users.department_id);

UPDATE audit_schedules 
SET department_id = (SELECT new_id FROM temp_dept_map WHERE temp_dept_map.old_id = audit_schedules.department_id)
WHERE EXISTS (SELECT 1 FROM temp_dept_map WHERE temp_dept_map.old_id = audit_schedules.department_id);

-- Delete duplicates (where old_id != new_id, meaning it's not the canonical)
DELETE FROM departments WHERE id IN (SELECT old_id FROM temp_dept_map WHERE old_id != new_id);

DROP TABLE temp_dept_map;

-- Now deduplicate locations
CREATE TABLE temp_loc_map (
  old_id TEXT,
  new_id TEXT
);

INSERT INTO temp_loc_map (old_id, new_id)
SELECT l.id AS old_id, canonical.min_id AS new_id
FROM locations l
JOIN (
  SELECT name, department_id, MIN(id) as min_id
  FROM locations
  GROUP BY name, department_id
) canonical ON l.name = canonical.name AND l.department_id = canonical.department_id;

UPDATE audit_schedules 
SET location_id = (SELECT new_id FROM temp_loc_map WHERE temp_loc_map.old_id = audit_schedules.location_id)
WHERE EXISTS (SELECT 1 FROM temp_loc_map WHERE temp_loc_map.old_id = audit_schedules.location_id);

DELETE FROM locations WHERE id IN (SELECT old_id FROM temp_loc_map WHERE old_id != new_id);

DROP TABLE temp_loc_map;
