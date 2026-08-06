import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import "./Projects.css";

export function ProjectsPage() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New project form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    api
      .get("/projects")
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setCreating(true);
    try {
      const project = await api.post("/projects", {
        name,
        key: key.toUpperCase(),
        description,
      });
      setProjects((prev) => [project, ...prev]);
      setShowForm(false);
      setName("");
      setKey("");
      setDescription("");
    } catch (err) {
      setFormError(err.message ?? "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="projects-page">
      <header className="top-bar">
        <span className="logo">🚀 DevTrack</span>
        <div className="top-right">
          <span className="user-name">{user?.name}</span>
          <button className="btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="projects-main">
        <div className="projects-header">
          <h2>Projects</h2>
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New project"}
          </button>
        </div>

        {showForm && (
          <form className="new-project-form" onSubmit={handleCreate}>
            <label>
              Project name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label>
              Key <span className="hint">(2–10 uppercase letters, e.g. DEV)</span>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                pattern="[A-Z0-9]{2,10}"
                required
              />
            </label>
            <label>
              Description (optional)
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </label>
            {formError && <p className="form-error">{formError}</p>}
            <button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create project"}
            </button>
          </form>
        )}

        {loading && <p className="state-msg">Loading…</p>}
        {error && <p className="state-msg error">{error}</p>}

        {!loading && !error && projects.length === 0 && (
          <p className="state-msg">
            No projects yet. Create your first one above.
          </p>
        )}

        <ul className="project-list">
          {projects.map((p) => (
            <li key={p.id} className={`project-card ${p.archived ? "archived" : ""}`}>
              <span className="project-key">{p.key}</span>
              <div className="project-info">
                <strong>{p.name}</strong>
                {p.description && <p>{p.description}</p>}
              </div>
              {p.archived && <span className="badge">Archived</span>}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
