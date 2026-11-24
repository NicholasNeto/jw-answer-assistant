import { render, screen } from "@testing-library/react";
import ArticleLoader from "./ArticleLoader";

describe("ArticleLoader", () => {
  it("mostra o texto e usa o tom 'ok' por defeito", () => {
    render(<ArticleLoader label="Telemóvel ligado" />);
    const chip = screen.getByRole("status");
    expect(chip).toHaveTextContent("Telemóvel ligado");
    expect(chip).toHaveClass("status-chip--ok");
  });

  it("aplica o tom pedido", () => {
    render(<ArticleLoader label="IA simulada" tone="warn" />);
    expect(screen.getByRole("status")).toHaveClass("status-chip--warn");
  });
});
