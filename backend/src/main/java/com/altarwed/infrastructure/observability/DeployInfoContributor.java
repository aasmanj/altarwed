package com.altarwed.infrastructure.observability;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

/**
 * Exposes the deployed commit at {@code /actuator/info} under a {@code deploy} key.
 *
 * Why this exists: the post-deploy smoke test gates on seeing the exact deployed
 * SHA in /actuator/info. Spring's built-in git info contributor renders empty in
 * our Azure environment, and a naive {@code classpath:git.properties} read does
 * too. Root cause: Azure App Service launches the app as
 * {@code java -cp /home/site/wwwroot/app.jar ... JarLauncher}, which puts the fat
 * jar on the SYSTEM classpath where the stamped file's real path is
 * {@code BOOT-INF/classes/git.properties}, not root {@code git.properties}. A
 * root-relative lookup misses; the nested path resolves.
 *
 * So we try the realistic (classloader, path) combinations until one yields the
 * commit id, and log which one worked so the environment is no longer a mystery.
 * git.properties is CI-generated and gitignored, so local dev reports "unknown".
 */
@Component
public class DeployInfoContributor implements InfoContributor {

    private static final Logger log = LoggerFactory.getLogger(DeployInfoContributor.class);

    // Both the LaunchedClassLoader (root) and system-classpath (nested) layouts.
    private static final List<String> PATHS = List.of("git.properties", "BOOT-INF/classes/git.properties");

    private final Map<String, String> deploy;

    public DeployInfoContributor() {
        this.deploy = loadDeployInfo();
    }

    private Map<String, String> loadDeployInfo() {
        Properties props = readGitProperties();
        Map<String, String> result = new LinkedHashMap<>();
        result.put("commit", props.getProperty("git.commit.id", "unknown"));
        result.put("commitAbbrev", props.getProperty("git.commit.id.abbrev", "unknown"));
        result.put("branch", props.getProperty("git.branch", "unknown"));
        result.put("buildTime", props.getProperty("git.build.time", "unknown"));
        return result;
    }

    private Properties readGitProperties() {
        Map<String, ClassLoader> loaders = new LinkedHashMap<>();
        loaders.put("tccl", Thread.currentThread().getContextClassLoader());
        loaders.put("own", getClass().getClassLoader());
        loaders.put("system", ClassLoader.getSystemClassLoader());

        for (String path : PATHS) {
            for (Map.Entry<String, ClassLoader> e : loaders.entrySet()) {
                ClassLoader cl = e.getValue();
                if (cl == null) {
                    continue;
                }
                try (InputStream in = cl.getResourceAsStream(path)) {
                    if (in == null) {
                        continue;
                    }
                    Properties props = new Properties();
                    props.load(in);
                    if (props.containsKey("git.commit.id")) {
                        log.info("deploy info loaded, classloader={}, path={}", e.getKey(), path);
                        return props;
                    }
                } catch (Exception ex) {
                    // Try the next combination; a read failure here is not fatal.
                }
            }
        }
        log.info("git.properties not resolvable on classpath, deploy info will report unknown");
        return new Properties();
    }

    @Override
    public void contribute(Info.Builder builder) {
        builder.withDetail("deploy", deploy);
    }
}
