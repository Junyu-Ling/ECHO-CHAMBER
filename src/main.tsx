import { createRoot } from "react-dom/client";
import { preloadHeroAssets } from "./app/lib/preloadHero";
import App from "./app/App.tsx";
import "./styles/index.css";

preloadHeroAssets();

createRoot(document.getElementById("root")!).render(<App />);
