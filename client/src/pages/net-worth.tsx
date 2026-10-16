import { Switch, Route } from "wouter";
import DashboardPage from "./dashboard";
import AssetsPage from "./assets";
import LiabilitiesPage from "./liabilities";
import LiabilityMapPage from "./liability-map";
import { NetWorthTabs } from "@/components/net-worth-tabs";

export default function NetWorthPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <NetWorthTabs />
      <div className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/assets" component={AssetsPage} />
          <Route path="/liabilities" component={LiabilitiesPage} />
          <Route path="/liability-map" component={LiabilityMapPage} />
        </Switch>
      </div>
    </div>
  );
}