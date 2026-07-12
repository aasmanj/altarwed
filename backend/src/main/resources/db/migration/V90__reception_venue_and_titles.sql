-- V90: a genuinely separate RECEPTION venue. The existing venue_* columns are the
-- CEREMONY venue; these hold a second location so a couple can list a ceremony address
-- and a distinct reception address. Also adds optional custom header titles for the two
-- venue cards so the couple can label and differentiate them ("Ceremony", "Reception",
-- or anything they choose). All nullable: a couple with no reception venue leaves these
-- null and only the ceremony card renders.
--
-- Single ALTER TABLE ... ADD statement (SQL Server + Flyway DDL rule): no separate
-- add-column-then-constraint pair. All columns are plain nullable, no constraints.
ALTER TABLE wedding_websites ADD
    reception_venue_name NVARCHAR(200) NULL,
    reception_venue_address NVARCHAR(300) NULL,
    reception_venue_city NVARCHAR(100) NULL,
    reception_venue_state NVARCHAR(50) NULL,
    reception_time NVARCHAR(50) NULL,
    reception_venue_additional_info NVARCHAR(MAX) NULL,
    ceremony_venue_title NVARCHAR(100) NULL,
    reception_venue_title NVARCHAR(100) NULL;
