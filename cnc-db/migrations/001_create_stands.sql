-- Создание справочника стендов.
-- ID 3 и 5 соответствуют REST endpoint /get/3 и /get/5.

CREATE TABLE stands (
    id   integer PRIMARY KEY,
    name text NOT NULL
);

INSERT INTO stands (id, name)
VALUES
    (3, 'Стенд 3'),
    (5, 'Стенд 5');
