import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dispatchLegacyEvent } from "../shared/legacy-events";
import legacyMarkup from "./legacy-markup.html?raw";
import { InventoryModule } from "../modules/inventory/InventoryModule";
import { AgriculturalModule } from "../modules/agricultural/AgriculturalModule";
import { LivestockModule } from "../modules/livestock/LivestockModule";
import { FarmsModule } from "../modules/farms/FarmsModule";
import { FinanceModule } from "../modules/finance/FinanceModule";
import { HRModule } from "../modules/hr/HRModule";
import { ReportsModule } from "../modules/reports/ReportsModule";
import { AlertsModule } from "../modules/alerts/AlertsModule";
import { DashboardModule } from "../modules/dashboard/DashboardModule";
import { SettingsModule } from "../modules/settings/SettingsModule";

export function LegacyMarkup({ authenticated, actions }: { authenticated: boolean; actions: Record<string, unknown> | null }) {
  const root = useRef<HTMLDivElement>(null);
  const [inventoryHost, setInventoryHost] = useState<HTMLElement | null>(null);
  const [agriculturalHost, setAgriculturalHost] = useState<HTMLElement | null>(null);
  const [livestockHost, setLivestockHost] = useState<HTMLElement | null>(null);
  const [farmsHost, setFarmsHost] = useState<HTMLElement | null>(null);
  const [financeHost, setFinanceHost] = useState<HTMLElement | null>(null);
  const [hrHost, setHrHost] = useState<HTMLElement | null>(null);
  const [reportsHost, setReportsHost] = useState<HTMLElement | null>(null);
  const [alertsHost, setAlertsHost] = useState<HTMLElement | null>(null);
  const [dashboardHost, setDashboardHost] = useState<HTMLElement | null>(null);
  const [settingsHost, setSettingsHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setInventoryHost(root.current?.querySelector<HTMLElement>("#page-inventario") || null);
    setAgriculturalHost(root.current?.querySelector<HTMLElement>("#page-agricola") || null);
    setLivestockHost(root.current?.querySelector<HTMLElement>("#page-pecuario") || null);
    setFarmsHost(root.current?.querySelector<HTMLElement>("#page-fincas") || null);
    setFinanceHost(root.current?.querySelector<HTMLElement>("#page-financiero") || null);
    setHrHost(root.current?.querySelector<HTMLElement>("#page-rrhh") || null);
    setReportsHost(root.current?.querySelector<HTMLElement>("#page-reportes") || null);
    setAlertsHost(root.current?.querySelector<HTMLElement>("#page-alertas") || null);
    setDashboardHost(root.current?.querySelector<HTMLElement>("#page-dashboard") || null);
    setSettingsHost(root.current?.querySelector<HTMLElement>("#page-configuracion") || null);
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element || !actions) return;
    element.querySelectorAll<HTMLElement>(".nav-item").forEach((item) => {
      const label = item.querySelector<HTMLElement>("span:not(.ico)")?.textContent?.trim();
      if (label) {
        item.title = label;
        item.setAttribute("aria-label", label);
      }
    });
    const onEvent = (event: Event) => dispatchLegacyEvent(event, actions);
    ["click", "change", "input"].forEach((eventName) => element.addEventListener(eventName, onEvent));
    return () => ["click", "change", "input"].forEach((eventName) => element.removeEventListener(eventName, onEvent));
  }, [actions]);

  return (
    <>
    <div
      ref={root}
      id="legacy-interface"
      className={authenticated ? "" : "hidden"}
      dangerouslySetInnerHTML={{ __html: legacyMarkup }}
    />
    {inventoryHost && createPortal(<InventoryModule />, inventoryHost)}
    {agriculturalHost && createPortal(<AgriculturalModule />, agriculturalHost)}
    {livestockHost && createPortal(<LivestockModule />, livestockHost)}
    {farmsHost && createPortal(<FarmsModule />, farmsHost)}
    {financeHost && createPortal(<FinanceModule />, financeHost)}
    {hrHost && createPortal(<HRModule />, hrHost)}
    {reportsHost && createPortal(<ReportsModule />, reportsHost)}
    {alertsHost && createPortal(<AlertsModule />, alertsHost)}
    {dashboardHost && createPortal(<DashboardModule />, dashboardHost)}
    {settingsHost && createPortal(<SettingsModule />, settingsHost)}
    </>
  );
}
