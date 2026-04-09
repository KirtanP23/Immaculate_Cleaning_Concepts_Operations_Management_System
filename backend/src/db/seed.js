const { initDb } = require("./init");
const { ObjectId } = require("mongodb");

async function seedDatabase(options = {}) {
  const db = options.db || (await initDb());
  const preserveStaff =
    typeof options.preserveStaff === "boolean"
      ? options.preserveStaff
      : process.argv.includes("--preserve-staff") || process.env.PRESERVE_STAFF === "1";

  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const date = local.toISOString().slice(0, 10);

  // Clear collections (preserve staff if flag is set)
  await db.collection("staff_assignments").deleteMany({});
  await db.collection("schedules").deleteMany({});
  await db.collection("service_equipment").deleteMany({});
  await db.collection("schedule_equipment").deleteMany({});
  await db.collection("equipment").deleteMany({});
  await db.collection("services").deleteMany({});
  await db.collection("clients").deleteMany({});
  await db.collection("staff_availability").deleteMany({});
  await db.collection("contracts").deleteMany({});

  if (!preserveStaff) {
    await db.collection("staff").deleteMany({});
  }

  // Insert clients
  const clientsCollection = db.collection("clients");
  const clientResults = await clientsCollection.insertMany([
    {
      name: "BlueWave Offices",
      client_type: "Commercial",
      phone: "555-1111",
      email: "admin@bluewave.com",
      address: "101 Main Street",
      assessment_date: new Date(new Date().setDate(new Date().getDate() - 20)).toISOString().slice(0, 10),
      ideal_staff_count: 4,
      equipment_required_notes: "Steam cleaner and ladder needed",
      service_frequency: "Daily",
      service_time_range: "07:00-09:00,17:00-19:00",
      special_notes: "Banking area requires extra sanitation",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      name: "Sunrise Apartments",
      client_type: "Commercial",
      phone: "555-2222",
      email: "ops@sunrise.com",
      address: "22 Lake Avenue",
      assessment_date: new Date(new Date().setDate(new Date().getDate() - 12)).toISOString().slice(0, 10),
      ideal_staff_count: 3,
      equipment_required_notes: "Mop kits and safety signs",
      service_frequency: "Weekly",
      service_time_range: "10:00-13:00",
      special_notes: "Use low-odor chemicals",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      name: "GreenLeaf School",
      client_type: "Residential",
      phone: "555-3333",
      email: "support@greenleaf.edu",
      address: "88 Hill Road",
      assessment_date: new Date(new Date().setDate(new Date().getDate() - 8)).toISOString().slice(0, 10),
      ideal_staff_count: 5,
      equipment_required_notes: "Vacuum and floor scrubber",
      service_frequency: "Recurring",
      service_time_range: "14:00-18:00",
      special_notes: "After-school only cleaning window",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      name: "OldTown Mall",
      client_type: "Commercial",
      phone: "555-4444",
      email: "contact@oldtownmall.com",
      address: "16 City Center",
      assessment_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
      ideal_staff_count: 6,
      equipment_required_notes: "Large floor scrubber",
      service_frequency: "Weekly",
      service_time_range: "06:00-10:00",
      special_notes: "Inactive legacy client",
      is_active: false,
      created_at: new Date().toISOString()
    }
  ]);

  // Insert services
  const servicesCollection = db.collection("services");
  const serviceResults = await servicesCollection.insertMany([
    {
      service_name: "Office Deep Clean",
      description: "Deep cleaning for office spaces",
      frequency: "Daily",
      start_time: "07:00",
      end_time: "09:00",
      estimated_hours: 4
    },
    {
      service_name: "Apartment Common Area",
      description: "Lobbies, corridors, and shared spaces",
      frequency: "Weekly",
      start_time: "10:00",
      end_time: "13:00",
      estimated_hours: 3
    },
    {
      service_name: "Post-Event Cleanup",
      description: "Quick turnaround cleanup after events",
      frequency: "Recurring",
      start_time: "14:00",
      end_time: "18:00",
      estimated_hours: 5
    }
  ]);

  // Insert equipment
  const equipmentCollection = db.collection("equipment");
  const equipmentResults = await equipmentCollection.insertMany([
    {
      equipment_name: "Vacuum Cleaner",
      quantity_available: 5,
      status: "Available",
      maintenance_date: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0, 10)
    },
    {
      equipment_name: "Mop Kit",
      quantity_available: 12,
      status: "Available",
      maintenance_date: new Date(new Date().setDate(new Date().getDate() - 14)).toISOString().slice(0, 10)
    },
    {
      equipment_name: "Steam Cleaner",
      quantity_available: 2,
      status: "Maintenance",
      maintenance_date: new Date(new Date().setDate(new Date().getDate() - 35)).toISOString().slice(0, 10)
    }
  ]);

  // Insert service equipment
  const serviceEquipCollection = db.collection("service_equipment");
  await serviceEquipCollection.insertMany([
    {
      service_id: serviceResults.insertedIds[0],
      equipment_id: equipmentResults.insertedIds[0],
      qty_required: 2
    },
    {
      service_id: serviceResults.insertedIds[0],
      equipment_id: equipmentResults.insertedIds[1],
      qty_required: 3
    },
    {
      service_id: serviceResults.insertedIds[1],
      equipment_id: equipmentResults.insertedIds[1],
      qty_required: 2
    },
    {
      service_id: serviceResults.insertedIds[2],
      equipment_id: equipmentResults.insertedIds[0],
      qty_required: 1
    },
    {
      service_id: serviceResults.insertedIds[2],
      equipment_id: equipmentResults.insertedIds[2],
      qty_required: 1
    }
  ]);

  // Insert or upsert staff
  const staffCollection = db.collection("staff");
  const staffSeedDocs = [
    {
      full_name: "Kirtan Patel",
      username: "admin.icc",
      password: "admin123",
      role: "Admin",
      employment_type: "Full-Time",
      phone: "555-9011",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      full_name: "ICC Owner",
      username: "owner.icc",
      password: "owner123",
      role: "Owner",
      employment_type: "Full-Time",
      phone: "555-9000",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      full_name: "Neha Kapoor",
      username: "sup.neha",
      password: "super123",
      role: "Supervisor",
      employment_type: "Full-Time",
      phone: "555-9012",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      full_name: "Rohan Mehta",
      username: "sup.rohan",
      password: "super123",
      role: "Supervisor",
      employment_type: "Part-Time",
      phone: "555-9013",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      full_name: "Isha Verma",
      username: "clean.isha",
      password: "clean123",
      role: "Cleaner",
      employment_type: "Full-Time",
      phone: "555-9101",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      full_name: "Karan Das",
      username: "clean.karan",
      password: "clean123",
      role: "Cleaner",
      employment_type: "Part-Time",
      phone: "555-9102",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      full_name: "Maya Singh",
      username: "clean.maya",
      password: "clean123",
      role: "Cleaner",
      employment_type: "Seasonal",
      phone: "555-9103",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      full_name: "Pooja Nair",
      username: "clean.pooja",
      password: "clean123",
      role: "Cleaner",
      employment_type: "Part-Time",
      phone: "555-9104",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      full_name: "Arjun Rao",
      username: "clean.arjun",
      password: "clean123",
      role: "Cleaner",
      employment_type: "Seasonal",
      phone: "555-9105",
      is_active: true,
      created_at: new Date().toISOString()
    }
  ];

  let staffIds = [];
  if (preserveStaff) {
    const idsByUsername = new Map();
    for (const doc of staffSeedDocs) {
      await staffCollection.updateOne(
        { username: doc.username },
        {
          $set: {
            full_name: doc.full_name,
            role: doc.role,
            employment_type: doc.employment_type,
            phone: doc.phone,
            is_active: doc.is_active
          },
          $setOnInsert: {
            username: doc.username,
            password: doc.password,
            created_at: doc.created_at
          }
        },
        { upsert: true }
      );
    }

    const usernames = staffSeedDocs.map((doc) => doc.username);
    const existingStaff = await staffCollection
      .find({ username: { $in: usernames } }, { projection: { _id: 1, username: 1 } })
      .toArray();

    for (const member of existingStaff) {
      idsByUsername.set(member.username, member._id);
    }

    staffIds = staffSeedDocs.map((doc) => idsByUsername.get(doc.username));
  } else {
    const staffResults = await staffCollection.insertMany(staffSeedDocs);
    staffIds = staffSeedDocs.map((_, index) => staffResults.insertedIds[index]);
  }

  // Insert staff availability
  const staffAvailCollection = db.collection("staff_availability");
  const supervisorAndCleanerIds = [
    staffIds[2], // Neha
    staffIds[3], // Rohan
    staffIds[4], // Isha
    staffIds[5], // Karan
    staffIds[6], // Maya
    staffIds[7], // Pooja
    staffIds[8] // Arjun
  ];

  const availabilityDocs = supervisorAndCleanerIds.map(staffId => ({
    staff_id: staffId,
    available_date: date,
    start_time: "08:00",
    end_time: "17:00"
  }));

  await staffAvailCollection.insertMany(availabilityDocs);

  // Insert contracts
  const contractsCollection = db.collection("contracts");
  await contractsCollection.insertMany([
    {
      client_id: clientResults.insertedIds[0],
      start_date: new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().slice(0, 10),
      end_date: new Date(new Date().setDate(new Date().getDate() + 275)).toISOString().slice(0, 10),
      notes: "Annual office contract with twice-daily windows"
    },
    {
      client_id: clientResults.insertedIds[1],
      start_date: new Date(new Date().setDate(new Date().getDate() - 45)).toISOString().slice(0, 10),
      end_date: new Date(new Date().setDate(new Date().getDate() + 320)).toISOString().slice(0, 10),
      notes: "Weekly common-area cleaning agreement"
    }
  ]);

  // Insert schedules
  const schedulesCollection = db.collection("schedules");
  const scheduleResults = await schedulesCollection.insertMany([
    {
      client_id: clientResults.insertedIds[0],
      service_id: serviceResults.insertedIds[0],
      supervisor_id: staffIds[2], // Neha
      schedule_date: date,
      start_time: "09:00",
      end_time: null,
      estimated_duration_hours: 4,
      status: "Planned",
      notes: "Morning shift",
      created_at: new Date().toISOString()
    },
    {
      client_id: clientResults.insertedIds[1],
      service_id: serviceResults.insertedIds[1],
      supervisor_id: staffIds[3], // Rohan
      schedule_date: date,
      start_time: "13:00",
      end_time: null,
      estimated_duration_hours: 3,
      status: "Completed",
      notes: "Completed early",
      created_at: new Date().toISOString()
    },
    {
      client_id: clientResults.insertedIds[2],
      service_id: serviceResults.insertedIds[2],
      supervisor_id: staffIds[2], // Neha
      schedule_date: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString().slice(0, 10),
      start_time: "10:30",
      end_time: null,
      estimated_duration_hours: 5,
      status: "Planned",
      notes: "Weekend prep",
      created_at: new Date().toISOString()
    }
  ]);

  // Insert staff assignments
  const staffAssignCollection = db.collection("staff_assignments");
  await staffAssignCollection.insertMany([
    {
      schedule_id: scheduleResults.insertedIds[0],
      staff_id: staffIds[4], // Isha
      assignment_role: "Cleaner"
    },
    {
      schedule_id: scheduleResults.insertedIds[0],
      staff_id: staffIds[5], // Karan
      assignment_role: "Cleaner"
    },
    {
      schedule_id: scheduleResults.insertedIds[0],
      staff_id: staffIds[6], // Maya
      assignment_role: "Cleaner"
    },
    {
      schedule_id: scheduleResults.insertedIds[1],
      staff_id: staffIds[6], // Maya
      assignment_role: "Cleaner"
    },
    {
      schedule_id: scheduleResults.insertedIds[1],
      staff_id: staffIds[7], // Pooja
      assignment_role: "Cleaner"
    },
    {
      schedule_id: scheduleResults.insertedIds[2],
      staff_id: staffIds[4], // Isha
      assignment_role: "Cleaner"
    },
    {
      schedule_id: scheduleResults.insertedIds[2],
      staff_id: staffIds[5], // Karan
      assignment_role: "Cleaner"
    },
    {
      schedule_id: scheduleResults.insertedIds[2],
      staff_id: staffIds[8], // Arjun
      assignment_role: "Cleaner"
    }
  ]);

  const message =
    `Database seeded successfully. preserveStaff=${preserveStaff ? "enabled" : "disabled"}`;
  console.log(message);
  return { preserveStaff, message };
}

if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
