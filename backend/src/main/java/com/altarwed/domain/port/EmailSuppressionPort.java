package com.altarwed.domain.port;

public interface EmailSuppressionPort {

    boolean isSuppressed(String emailHash);

    void suppress(String emailHash, String source);
}
