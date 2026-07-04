import { createRoot } from "react-dom/client";
import "../styles/globals.css";
import { PopupApp } from "./popup-app";

createRoot(document.getElementById("root")!).render(<PopupApp />);
