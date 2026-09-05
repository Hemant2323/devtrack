import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/primitives/Button";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.code}>404</span>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.description}>
          That page doesn&rsquo;t exist, or the project it belonged to is no longer
          available to you.
        </p>
        <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => navigate("/projects")}>
          Back to projects
        </Button>
      </div>
    </div>
  );
}
