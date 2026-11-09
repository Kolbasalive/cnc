import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { NotFoundPage } from "@/pages/not-found-page";
import { OverviewPage } from "@/pages/overview-page";

const StandPage = lazy(() =>
  import("@/pages/stand-page").then((module) => ({ default: module.StandPage })),
);
const MqttPage = lazy(() =>
  import("@/pages/mqtt-page").then((module) => ({ default: module.MqttPage })),
);
const AnalyticsPage = lazy(() =>
  import("@/pages/analytics-page").then((module) => ({ default: module.AnalyticsPage })),
);

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="stands/:id" element={<StandPage />} />
        <Route path="mqtt" element={<MqttPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
