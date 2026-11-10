import { createRoot } from "react-dom/client";
import App from "./App";
import "./css/style.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("No se encontró el elemento raíz de AgroSen.");
}

createRoot(rootElement).render(<App />);
