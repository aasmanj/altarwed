CREATE TABLE vendor_portfolio_photos (
    id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    vendor_id   UNIQUEIDENTIFIER NOT NULL,
    photo_url   NVARCHAR(500)    NOT NULL,
    caption     NVARCHAR(255)    NULL,
    sort_order  INT              NOT NULL DEFAULT 0,
    created_at  DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_vpp_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE INDEX idx_vpp_vendor_sort ON vendor_portfolio_photos (vendor_id, sort_order);
