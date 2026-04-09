const DEFAULT_API_URL =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? window.location.origin
    : "http://localhost:4000";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_URL).replace(/\/$/, "");
let authToken = "";

export function setAuthToken(token) {
  authToken = token || "";
}

async function request(path, options = {}) {
  const headers = {
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    headers,
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Request failed");
  }

  return response.json();
}

export const api = {
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/auth/me"),

  getClients: () => request("/clients"),
  addClient: (payload) => request("/clients", { method: "POST", body: JSON.stringify(payload) }),
  updateClient: (id, payload) =>
    request(`/clients/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteClient: (id) => request(`/clients/${id}`, { method: "DELETE" }),

  getStaff: () => request("/staff"),
  addStaff: (payload) => request("/staff", { method: "POST", body: JSON.stringify(payload) }),
  deleteStaff: (id) => request(`/staff/${id}`, { method: "DELETE" }),
  getStaffAvailability: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/staff-availability${qs ? `?${qs}` : ""}`);
  },
  addStaffAvailability: (payload) =>
    request("/staff-availability", { method: "POST", body: JSON.stringify(payload) }),

  getEquipment: () => request("/equipment"),
  addEquipment: (payload) => request("/equipment", { method: "POST", body: JSON.stringify(payload) }),
  updateEquipment: (id, payload) =>
    request(`/equipment/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteEquipment: (id) => request(`/equipment/${id}`, { method: "DELETE" }),

  getServices: () => request("/services"),
  addService: (payload) => request("/services", { method: "POST", body: JSON.stringify(payload) }),

  getSchedules: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/schedule${qs ? `?${qs}` : ""}`);
  },
  addSchedule: (payload) => request("/schedule", { method: "POST", body: JSON.stringify(payload) }),
  updateSchedule: (id, payload) =>
    request(`/schedule/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSchedule: (id) => request(`/schedule/${id}`, { method: "DELETE" }),
  checkScheduleConflicts: (payload) =>
    request("/schedule/check-conflicts", { method: "POST", body: JSON.stringify(payload) }),
  updateScheduleStatus: (id, status) =>
    request(`/schedule/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getDashboardSummary: () => request("/dashboard-summary"),
  getWeeklyScheduleReport: (date) => request(`/reports/weekly-schedule?date=${date}`),
  getStaffAllocationReport: () => request("/reports/staff-allocation"),
  getClientHistory: (id) => request(`/clients/${id}/history`),

  getContracts: () => request("/contracts"),
  addContract: (payload) => request("/contracts", { method: "POST", body: JSON.stringify(payload) })
};
