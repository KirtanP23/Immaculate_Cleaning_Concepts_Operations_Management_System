const { getDb } = require("./database");

async function fixScheduleStatusOrder() {
  const db = await getDb();
  const schedules = db.collection("schedules");

  const completedSchedules = await schedules.find({ status: "Completed" }).toArray();
  let fixedCount = 0;

  for (const schedule of completedSchedules) {
    const earlierPendingCount = await schedules.countDocuments({
      supervisor_id: schedule.supervisor_id,
      schedule_date: schedule.schedule_date,
      start_time: { $lt: schedule.start_time },
      status: { $in: ["Planned", "InProgress"] }
    });

    if (earlierPendingCount > 0) {
      await schedules.updateOne(
        { _id: schedule._id },
        { $set: { status: "Planned" } }
      );
      fixedCount += 1;
    }
  }

  console.log(`Inconsistent completed schedules reverted: ${fixedCount}`);
}

fixScheduleStatusOrder()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to fix schedule statuses:", error);
    process.exit(1);
  });
