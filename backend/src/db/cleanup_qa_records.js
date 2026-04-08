const { getDb } = require("./database");

async function cleanupQaRecords() {
  const db = await getDb();
  const clients = db.collection("clients");
  const schedules = db.collection("schedules");
  const staff = db.collection("staff");
  const staffAssignments = db.collection("staff_assignments");
  const scheduleEquipment = db.collection("schedule_equipment");

  const qaClients = await clients.find({ name: /^QA Temp Client/i }).project({ _id: 1 }).toArray();
  const qaClientIds = qaClients.map((client) => client._id);

  const qaSchedulesByNote = await schedules
    .find({ notes: /^QA/i })
    .project({ _id: 1 })
    .toArray();
  const qaScheduleIdsByNote = qaSchedulesByNote.map((schedule) => schedule._id);

  const qaStaff = await staff
    .find({
      $or: [
        { username: /^qa\./i },
        { full_name: /^QA /i }
      ]
    })
    .project({ _id: 1 })
    .toArray();
  const qaStaffIds = qaStaff.map((member) => member._id);

  const qaSchedulesByClient = qaClientIds.length
    ? await schedules.find({ client_id: { $in: qaClientIds } }).project({ _id: 1 }).toArray()
    : [];
  const qaScheduleIdsByClient = qaSchedulesByClient.map((schedule) => schedule._id);

  const qaScheduleIds = [...new Set([...qaScheduleIdsByNote, ...qaScheduleIdsByClient])];

  if (qaScheduleIds.length > 0) {
    await staffAssignments.deleteMany({ schedule_id: { $in: qaScheduleIds } });
    await scheduleEquipment.deleteMany({ schedule_id: { $in: qaScheduleIds } });
    await schedules.deleteMany({ _id: { $in: qaScheduleIds } });
  }

  if (qaClientIds.length > 0) {
    await clients.deleteMany({ _id: { $in: qaClientIds } });
  }

  if (qaStaffIds.length > 0) {
    await staff.deleteMany({ _id: { $in: qaStaffIds } });
  }

  console.log(JSON.stringify({
    removedClients: qaClientIds.length,
    removedSchedules: qaScheduleIds.length,
    removedStaff: qaStaffIds.length
  }));
}

cleanupQaRecords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("QA cleanup failed:", error);
    process.exit(1);
  });
