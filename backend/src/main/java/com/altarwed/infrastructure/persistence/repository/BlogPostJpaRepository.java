package com.altarwed.infrastructure.persistence.repository;

import com.altarwed.infrastructure.persistence.entity.BlogPostEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BlogPostJpaRepository extends JpaRepository<BlogPostEntity, UUID> {
    List<BlogPostEntity> findAllByIsPublishedTrueOrderByPublishedAtDesc();
    Optional<BlogPostEntity> findBySlug(String slug);
}
