-- V3: Create denominations table and denomination_traditions join table
-- Denominations are a core filtering concept — couples and vendors align on them.
-- Traditions are stored as rows (not a comma-separated column) for query flexibility.

CREATE TABLE denominations (
    id      UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWSEQUENTIALID(),
    name    NVARCHAR(100)       NOT NULL,
    slug    NVARCHAR(100)       NOT NULL,

    CONSTRAINT pk_denominations PRIMARY KEY (id),
    CONSTRAINT uq_denominations_slug UNIQUE (slug)
);

CREATE TABLE denomination_traditions (
    denomination_id     UNIQUEIDENTIFIER    NOT NULL,
    tradition           NVARCHAR(100)       NOT NULL,

    CONSTRAINT pk_denomination_traditions PRIMARY KEY (denomination_id, tradition),
    CONSTRAINT fk_denomination_traditions_denomination FOREIGN KEY (denomination_id)
        REFERENCES denominations (id) ON DELETE CASCADE
);

CREATE INDEX ix_denominations_slug              ON denominations (slug);
CREATE INDEX ix_denomination_traditions_denom   ON denomination_traditions (denomination_id);

-- Seed core denominations used at launch
INSERT INTO denominations (id, name, slug) VALUES
    (NEWID(), 'Non-Denominational',     'non-denominational'),
    (NEWID(), 'Baptist',                'baptist'),
    (NEWID(), 'Catholic',               'catholic'),
    (NEWID(), 'Methodist',              'methodist'),
    (NEWID(), 'Presbyterian',           'presbyterian'),
    (NEWID(), 'Lutheran',               'lutheran'),
    (NEWID(), 'Pentecostal',            'pentecostal'),
    (NEWID(), 'Anglican / Episcopal',   'anglican-episcopal'),
    (NEWID(), 'Assembly of God',        'assembly-of-god'),
    (NEWID(), 'Church of Christ',       'church-of-christ');
