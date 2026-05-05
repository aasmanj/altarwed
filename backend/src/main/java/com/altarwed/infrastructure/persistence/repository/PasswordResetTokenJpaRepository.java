package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.PasswordResetTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenJpaRepository extends JpaRepository<PasswordResetTokenEntity, UUID> {
    Optional<PasswordResetTokenEntity> findByTokenHash(String tokenHash);
    void deleteAllByEmail(String email);

    @Modifying
    @Query("UPDATE PasswordResetTokenEntity t SET t.used = true WHERE t.tokenHash = :tokenHash")
    void markUsedByTokenHash(@Param("tokenHash") String tokenHash);
}
