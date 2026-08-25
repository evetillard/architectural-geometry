(() => {
  "use strict";

  /* ======================================================================== */
  /* PREVIOUS PROTOTYPE CLEANUP                                               */
  /* ======================================================================== */

  // Remove the previous injected version before installing this one.
  window.suggestEditPrototype?.destroy?.();

  // Also remove stale elements left behind by a previously interrupted script.
  document.getElementById("suggest-edit-action")?.remove();
  document.getElementById("suggest-edit-dialog")?.remove();
  document.getElementById("suggest-edit-prototype-styles")?.remove();

  /* ======================================================================== */
  /* PAGE CONTENT AND PROTOTYPE CONFIGURATION                                 */
  /* ======================================================================== */

  // Retrieve the current scientific content whenever it is needed.
  // Remix may replace the <main> element during client-side navigation, so
  // keeping a reference captured when the script loads would become stale.
  function getMainContent() {
    return document.querySelector("main");
  }

  if (!getMainContent()) {
    console.error("[Suggest an edit] Main page content was not found.");
    return;
  }

  // Number of contextual characters retained on each side of the selection.
  const contextCharacterLimit = 160;

  /* ======================================================================== */
  /* PROTOTYPE STATE                                                          */
  /* ======================================================================== */

  let capturedSelection = null;
  let activeAnchor = null;
  let lastDraft = null;

  /* ======================================================================== */
  /* USER INTERFACE CREATION                                                  */
  /* ======================================================================== */

  const actionButton = document.createElement("button");

  actionButton.id = "suggest-edit-action";
  actionButton.className = "suggest-edit-action";
  actionButton.type = "button";
  actionButton.textContent = "Suggest an edit";
  actionButton.hidden = true;

  const dialog = document.createElement("dialog");

  dialog.id = "suggest-edit-dialog";
  dialog.className = "suggest-edit-dialog";
  dialog.setAttribute("aria-labelledby", "suggest-edit-dialog-title");

  dialog.innerHTML = `
    <div class="suggest-edit-dialog__body">
      <header class="suggest-edit-dialog__header">
        <div>
          <p class="suggest-edit-dialog__eyebrow">Content suggestion</p>
          <h2 id="suggest-edit-dialog-title">Suggest an edit</h2>
        </div>
        <button
          class="suggest-edit-dialog__close"
          id="suggest-edit-dialog-close"
          type="button"
          aria-label="Close suggestion form"
        >
          ×
        </button>
      </header>

      <div class="suggest-edit-context" aria-label="Selected passage context">
        <dl class="suggest-edit-context__metadata">
          <div>
            <dt>Page</dt>
            <dd id="suggest-edit-page-title"></dd>
          </div>
          <div>
            <dt>Section</dt>
            <dd id="suggest-edit-section-title"></dd>
          </div>
        </dl>

        <p class="suggest-edit-context__label">Selected passage</p>
        <blockquote id="suggest-edit-selected-text"></blockquote>
      </div>

      <form id="suggest-edit-form">
        <div class="suggest-edit-field">
          <label for="suggest-edit-operation">Operation</label>
          <select id="suggest-edit-operation" name="operation" required>
            <option value="add">Add text</option>
            <option value="delete">Delete selected text</option>
          </select>
        </div>

        <fieldset id="suggest-edit-placement-group">
          <legend>Insertion position</legend>
          <label class="suggest-edit-choice">
            <input type="radio" name="placement" value="before">
            Before the selected passage
          </label>
          <label class="suggest-edit-choice">
            <input type="radio" name="placement" value="after" checked>
            After the selected passage
          </label>
        </fieldset>

        <div class="suggest-edit-field">
          <label for="suggest-edit-title">Suggestion title</label>
          <input
            id="suggest-edit-title"
            name="title"
            type="text"
            maxlength="160"
            autocomplete="off"
            placeholder="Give a short title for this suggestion."
            required
          >
        </div>

        <div class="suggest-edit-field" id="suggest-edit-text-group">
          <label for="suggest-edit-text">Text to add</label>
          <textarea
            id="suggest-edit-text"
            name="suggestedText"
            rows="5"
            placeholder="Write the proposed text here."
            required
          ></textarea>
        </div>

        <div class="suggest-edit-field">
          <label for="suggest-edit-rationale">Rationale</label>
          <textarea
            id="suggest-edit-rationale"
            name="rationale"
            rows="4"
            placeholder="Explain why this change would improve the page."
            required
          ></textarea>
        </div>

        <div class="suggest-edit-field">
          <label for="suggest-edit-sources">Sources <span>(optional)</span></label>
          <textarea
            id="suggest-edit-sources"
            name="sources"
            rows="3"
            placeholder="Enter one reference or URL per line."
          ></textarea>
        </div>

        <div class="suggest-edit-actions">
          <button id="suggest-edit-cancel" type="button">Cancel</button>
          <button class="suggest-edit-primary" type="submit">
            Preview suggestion
          </button>
        </div>
      </form>

      <section id="suggest-edit-preview-section" hidden>
        <h3>Structured preview</h3>
        <p>
          This prototype does not send or modify anything. It only prepares the
          proposal shown below.
        </p>
        <pre id="suggest-edit-preview"></pre>
      </section>
    </div>
  `;

  const styleElement = document.createElement("style");

  styleElement.id = "suggest-edit-prototype-styles";
  styleElement.textContent = `
    .suggest-edit-action {
      position: fixed;
      z-index: 99999;
      padding: 9px 13px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 999px;
      background: #1f2937;
      color: #ffffff;
      font: 600 14px/1.3 system-ui, sans-serif;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    }

    .suggest-edit-action:hover {
      background: #111827;
    }

    .suggest-edit-action:focus-visible,
    .suggest-edit-dialog button:focus-visible,
    .suggest-edit-dialog input:focus-visible,
    .suggest-edit-dialog select:focus-visible,
    .suggest-edit-dialog textarea:focus-visible {
      outline: 3px solid #60a5fa;
      outline-offset: 2px;
    }

    .suggest-edit-dialog {
      width: min(720px, calc(100vw - 32px));
      max-width: none;
      max-height: min(88vh, 900px);
      padding: 0;
      border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
      border-radius: 16px;
      background: Canvas;
      color: CanvasText;
      color-scheme: light dark;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
    }

    .suggest-edit-dialog::backdrop {
      background: rgba(15, 23, 42, 0.68);
      backdrop-filter: blur(2px);
    }

    .suggest-edit-dialog__body {
      padding: 24px;
      overflow: auto;
    }

    .suggest-edit-dialog__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 20px;
    }

    .suggest-edit-dialog__header h2,
    .suggest-edit-dialog__header p,
    .suggest-edit-dialog h3 {
      margin: 0;
    }

    .suggest-edit-dialog__eyebrow {
      margin-bottom: 4px !important;
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .suggest-edit-dialog__close {
      width: 38px;
      height: 38px;
      border: 0;
      border-radius: 999px;
      background: color-mix(in srgb, CanvasText 8%, transparent);
      color: inherit;
      font-size: 26px;
      line-height: 1;
      cursor: pointer;
    }

    .suggest-edit-context {
      margin-bottom: 22px;
      padding: 16px;
      border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
      border-radius: 12px;
      background: color-mix(in srgb, CanvasText 4%, Canvas);
    }

    .suggest-edit-context__metadata {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin: 0 0 14px;
    }

    .suggest-edit-context__metadata dt,
    .suggest-edit-context__label {
      margin: 0 0 3px;
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .suggest-edit-context__metadata dd {
      margin: 0;
      font-weight: 600;
    }

    .suggest-edit-context blockquote {
      margin: 0;
      padding-left: 12px;
      border-left: 4px solid #3b82f6;
      font-style: italic;
    }

    #suggest-edit-form {
      display: grid;
      gap: 18px;
    }

    .suggest-edit-field {
      display: grid;
      gap: 7px;
    }

    .suggest-edit-field label,
    #suggest-edit-placement-group legend {
      font-weight: 700;
    }

    .suggest-edit-field label span {
      font-weight: 400;
    }

    .suggest-edit-dialog input[type="text"],
    .suggest-edit-dialog select,
    .suggest-edit-dialog textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 1px solid color-mix(in srgb, CanvasText 24%, transparent);
      border-radius: 8px;
      background: Canvas;
      color: CanvasText;
      font: inherit;
    }

    .suggest-edit-dialog textarea {
      resize: vertical;
    }

    #suggest-edit-placement-group {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 14px;
      border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
      border-radius: 10px;
    }

    .suggest-edit-choice {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .suggest-edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 4px;
    }

    .suggest-edit-actions button {
      padding: 10px 14px;
      border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      border-radius: 8px;
      background: Canvas;
      color: CanvasText;
      font: 600 14px/1.3 system-ui, sans-serif;
      cursor: pointer;
    }

    .suggest-edit-actions .suggest-edit-primary {
      border-color: #2563eb;
      background: #2563eb;
      color: #ffffff;
    }

    #suggest-edit-preview-section {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
    }

    #suggest-edit-preview {
      max-height: 340px;
      overflow: auto;
      padding: 14px;
      border-radius: 10px;
      background: #111827;
      color: #e5e7eb;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 12px;
    }

    @media (max-width: 560px) {
      .suggest-edit-dialog__body {
        padding: 18px;
      }

      .suggest-edit-context__metadata {
        grid-template-columns: 1fr;
      }

      .suggest-edit-actions {
        flex-direction: column-reverse;
      }

      .suggest-edit-actions button {
        width: 100%;
      }
    }
  `;

  document.head.append(styleElement);
  document.body.append(actionButton, dialog);

  /* ======================================================================== */
  /* FORM ELEMENT REFERENCES                                                  */
  /* ======================================================================== */

  const form = dialog.querySelector("#suggest-edit-form");
  const closeButton = dialog.querySelector("#suggest-edit-dialog-close");
  const cancelButton = dialog.querySelector("#suggest-edit-cancel");
  const pageTitleOutput = dialog.querySelector("#suggest-edit-page-title");
  const sectionTitleOutput = dialog.querySelector(
    "#suggest-edit-section-title",
  );
  const selectedTextOutput = dialog.querySelector("#suggest-edit-selected-text");
  const operationSelect = dialog.querySelector("#suggest-edit-operation");
  const placementGroup = dialog.querySelector(
    "#suggest-edit-placement-group",
  );
  const titleInput = dialog.querySelector("#suggest-edit-title");
  const suggestedTextGroup = dialog.querySelector("#suggest-edit-text-group");
  const suggestedTextInput = dialog.querySelector("#suggest-edit-text");
  const rationaleInput = dialog.querySelector("#suggest-edit-rationale");
  const sourcesInput = dialog.querySelector("#suggest-edit-sources");
  const previewSection = dialog.querySelector(
    "#suggest-edit-preview-section",
  );
  const previewOutput = dialog.querySelector("#suggest-edit-preview");

  /* ======================================================================== */
  /* TEXT AND EDITORIAL ANCHOR UTILITIES                                      */
  /* ======================================================================== */

  function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function cloneSerializable(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /* ======================================================================== */
  /* SOURCE PATH RESOLUTION                                                   */
  /* ======================================================================== */

  function normalizeRoutePath(routePath) {
    let normalizedPath = decodeURIComponent(routePath || "/")
      .split(/[?#]/, 1)[0]
      .replace(/\/{2,}/g, "/");

    if (!normalizedPath.startsWith("/")) {
      normalizedPath = `/${normalizedPath}`;
    }

    if (normalizedPath.length > 1) {
      normalizedPath = normalizedPath.replace(/\/+$/, "");
    }

    return normalizedPath;
  }

  function createSlugRouteCandidates(slug) {
    const normalizedSlug = String(slug || "")
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.(?:md|ipynb)$/i, "");

    const candidates = new Set();

    if (!normalizedSlug) {
      candidates.add("/");
      return candidates;
    }

    candidates.add(normalizeRoutePath(`/${normalizedSlug}`));

    if (normalizedSlug === "index") {
      candidates.add("/");
    } else if (normalizedSlug.endsWith("/index")) {
      candidates.add(
        normalizeRoutePath(
          `/${normalizedSlug.slice(0, -"/index".length)}`,
        ),
      );
    }

    return candidates;
  }

  function createSourceRouteCandidates(sourcePath) {
    const portableSourcePath = String(sourcePath || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\.(?:md|ipynb)$/i, "");

    // Jupyter Book 2 converts underscores to hyphens in public page routes.
    const publicSlug = portableSourcePath
      .split("/")
      .map((segment) => segment.replaceAll("_", "-"))
      .join("/");

    return createSlugRouteCandidates(publicSlug);
  }

  function getCurrentRemixPage() {
    return (
      window.__remixContext?.state?.loaderData?.["routes/_index"]?.page ??
      null
    );
  }

  function getExpandedTableOfContents() {
    return (
      window.__remixContext?.state?.loaderData?.root?.config?.projects?.[0]
        ?.toc ?? null
    );
  }

  function collectSourceFiles(value, sourceFiles, visitedObjects) {
    if (Array.isArray(value)) {
      for (const item of value) {
        collectSourceFiles(item, sourceFiles, visitedObjects);
      }

      return;
    }

    if (
      value === null ||
      typeof value !== "object" ||
      visitedObjects.has(value)
    ) {
      return;
    }

    visitedObjects.add(value);

    if (typeof value.file === "string") {
      sourceFiles.add(
        value.file.replace(/\\/g, "/").replace(/^\/+/, ""),
      );
    }

    for (const childValue of Object.values(value)) {
      collectSourceFiles(childValue, sourceFiles, visitedObjects);
    }
  }

  function routeMatchesCurrentPage(routeCandidates, currentRoute) {
    return routeCandidates.has(currentRoute);
  }

  function resolveSourcePath() {
    const currentRoute = normalizeRoutePath(window.location.pathname);
    const remixPage = getCurrentRemixPage();

    // Remix may retain the data of the page that originally loaded the app
    // after client-side navigation. Trust page.location only when page.slug
    // still corresponds to the current browser route.
    if (
      typeof remixPage?.location === "string" &&
      typeof remixPage?.slug === "string" &&
      routeMatchesCurrentPage(
        createSlugRouteCandidates(remixPage.slug),
        currentRoute,
      )
    ) {
      return remixPage.location.replace(/\\/g, "/").replace(/^\/+/, "");
    }

    const tableOfContents = getExpandedTableOfContents();

    if (!tableOfContents) {
      throw new Error(
        "The expanded MyST table of contents is not available.",
      );
    }

    const sourceFiles = new Set();
    collectSourceFiles(tableOfContents, sourceFiles, new WeakSet());

    const matchingSourceFiles = [...sourceFiles].filter((sourcePath) =>
      routeMatchesCurrentPage(
        createSourceRouteCandidates(sourcePath),
        currentRoute,
      ),
    );

    if (matchingSourceFiles.length === 1) {
      return matchingSourceFiles[0];
    }

    if (matchingSourceFiles.length === 0) {
      throw new Error(
        `No MyST source file matches the current route: ${currentRoute}`,
      );
    }

    throw new Error(
      `Several MyST source files match ${currentRoute}: ${matchingSourceFiles.join(
        ", ",
      )}`,
    );
  }

  function getPageTitle() {
    const mainContent = getMainContent();
    const pageHeading = mainContent.querySelector("h1");
    return normalizeText(pageHeading?.textContent || document.title);
  }

  function getNearestSectionHeading(range) {
    const mainContent = getMainContent();
    const headings = mainContent.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const selectionStartNode = range.startContainer;
    let nearestHeading = null;

    for (const heading of headings) {
      if (heading.contains(selectionStartNode)) {
        nearestHeading = heading;
        break;
      }

      const relativePosition =
        heading.compareDocumentPosition(selectionStartNode);

      if (relativePosition & Node.DOCUMENT_POSITION_FOLLOWING) {
        nearestHeading = heading;
        continue;
      }

      if (relativePosition & Node.DOCUMENT_POSITION_PRECEDING) {
        break;
      }
    }

    return nearestHeading;
  }

  function getSelectionContext(range) {
    const mainContent = getMainContent();

    if (!mainContent) {
      throw new Error("The current main page content was not found.");
    }

    const precedingRange = document.createRange();
    precedingRange.selectNodeContents(mainContent);
    precedingRange.setEnd(range.startContainer, range.startOffset);

    const followingRange = document.createRange();
    followingRange.selectNodeContents(mainContent);
    followingRange.setStart(range.endContainer, range.endOffset);

    const precedingText = normalizeText(precedingRange.toString());
    const followingText = normalizeText(followingRange.toString());

    return {
      prefix: precedingText.slice(-contextCharacterLimit),
      suffix: followingText.slice(0, contextCharacterLimit),
    };
  }

  function createEditorialAnchor(range, selectedText) {
    const sectionHeading = getNearestSectionHeading(range);
    const context = getSelectionContext(range);

    return {
      source: {
        pageTitle: getPageTitle(),
        pageUrl: window.location.href,
        sourcePath: resolveSourcePath(),
        siteRevision: null,
      },
      section: {
        title: sectionHeading
          ? normalizeText(sectionHeading.textContent)
          : getPageTitle(),
        id: sectionHeading?.id || null,
        level: sectionHeading?.tagName.toLowerCase() || null,
      },
      selector: {
        type: "TextQuoteSelector",
        exact: selectedText,
        prefix: context.prefix,
        suffix: context.suffix,
      },
    };
  }

  function getSelectedText() {
    const mainContent = getMainContent();
    const selection = window.getSelection();

    if (
      !mainContent ||
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0
    ) {
      return null;
    }

    const selectedText = normalizeText(selection.toString());

    if (!selectedText) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    const commonElement =
      commonAncestor.nodeType === Node.ELEMENT_NODE
        ? commonAncestor
        : commonAncestor.parentElement;

    if (!commonElement || !mainContent.contains(commonElement)) {
      return null;
    }

    const clonedRange = range.cloneRange();

    return {
      text: selectedText,
      range: clonedRange,
      anchor: createEditorialAnchor(clonedRange, selectedText),
    };
  }

  /* ======================================================================== */
  /* FLOATING ACTION BUTTON                                                   */
  /* ======================================================================== */

  function hideActionButton(options = {}) {
    const { clearSelection = true } = options;

    actionButton.hidden = true;

    if (clearSelection) {
      capturedSelection = null;
    }
  }

  function positionActionButton(range) {
    const selectionRectangle = range.getBoundingClientRect();

    if (selectionRectangle.width === 0 && selectionRectangle.height === 0) {
      hideActionButton();
      return;
    }

    actionButton.hidden = false;

    const buttonRectangle = actionButton.getBoundingClientRect();
    const preferredLeft =
      selectionRectangle.left +
      selectionRectangle.width / 2 -
      buttonRectangle.width / 2;

    const safeLeft = Math.min(
      Math.max(preferredLeft, 12),
      window.innerWidth - buttonRectangle.width - 12,
    );

    const safeTop = Math.min(
      selectionRectangle.bottom + 10,
      window.innerHeight - buttonRectangle.height - 12,
    );

    actionButton.style.left = `${safeLeft}px`;
    actionButton.style.top = `${safeTop}px`;
  }

  function handlePointerSelection(event) {
    // Interactions with the prototype interface must not be mistaken for new
    // selections in the scientific content.
    if (
      actionButton.contains(event.target) ||
      dialog.contains(event.target)
    ) {
      return;
    }

    window.setTimeout(() => {
      let selectionData;

      try {
        selectionData = getSelectedText();
      } catch (error) {
        hideActionButton();
        console.error(
          "[Suggest an edit] Unable to resolve the source page.",
          error,
        );
        return;
      }

      if (!selectionData) {
        hideActionButton();
        return;
      }

      capturedSelection = selectionData;
      positionActionButton(selectionData.range);

      console.info("[Suggest an edit] Valid selection detected.", {
        selectedText: selectionData.text,
      });
    }, 0);
  }

  function handleActionButtonMouseDown(event) {
    // Preserve the selected passage while pressing the floating button.
    event.preventDefault();
  }

  function handleActionButtonClick() {
    if (!capturedSelection) {
      return;
    }

    activeAnchor = cloneSerializable(capturedSelection.anchor);
    lastDraft = null;

    form.reset();
    operationSelect.value = "add";
    updateOperationFields();
    hidePreview();

    pageTitleOutput.textContent = activeAnchor.source.pageTitle;
    sectionTitleOutput.textContent = activeAnchor.section.title;
    selectedTextOutput.textContent = activeAnchor.selector.exact;

    hideActionButton({ clearSelection: false });
    window.getSelection()?.removeAllRanges();

    if (!dialog.open) {
      dialog.showModal();
    }

    titleInput.focus();
  }

  /* ======================================================================== */
  /* FORM BEHAVIOUR                                                           */
  /* ======================================================================== */

  function updateOperationFields() {
    const isAddition = operationSelect.value === "add";

    placementGroup.hidden = !isAddition;
    placementGroup.disabled = !isAddition;
    suggestedTextGroup.hidden = !isAddition;
    suggestedTextInput.disabled = !isAddition;
    suggestedTextInput.required = isAddition;

    if (!isAddition) {
      suggestedTextInput.value = "";
    }
  }

  function hidePreview() {
    previewSection.hidden = true;
    previewOutput.textContent = "";
  }

  function parseSources(value) {
    return value
      .split(/\r?\n/)
      .map((source) => source.trim())
      .filter(Boolean);
  }

  function createSuggestionDraft() {
    const operation = operationSelect.value;
    const formData = new FormData(form);

    return {
      schemaVersion: 1,
      type: "content-suggestion",
      status: "draft",
      createdAt: new Date().toISOString(),
      operation,
      placement: operation === "add" ? formData.get("placement") : null,
      title: titleInput.value.trim(),
      target: cloneSerializable(activeAnchor),
      body: {
        suggestedText:
          operation === "add" ? suggestedTextInput.value.trim() : null,
        rationale: rationaleInput.value.trim(),
        sources: parseSources(sourcesInput.value),
      },
    };
  }

  function handleOperationChange() {
    updateOperationFields();
    hidePreview();
  }

  function handleFormInput() {
    hidePreview();
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    if (!activeAnchor) {
      console.error("[Suggest an edit] No editorial anchor is available.");
      return;
    }

    lastDraft = createSuggestionDraft();
    previewOutput.textContent = JSON.stringify(lastDraft, null, 2);
    previewSection.hidden = false;
    previewSection.scrollIntoView({ behavior: "smooth", block: "nearest" });

    console.info("[Suggest an edit] Draft suggestion prepared.", lastDraft);
  }

  function closeDialog(returnValue = "cancel") {
    if (dialog.open) {
      dialog.close(returnValue);
    }
  }

  function handleDialogClose() {
    activeAnchor = null;
    capturedSelection = null;
    form.reset();
    updateOperationFields();
    hidePreview();
  }

  function handleWindowReposition() {
    if (!dialog.open) {
      hideActionButton();
    }
  }

  /* ======================================================================== */
  /* EVENT REGISTRATION                                                       */
  /* ======================================================================== */

  // Listen on document rather than on the current <main>. This listener
  // survives Remix replacing the article during client-side navigation.
  document.addEventListener("mouseup", handlePointerSelection);
  actionButton.addEventListener("mousedown", handleActionButtonMouseDown);
  actionButton.addEventListener("click", handleActionButtonClick);
  operationSelect.addEventListener("change", handleOperationChange);
  form.addEventListener("input", handleFormInput);
  form.addEventListener("submit", handleFormSubmit);
  closeButton.addEventListener("click", () => closeDialog("close"));
  cancelButton.addEventListener("click", () => closeDialog("cancel"));
  dialog.addEventListener("close", handleDialogClose);
  window.addEventListener("scroll", handleWindowReposition, true);
  window.addEventListener("resize", handleWindowReposition);

  /* ======================================================================== */
  /* DEVELOPMENT API AND CLEANUP                                              */
  /* ======================================================================== */

  window.suggestEditPrototype = {
    getSourcePath() {
      return resolveSourcePath();
    },

    getLastDraft() {
      return lastDraft ? cloneSerializable(lastDraft) : null;
    },

    destroy() {
      document.removeEventListener("mouseup", handlePointerSelection);
      actionButton.removeEventListener("mousedown", handleActionButtonMouseDown);
      actionButton.removeEventListener("click", handleActionButtonClick);
      operationSelect.removeEventListener("change", handleOperationChange);
      form.removeEventListener("input", handleFormInput);
      form.removeEventListener("submit", handleFormSubmit);
      dialog.removeEventListener("close", handleDialogClose);
      window.removeEventListener("scroll", handleWindowReposition, true);
      window.removeEventListener("resize", handleWindowReposition);

      if (dialog.open) {
        dialog.close("destroy");
      }

      actionButton.remove();
      dialog.remove();
      styleElement.remove();
      delete window.suggestEditPrototype;

      console.info("[Suggest an edit] Previous prototype removed.");
    },
  };

  console.info("[Suggest an edit] Form prototype loaded.");
})();