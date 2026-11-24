import { useState } from "react";
import Button from "../Button";
import "./ArticleLoader.css";
import { type FormEvent } from "react";

type ArticleLoaderProps = {
  onLoad: (url: string) => void;
  loading?: boolean;
  error?: string;
  article: { title: string; week: string; questions: number };
};

export default function ArticleLoader({
  onLoad,
  loading,
  error,
  article,
}: ArticleLoaderProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim() && !loading) onLoad(url.trim());
  };

  return (
    <section className="card">
      <h2>Artigo</h2>
      <div className="muted">
        Cole o link do estudo (Sentinela) ou do caderno da reunião em
        wol.jw.org.
      </div>

      <form className="loader" onSubmit={handleSubmit}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://wol.jw.org/..."
          aria-label="Link do artigo"
        />

        <Button
          type="submit"
          variant="primary"
          disabled={!url.trim() || loading}
        >
          Carregar artigo
        </Button>
      </form>

      <div className="article-title">
        Pregando as boas novas em “todas as línguas das nações”{" "}
        <span className="muted">
          · {article.week} · {article.questions} perguntas
        </span>
      </div>
    </section>
  );
}
