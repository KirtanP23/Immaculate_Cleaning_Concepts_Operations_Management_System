export default function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <p>{label}</p>
      <h2>{value}</h2>
    </div>
  );
}
