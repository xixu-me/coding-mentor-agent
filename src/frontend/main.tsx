import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("Missing app root");

createRoot(appRoot).render(<App />);
