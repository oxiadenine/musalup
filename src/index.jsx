import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { HelmetProvider } from "react-helmet-async";
import { Home } from "./pages/home";
import { NotFound } from "./pages/not-found";
import "./index.css";

const root = document.getElementById("root");

const router = createBrowserRouter([
  {
    path: "/",
    loader: async () => (await (await fetch("/api")).json()).data,
    Component: Home
  },
  { path: "*", Component: NotFound }
]);

const app = (
  <HelmetProvider>
    <RouterProvider router={router} />
  </HelmetProvider>
);

document.addEventListener("DOMContentLoaded", () => {
  if (import.meta.hot) {
    (import.meta.hot.data.root ??= createRoot(root).render(app));
  } else {
    createRoot(root).render(app);
  }
});
