// Import the file-system functions required to read, copy, create,
// move and remove files and folders.
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";

// Import utilities for constructing file paths on Windows, macOS and Linux.
import path from "node:path";
import { fileURLToPath } from "node:url";
// Import the bibliography synchronizer so the generated configuration is updated automatically after creating a surface page.
import { syncBibliography } from "./sync-bibliography.mjs";

/* ========================================================================== */
/* PROJECT PATHS                                                              */
/* ========================================================================== */

// Find the directory containing this script.
//
// import.meta.url identifies the current JavaScript file as a URL.
// fileURLToPath converts that URL into a normal file-system path.
// path.dirname then returns the containing "scripts" folder.
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

// The repository root is one level above the "scripts" folder.
//
// Resolving paths from the script location allows the command to work
// independently of the user's absolute Windows, macOS or Linux path.
const repositoryRoot = path.resolve(scriptDirectory, "..");

// Location of the editable surface template.
const templateDirectory = path.join(
  repositoryRoot,
  "gabarit",
  "surface_template",
);

// Destination folder containing all surface pages.
const surfacesDirectory = path.join(repositoryRoot, "surfaces");

/* ========================================================================== */
/* WINDOWS RESERVED NAMES                                                     */
/* ========================================================================== */

// Windows forbids these names for files and folders, even when an extension
// is added. Rejecting them here prevents obscure file-system errors.
const reservedWindowsNames = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

/* ========================================================================== */
/* UTILITY FUNCTIONS                                                          */
/* ========================================================================== */

/**
 * Convert a human-readable title into a safe folder name.
 *
 * Example:
 * "Surface Réglée & Élégante" becomes
 * "surface_reglee_and_elegante".
 */
function createSlug(title) {
  return title
    // Separate accented letters from their diacritical marks.
    .normalize("NFD")

    // Remove the separated diacritical marks: "é" becomes "e".
    .replace(/\p{Diacritic}/gu, "")

    // Use lowercase folder names throughout the project.
    .toLowerCase()

    // Preserve the meaning of "&" instead of simply deleting it.
    .replace(/&/g, " and ")

    // Replace spaces, punctuation and other special characters
    // with underscores.
    .replace(/[^a-z0-9]+/g, "_")

    // Remove underscores left at the beginning or end of the name.
    .replace(/^_+|_+$/g, "");
}

/**
 * Check whether a file or folder already exists.
 *
 * access() succeeds when the path exists and throws an error otherwise.
 * This wrapper converts that behaviour into a simple true/false result.
 */
async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/* ========================================================================== */
/* MAIN GENERATION PROCESS                                                    */
/* ========================================================================== */

