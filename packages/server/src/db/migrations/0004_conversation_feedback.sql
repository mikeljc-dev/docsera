-- Feedback del usuario final sobre cada respuesta del asistente:
-- 1 = util (👍), -1 = no util (👎), NULL = sin feedback.
ALTER TABLE conversations ADD COLUMN feedback SMALLINT;
