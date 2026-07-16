-- Custom SQL migration file, put your code below! --

-- FASE-02 · Extensiones base del esquema Orkalis.
-- btree_gist: necesaria en FASE-03 para el constraint EXCLUDE con tstzrange
--             (evita solapamiento de citas por especialista/sucursal).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- pgcrypto: provee gen_random_uuid() para las PKs UUID de las tablas (FASE-03).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
