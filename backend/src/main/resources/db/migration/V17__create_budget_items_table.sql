CREATE TABLE budget_items (
    id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    couple_id       UNIQUEIDENTIFIER NOT NULL,
    category        NVARCHAR(50)     NOT NULL,
    vendor_name     NVARCHAR(200)    NOT NULL,
    estimated_cost  DECIMAL(10, 2)   NOT NULL DEFAULT 0,
    actual_cost     DECIMAL(10, 2)   NULL,
    is_paid         BIT              NOT NULL DEFAULT 0,
    notes           NVARCHAR(500)    NULL,
    created_at      DATETIME2        NOT NULL DEFAULT SYSDATETIME(),
    updated_at      DATETIME2        NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT fk_budget_items_couple
        FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
);

CREATE INDEX idx_budget_items_couple ON budget_items(couple_id);
