package com.altarwed.infrastructure.persistence;

import com.altarwed.domain.port.EmailSuppressionPort;
import com.altarwed.infrastructure.persistence.entity.EmailSuppressionEntity;
import com.altarwed.infrastructure.persistence.repository.EmailSuppressionJpaRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EmailSuppressionAdapter implements EmailSuppressionPort {

    private static final Logger log = LoggerFactory.getLogger(EmailSuppressionAdapter.class);

    private final EmailSuppressionJpaRepository jpaRepository;

    @Override
    public boolean isSuppressed(String emailHash) {
        return jpaRepository.existsByEmailHash(emailHash);
    }

    @Override
    public void suppress(String emailHash, String source) {
        if (jpaRepository.existsByEmailHash(emailHash)) {
            log.debug("email already suppressed, hash={}", emailHash);
            return;
        }
        try {
            jpaRepository.save(EmailSuppressionEntity.builder()
                    .emailHash(emailHash)
                    .source(source)
                    .build());
            log.info("email suppressed, source={}", source);
        } catch (DataIntegrityViolationException ex) {
            // Concurrent insert on the same hash -- idempotent, ignore
            log.debug("email suppression concurrent insert ignored, hash={}", emailHash);
        }
    }
}
