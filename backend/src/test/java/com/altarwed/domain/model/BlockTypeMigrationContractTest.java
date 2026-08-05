package com.altarwed.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

/**
 * Guards the contract between the BlockType enum and the SQL Server CHECK constraint
 * chk_wedding_page_blocks_type.
 *
 * <p>This is the failure mode V39 was written to repair: STORY_ENTRY was added to the enum and to
 * the frontend block picker, but the CHECK constraint was never widened, so every insert of that
 * block type was rejected by the database and surfaced to the couple as a misleading 409 "Data
 * Conflict". Nothing in the build caught it, because the enum and the migration are separate
 * artifacts that never reference each other. This test makes the compiler-less coupling explicit:
 * add a BlockType value without a matching Flyway migration and CI fails here rather than prod
 * failing on the couple's first save.
 *
 * <p>Pure JUnit, no Spring context and no database, so it runs in CI's backend-test job.
 */
class BlockTypeMigrationContractTest {

    private static final Path MIGRATION_DIR = Path.of("src/main/resources/db/migration");

    /** Captures the value list of the last ADD CONSTRAINT ... CHECK (block_type IN (...)) statement. */
    private static final Pattern ADD_CONSTRAINT = Pattern.compile(
            "ADD\\s+CONSTRAINT\\s+chk_wedding_page_blocks_type\\s+CHECK\\s*\\(\\s*block_type\\s+IN\\s*\\((.*?)\\)\\s*\\)",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final Pattern QUOTED_VALUE = Pattern.compile("'([^']*)'");

    @Test
    void dayOfTimelineIsADeclaredBlockType() {
        assertThat(BlockType.valueOf("DAY_OF_TIMELINE")).isEqualTo(BlockType.DAY_OF_TIMELINE);
    }

    @Test
    void everyBlockTypeIsAllowedByTheLatestCheckConstraint() {
        Set<String> allowed = allowedBlockTypesFromLatestMigration();
        Set<String> declared = Stream.of(BlockType.values())
                .map(Enum::name)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        assertThat(allowed)
                .as("chk_wedding_page_blocks_type must allow every BlockType; "
                        + "add a Flyway migration that drops and re-adds the constraint")
                .containsAll(declared);
    }

    @Test
    void theCheckConstraintDoesNotAllowUnknownBlockTypes() {
        Set<String> declared = Stream.of(BlockType.values()).map(Enum::name).collect(Collectors.toSet());

        assertThat(allowedBlockTypesFromLatestMigration())
                .as("the constraint allows a value with no matching BlockType; "
                        + "the enum and the migration have drifted apart")
                .allMatch(declared::contains);
    }

    /**
     * Reads the highest-numbered migration that re-adds chk_wedding_page_blocks_type and returns the
     * block types it permits. Migrations apply in version order, so the last one to touch the
     * constraint is the one in effect.
     */
    private static Set<String> allowedBlockTypesFromLatestMigration() {
        List<Path> migrations = listMigrationsNewestFirst();

        for (Path migration : migrations) {
            String sql = read(migration);
            Matcher matcher = ADD_CONSTRAINT.matcher(sql);
            String lastMatch = null;
            while (matcher.find()) {
                lastMatch = matcher.group(1);
            }
            if (lastMatch != null) {
                Set<String> values = new LinkedHashSet<>();
                Matcher valueMatcher = QUOTED_VALUE.matcher(lastMatch);
                while (valueMatcher.find()) {
                    values.add(valueMatcher.group(1));
                }
                assertThat(values)
                        .as("parsed no block types out of %s", migration.getFileName())
                        .isNotEmpty();
                return values;
            }
        }
        throw new AssertionError(
                "no migration in " + MIGRATION_DIR + " adds chk_wedding_page_blocks_type");
    }

    private static List<Path> listMigrationsNewestFirst() {
        assertThat(Files.isDirectory(MIGRATION_DIR))
                .as("migration directory not found at %s (tests must run with the backend module "
                        + "directory as the working directory)", MIGRATION_DIR.toAbsolutePath())
                .isTrue();
        try (Stream<Path> files = Files.list(MIGRATION_DIR)) {
            return files
                    .filter(p -> p.getFileName().toString().endsWith(".sql"))
                    .sorted(Comparator.comparingInt(BlockTypeMigrationContractTest::versionOf).reversed())
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static final Pattern VERSION = Pattern.compile("^V(\\d+)__");

    /** Extracts N from a "V{N}__description.sql" filename; unparseable names sort last. */
    private static int versionOf(Path path) {
        Matcher m = VERSION.matcher(path.getFileName().toString());
        return m.find() ? Integer.parseInt(m.group(1)) : -1;
    }

    private static String read(Path path) {
        try {
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
