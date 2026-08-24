// Import the file-system functions required to scan directories,
// read the current configuration and write the generated one.
import {
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";

// Import utilities for creating portable paths.
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ========================================================================== */
/* PROJECT PATHS                                                              */
/* ========================================================================== */

// Find the directory containing this script.
const scriptFile = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptFile);

// The repository root is one level above the "scripts" folder.
const repositoryRoot = path.resolve(scriptDirectory, "..");

// The generated bibliography configuration will be stored at the root.
const bibliographyConfigPath = path.join(
  repositoryRoot,
  "bibliography.yml",
);

/* ========================================================================== */
/* EXCLUDED DIRECTORIES                                                       */
/* ========================================================================== */

// These directories must never contribute bibliography files.
//
// In particular, "gabarit" contains the commented reference examples.
// Registering its references.bib would incorrectly treat the template
// itself as website content.
const excludedDirectoryNames = new Set([
  ".git",
  ".myst",
  ".venv",
  "_build",
  "env",
  "gabarit",
  "node_modules",
  "venv",
]);

/* ========================================================================== */
/* PATH UTILITIES                                                             */
/* ========================================================================== */

/**
 * Convert a system-dependent path into a portable repository path.
 *
 * Windows uses backslashes:
 * surfaces\minimal_surface\references.bib
 *
 * MyST and Git configuration files require forward slashes:
 * surfaces/minimal_surface/references.bib
 */
function toPortablePath(filePath) {
  return filePath.split(path.sep).join("/");
}

/**
 * Normalize line endings before comparing generated content.
 *
 * This prevents Windows CRLF and Unix LF from being interpreted
 * as a meaningful bibliography difference.
 */
function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, "\n");
}

/* ========================================================================== */
/* BIBLIOGRAPHY DISCOVERY                                                     */
/* ========================================================================== */

/**
 * Recursively find every file named "references.bib".
 *
 * Symbolic links are not followed, and excluded or temporary directories
 * are ignored.
 */
async function findBibliographyFiles(directory) {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  const bibliographyFiles = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      // Ignore technical, generated and dependency directories.
      if (excludedDirectoryNames.has(entry.name)) {
        continue;
      }

      // Ignore temporary directories created by new-surface.mjs.
      if (entry.name.startsWith(".new-surface-")) {
        continue;
      }

      // Search the accepted directory recursively.
      const nestedBibliographies =
        await findBibliographyFiles(entryPath);

      bibliographyFiles.push(...nestedBibliographies);
      continue;
    }

    // Only files with this exact conventional name are registered.
    if (entry.isFile() && entry.name === "references.bib") {
      bibliographyFiles.push(entryPath);
    }
  }

  return bibliographyFiles;
}

/* ========================================================================== */
/* YAML GENERATION                                                            */
/* ========================================================================== */

/**
 * Generate the complete bibliography.yml file.
 *
 * The paths are:
 * - made relative to the repository root;
 * - converted to forward slashes;
 * - sorted alphabetically for deterministic Git diffs.
 */
function createBibliographyConfig(absoluteFilePaths) {
  const relativeFilePaths = absoluteFilePaths
    .map((absolutePath) => {
      const relativePath = path.relative(
        repositoryRoot,
        absolutePath,
      );

      return toPortablePath(relativePath);
    })
    .sort();

  const lines = [
    "# This file is generated automatically.",
    "# Do not edit it manually.",
    "# Run: npm run sync:bibliography",
    "",
    "version: 1",
    "",
    "project:",
  ];

  if (relativeFilePaths.length === 0) {
    lines.push("  bibliography: []");
  } else {
    lines.push("  bibliography:");

    for (const relativePath of relativeFilePaths) {
      // JSON string syntax is also valid YAML syntax and safely quotes
      // unusual characters that may appear in a path.
      lines.push(`    - ${JSON.stringify(relativePath)}`);
    }
  }

  // End the generated file with exactly one newline.
  return {
    content: `${lines.join("\n")}\n`,
    relativeFilePaths,
  };
}

/* ========================================================================== */
/* SYNCHRONIZATION                                                            */
/* ========================================================================== */

/**
 * Discover every bibliography and either:
 *
 * - write bibliography.yml; or
 * - check that the existing file is already synchronized.
 */
export async function syncBibliography({
  check = false,
} = {}) {
  const absoluteFilePaths =
    await findBibliographyFiles(repositoryRoot);

  const {
    content: expectedContent,
    relativeFilePaths,
  } = createBibliographyConfig(absoluteFilePaths);

  if (check) {
    let currentContent;

    try {
      currentContent = await readFile(
        bibliographyConfigPath,
        "utf8",
      );
    } catch {
      throw new Error(
        "bibliography.yml does not exist. Run npm run sync:bibliography.",
      );
    }

    const normalizedCurrentContent =
      normalizeLineEndings(currentContent);

    const normalizedExpectedContent =
      normalizeLineEndings(expectedContent);

    if (normalizedCurrentContent !== normalizedExpectedContent) {
      throw new Error(
        "bibliography.yml is not synchronized. Run npm run sync:bibliography.",
      );
    }

    console.log(
      `Bibliography is synchronized: ${relativeFilePaths.length} file(s).`,
    );

    return relativeFilePaths;
  }

  await writeFile(
    bibliographyConfigPath,
    expectedContent,
    "utf8",
  );

  console.log(
    `Bibliography synchronized: ${relativeFilePaths.length} file(s).`,
  );

  for (const relativePath of relativeFilePaths) {
    console.log(`  ${relativePath}`);
  }

  return relativeFilePaths;
}

/* ========================================================================== */
/* COMMAND-LINE INTERFACE                                                     */
/* ========================================================================== */

/**
 * Interpret command-line options when this file is executed directly.
 *
 * Supported commands:
 *
 * node scripts/sync-bibliography.mjs
 * node scripts/sync-bibliography.mjs --check
 */
async function runCommandLineInterface() {
  const argumentsList = process.argv.slice(2);

  const unsupportedArguments = argumentsList.filter(
    (argument) => argument !== "--check",
  );

  if (unsupportedArguments.length > 0) {
    throw new Error(
      `Unsupported argument(s): ${unsupportedArguments.join(", ")}`,
    );
  }

  await syncBibliography({
    check: argumentsList.includes("--check"),
  });
}

// Determine whether this file was launched directly from the terminal.
//
// This condition is false when syncBibliography() is imported later
// by new-surface.mjs.
const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === scriptFile;

if (isDirectExecution) {
  runCommandLineInterface().catch((error) => {
    console.error("");
    console.error("Unable to synchronize the bibliography.");
    console.error(error.message);
    console.error("");

    process.exitCode = 1;
  });
}