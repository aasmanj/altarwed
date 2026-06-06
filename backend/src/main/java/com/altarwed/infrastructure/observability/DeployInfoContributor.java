package com.altarwed.infrastructure.observability;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

/**
 * Exposes the deployed commit at {@code /actuator/info} under a {@code deploy} key.
 *
 * Why this exists instead of relying on Spring's built-in git info contributor:
 * the CI pipeline stamps a valid git.properties into the jar (verified present in
 * the deployed artifact), yet Spring's GitInfoContributor renders {@code "git":{}}
 * empty in production under Spring Boot 4. The post-deploy smoke test gates on
 * seeing the exact deployed SHA in /actuator/info, so we read the same
 * CI-stamped file directly and emit the commit ourselves. This is a tiny,
 * deterministic read with no dependency on actuator auto-config quirks.
 *
 * git.properties is gitignored and only exists in CI-built jars, so in local dev
 * the read fails quietly and the deploy block reports "unknown".
 */
@Component
public class DeployInfoContributor implements InfoContributor {

    private static final Logger log = LoggerFactory.getLogger(DeployInfoContributor.class);

    private final Map<String, String> deploy;

    public DeployInfoContributor() {
        this.deploy = loadDeployInfo();
    }

    private Map<String, String> loadDeployInfo() {
        Map<String, String> result = new LinkedHashMap<>();
        Properties props = new Properties();
        try (InputStream in = new ClassPathResource("git.properties").getInputStream()) {
            props.load(in);
        } catch (Exception ex) {
            // Expected in local dev (git.properties is CI-generated, gitignored).
            log.info("git.properties not on classpath, deploy info will report unknown");
        }
        result.put("commit", props.getProperty("git.commit.id", "unknown"));
        result.put("commitAbbrev", props.getProperty("git.commit.id.abbrev", "unknown"));
        result.put("branch", props.getProperty("git.branch", "unknown"));
        result.put("buildTime", props.getProperty("git.build.time", "unknown"));
        return result;
    }

    @Override
    public void contribute(Info.Builder builder) {
        builder.withDetail("deploy", deploy);
    }
}
