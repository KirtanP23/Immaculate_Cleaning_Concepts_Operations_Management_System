const { getDb } = require("./database");

async function initDb() {
  const db = await getDb();

  // Create collections if they don't exist
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  // Collection definitions with validation schemas
  const collectionsToCreate = [
    {
      name: "clients",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["name", "client_type", "is_active", "created_at"],
          properties: {
            _id: { bsonType: "objectId" },
            name: { bsonType: "string" },
            client_type: { bsonType: "string", enum: ["Commercial", "Residential"] },
            phone: { bsonType: "string" },
            email: { bsonType: "string" },
            address: { bsonType: "string" },
            assessment_date: { bsonType: "string" },
            ideal_staff_count: { bsonType: "int" },
            equipment_required_notes: { bsonType: "string" },
            service_frequency: { bsonType: "string" },
            service_time_range: { bsonType: "string" },
            special_notes: { bsonType: "string" },
            is_active: { bsonType: "bool" },
            created_at: { bsonType: "string" }
          }
        }
      },
      indexes: [
        { key: { name: 1 } },
        { key: { is_active: 1 } }
      ]
    },
    {
      name: "staff",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["full_name", "role", "is_active", "created_at"],
          properties: {
            _id: { bsonType: "objectId" },
            full_name: { bsonType: "string" },
            username: { bsonType: "string" },
            password: { bsonType: "string" },
            role: { bsonType: "string", enum: ["Admin", "Supervisor", "Cleaner", "Owner"] },
            employment_type: { bsonType: "string" },
            phone: { bsonType: "string" },
            is_active: { bsonType: "bool" },
            created_at: { bsonType: "string" }
          }
        }
      },
      indexes: [
        { key: { username: 1 }, unique: true, sparse: true },
        { key: { role: 1 } },
        { key: { is_active: 1 } }
      ]
    },
    {
      name: "services",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["service_name"],
          properties: {
            _id: { bsonType: "objectId" },
            service_name: { bsonType: "string" },
            description: { bsonType: ["string", "null"] },
            frequency: { bsonType: ["string", "null"] },
            start_time: { bsonType: ["string", "null"] },
            end_time: { bsonType: ["string", "null"] },
            estimated_hours: { bsonType: ["double", "int", "null"] }
          }
        }
      }
    },
    {
      name: "schedules",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["client_id", "service_id", "supervisor_id", "schedule_date", "start_time", "status"],
          properties: {
            _id: { bsonType: "objectId" },
            client_id: { bsonType: "objectId" },
            service_id: { bsonType: "objectId" },
            supervisor_id: { bsonType: "objectId" },
            schedule_date: { bsonType: "string" },
            start_time: { bsonType: "string" },
            end_time: { bsonType: ["string", "null"] },
            estimated_duration_hours: { bsonType: ["double", "int", "null"] },
            status: { bsonType: "string", enum: ["Planned", "Completed", "InProgress"] },
            notes: { bsonType: ["string", "null"] },
            created_at: { bsonType: "string" }
          }
        }
      },
      indexes: [
        { key: { client_id: 1 } },
        { key: { schedule_date: 1 } },
        { key: { status: 1 } }
      ]
    },
    {
      name: "staff_assignments",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["schedule_id", "staff_id"],
          properties: {
            _id: { bsonType: "objectId" },
            schedule_id: { bsonType: "objectId" },
            staff_id: { bsonType: "objectId" },
            assignment_role: { bsonType: "string" }
          }
        }
      },
      indexes: [
        { key: { schedule_id: 1 } },
        { key: { staff_id: 1 } }
      ]
    },
    {
      name: "equipment",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["equipment_name", "quantity_available"],
          properties: {
            _id: { bsonType: "objectId" },
            equipment_name: { bsonType: "string" },
            quantity_available: { bsonType: ["int", "double"] },
            status: { bsonType: ["string", "null"] },
            maintenance_date: { bsonType: ["string", "null"] }
          }
        }
      },
      indexes: [
        { key: { status: 1 } }
      ]
    },
    {
      name: "staff_availability",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["staff_id", "available_date", "start_time", "end_time"],
          properties: {
            _id: { bsonType: "objectId" },
            staff_id: { bsonType: "objectId" },
            available_date: { bsonType: "string" },
            start_time: { bsonType: "string" },
            end_time: { bsonType: "string" }
          }
        }
      },
      indexes: [
        { key: { staff_id: 1 } },
        { key: { available_date: 1 } }
      ]
    },
    {
      name: "contracts",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["client_id", "start_date", "end_date"],
          properties: {
            _id: { bsonType: "objectId" },
            client_id: { bsonType: "objectId" },
            start_date: { bsonType: "string" },
            end_date: { bsonType: "string" },
            notes: { bsonType: "string" }
          }
        }
      },
      indexes: [
        { key: { client_id: 1 } }
      ]
    },
    {
      name: "service_equipment",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["service_id", "equipment_id", "qty_required"],
          properties: {
            _id: { bsonType: "objectId" },
            service_id: { bsonType: "objectId" },
            equipment_id: { bsonType: "objectId" },
            qty_required: { bsonType: "int" }
          }
        }
      },
      indexes: [
        { key: { service_id: 1 } }
      ]
    },
    {
      name: "schedule_equipment",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["schedule_id", "equipment_id", "qty_allocated"],
          properties: {
            _id: { bsonType: "objectId" },
            schedule_id: { bsonType: "objectId" },
            equipment_id: { bsonType: "objectId" },
            qty_allocated: { bsonType: "int" },
            allocated_at: { bsonType: "string" }
          }
        }
      },
      indexes: [
        { key: { schedule_id: 1 } }
      ]
    }
  ];

  // Create collections and indexes
  for (const collDef of collectionsToCreate) {
    if (!collectionNames.includes(collDef.name)) {
      const opts = {};
      if (collDef.validator) {
        opts.validator = collDef.validator;
      }
      await db.createCollection(collDef.name, opts);
      console.log(`Created collection: ${collDef.name}`);
    }

    // Create indexes
    const collection = db.collection(collDef.name);
    if (collDef.indexes) {
      for (const index of collDef.indexes) {
        await collection.createIndex(index.key, {
          unique: index.unique || false,
          sparse: index.sparse !== undefined ? index.sparse : false
        });
      }
    }
  }

  return db;
}

module.exports = { initDb };
