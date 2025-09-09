-- Sample Plants Data for Plant Management System

-- Sample Plants
INSERT INTO plants (id, name, description, category, growth_duration, is_active) VALUES
('plant-tomato', 'Tomato', 'Nutritious red fruit, excellent for cooking and fresh consumption. Rich in vitamins A and C.', 'vegetables', '3-4 months', true),
('plant-maize', 'Maize (Corn)', 'Staple grain crop that can be used for food, animal feed, and industrial purposes.', 'grains', '4-6 months', true),
('plant-cassava', 'Cassava', 'Root crop that serves as a major source of carbohydrates. Drought resistant and easy to grow.', 'roots', '8-12 months', true),
('plant-yam', 'Yam', 'Important tuber crop in West Africa. Provides carbohydrates and can be stored for long periods.', 'roots', '6-10 months', true),
('plant-pepper', 'Pepper (Scotch Bonnet)', 'Hot pepper variety popular in Nigerian cuisine. High in vitamin C.', 'vegetables', '3-4 months', true),
('plant-okra', 'Okra', 'Green vegetable pods used in soups and stews. Contains valuable nutrients and fiber.', 'vegetables', '2-3 months', true);

-- Sample Questions for Tomato
INSERT INTO plant_questions (id, plant_id, question, question_type, options, is_required, category, order_index) VALUES
('q-tomato-processing', 'plant-tomato', 'How do you process your tomatoes after harvest?', 'checkbox', '[
  {"value": "fresh_sale", "label": "Sell fresh at market"},
  {"value": "sun_drying", "label": "Sun drying"},
  {"value": "sauce_making", "label": "Make tomato paste/sauce"},
  {"value": "canning", "label": "Canning/preserving"},
  {"value": "others", "label": "Others (please specify)"}
]', true, 'processing', 1),

('q-tomato-waste', 'plant-tomato', 'What do you do with tomato waste (damaged/overripe fruits)?', 'checkbox', '[
  {"value": "compost", "label": "Make compost"},
  {"value": "animal_feed", "label": "Use as animal feed"},
  {"value": "disposal", "label": "Dispose of it"},
  {"value": "biogas", "label": "Use for biogas production"},
  {"value": "others", "label": "Others (please specify)"}
]', true, 'waste_management', 2),

('q-tomato-challenges', 'plant-tomato', 'What are your main challenges in tomato production?', 'checkbox', '[
  {"value": "pests", "label": "Pest attacks"},
  {"value": "diseases", "label": "Plant diseases"},
  {"value": "water", "label": "Water shortage"},
  {"value": "storage", "label": "Storage problems"},
  {"value": "market_access", "label": "Market access"},
  {"value": "others", "label": "Others (please specify)"}
]', false, 'challenges', 3);

-- Sample Questions for Maize
INSERT INTO plant_questions (id, plant_id, question, question_type, options, is_required, category, order_index) VALUES
('q-maize-processing', 'plant-maize', 'How do you process your maize after harvest?', 'checkbox', '[
  {"value": "dry_grain", "label": "Dry and sell as grain"},
  {"value": "flour", "label": "Mill into flour"},
  {"value": "animal_feed", "label": "Use as animal feed"},
  {"value": "popcorn", "label": "Process as popcorn"},
  {"value": "others", "label": "Others (please specify)"}
]', true, 'processing', 1),

('q-maize-storage', 'plant-maize', 'How do you store your maize?', 'multiple_choice', '[
  {"value": "traditional_barn", "label": "Traditional barn"},
  {"value": "modern_silo", "label": "Modern silo"},
  {"value": "bags", "label": "In bags"},
  {"value": "open_air", "label": "Open air drying"},
  {"value": "others", "label": "Others (please specify)"}
]', true, 'storage', 2),

('q-maize-waste', 'plant-maize', 'What do you do with maize waste (husks, cobs, stalks)?', 'checkbox', '[
  {"value": "animal_feed", "label": "Use as animal feed"},
  {"value": "compost", "label": "Make compost"},
  {"value": "fuel", "label": "Use as fuel for cooking"},
  {"value": "construction", "label": "Building materials"},
  {"value": "disposal", "label": "Dispose of it"},
  {"value": "others", "label": "Others (please specify)"}
]', true, 'waste_management', 3);

-- Sample Questions for Cassava
INSERT INTO plant_questions (id, plant_id, question, question_type, options, is_required, category, order_index) VALUES
('q-cassava-processing', 'plant-cassava', 'How do you process your cassava?', 'checkbox', '[
  {"value": "fresh_tuber", "label": "Sell fresh tubers"},
  {"value": "garri", "label": "Process into garri"},
  {"value": "flour", "label": "Make cassava flour"},
  {"value": "starch", "label": "Extract starch"},
  {"value": "chips", "label": "Dry into chips"},
  {"value": "others", "label": "Others (please specify)"}
]', true, 'processing', 1),

('q-cassava-peels', 'plant-cassava', 'What do you do with cassava peels?', 'checkbox', '[
  {"value": "animal_feed", "label": "Use as animal feed"},
  {"value": "compost", "label": "Make compost"},
  {"value": "disposal", "label": "Dispose of them"},
  {"value": "biogas", "label": "Use for biogas"},
  {"value": "others", "label": "Others (please specify)"}
]', true, 'waste_management', 2);

-- Sample Questions for Pepper
INSERT INTO plant_questions (id, plant_id, question, question_type, options, is_required, category, order_index) VALUES
('q-pepper-processing', 'plant-pepper', 'How do you process your peppers?', 'checkbox', '[
  {"value": "fresh_sale", "label": "Sell fresh"},
  {"value": "drying", "label": "Sun dry them"},
  {"value": "grinding", "label": "Grind into powder"},
  {"value": "sauce", "label": "Make pepper sauce"},
  {"value": "others", "label": "Others (please specify)"}
]', true, 'processing', 1),

('q-pepper-preservation', 'plant-pepper', 'How do you preserve peppers for longer storage?', 'multiple_choice', '[
  {"value": "sun_drying", "label": "Sun drying"},
  {"value": "smoking", "label": "Smoking"},
  {"value": "freezing", "label": "Freezing"},
  {"value": "salting", "label": "Salt preservation"},
  {"value": "others", "label": "Others (please specify)"}
]', false, 'storage', 2);