import { useEffect, useState } from "react";
import { api, setAuthToken } from "./api";
import LoginPanel from "./components/LoginPanel";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import StaffPage from "./pages/StaffPage";
import SchedulePage from "./pages/SchedulePage";
import ReportsPage from "./pages/ReportsPage";
import { EquipmentPage } from "./pages/EquipmentPage";
import ContractsPage from "./pages/ContractsPage";

const tabs = [
  "Dashboard",
  "Clients",
  "Staff",
  "Equipment",
  "Schedule",
  "Contracts",
  "Reports"
];

const roleTabs = {
  Admin: tabs,
  Owner: tabs,
  Supervisor: ["Dashboard", "Schedule", "Reports"],
  Cleaner: ["Schedule"]
};

const tabDescriptions = {
  Dashboard: "A calm overview of today’s operations, staffing, and alerts.",
  Clients: "Track active accounts, service cadence, and onboarding details.",
  Staff: "Manage your team roster, roles, and employment details.",
  Equipment: "Keep supplies organized, available, and ready for each shift.",
  Schedule: "Plan teams, allocate equipment, and monitor appointment flow.",
  Contracts: "Review agreement windows and notes for active clients.",
  Reports: "Check weekly schedules, staff allocation, and client history."
};

export default function App() {
  const [activeTab, setActiveTab] = useState("Schedule");
  const [currentUser, setCurrentUser] = useState(null);
  const [staff, setStaff] = useState([]);
  const [sessionReady, setSessionReady] = useState(false);

  const role = currentUser?.role;
  const visibleTabs = roleTabs[role] || [];

  useEffect(() => {
    const boot = async () => {
      const token = localStorage.getItem("iccAuthToken");
      if (!token) {
        setSessionReady(true);
        return;
      }

      setAuthToken(token);
      try {
        const me = await api.me();
        setCurrentUser(me.user);
      } catch (_error) {
        setAuthToken("");
        localStorage.removeItem("iccAuthToken");
      } finally {
        setSessionReady(true);
      }
    };

    boot().catch(console.error);
  }, []);

  useEffect(() => {
    if (!currentUser || role === "Cleaner") return;
    api.getStaff().then(setStaff).catch(console.error);
  }, [currentUser, role]);

  useEffect(() => {
    if (!currentUser) return;
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]);
    }
  }, [activeTab, visibleTabs, currentUser]);

  const handleLogin = async (credentials) => {
    const result = await api.login(credentials);
    setAuthToken(result.token);
    localStorage.setItem("iccAuthToken", result.token);
    setCurrentUser(result.user);
    setActiveTab((roleTabs[result.user.role] || ["Schedule"])[0]);
  };

  const handleLogout = () => {
    setAuthToken("");
    localStorage.removeItem("iccAuthToken");
    setCurrentUser(null);
    setStaff([]);
    setActiveTab("Schedule");
  };

  const refreshStaff = async () => {
    if (!currentUser || currentUser.role === "Cleaner") return;
    const rows = await api.getStaff();
    setStaff(rows);
  };

  if (!sessionReady) {
    return (
      <div className="layout">
        <section className="panel panel-loading">
          <p>Loading session...</p>
        </section>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="layout layout-auth">
        <section className="welcome-shell">
          <div className="welcome-copy">
            <span className="brand-badge brand-badge-light">Immaculate Cleaning Concepts</span>
            <p className="eyebrow">Cleaning operations platform</p>
            <h1>From dusty to done, with every shift accounted for.</h1>
            <p className="hero-subtitle">
              Sign in to manage clients, schedules, staff, equipment, and reporting in one place.
            </p>
            <div className="welcome-notes">
              <div className="note-card">
                <strong>Calm dashboard</strong>
                <span>Daily operations, staffing, and alerts in one clear view.</span>
              </div>
              <div className="note-card">
                <strong>Real-time coordination</strong>
                <span>Keep teams, services, and equipment aligned with live backend data.</span>
              </div>
            </div>
          </div>
          <div className="hero-illustration" aria-hidden="true">
            <div className="shape-sun" />
            <div className="shape-blob" />
            <div className="illustration-card illustration-card-tall" />
            <div className="illustration-card illustration-card-wide" />
            <div className="illustration-line illustration-line-left" />
            <div className="illustration-line illustration-line-right" />
          </div>
        </section>
        <LoginPanel onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="layout">
      <header className="top-bar top-bar-app">
        <div className="hero-copy hero-copy-app">
          <span className="brand-badge brand-badge-light">Immaculate Cleaning Concepts</span>
          <p className="eyebrow">ICC management system</p>
          <h1>{activeTab}</h1>
          <p className="hero-subtitle">{tabDescriptions[activeTab]}</p>
        </div>
        <div className="session-meta">
          <div className="session-chip">
            <span className="session-label">Signed in</span>
            <strong>{currentUser.full_name}</strong>
            <span>{currentUser.role}</span>
          </div>
          <button className="ghost-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
        <div className="top-bar-art" aria-hidden="true">
          <span className="top-bar-orb top-bar-orb-peach" />
          <span className="top-bar-orb top-bar-orb-blue" />
        </div>
      </header>

      <section className="nav-shell">
        <nav className="tabs">
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              className={tab === activeTab ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
      </section>

      <main className="app-main">
        {activeTab === "Dashboard" && <DashboardPage role={role} />}
        {activeTab === "Clients" && <ClientsPage role={role} />}
        {activeTab === "Staff" && <StaffPage role={role} onStaffUpdated={refreshStaff} />}
        {activeTab === "Equipment" && <EquipmentPage currentUser={currentUser} />}
        {activeTab === "Schedule" && (
          <SchedulePage role={role} currentUser={currentUser} staff={staff} />
        )}
        {activeTab === "Contracts" && <ContractsPage role={role} />}
        {activeTab === "Reports" && <ReportsPage role={role} />}
      </main>
    </div>
  );
}
