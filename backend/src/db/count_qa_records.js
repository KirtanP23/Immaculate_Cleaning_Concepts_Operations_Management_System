const { getDb } = require("./database");

async function main() {
  const db = await getDb();
  const clients = await db.collection("clients").countDocuments({ name: /^QA Temp Client/i });
  const schedules = await db.collection("schedules").countDocuments({ notes: /^QA/i });
  const staff = await db.collection("staff").countDocuments({
    $or: [
      { username: /^qa\./i },
      { full_name: /^QA /i }
    ]
  });

  console.log(JSON.stringify({ clients, schedules, staff }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
