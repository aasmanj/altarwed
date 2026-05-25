-- Meal preference removed from guest model. Dietary restrictions remain.
ALTER TABLE guests DROP COLUMN meal_preference;
