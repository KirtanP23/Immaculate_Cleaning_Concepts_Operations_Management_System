const { getDb } = require("./database");

async function resetDb() {
  const db = await getDb();
  
  const collections = [
    "clients", "staff", "services", "schedules", "staff_assignments",
    "equipment", "staff_availability", "contracts", "service_equipment", "schedule_equipment"
  ];
  
  for (const collName of collections) {
    try {
      await db.collection(collName).drop();
      console.log(`Dropped collection: ${collName}`);
    } catch (error) {
      console.log(`Collection ${collName} doesn't exist or already dropped`);
    }
  }
  
  console.log("Reset complete");
  process.exit(0);
}

resetDb().catch((error) => {
  console.error("Reset failed:", error);
  process.exit(1);
});
