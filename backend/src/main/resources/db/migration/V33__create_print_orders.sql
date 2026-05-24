-- Print orders for physical save-the-dates and invitations mailed via Lob.
-- One row per order (a batch send to multiple guests). Per-guest postcard IDs
-- live in print_order_recipients so we can track delivery + failures per guest.

CREATE TABLE print_orders (
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    couple_id UNIQUEIDENTIFIER NOT NULL,
    order_type NVARCHAR(32) NOT NULL CONSTRAINT chk_print_order_type CHECK (order_type IN ('SAVE_THE_DATE', 'INVITATION')),
    status NVARCHAR(32) NOT NULL DEFAULT 'DRAFT' CONSTRAINT chk_print_order_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'PARTIAL_FAILURE', 'FAILED', 'MAILED')),
    template_key NVARCHAR(64) NOT NULL,
    recipient_count INT NOT NULL DEFAULT 0,
    cost_cents INT NOT NULL DEFAULT 0,
    error_message NVARCHAR(1000) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    submitted_at DATETIME2 NULL,
    CONSTRAINT pk_print_orders PRIMARY KEY (id),
    CONSTRAINT fk_print_orders_couple FOREIGN KEY (couple_id) REFERENCES couples(id)
);

CREATE INDEX ix_print_orders_couple ON print_orders(couple_id, created_at DESC);

CREATE TABLE print_order_recipients (
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    print_order_id UNIQUEIDENTIFIER NOT NULL,
    guest_id UNIQUEIDENTIFIER NOT NULL,
    lob_postcard_id NVARCHAR(64) NULL,
    delivery_status NVARCHAR(32) NULL,
    error_message NVARCHAR(500) NULL,
    CONSTRAINT pk_print_order_recipients PRIMARY KEY (id),
    CONSTRAINT fk_print_order_recipients_order FOREIGN KEY (print_order_id) REFERENCES print_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_print_order_recipients_guest FOREIGN KEY (guest_id) REFERENCES guests(id)
);

CREATE INDEX ix_print_order_recipients_order ON print_order_recipients(print_order_id);
