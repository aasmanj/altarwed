CREATE TABLE inquiries (
    id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    vendor_id     UNIQUEIDENTIFIER NOT NULL REFERENCES vendors(id),
    couple_name   NVARCHAR(120)    NOT NULL,
    couple_email  NVARCHAR(254)    NOT NULL,
    wedding_date  NVARCHAR(60)     NULL,
    message       NVARCHAR(2000)   NOT NULL,
    is_read       BIT              NOT NULL DEFAULT 0,
    created_at    DATETIME2        NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX idx_inquiries_vendor_id ON inquiries(vendor_id);
