import { useEffect, useState } from "react";
import { apiGet } from "./api/client";
import "./App.css";

// Scaffold page: proves the React → FastAPI chain works.
// Replaced by real pages (login, projects, board) in later steps.
function App() {
  // status is one of: "checking" | "online" | "offline"
  const [status, setStatus] = useState("checking");
  const [apiInfo, setApiInfo] = useState(null);

  // useEffect with [] runs once, right after the component first renders —
  // the standard place to fetch initial data.
  useEffect(() => {
    apiGet("/health")
      .then((data) => {
        setApiInfo(data);
        setStatus("online");
      })
      .catch(() => setStatus("offline"));
  }, []);

  return (
    <main className="scaffold">
      <h1>🚀 DevTrack</h1>
      <p>Project management &amp; bug tracking with AI-assisted triage</p>

      <div className={`api-status ${status}`}>
        {status === "checking" && "Checking backend…"}
        {status === "online" &&
          `✅ Backend online — ${apiInfo.app} v${apiInfo.version}`}
        {status === "offline" &&
          "❌ Backend unreachable — is uvicorn running on port 8000?"}
      </div>
    </main>
  );
}

export default App;
