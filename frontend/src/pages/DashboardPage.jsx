import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";

export default function DashboardPage({ role }) {
  const [data, setData] = useState({
    activeClients: 0,
    staffWorkingToday: 0,
    todaysSchedules: [],
    equipmentAlerts: []
  });

  useEffect(() => {
    api.getDashboardSummary().then(setData).catch(console.error);
  }, []);

  const isSupervisor = role === "Supervisor";
  const scheduleLabel = useMemo(
    () => (isSupervisor ? "My Upcoming Appointments" : "Today's Schedules"),
    [isSupervisor]
  );
  const scheduleHeading = isSupervisor ? "My Upcoming Appointments" : "Today's Schedule";

  const scheduleColumns = [
    { key: "id", label: "#", render: (_row, idx) => idx + 1 },
    { key: "start_time", label: "Start" },
    { key: "client_name", label: "Client" },
    { key: "service_name", label: "Service" },
    { key: "supervisor_name", label: "Supervisor" },
    { key: "status", label: "Status" }
  ];

  return (
    <div className="page-grid">
      <section className="panel page-intro">
        <div className="section-heading">
          <p className="eyebrow">Overview</p>
          <h3>Today at a glance</h3>
          <p className="muted section-muted">
            Review live schedules, staffing, and equipment readiness without leaving the dashboard.
          </p>
        </div>
      </section>

      <div className="stats-row">
        <StatCard label="Active Clients" value={data.activeClients} />
        <StatCard label="Staff Working Today" value={data.staffWorkingToday} />
        <StatCard label={scheduleLabel} value={data.todaysSchedules.length} />
        <StatCard label="Equipment Alerts" value={data.equipmentAlerts.length} />
      </div>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Schedules</p>
          <h3>{scheduleHeading}</h3>
        </div>
        <DataTable columns={scheduleColumns} rows={data.todaysSchedules} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Readiness</p>
          <h3>Equipment Alerts</h3>
        </div>
        <DataTable
          columns={[
            { key: "equipment_name", label: "Equipment" },
            { key: "quantity_available", label: "Available Qty" },
            { key: "status", label: "Status" },
            { key: "maintenance_date", label: "Maintenance Date" }
          ]}
          rows={data.equipmentAlerts}
        />
      </section>
    </div>
  );
}
