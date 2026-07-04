import { createFileRoute } from "@tanstack/react-router";
import ImmoPilotApp from "../components/ImmoPilotApp";

export const Route = createFileRoute("/")({
  component: ImmoPilotApp,
});
