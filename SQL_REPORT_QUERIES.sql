-- Weekly schedule report (with team size)
SELECT
  s.id,
  s.schedule_date,
  s.start_time,
  s.status,
  c.name AS client_name,
  sv.service_name,
  sup.full_name AS supervisor_name,
  COUNT(sa.staff_id) AS team_size
FROM SCHEDULE s
JOIN CLIENT c ON c.id = s.client_id
JOIN SERVICE sv ON sv.id = s.service_id
JOIN STAFF sup ON sup.id = s.supervisor_id
LEFT JOIN STAFF_ASSIGNMENT sa ON sa.schedule_id = s.id
WHERE s.schedule_date BETWEEN :week_start AND :week_end
GROUP BY s.id
ORDER BY s.schedule_date ASC, s.start_time ASC;

-- Staff allocation per schedule
SELECT
  s.id AS schedule_id,
  s.schedule_date,
  c.name AS client_name,
  GROUP_CONCAT(st.full_name, ', ') AS staff_list
FROM SCHEDULE s
JOIN CLIENT c ON c.id = s.client_id
LEFT JOIN STAFF_ASSIGNMENT sa ON sa.schedule_id = s.id
LEFT JOIN STAFF st ON st.id = sa.staff_id
GROUP BY s.id
ORDER BY s.schedule_date DESC;

-- Dashboard summary parts
-- 1) Active client count
SELECT COUNT(*) AS active_clients
FROM CLIENT
WHERE is_active = 1;

-- 2) Staff working today
SELECT COUNT(DISTINCT sa.staff_id) AS staff_working_today
FROM STAFF_ASSIGNMENT sa
JOIN SCHEDULE s ON s.id = sa.schedule_id
WHERE s.schedule_date = :today;

-- 3) Today's schedules list
SELECT
  s.id,
  s.schedule_date,
  s.start_time,
  s.status,
  c.name AS client_name,
  sv.service_name,
  sup.full_name AS supervisor_name
FROM SCHEDULE s
JOIN CLIENT c ON c.id = s.client_id
JOIN SERVICE sv ON sv.id = s.service_id
JOIN STAFF sup ON sup.id = s.supervisor_id
WHERE s.schedule_date = :today
ORDER BY s.start_time ASC;