async function main() {
  // Read every argument provided after the script name and join them.
  //
  // With:
  // npm run new:surface -- "Minimal Surface"
  //
  // the resulting title is:
  // Minimal Surface
  const title = process.argv.slice(2).join(" ").trim();

  /* ------------------------------------------------------------------------ */
  /* INPUT VALIDATION                                                         */
  /* ------------------------------------------------------------------------ */

  // A page cannot be created without a title.
  if (!title) {
    throw new Error(
      'A surface title is required.\nExample: npm run new:surface -- "Minimal Surface"',
    );
  }

  // Avoid accidental absurdly long names and problematic paths.
  if (title.length > 120) {
    throw new Error(
      "The surface title must contain no more than 120 characters.",
    );
  }

  // Convert the title into the future folder name.
  const slug = createSlug(title);

  // A title containing only punctuation or unsupported characters
  // would produce an empty folder name.
  if (!slug) {
    throw new Error(
      "The supplied title does not contain any usable letters or numbers.",
    );
  }

  // Prevent folder names that Windows cannot create.
  if (reservedWindowsNames.has(slug)) {
    throw new Error(`"${slug}" is a reserved folder name on Windows.`);
  }

  /* ------------------------------------------------------------------------ */
  /* TEMPLATE VALIDATION                                                      */
  /* ------------------------------------------------------------------------ */

  // Define the two template files that must be copied.
  const templateHome = path.join(templateDirectory, "home.md");

  const templateBibliography = path.join(
    templateDirectory,
    "references.bib",
  );

  // Stop with an explicit message if the Markdown template is missing.
  if (!(await pathExists(templateHome))) {
    throw new Error(`Missing template file: ${templateHome}`);
  }

  // Stop if the bibliography template is missing.
  if (!(await pathExists(templateBibliography))) {
    throw new Error(`Missing template file: ${templateBibliography}`);
  }

  // Stop if the repository does not contain the expected surfaces folder.
  // This also protects against accidentally running the script in an
  // unrelated project.
  if (!(await pathExists(surfacesDirectory))) {
    throw new Error(`Missing surfaces directory: ${surfacesDirectory}`);
  }

  /* ------------------------------------------------------------------------ */
  /* DESTINATION PROTECTION                                                   */
  /* ------------------------------------------------------------------------ */

  // Construct the final destination:
  // surfaces/minimal_surface
  const destinationDirectory = path.join(surfacesDirectory, slug);

  // Never overwrite an existing page.
  //
  // This is the main safety rule of the generator: existing research
  // content always has priority over the automation.
  if (await pathExists(destinationDirectory)) {
    throw new Error(
      `The destination already exists: surfaces/${slug}\nNo file has been overwritten.`,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* TEMPORARY GENERATION DIRECTORY                                           */
  /* ------------------------------------------------------------------------ */

  // Build the page in a unique temporary directory first.
  //
  // The process ID and current timestamp make collisions extremely unlikely.
  // Example:
  // surfaces/.new-surface-minimal_surface-18420-1787565000000
  const temporaryDirectory = path.join(
    surfacesDirectory,
    `.new-surface-${slug}-${process.pid}-${Date.now()}`,
  );

  await mkdir(temporaryDirectory);

  try {
    /* ---------------------------------------------------------------------- */
    /* HOME PAGE GENERATION                                                   */
    /* ---------------------------------------------------------------------- */

    // Load the Markdown template as text.
    const homeTemplate = await readFile(templateHome, "utf8");

    // Ensure that the template still contains the placeholder expected
    // by this script. This detects an incompatible template modification.
    if (!homeTemplate.includes("{{TITLE}}")) {
      throw new Error(
        'The template home.md does not contain the required "{{TITLE}}" placeholder.',
      );
    }

    // Replace every occurrence of {{TITLE}} with the supplied page title.
    const generatedHome = homeTemplate.replaceAll("{{TITLE}}", title);

    // Write the personalized home page into the temporary directory.
    await writeFile(
      path.join(temporaryDirectory, "home.md"),
      generatedHome,
      "utf8",
    );

    /* ---------------------------------------------------------------------- */
    /* BIBLIOGRAPHY AND IMAGE DIRECTORY                                       */
    /* ---------------------------------------------------------------------- */

    // Copy the commented bibliography examples without modifying them.
    await copyFile(
      templateBibliography,
      path.join(temporaryDirectory, "references.bib"),
    );

    // Create an empty folder for the future page illustrations.
    await mkdir(path.join(temporaryDirectory, "images"));

    /* ---------------------------------------------------------------------- */
    /* FINALIZATION                                                           */
    /* ---------------------------------------------------------------------- */

    // Once every required element has been created successfully,
    // rename the temporary directory to its final destination.
    //
    // The new surface therefore appears all at once instead of being
    // left half-created if an earlier operation fails.
    await rename(temporaryDirectory, destinationDirectory);
  } catch (error) {
    /* ---------------------------------------------------------------------- */
    /* AUTOMATIC CLEANUP                                                      */
    /* ---------------------------------------------------------------------- */

    // If any generation step fails, remove the temporary directory
    // and everything it contains.
    //
    // force: true means that cleanup also succeeds if the directory has
    // already disappeared. It does not affect the final destination.
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });

    // Send the original error to the final error handler below.
    throw error;
  }

  /* ------------------------------------------------------------------------ */
  /* BIBLIOGRAPHY SYNCHRONIZATION                                             */
  /* ------------------------------------------------------------------------ */

  // The new references.bib file now exists in its final location.
  // Update bibliography.yml so MyST immediately knows about it.
  await syncBibliography();

  /* ------------------------------------------------------------------------ */
  /* SUCCESS MESSAGE                                                          */
  /* ------------------------------------------------------------------------ */

  console.log("");
  console.log(`Surface page created: surfaces/${slug}`);
  console.log("");
  console.log("Created:");
  console.log(`  surfaces/${slug}/home.md`);
  console.log(`  surfaces/${slug}/references.bib`);
  console.log(`  surfaces/${slug}/images/`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Complete the TODO instructions in home.md.");
  console.log("  2. Add illustrations to the images folder.");
  console.log("  3. Add references to references.bib.");
  console.log("  4. Build and preview the website.");
  console.log("");
}

/* ========================================================================== */
/* ERROR HANDLING                                                             */
/* ========================================================================== */

// Run the generator.
//
// main() is asynchronous because file-system operations take time.
// If it throws an error, catch it here, display a readable message and
// return exit code 1 so terminals and CI systems know that the command failed.
main().catch((error) => {
  console.error("");
  console.error("Unable to create the surface page.");
  console.error(error.message);
  console.error("");

  process.exitCode = 1;
});