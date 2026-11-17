const form = document.getElementById("noteForm");
const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const categoryInput = document.getElementById("category");
const priorityInput = document.getElementById("priority");
const noteIdInput = document.getElementById("noteId");
const notesGrid = document.getElementById("notesGrid");
const emptyState = document.getElementById("emptyState");
const formMessage = document.getElementById("formMessage");
const saveButton = document.getElementById("saveButton");
const cancelEdit = document.getElementById("cancelEdit");
const archiveToggle = document.getElementById("archiveToggle");
let showingArchive = false;
let searchTimer;

document.getElementById("year").textContent = new Date().getFullYear();
contentInput.addEventListener("input", () => {
  document.getElementById("charCount").textContent = contentInput.value.length;
});

function showMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

async function checkHealth() {
  const dot = document.getElementById("statusDot");
  const label = document.getElementById("dbStatus");
  try {
    const health = await api("/api/health");
    const online = health.database === "connected";
    dot.className = `status-dot ${online ? "online" : "offline"}`;
    label.textContent = online ? "MongoDB connected" : "Database disconnected";
  } catch {
    dot.className = "status-dot offline";
    label.textContent = "Server unavailable";
  }
}

async function loadStats() {
  try {
    const stats = await api("/api/stats");
    document.getElementById("statTotal").textContent = stats.total;
    document.getElementById("statActive").textContent = stats.active;
    document.getElementById("statPinned").textContent = stats.pinned;
    document.getElementById("statHigh").textContent = stats.highPriority;
  } catch (error) {
    showMessage(error.message, true);
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function formatDate(value) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function noteCard(note) {
  const safeId = escapeHtml(note._id);
  const pinLabel = note.pinned ? "Unpin" : "Pin";
  const archiveLabel = note.archived ? "Restore" : "Archive";
  return `
    <article class="note-card ${note.pinned ? "pinned" : ""}">
      <div class="note-top">
        <span class="badge">${escapeHtml(note.category)}</span>
        <button class="pin ${note.pinned ? "active" : ""}" data-action="pin" data-id="${safeId}" title="${pinLabel}" aria-label="${pinLabel} note">${note.pinned ? "★" : "☆"}</button>
      </div>
      <h3>${escapeHtml(note.title)}</h3>
      <div class="note-top"><span class="badge priority-${note.priority.toLowerCase()}">${escapeHtml(note.priority)} priority</span></div>
      <p class="note-content">${escapeHtml(note.content)}</p>
      <div class="note-meta">Updated ${formatDate(note.updatedAt)}</div>
      <div class="note-actions">
        <button class="small-btn" data-action="edit" data-id="${safeId}">Edit</button>
        <button class="small-btn neutral" data-action="archive" data-id="${safeId}">${archiveLabel}</button>
        <button class="small-btn danger" data-action="delete" data-id="${safeId}">Delete</button>
      </div>
    </article>`;
}

async function loadNotes() {
  const params = new URLSearchParams({
    search: document.getElementById("search").value,
    category: document.getElementById("filterCategory").value,
    priority: document.getElementById("filterPriority").value,
    archived: showingArchive ? "true" : "false"
  });
  try {
    const notes = await api(`/api/notes?${params.toString()}`);
    notesGrid.innerHTML = notes.map(noteCard).join("");
    emptyState.classList.toggle("hidden", notes.length !== 0);
    document.getElementById("noteCount").textContent = notes.length;
    await loadStats();
    await checkHealth();
  } catch (error) {
    notesGrid.innerHTML = "";
    emptyState.classList.remove("hidden");
    emptyState.querySelector("h3").textContent = "Could not load notes";
    emptyState.querySelector("p").textContent = error.message;
    await checkHealth();
  }
}

function resetForm() {
  form.reset();
  noteIdInput.value = "";
  document.getElementById("charCount").textContent = "0";
  document.getElementById("formHeading").textContent = "Create a note";
  saveButton.textContent = "Save note";
  cancelEdit.classList.add("hidden");
  showMessage("");
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const id = noteIdInput.value;
  const body = {
    title: titleInput.value.trim(),
    content: contentInput.value.trim(),
    category: categoryInput.value,
    priority: priorityInput.value
  };
  if (!body.title || !body.content) return showMessage("Please enter both a title and content.", true);
  saveButton.disabled = true;
  saveButton.textContent = id ? "Updating…" : "Saving…";
  try {
    await api(id ? `/api/notes/${id}` : "/api/notes", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body)
    });
    resetForm();
    showMessage(id ? "Note updated successfully." : "Note saved successfully.");
    await loadNotes();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = noteIdInput.value ? "Update note" : "Save note";
  }
});

cancelEdit.addEventListener("click", resetForm);
archiveToggle.addEventListener("click", async () => {
  showingArchive = !showingArchive;
  archiveToggle.textContent = showingArchive ? "Back to active notes" : "View archive";
  document.querySelector(".section-title .eyebrow").textContent = showingArchive ? "ARCHIVED NOTES" : "YOUR LIBRARY";
  await loadNotes();
});

for (const id of ["filterCategory", "filterPriority"]) {
  document.getElementById(id).addEventListener("change", loadNotes);
}
document.getElementById("search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadNotes, 250);
});

notesGrid.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    const notes = await api("/api/notes?archived=all");
    const note = notes.find(item => item._id === id);
    if (!note) throw new Error("Note not found. Refresh and try again.");

    if (action === "edit") {
      noteIdInput.value = note._id;
      titleInput.value = note.title;
      contentInput.value = note.content;
      categoryInput.value = note.category;
      priorityInput.value = note.priority;
      document.getElementById("charCount").textContent = contentInput.value.length;
      document.getElementById("formHeading").textContent = "Edit note";
      saveButton.textContent = "Update note";
      cancelEdit.classList.remove("hidden");
      showMessage("Editing this note.");
      titleInput.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (action === "delete") {
      if (!window.confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
      await api(`/api/notes/${id}`, { method: "DELETE" });
      showMessage("Note deleted successfully.");
    }
    if (action === "pin") {
      await api(`/api/notes/${id}`, { method: "PUT", body: JSON.stringify({ pinned: !note.pinned }) });
    }
    if (action === "archive") {
      await api(`/api/notes/${id}`, { method: "PUT", body: JSON.stringify({ archived: !note.archived }) });
      showMessage(note.archived ? "Note restored." : "Note archived.");
    }
    await loadNotes();
  } catch (error) {
    showMessage(error.message, true);
  }
});

loadNotes();
