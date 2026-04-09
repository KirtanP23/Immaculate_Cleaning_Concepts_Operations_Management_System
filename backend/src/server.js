const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const { initDb } = require("./db/init");

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const AUTH_SECRET = process.env.AUTH_SECRET || "icc-prototype-secret";
const ADMIN_ROLES = ["Admin", "Owner"];
const MANAGER_ROLES = ["Admin", "Owner", "Supervisor"];
const VALID_CLIENT_TYPES = ["Commercial", "Residential"];

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function normalizeOrigin(origin) {
  if (!origin) return "";
  return origin.replace(/\/$/, "").toLowerCase();
}

function wildcardToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function isOriginAllowed(origin) {
  const normalizedOrigin = normalizeOrigin(origin);
  return allowedOrigins.some((allowedOrigin) => {
    const normalizedAllowed = normalizeOrigin(allowedOrigin);
    if (normalizedAllowed.includes("*")) {
      return wildcardToRegex(normalizedAllowed).test(normalizedOrigin);
    }
    return normalizedAllowed === normalizedOrigin;
  });
}

app.use(
  cors(
    allowedOrigins.length
      ? {
          origin(origin, callback) {
            if (!origin || isOriginAllowed(origin)) {
              return callback(null, true);
            }
            return callback(new Error("Not allowed by CORS"));
          }
        }
      : {}
  )
);
app.use(express.json());

function normalizeDate(dateString) {
  if (!dateString) {
    return getLocalDateString();
  }
  return dateString;
}

function getLocalDateString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getWeekRange(dateString) {
  const date = parseLocalDate(dateString || getLocalDateString());
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10)
  };
}

function sanitizeUser(user) {
  return {
    id: user._id ? user._id.toString() : user.id,
    full_name: user.full_name,
    username: user.username,
    role: user.role,
    is_active: user.is_active
  };
}

function signPayload(payload) {
  return crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
}

function createToken(user) {
  const userId = user._id ? user._id.toString() : user.id;
  const payload = Buffer.from(
    JSON.stringify({ id: userId, username: user.username, role: user.role })
  ).toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function decodeToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = signPayload(payload);
  if (signature !== expected) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch (_error) {
    return null;
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

function timeToMinutes(timeString) {
  if (!timeString || typeof timeString !== "string" || !timeString.includes(":")) {
    return null;
  }
  const [hoursStr, minutesStr] = timeString.split(":");
  const hours = Number.parseInt(hoursStr, 10);
  const minutes = Number.parseInt(minutesStr, 10);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function calculateEndTime(startTime, durationHours) {
  if (!startTime || !durationHours) {
    return null;
  }

  const [startHour, startMin] = startTime.split(":").map(Number);
  if (!Number.isFinite(startHour) || !Number.isFinite(startMin)) {
    return null;
  }

  const totalMinutes = startHour * 60 + startMin + durationHours * 60;
  const endHour = Math.floor(totalMinutes / 60);
  const endMin = totalMinutes % 60;
  return `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
}

function normalizeClientType(clientType) {
  if (!clientType) {
    return "Commercial";
  }
  if (clientType === "Domestic") {
    return "Residential";
  }
  return clientType;
}

async function bootstrapAdminUser(db) {
  const shouldResetAdminOnStart = process.env.RESET_ADMIN_ON_START === "1";
  if (!shouldResetAdminOnStart) {
    return;
  }

  const username = (process.env.BOOTSTRAP_ADMIN_USERNAME || "admin.icc").trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
  const fullName = (process.env.BOOTSTRAP_ADMIN_FULL_NAME || "Kirtan Patel").trim();

  if (!username || !password) {
    console.warn(
      "Admin bootstrap skipped: set BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD when RESET_ADMIN_ON_START=1"
    );
    return;
  }

  const staffCollection = db.collection("staff");
  const hashedPassword = await bcrypt.hash(password, 10);

  await staffCollection.updateOne(
    { username },
    {
      $set: {
        full_name: fullName,
        username,
        password: hashedPassword,
        role: "Admin",
        employment_type: "Full-Time",
        phone: "555-9011",
        is_active: true,
        created_at: new Date().toISOString()
      }
    },
    { upsert: true }
  );

  console.log(`Admin bootstrap completed for username: ${username}`);
}

async function start() {
  const db = await initDb();
  await bootstrapAdminUser(db);

  const requireAuth = async (req, res, next) => {
    const token = getBearerToken(req);
    const decoded = decodeToken(token);

    if (!decoded?.id) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    const staffCollection = db.collection("staff");
    const user = await staffCollection.findOne({
      _id: new ObjectId(decoded.id),
      username: decoded.username
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    req.user = user;
    next();
  };

  const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden." });
    }
    next();
  };

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required." });
    }

    const staffCollection = db.collection("staff");
    const user = await staffCollection.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const storedPassword = user.password || "";
    const isHashed = storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$");
    const passwordOk = isHashed
      ? await bcrypt.compare(password, storedPassword)
      : storedPassword === password;

    if (!passwordOk) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!isHashed) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await staffCollection.updateOne(
        { _id: user._id },
        { $set: { password: hashedPassword } }
      );
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "Account is inactive." });
    }

    const token = createToken(user);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.get("/auth/me", requireAuth, async (req, res) => {
    res.json({ user: sanitizeUser(req.user) });
  });

  app.use(requireAuth);

  // ========== CLIENTS ==========
  app.post("/clients", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const {
        name,
        client_type = "Commercial",
        phone,
        email,
        address,
        assessment_date,
        ideal_staff_count,
        equipment_required_notes,
        service_frequency,
        service_time_range,
        special_notes,
        is_active = true
      } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Client name is required." });
      }

      const normalizedClientType = normalizeClientType(client_type);
      if (!VALID_CLIENT_TYPES.includes(normalizedClientType)) {
        return res.status(400).json({ message: "Invalid client_type." });
      }

      const clientDoc = {
        name: String(name).trim(),
        client_type: normalizedClientType,
        is_active: !!is_active,
        created_at: new Date().toISOString()
      };

      if (phone !== undefined) clientDoc.phone = String(phone || "").trim();
      if (email !== undefined) clientDoc.email = String(email || "").trim();
      if (address !== undefined) clientDoc.address = String(address || "").trim();
      if (assessment_date !== undefined) clientDoc.assessment_date = String(assessment_date || "").trim();
      if (equipment_required_notes !== undefined) {
        clientDoc.equipment_required_notes = String(equipment_required_notes || "").trim();
      }
      if (service_frequency !== undefined) {
        clientDoc.service_frequency = String(service_frequency || "").trim();
      }
      if (service_time_range !== undefined) {
        clientDoc.service_time_range = String(service_time_range || "").trim();
      }
      if (special_notes !== undefined) {
        clientDoc.special_notes = String(special_notes || "").trim();
      }

      if (ideal_staff_count !== undefined && ideal_staff_count !== null && `${ideal_staff_count}`.trim() !== "") {
        const parsedStaffCount = Number.parseInt(`${ideal_staff_count}`, 10);
        if (!Number.isInteger(parsedStaffCount) || parsedStaffCount < 1) {
          return res.status(400).json({ message: "ideal_staff_count must be a positive integer." });
        }
        clientDoc.ideal_staff_count = parsedStaffCount;
      }

      const clientsCollection = db.collection("clients");
      const result = await clientsCollection.insertOne(clientDoc);

      const client = await clientsCollection.findOne({ _id: result.insertedId });
      return res.status(201).json(client);
    } catch (error) {
      console.error("Failed to create client:", error);
      return res.status(500).json({ message: "Failed to create client." });
    }
  });

  app.get("/clients", requireRole(...MANAGER_ROLES), async (_req, res) => {
    const clientsCollection = db.collection("clients");
    const clients = await clientsCollection.find({}).sort({ _id: -1 }).toArray();
    res.json(clients);
  });

  app.put("/clients/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const { id } = req.params;
      const clientsCollection = db.collection("clients");

      const updateData = {};
      const unsetData = {};

      if (req.body.name !== undefined) updateData.name = String(req.body.name || "").trim();
      if (req.body.client_type !== undefined) {
        const normalizedClientType = normalizeClientType(req.body.client_type);
        if (!VALID_CLIENT_TYPES.includes(normalizedClientType)) {
          return res.status(400).json({ message: "Invalid client_type." });
        }
        updateData.client_type = normalizedClientType;
      }
      if (req.body.phone !== undefined) updateData.phone = String(req.body.phone || "").trim();
      if (req.body.email !== undefined) updateData.email = String(req.body.email || "").trim();
      if (req.body.address !== undefined) updateData.address = String(req.body.address || "").trim();
      if (req.body.assessment_date !== undefined) {
        updateData.assessment_date = String(req.body.assessment_date || "").trim();
      }
      if (req.body.equipment_required_notes !== undefined) {
        updateData.equipment_required_notes = String(req.body.equipment_required_notes || "").trim();
      }
      if (req.body.service_frequency !== undefined) {
        updateData.service_frequency = String(req.body.service_frequency || "").trim();
      }
      if (req.body.service_time_range !== undefined) {
        updateData.service_time_range = String(req.body.service_time_range || "").trim();
      }
      if (req.body.special_notes !== undefined) {
        updateData.special_notes = String(req.body.special_notes || "").trim();
      }
      if (req.body.is_active !== undefined) updateData.is_active = !!req.body.is_active;

      if (req.body.ideal_staff_count !== undefined) {
        if (req.body.ideal_staff_count === null || `${req.body.ideal_staff_count}`.trim() === "") {
          unsetData.ideal_staff_count = "";
        } else {
          const parsedStaffCount = Number.parseInt(`${req.body.ideal_staff_count}`, 10);
          if (!Number.isInteger(parsedStaffCount) || parsedStaffCount < 1) {
            return res.status(400).json({ message: "ideal_staff_count must be a positive integer." });
          }
          updateData.ideal_staff_count = parsedStaffCount;
        }
      }

      if (Object.keys(updateData).length === 0 && Object.keys(unsetData).length === 0) {
        return res.status(400).json({ message: "No fields to update." });
      }

      const mongoUpdate = {};
      if (Object.keys(updateData).length > 0) {
        mongoUpdate.$set = updateData;
      }
      if (Object.keys(unsetData).length > 0) {
        mongoUpdate.$unset = unsetData;
      }

      const result = await clientsCollection.updateOne(
        { _id: new ObjectId(id) },
        mongoUpdate
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Client not found." });
      }

      const updated = await clientsCollection.findOne({ _id: new ObjectId(id) });
      return res.json(updated);
    } catch (error) {
      console.error("Failed to update client:", error);
      return res.status(500).json({ message: "Failed to update client." });
    }
  });

  app.delete("/clients/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid client id." });
      }

      const clientId = new ObjectId(id);
      const clientsCollection = db.collection("clients");
      const schedulesCollection = db.collection("schedules");
      const contractsCollection = db.collection("contracts");

      const client = await clientsCollection.findOne({ _id: clientId });
      if (!client) {
        return res.status(404).json({ message: "Client not found." });
      }

      const scheduleCount = await schedulesCollection.countDocuments({ client_id: clientId });
      if (scheduleCount > 0) {
        return res.status(409).json({
          message: `Cannot delete client with ${scheduleCount} schedule record(s). Archive or reassign schedules first.`
        });
      }

      const contractCount = await contractsCollection.countDocuments({ client_id: clientId });
      if (contractCount > 0) {
        return res.status(409).json({
          message: `Cannot delete client with ${contractCount} contract record(s). Remove contracts first.`
        });
      }

      const result = await clientsCollection.deleteOne({ _id: clientId });
      return res.json({ message: result.deletedCount ? "Client deleted successfully." : "Client not found." });
    } catch (error) {
      console.error("Failed to delete client:", error);
      return res.status(500).json({ message: "Failed to delete client." });
    }
  });

  app.get("/clients/:id/history", requireRole(...MANAGER_ROLES), async (req, res) => {
    const { id } = req.params;
    const clientId = new ObjectId(id);

    const clientsCollection = db.collection("clients");
    const client = await clientsCollection.findOne({ _id: clientId });
    if (!client) {
      return res.status(404).json({ message: "Client not found." });
    }

    const schedulesCollection = db.collection("schedules");
    const schedules = await schedulesCollection
      .aggregate([
        { $match: { client_id: clientId } },
        {
          $lookup: {
            from: "services",
            localField: "service_id",
            foreignField: "_id",
            as: "service"
          }
        },
        {
          $lookup: {
            from: "staff",
            localField: "supervisor_id",
            foreignField: "_id",
            as: "supervisor"
          }
        },
        {
          $project: {
            id: "$_id",
            schedule_date: 1,
            start_time: 1,
            status: 1,
            service_name: { $arrayElemAt: ["$service.service_name", 0] },
            supervisor: { $arrayElemAt: ["$supervisor.full_name", 0] }
          }
        },
        { $sort: { schedule_date: -1, start_time: -1 } }
      ])
      .toArray();

    res.json({ client, schedules });
  });

  // ========== STAFF ==========
  app.post("/staff", requireRole(...ADMIN_ROLES), async (req, res) => {
    const {
      full_name,
      username,
      password,
      role,
      employment_type = "Full-Time",
      phone,
      is_active = true
    } = req.body;

    if (!full_name || !username || !password || !role) {
      return res.status(400).json({
        message: "full_name, username, password and role are required."
      });
    }

    if (!["Admin", "Owner", "Supervisor", "Cleaner"].includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const staffCollection = db.collection("staff");

    const result = await staffCollection.insertOne({
      full_name,
      username,
      password: passwordHash,
      role,
      employment_type,
      phone: phone || null,
      is_active: !!is_active,
      created_at: new Date().toISOString()
    });

    const staff = await staffCollection.findOne({ _id: result.insertedId });
    res.status(201).json(staff);
  });

  app.get("/staff", requireRole(...MANAGER_ROLES), async (_req, res) => {
    const staffCollection = db.collection("staff");
    const staff = await staffCollection
      .find({})
      .project({ password: 0 })
      .sort({ _id: -1 })
      .toArray();
    res.json(staff);
  });

  app.delete("/staff/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
    const { id } = req.params;
    const staffId = new ObjectId(id);
    const staffCollection = db.collection("staff");
    const staffAssignCollection = db.collection("staff_assignments");
    const schedulesCollection = db.collection("schedules");

    const staff = await staffCollection.findOne({ _id: staffId });
    if (!staff) {
      return res.status(404).json({ message: "Staff not found." });
    }

    const today = getLocalDateString();
    const futureAssignments = await staffAssignCollection
      .aggregate([
        { $match: { staff_id: staffId } },
        {
          $lookup: {
            from: "schedules",
            localField: "schedule_id",
            foreignField: "_id",
            as: "schedule"
          }
        },
        {
          $match: {
            "schedule.schedule_date": { $gte: today },
            "schedule.status": { $in: ["Planned", "InProgress"] }
          }
        }
      ])
      .toArray();

    if (futureAssignments.length > 0) {
      return res.status(409).json({
        message: `Cannot delete staff with ${futureAssignments.length} active schedule assignment(s). Please reassign or cancel these schedules first.`
      });
    }

    const assignmentCount = await staffAssignCollection.countDocuments({ staff_id: staffId });
    if (assignmentCount > 0) {
      return res.status(409).json({
        message: `Cannot delete staff with ${assignmentCount} historical assignment record(s).`
      });
    }

    const supervisedCount = await schedulesCollection.countDocuments({ supervisor_id: staffId });
    if (supervisedCount > 0) {
      return res.status(409).json({
        message: `Cannot delete supervisor with ${supervisedCount} schedule record(s). Reassign schedules first.`
      });
    }

    const result = await staffCollection.deleteOne({ _id: staffId });
    return res.json({ message: result.deletedCount ? "Staff deleted successfully." : "Staff not found." });
  });

  // ========== EQUIPMENT ==========
  app.get("/equipment", requireRole(...MANAGER_ROLES), async (_req, res) => {
    const equipmentCollection = db.collection("equipment");
    const equipment = await equipmentCollection.find({}).sort({ _id: -1 }).toArray();
    res.json(equipment);
  });

  app.post("/equipment", requireRole(...ADMIN_ROLES), async (req, res) => {
    const {
      equipment_name,
      quantity_available,
      status = "Available",
      maintenance_date
    } = req.body;

    if (!equipment_name || quantity_available === undefined) {
      return res.status(400).json({
        message: "equipment_name and quantity_available are required."
      });
    }

    const equipmentCollection = db.collection("equipment");
    const result = await equipmentCollection.insertOne({
      equipment_name,
      quantity_available: Number(quantity_available),
      status,
      maintenance_date: maintenance_date || null
    });

    const equip = await equipmentCollection.findOne({ _id: result.insertedId });
    res.status(201).json(equip);
  });

  app.put("/equipment/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
    const { id } = req.params;
    const { equipment_name, quantity_available, status, maintenance_date } = req.body;
    const equipmentCollection = db.collection("equipment");

    const existing = await equipmentCollection.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      return res.status(404).json({ message: "Equipment not found." });
    }

    const updateData = {};
    if (equipment_name !== undefined) updateData.equipment_name = equipment_name;
    if (quantity_available !== undefined) updateData.quantity_available = Number(quantity_available);
    if (status !== undefined) updateData.status = status;
    if (maintenance_date !== undefined) updateData.maintenance_date = maintenance_date || null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fields to update." });
    }

    const result = await equipmentCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Failed to update equipment." });
    }

    const updated = await equipmentCollection.findOne({ _id: new ObjectId(id) });
    return res.json(updated);
  });

  app.delete("/equipment/:id", requireRole(...ADMIN_ROLES), async (req, res) => {
    const { id } = req.params;
    const equipmentId = new ObjectId(id);
    const equipmentCollection = db.collection("equipment");
    const serviceEquipCollection = db.collection("service_equipment");
    const scheduleEquipCollection = db.collection("schedule_equipment");

    const equip = await equipmentCollection.findOne({ _id: equipmentId });
    if (!equip) {
      return res.status(404).json({ message: "Equipment not found." });
    }

    const serviceUsage = await serviceEquipCollection.countDocuments({ equipment_id: equipmentId });
    if (serviceUsage > 0) {
      return res.status(409).json({
        message: `Cannot delete equipment that is required by ${serviceUsage} service(s). Please remove it from those services first.`
      });
    }

    const activeAllocation = await scheduleEquipCollection
      .aggregate([
        { $match: { equipment_id: equipmentId } },
        {
          $lookup: {
            from: "schedules",
            localField: "schedule_id",
            foreignField: "_id",
            as: "schedule"
          }
        },
        { $match: { "schedule.status": { $in: ["Planned", "InProgress"] } } }
      ])
      .toArray();

    if (activeAllocation.length > 0) {
      return res.status(409).json({
        message: `Cannot delete equipment currently allocated to ${activeAllocation.length} active schedule(s).`
      });
    }

    const historicalAllocation = await scheduleEquipCollection.countDocuments({ equipment_id: equipmentId });
    if (historicalAllocation > 0) {
      return res.status(409).json({
        message: `Cannot delete equipment with ${historicalAllocation} schedule allocation record(s).`
      });
    }

    const result = await equipmentCollection.deleteOne({ _id: equipmentId });
    return res.json({ message: result.deletedCount ? "Equipment deleted successfully." : "Equipment not found." });
  });

  // ========== SERVICES ==========
  app.get("/services", requireRole(...MANAGER_ROLES), async (_req, res) => {
    const servicesCollection = db.collection("services");
    const services = await servicesCollection.find({}).sort({ _id: 1 }).toArray();
    res.json(services);
  });

  app.post("/services", requireRole(...ADMIN_ROLES), async (req, res) => {
    const { service_name, description, frequency, start_time, end_time, estimated_hours } = req.body;
    if (!service_name) {
      return res.status(400).json({ message: "service_name is required." });
    }

    const servicesCollection = db.collection("services");
    const result = await servicesCollection.insertOne({
      service_name,
      description: description || null,
      frequency: frequency || null,
      start_time: start_time || null,
      end_time: end_time || null,
      estimated_hours: estimated_hours || null
    });

    const service = await servicesCollection.findOne({ _id: result.insertedId });
    res.status(201).json(service);
  });

  // ========== SCHEDULE CONFLICT CHECK ==========
  app.post("/schedule/check-conflicts", requireRole(...MANAGER_ROLES), async (req, res) => {
    const {
      client_id,
      service_id,
      supervisor_id,
      schedule_date,
      exclude_schedule_id,
      staff_ids = [],
      equipment_allocations = []
    } = req.body;

    const warnings = [];
    const errors = [];
    const excludedScheduleId = ObjectId.isValid(exclude_schedule_id) ? new ObjectId(exclude_schedule_id) : null;

    const schedulesCollection = db.collection("schedules");
    const staffAssignCollection = db.collection("staff_assignments");
    const equipmentCollection = db.collection("equipment");
    const scheduleEquipCollection = db.collection("schedule_equipment");

    if (!schedule_date) {
      errors.push({
        message: "schedule_date is required.",
        type: "schedule_date_required"
      });
      return res.json({
        hasConflicts: true,
        hasWarnings: false,
        errors,
        warnings
      });
    }

    // Check duplicate schedule for same client + service on same date
    if (client_id && service_id && ObjectId.isValid(client_id) && ObjectId.isValid(service_id)) {
      const sameServiceSameDayQuery = {
        client_id: new ObjectId(client_id),
        service_id: new ObjectId(service_id),
        schedule_date,
        status: { $in: ["Planned", "InProgress", "Completed"] }
      };
      if (excludedScheduleId) {
        sameServiceSameDayQuery._id = { $ne: excludedScheduleId };
      }
      const sameServiceSameDayCount = await schedulesCollection.countDocuments(sameServiceSameDayQuery);
      if (sameServiceSameDayCount > 0) {
        errors.push({
          message: "This service is already scheduled for this client on the selected date.",
          type: "duplicate_client_service_date"
        });
      }
    }

    // Check duplicate schedule for same client on same date (regardless of service)
    if (client_id && ObjectId.isValid(client_id)) {
      const sameClientSameDayQuery = {
        client_id: new ObjectId(client_id),
        schedule_date,
        status: { $in: ["Planned", "InProgress", "Completed"] }
      };
      if (excludedScheduleId) {
        sameClientSameDayQuery._id = { $ne: excludedScheduleId };
      }
      const sameClientSameDayCount = await schedulesCollection.countDocuments(sameClientSameDayQuery);
      if (sameClientSameDayCount > 0) {
        errors.push({
          message: "This client already has a schedule on the selected date.",
          type: "duplicate_client_date"
        });
      }
    }

    // Check supervisor availability
    if (supervisor_id && ObjectId.isValid(supervisor_id)) {
      const supervisorId = new ObjectId(supervisor_id);
      const supervisorConflictQuery = {
        supervisor_id: supervisorId,
        schedule_date: schedule_date,
        status: { $in: ["Planned", "InProgress"] }
      };
      if (excludedScheduleId) {
        supervisorConflictQuery._id = { $ne: excludedScheduleId };
      }
      const supervisorConflict = await schedulesCollection.countDocuments(supervisorConflictQuery);

      if (supervisorConflict > 0) {
        errors.push({
          message: "Supervisor is already allocated to another active schedule on this date.",
          type: "supervisor_conflict"
        });
      }
    }

    // Check team member availability
    if (staff_ids.length > 0) {
      for (const staffId of staff_ids) {
        if (!ObjectId.isValid(staffId)) {
          errors.push({
            message: "One or more staff IDs are invalid.",
            type: "invalid_staff_id"
          });
          break;
        }
        const cleanerConflict = await staffAssignCollection
          .aggregate([
            {
              $match: {
                staff_id: new ObjectId(staffId),
                ...(excludedScheduleId ? { schedule_id: { $ne: excludedScheduleId } } : {})
              }
            },
            {
              $lookup: {
                from: "schedules",
                localField: "schedule_id",
                foreignField: "_id",
                as: "schedule"
              }
            },
            {
              $match: {
                "schedule.schedule_date": schedule_date,
                "schedule.status": { $in: ["Planned", "InProgress"] }
              }
            }
          ])
          .toArray();

        if (cleanerConflict.length > 0) {
          errors.push({
            message: `One or more team members are already assigned to active schedules on this date.`,
            type: "cleaner_conflict"
          });
          break;
        }
      }
    }

    // Check equipment availability
    if (equipment_allocations.length > 0) {
      for (const alloc of equipment_allocations) {
        const { equipment_id, qty_needed } = alloc;
        if (!ObjectId.isValid(equipment_id)) {
          errors.push({
            message: `Equipment ${equipment_id} has an invalid id.`,
            type: "invalid_equipment_id"
          });
          continue;
        }

        const equipId = new ObjectId(equipment_id);

        const equip = await equipmentCollection.findOne({ _id: equipId });
        if (!equip) {
          errors.push({
            message: `Equipment ${equipment_id} not found.`,
            type: "equipment_not_found"
          });
          continue;
        }

        const allocatedQty = await scheduleEquipCollection
          .aggregate([
            {
              $match: {
                equipment_id: equipId,
                ...(excludedScheduleId ? { schedule_id: { $ne: excludedScheduleId } } : {})
              }
            },
            {
              $lookup: {
                from: "schedules",
                localField: "schedule_id",
                foreignField: "_id",
                as: "schedule"
              }
            },
            {
              $match: {
                "schedule.schedule_date": schedule_date,
                "schedule.status": { $in: ["Planned", "InProgress"] }
              }
            },
            { $group: { _id: null, total: { $sum: "$qty_allocated" } } }
          ])
          .toArray();

        const totalAllocated = (allocatedQty[0]?.total || 0) + (qty_needed || 1);

        if (totalAllocated > equip.quantity_available) {
          warnings.push({
            severity: "warning",
            message: `Equipment has limited availability (${equip.quantity_available} available, ${totalAllocated} needed today).`,
            type: "equipment_low_stock"
          });
        }
      }
    }

    res.json({
      hasConflicts: errors.length > 0,
      hasWarnings: warnings.length > 0,
      errors,
      warnings
    });
  });

  // ========== SCHEDULES ==========
  app.post("/schedule", requireRole(...MANAGER_ROLES), async (req, res) => {
    const {
      client_id,
      service_id,
      supervisor_id,
      schedule_date,
      start_time,
      notes,
      staff_ids = [],
      equipment_allocations = [],
      estimated_duration_hours
    } = req.body;

    if (!client_id || !service_id || !supervisor_id || !start_time) {
      return res.status(400).json({
        message: "client_id, service_id, supervisor_id and start_time are required."
      });
    }

    if (!Array.isArray(staff_ids) || staff_ids.length < 2 || staff_ids.length > 6) {
      return res.status(400).json({ message: "Team size must be between 2 and 6 staff." });
    }

    const normalizedDate = normalizeDate(schedule_date);
    const today = getLocalDateString();
    if (normalizedDate < today) {
      return res.status(400).json({ message: "Schedule date cannot be in the past." });
    }

    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);
    const maxDateStr = maxDate.toISOString().slice(0, 10);
    if (normalizedDate > maxDateStr) {
      return res.status(400).json({
        message: "Schedule cannot be more than 2 years in the future."
      });
    }

    if (req.user.role === "Supervisor" && supervisor_id !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Supervisors can only create schedules assigned to themselves."
      });
    }

    const clientsCollection = db.collection("clients");
    const servicesCollection = db.collection("services");
    const staffCollection = db.collection("staff");
    const equipmentCollection = db.collection("equipment");
    const schedulesCollection = db.collection("schedules");
    const staffAssignCollection = db.collection("staff_assignments");
    const scheduleEquipCollection = db.collection("schedule_equipment");

    // Validate client
    const clientId = new ObjectId(client_id);
    const client = await clientsCollection.findOne({ _id: clientId });
    if (!client) {
      return res.status(400).json({ message: "Invalid client_id." });
    }
    if (!client.is_active) {
      return res.status(400).json({ message: "Cannot create schedule for inactive client." });
    }

    // Validate service
    const serviceId = new ObjectId(service_id);
    const service = await servicesCollection.findOne({ _id: serviceId });
    if (!service) {
      return res.status(400).json({ message: "Invalid service_id." });
    }

    const sameServiceSameDayCount = await schedulesCollection.countDocuments({
      client_id: clientId,
      service_id: serviceId,
      schedule_date: normalizedDate,
      status: { $in: ["Planned", "InProgress", "Completed"] }
    });
    if (sameServiceSameDayCount > 0) {
      return res.status(409).json({
        message: "This service is already scheduled for this client on the selected date."
      });
    }

    const sameClientSameDayCount = await schedulesCollection.countDocuments({
      client_id: clientId,
      schedule_date: normalizedDate,
      status: { $in: ["Planned", "InProgress", "Completed"] }
    });
    if (sameClientSameDayCount > 0) {
      return res.status(409).json({
        message: "This client already has a schedule on the selected date."
      });
    }

    // Validate supervisor
    const supervisorId = new ObjectId(supervisor_id);
    const supervisor = await staffCollection.findOne({
      _id: supervisorId,
      role: "Supervisor"
    });
    if (!supervisor) {
      return res.status(400).json({ message: "Invalid supervisor_id. Must be a Supervisor." });
    }

    // Validate all staff
    const staffIdObjects = staff_ids.map(id => new ObjectId(id));
    const validStaff = await staffCollection.countDocuments({ _id: { $in: staffIdObjects } });
    if (validStaff !== staff_ids.length) {
      return res.status(400).json({ message: "One or more assigned staff_ids are invalid." });
    }

    const supervisorConflictCount = await schedulesCollection.countDocuments({
      supervisor_id: supervisorId,
      schedule_date: normalizedDate,
      status: { $in: ["Planned", "InProgress"] }
    });
    if (supervisorConflictCount > 0) {
      return res.status(409).json({
        message: "Supervisor is already allocated to another active schedule on this date."
      });
    }

    const staffConflict = await staffAssignCollection
      .aggregate([
        { $match: { staff_id: { $in: staffIdObjects } } },
        {
          $lookup: {
            from: "schedules",
            localField: "schedule_id",
            foreignField: "_id",
            as: "schedule"
          }
        },
        {
          $match: {
            "schedule.schedule_date": normalizedDate,
            "schedule.status": { $in: ["Planned", "InProgress"] }
          }
        },
        { $group: { _id: "$staff_id" } }
      ])
      .toArray();

    if (staffConflict.length > 0) {
      return res.status(409).json({
        message: "One or more team members are already allocated to active schedules on this date."
      });
    }

    // Validate equipment allocations
    if (Array.isArray(equipment_allocations) && equipment_allocations.length > 0) {
      for (const alloc of equipment_allocations) {
        const { equipment_id, qty_needed } = alloc;
        const equipId = new ObjectId(equipment_id);

        const equip = await equipmentCollection.findOne({ _id: equipId });
        if (!equip) {
          return res.status(400).json({
            message: `Equipment ${equipment_id} not found.`
          });
        }

        const allocatedQty = await scheduleEquipCollection
          .aggregate([
            { $match: { equipment_id: equipId } },
            {
              $lookup: {
                from: "schedules",
                localField: "schedule_id",
                foreignField: "_id",
                as: "schedule"
              }
            },
            {
              $match: {
                "schedule.schedule_date": normalizedDate,
                "schedule.status": { $in: ["Planned", "InProgress"] }
              }
            },
            { $group: { _id: null, total: { $sum: "$qty_allocated" } } }
          ])
          .toArray();

        const totalAllocated = (allocatedQty[0]?.total || 0) + (qty_needed || 1);

        if (totalAllocated > equip.quantity_available) {
          return res.status(409).json({
            message: `Insufficient equipment ${equipment_id} availability (${equip.quantity_available} available, ${totalAllocated} needed).`
          });
        }
      }
    }

    try {
      const finalDuration = estimated_duration_hours || service.estimated_hours;
      const endTime = calculateEndTime(start_time, finalDuration);

      const scheduleResult = await schedulesCollection.insertOne({
        client_id: clientId,
        service_id: serviceId,
        supervisor_id: supervisorId,
        schedule_date: normalizedDate,
        start_time,
        end_time: endTime,
        estimated_duration_hours: finalDuration || null,
        status: "Planned",
        notes: notes || null,
        created_at: new Date().toISOString()
      });

      const scheduleId = scheduleResult.insertedId;

      // Insert staff assignments
      for (const staffId of staff_ids) {
        await staffAssignCollection.insertOne({
          schedule_id: scheduleId,
          staff_id: new ObjectId(staffId),
          assignment_role: "Cleaner"
        });
      }

      // Insert equipment allocations
      if (Array.isArray(equipment_allocations) && equipment_allocations.length > 0) {
        for (const alloc of equipment_allocations) {
          await scheduleEquipCollection.insertOne({
            schedule_id: scheduleId,
            equipment_id: new ObjectId(alloc.equipment_id),
            qty_allocated: alloc.qty_needed || 1,
            allocated_at: new Date().toISOString()
          });
        }
      }

      const schedule = await schedulesCollection.findOne({ _id: scheduleId });
      const scheduleEquipment = await scheduleEquipCollection
        .aggregate([
          { $match: { schedule_id: scheduleId } },
          {
            $lookup: {
              from: "equipment",
              localField: "equipment_id",
              foreignField: "_id",
              as: "equipment"
            }
          },
          {
            $project: {
              id: "$_id",
              equipment_name: { $arrayElemAt: ["$equipment.equipment_name", 0] },
              qty_allocated: 1,
              quantity_available: { $arrayElemAt: ["$equipment.quantity_available", 0] }
            }
          }
        ])
        .toArray();

      res.status(201).json({
        ...schedule,
        equipment: scheduleEquipment
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to create schedule.", error: error.message });
    }
  });

  app.patch("/schedule/:id", requireRole(...MANAGER_ROLES), async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid schedule id." });
      }

      const scheduleId = new ObjectId(id);
      const {
        client_id,
        service_id,
        supervisor_id,
        schedule_date,
        start_time,
        notes,
        staff_ids = [],
        equipment_allocations = [],
        estimated_duration_hours
      } = req.body;

      if (!client_id || !service_id || !supervisor_id || !start_time) {
        return res.status(400).json({
          message: "client_id, service_id, supervisor_id and start_time are required."
        });
      }

      if (!schedule_date) {
        return res.status(400).json({ message: "schedule_date is required." });
      }

      if (!Array.isArray(staff_ids) || staff_ids.length < 2 || staff_ids.length > 6) {
        return res.status(400).json({ message: "Team size must be between 2 and 6 staff." });
      }

      const normalizedDate = normalizeDate(schedule_date);
      const today = getLocalDateString();
      if (normalizedDate < today) {
        return res.status(400).json({ message: "Only upcoming schedules can be edited." });
      }

      const clientsCollection = db.collection("clients");
      const servicesCollection = db.collection("services");
      const staffCollection = db.collection("staff");
      const equipmentCollection = db.collection("equipment");
      const schedulesCollection = db.collection("schedules");
      const staffAssignCollection = db.collection("staff_assignments");
      const scheduleEquipCollection = db.collection("schedule_equipment");

      const existingSchedule = await schedulesCollection.findOne({ _id: scheduleId });
      if (!existingSchedule) {
        return res.status(404).json({ message: "Schedule not found." });
      }

      if (existingSchedule.status !== "Planned" || existingSchedule.schedule_date < today) {
        return res.status(409).json({ message: "Only upcoming planned schedules can be edited." });
      }

      if (req.user.role === "Supervisor" && supervisor_id !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Supervisors can only edit schedules assigned to themselves."
        });
      }

      const clientId = new ObjectId(client_id);
      const client = await clientsCollection.findOne({ _id: clientId });
      if (!client) {
        return res.status(400).json({ message: "Invalid client_id." });
      }
      if (!client.is_active) {
        return res.status(400).json({ message: "Cannot edit schedule for inactive client." });
      }

      const serviceId = new ObjectId(service_id);
      const service = await servicesCollection.findOne({ _id: serviceId });
      if (!service) {
        return res.status(400).json({ message: "Invalid service_id." });
      }

      const sameServiceSameDayCount = await schedulesCollection.countDocuments({
        _id: { $ne: scheduleId },
        client_id: clientId,
        service_id: serviceId,
        schedule_date: normalizedDate,
        status: { $in: ["Planned", "InProgress", "Completed"] }
      });
      if (sameServiceSameDayCount > 0) {
        return res.status(409).json({
          message: "This service is already scheduled for this client on the selected date."
        });
      }

      const sameClientSameDayCount = await schedulesCollection.countDocuments({
        _id: { $ne: scheduleId },
        client_id: clientId,
        schedule_date: normalizedDate,
        status: { $in: ["Planned", "InProgress", "Completed"] }
      });
      if (sameClientSameDayCount > 0) {
        return res.status(409).json({
          message: "This client already has a schedule on the selected date."
        });
      }

      const supervisorId = new ObjectId(supervisor_id);
      const supervisor = await staffCollection.findOne({
        _id: supervisorId,
        role: "Supervisor"
      });
      if (!supervisor) {
        return res.status(400).json({ message: "Invalid supervisor_id. Must be a Supervisor." });
      }

      if (staff_ids.some((staffId) => !ObjectId.isValid(staffId))) {
        return res.status(400).json({ message: "One or more assigned staff_ids are invalid." });
      }

      const staffIdObjects = staff_ids.map((staffId) => new ObjectId(staffId));
      const validStaff = await staffCollection.countDocuments({ _id: { $in: staffIdObjects } });
      if (validStaff !== staff_ids.length) {
        return res.status(400).json({ message: "One or more assigned staff_ids are invalid." });
      }

      const supervisorConflictCount = await schedulesCollection.countDocuments({
        _id: { $ne: scheduleId },
        supervisor_id: supervisorId,
        schedule_date: normalizedDate,
        status: { $in: ["Planned", "InProgress"] }
      });
      if (supervisorConflictCount > 0) {
        return res.status(409).json({
          message: "Supervisor is already allocated to another active schedule on this date."
        });
      }

      const staffConflict = await staffAssignCollection
        .aggregate([
          {
            $match: {
              staff_id: { $in: staffIdObjects },
              schedule_id: { $ne: scheduleId }
            }
          },
          {
            $lookup: {
              from: "schedules",
              localField: "schedule_id",
              foreignField: "_id",
              as: "schedule"
            }
          },
          {
            $match: {
              "schedule.schedule_date": normalizedDate,
              "schedule.status": { $in: ["Planned", "InProgress"] }
            }
          },
          { $group: { _id: "$staff_id" } }
        ])
        .toArray();

      if (staffConflict.length > 0) {
        return res.status(409).json({
          message: "One or more team members are already allocated to active schedules on this date."
        });
      }

      if (Array.isArray(equipment_allocations) && equipment_allocations.length > 0) {
        for (const alloc of equipment_allocations) {
          const { equipment_id, qty_needed } = alloc;
          if (!ObjectId.isValid(equipment_id)) {
            return res.status(400).json({ message: `Equipment ${equipment_id} has an invalid id.` });
          }

          const equipId = new ObjectId(equipment_id);
          const equip = await equipmentCollection.findOne({ _id: equipId });
          if (!equip) {
            return res.status(400).json({ message: `Equipment ${equipment_id} not found.` });
          }

          const allocatedQty = await scheduleEquipCollection
            .aggregate([
              {
                $match: {
                  equipment_id: equipId,
                  schedule_id: { $ne: scheduleId }
                }
              },
              {
                $lookup: {
                  from: "schedules",
                  localField: "schedule_id",
                  foreignField: "_id",
                  as: "schedule"
                }
              },
              {
                $match: {
                  "schedule.schedule_date": normalizedDate,
                  "schedule.status": { $in: ["Planned", "InProgress"] }
                }
              },
              { $group: { _id: null, total: { $sum: "$qty_allocated" } } }
            ])
            .toArray();

          const totalAllocated = (allocatedQty[0]?.total || 0) + (qty_needed || 1);

          if (totalAllocated > equip.quantity_available) {
            return res.status(409).json({
              message: `Insufficient equipment ${equipment_id} availability (${equip.quantity_available} available, ${totalAllocated} needed).`
            });
          }
        }
      }

      const parsedDuration =
        estimated_duration_hours !== undefined &&
        estimated_duration_hours !== null &&
        `${estimated_duration_hours}`.trim() !== ""
          ? Number(estimated_duration_hours)
          : null;

      if (parsedDuration !== null && (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) {
        return res.status(400).json({ message: "estimated_duration_hours must be greater than zero." });
      }

      const finalDuration = parsedDuration ?? service.estimated_hours ?? null;
      const endTime = calculateEndTime(start_time, finalDuration);

      await schedulesCollection.updateOne(
        { _id: scheduleId },
        {
          $set: {
            client_id: clientId,
            service_id: serviceId,
            supervisor_id: supervisorId,
            schedule_date: normalizedDate,
            start_time,
            end_time: endTime,
            estimated_duration_hours: finalDuration,
            notes: notes || null,
            updated_at: new Date().toISOString()
          }
        }
      );

      await staffAssignCollection.deleteMany({ schedule_id: scheduleId });
      for (const staffId of staff_ids) {
        await staffAssignCollection.insertOne({
          schedule_id: scheduleId,
          staff_id: new ObjectId(staffId),
          assignment_role: "Cleaner"
        });
      }

      await scheduleEquipCollection.deleteMany({ schedule_id: scheduleId });
      for (const alloc of equipment_allocations) {
        await scheduleEquipCollection.insertOne({
          schedule_id: scheduleId,
          equipment_id: new ObjectId(alloc.equipment_id),
          qty_allocated: alloc.qty_needed || 1,
          allocated_at: new Date().toISOString()
        });
      }

      const updatedSchedule = await schedulesCollection.findOne({ _id: scheduleId });
      res.json(updatedSchedule);
    } catch (error) {
      console.error("Failed to update schedule:", error);
      res.status(500).json({ message: "Failed to update schedule.", error: error.message });
    }
  });

  app.delete("/schedule/:id", requireRole(...MANAGER_ROLES), async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid schedule id." });
      }

      const scheduleId = new ObjectId(id);
      const schedulesCollection = db.collection("schedules");
      const staffAssignCollection = db.collection("staff_assignments");
      const scheduleEquipCollection = db.collection("schedule_equipment");

      const schedule = await schedulesCollection.findOne({ _id: scheduleId });
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found." });
      }

      const today = getLocalDateString();
      if (schedule.status !== "Planned" || schedule.schedule_date < today) {
        return res.status(409).json({
          message: "Only upcoming planned schedules can be deleted."
        });
      }

      if (req.user.role === "Supervisor" && schedule.supervisor_id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Supervisors can delete only schedules assigned to themselves."
        });
      }

      await staffAssignCollection.deleteMany({ schedule_id: scheduleId });
      await scheduleEquipCollection.deleteMany({ schedule_id: scheduleId });
      await schedulesCollection.deleteOne({ _id: scheduleId });

      return res.json({ message: "Schedule deleted successfully." });
    } catch (error) {
      console.error("Failed to delete schedule:", error);
      return res.status(500).json({ message: "Failed to delete schedule." });
    }
  });

  app.patch("/schedule/:id/status", requireRole(...MANAGER_ROLES), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid schedule id." });
      }

      if (!["Planned", "Completed", "InProgress"].includes(status)) {
        return res.status(400).json({ message: "Invalid status." });
      }

      const scheduleId = new ObjectId(id);
      const schedulesCollection = db.collection("schedules");
      const schedule = await schedulesCollection.findOne({ _id: scheduleId });
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found." });
      }

      if (req.user.role === "Supervisor" && schedule.supervisor_id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Supervisors can update only schedules assigned to them."
        });
      }

      if (status === "Completed") {
        const today = getLocalDateString();
        if (schedule.schedule_date > today) {
          return res.status(409).json({
            message: "Cannot mark a future schedule as Completed."
          });
        }

        if (schedule.schedule_date === today) {
          const now = new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const startMinutes = timeToMinutes(schedule.start_time);
          if (startMinutes !== null && startMinutes > currentMinutes) {
            return res.status(409).json({
              message: "Cannot mark schedule as Completed before its start time."
            });
          }
        }

        const earlierPending = await schedulesCollection.findOne({
          supervisor_id: schedule.supervisor_id,
          schedule_date: schedule.schedule_date,
          start_time: { $lt: schedule.start_time },
          status: { $in: ["Planned", "InProgress"] }
        });

        if (earlierPending) {
          return res.status(409).json({
            message: "Cannot complete this schedule while earlier schedules for this supervisor on the same date are still pending."
          });
        }
      }

      const result = await schedulesCollection.updateOne(
        { _id: scheduleId },
        { $set: { status } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Schedule not found." });
      }

      const updated = await schedulesCollection.findOne({ _id: scheduleId });
      return res.json(updated);
    } catch (error) {
      console.error("Failed to update schedule status:", error);
      return res.status(500).json({ message: "Failed to update schedule status." });
    }
  });

  app.get("/schedule", async (req, res) => {
    const role = req.user.role;
    const { date, client_id, staff_id } = req.query;
    const today = getLocalDateString();

    const schedulesCollection = db.collection("schedules");

    const pipeline = [
      {
        $lookup: {
          from: "clients",
          localField: "client_id",
          foreignField: "_id",
          as: "client"
        }
      },
      {
        $lookup: {
          from: "services",
          localField: "service_id",
          foreignField: "_id",
          as: "service"
        }
      },
      {
        $lookup: {
          from: "staff",
          localField: "supervisor_id",
          foreignField: "_id",
          as: "supervisor"
        }
      },
      {
        $lookup: {
          from: "staff_assignments",
          localField: "_id",
          foreignField: "schedule_id",
          as: "assignments"
        }
      },
      {
        $lookup: {
          from: "staff",
          localField: "assignments.staff_id",
          foreignField: "_id",
          as: "assigned_staff"
        }
      },
      {
        $lookup: {
          from: "schedule_equipment",
          localField: "_id",
          foreignField: "schedule_id",
          as: "equipment_allocations"
        }
      }
    ];

    const matchStage = { $match: {} };

    if (role === "Cleaner") {
      const cleanerSchedules = await db.collection("staff_assignments")
        .find({ staff_id: req.user._id })
        .project({ schedule_id: 1 })
        .toArray();
      const scheduleIds = cleanerSchedules.map(s => s.schedule_id);
      matchStage.$match._id = { $in: scheduleIds };
    }

    if (date) {
      matchStage.$match.schedule_date = date;
    }
    if (client_id) {
      matchStage.$match.client_id = new ObjectId(client_id);
    }
    if (staff_id) {
      const staffSchedules = await db.collection("staff_assignments")
        .find({ staff_id: new ObjectId(staff_id) })
        .project({ schedule_id: 1 })
        .toArray();
      const scheduleIds = staffSchedules.map(s => s.schedule_id);
      matchStage.$match._id = { $in: scheduleIds };
    }

    pipeline.unshift(matchStage);

    const scheduleAggregation = [
      ...pipeline,
      {
        $project: {
          id: "$_id",
          client_id: 1,
          service_id: 1,
          supervisor_id: 1,
          schedule_date: 1,
          start_time: 1,
          end_time: 1,
          estimated_duration_hours: 1,
          status: 1,
          notes: 1,
          client_name: { $arrayElemAt: ["$client.name", 0] },
          service_name: { $arrayElemAt: ["$service.service_name", 0] },
          supervisor_name: { $arrayElemAt: ["$supervisor.full_name", 0] },
          assigned_staff_ids: {
            $map: {
              input: "$assignments",
              as: "assignment",
              in: "$$assignment.staff_id"
            }
          },
          assigned_staff: {
            $map: {
              input: "$assigned_staff",
              as: "staff",
              in: "$$staff.full_name"
            }
          },
          equipment_allocations: {
            $map: {
              input: "$equipment_allocations",
              as: "alloc",
              in: {
                equipment_id: "$$alloc.equipment_id",
                qty_needed: "$$alloc.qty_allocated"
              }
            }
          }
        }
      },
      {
        $sort: {
          schedule_date: -1,
          start_time: -1
        }
      }
    ];

    const schedules = await schedulesCollection.aggregate(scheduleAggregation).toArray();

    const response = schedules.map((schedule) => ({
      ...schedule,
      can_update_status:
        ["Admin", "Owner"].includes(req.user.role) ||
        (req.user.role === "Supervisor" && schedule.supervisor_id.toString() === req.user._id.toString()),
      can_edit_upcoming:
        schedule.status === "Planned" &&
        schedule.schedule_date >= today &&
        (["Admin", "Owner"].includes(req.user.role) ||
          (req.user.role === "Supervisor" && schedule.supervisor_id.toString() === req.user._id.toString()))
    }));

    res.json(response);
  });

  // ========== DASHBOARD ==========
  app.get("/dashboard-summary", requireRole(...MANAGER_ROLES), async (_req, res) => {
    const today = getLocalDateString();
    const isSupervisor = _req.user.role === "Supervisor";

    const clientsCollection = db.collection("clients");
    const staffAssignCollection = db.collection("staff_assignments");
    const schedulesCollection = db.collection("schedules");
    const equipmentCollection = db.collection("equipment");

    const activeClients = await clientsCollection.countDocuments({ is_active: true });

    let staffWorkingTodayCount = 0;
    const staffWorkingTodayPipeline = [
      {
        $lookup: {
          from: "schedules",
          localField: "schedule_id",
          foreignField: "_id",
          as: "schedule"
        }
      },
      { $match: { "schedule.schedule_date": today } }
    ];

    if (isSupervisor) {
      staffWorkingTodayPipeline.push({
        $match: { "schedule.supervisor_id": _req.user._id }
      });
    }

    staffWorkingTodayPipeline.push({
      $group: { _id: "$staff_id" }
    });

    const staffWorkingToday = await staffAssignCollection.aggregate(staffWorkingTodayPipeline).toArray();
    staffWorkingTodayCount = staffWorkingToday.length;

    let todaysSchedulesPipeline = [
      { $match: { schedule_date: { $gte: today } } },
      {
        $lookup: {
          from: "clients",
          localField: "client_id",
          foreignField: "_id",
          as: "client"
        }
      },
      {
        $lookup: {
          from: "services",
          localField: "service_id",
          foreignField: "_id",
          as: "service"
        }
      },
      {
        $lookup: {
          from: "staff",
          localField: "supervisor_id",
          foreignField: "_id",
          as: "supervisor"
        }
      }
    ];

    if (isSupervisor) {
      todaysSchedulesPipeline.push({ $match: { supervisor_id: _req.user._id } });
    } else {
      todaysSchedulesPipeline.push({ $match: { schedule_date: today } });
    }

    todaysSchedulesPipeline.push({
      $project: {
        id: "$_id",
        schedule_date: 1,
        start_time: 1,
        status: 1,
        client_name: { $arrayElemAt: ["$client.name", 0] },
        service_name: { $arrayElemAt: ["$service.service_name", 0] },
        supervisor_name: { $arrayElemAt: ["$supervisor.full_name", 0] }
      }
    });

    todaysSchedulesPipeline.push({ $sort: { schedule_date: 1, start_time: 1 } });

    const todaysSchedules = await schedulesCollection.aggregate(todaysSchedulesPipeline).toArray();

    const equipmentAlerts = await equipmentCollection
      .find({
        $or: [
          { quantity_available: { $lte: 1 } },
          { status: { $in: ["Maintenance", "Damaged"] } }
        ]
      })
      .sort({ quantity_available: 1, equipment_name: 1 })
      .toArray();

    res.json({
      activeClients,
      staffWorkingToday: staffWorkingTodayCount,
      todaysSchedules,
      equipmentAlerts
    });
  });

  // ========== REPORTS ==========
  app.get("/reports/weekly-schedule", requireRole(...MANAGER_ROLES), async (req, res) => {
    const { start, end } = getWeekRange(req.query.date);

    const schedulesCollection = db.collection("schedules");
    const weeklySchedules = await schedulesCollection
      .aggregate([
        {
          $match: {
            schedule_date: { $gte: start, $lte: end }
          }
        },
        {
          $lookup: {
            from: "clients",
            localField: "client_id",
            foreignField: "_id",
            as: "client"
          }
        },
        {
          $lookup: {
            from: "services",
            localField: "service_id",
            foreignField: "_id",
            as: "service"
          }
        },
        {
          $lookup: {
            from: "staff",
            localField: "supervisor_id",
            foreignField: "_id",
            as: "supervisor"
          }
        },
        {
          $lookup: {
            from: "staff_assignments",
            localField: "_id",
            foreignField: "schedule_id",
            as: "assignments"
          }
        },
        {
          $project: {
            id: "$_id",
            schedule_date: 1,
            start_time: 1,
            status: 1,
            client_name: { $arrayElemAt: ["$client.name", 0] },
            service_name: { $arrayElemAt: ["$service.service_name", 0] },
            supervisor_name: { $arrayElemAt: ["$supervisor.full_name", 0] },
            team_size: { $size: "$assignments" }
          }
        },
        { $sort: { schedule_date: 1, start_time: 1 } }
      ])
      .toArray();

    res.json({ weekStart: start, weekEnd: end, weeklySchedules });
  });

  app.get("/reports/staff-allocation", requireRole(...MANAGER_ROLES), async (_req, res) => {
    const schedulesCollection = db.collection("schedules");
    const rows = await schedulesCollection
      .aggregate([
        {
          $lookup: {
            from: "clients",
            localField: "client_id",
            foreignField: "_id",
            as: "client"
          }
        },
        {
          $lookup: {
            from: "staff_assignments",
            localField: "_id",
            foreignField: "schedule_id",
            as: "assignments"
          }
        },
        {
          $lookup: {
            from: "staff",
            localField: "assignments.staff_id",
            foreignField: "_id",
            as: "staff"
          }
        },
        {
          $project: {
            schedule_id: "$_id",
            schedule_date: 1,
            client_name: { $arrayElemAt: ["$client.name", 0] },
            staff_list: {
              $reduce: {
                input: "$staff",
                initialValue: "",
                in: {
                  $cond: [
                    { $eq: ["$$value", ""] },
                    "$$this.full_name",
                    { $concat: ["$$value", ", ", "$$this.full_name"] }
                  ]
                }
              }
            }
          }
        },
        { $sort: { schedule_date: -1 } }
      ])
      .toArray();

    res.json(rows);
  });

  // ========== STAFF AVAILABILITY ==========
  app.get("/staff-availability", requireRole(...MANAGER_ROLES), async (req, res) => {
    const { staff_id, available_date } = req.query;
    const staffAvailCollection = db.collection("staff_availability");

    const pipeline = [
      {
        $lookup: {
          from: "staff",
          localField: "staff_id",
          foreignField: "_id",
          as: "staff"
        }
      }
    ];

    const matchStage = { $match: {} };
    if (staff_id) {
      matchStage.$match.staff_id = new ObjectId(staff_id);
    }
    if (available_date) {
      matchStage.$match.available_date = available_date;
    }

    pipeline.push(matchStage);
    pipeline.push({
      $project: {
        id: "$_id",
        staff_id: 1,
        full_name: { $arrayElemAt: ["$staff.full_name", 0] },
        available_date: 1,
        start_time: 1,
        end_time: 1
      }
    });
    pipeline.push({ $sort: { available_date: -1 } });

    const rows = await staffAvailCollection.aggregate(pipeline).toArray();
    res.json(rows);
  });

  app.post("/staff-availability", requireRole(...ADMIN_ROLES), async (req, res) => {
    const { staff_id, available_date, start_time, end_time } = req.body;
    if (!staff_id || !available_date || !start_time || !end_time) {
      return res.status(400).json({
        message: "staff_id, available_date, start_time and end_time are required."
      });
    }

    const staffAvailCollection = db.collection("staff_availability");
    const result = await staffAvailCollection.insertOne({
      staff_id: new ObjectId(staff_id),
      available_date,
      start_time,
      end_time
    });

    const row = await staffAvailCollection.findOne({ _id: result.insertedId });
    res.status(201).json(row);
  });

  // ========== CONTRACTS ==========
  app.get("/contracts", requireRole(...MANAGER_ROLES), async (_req, res) => {
    const contractsCollection = db.collection("contracts");
    const rows = await contractsCollection
      .aggregate([
        {
          $lookup: {
            from: "clients",
            localField: "client_id",
            foreignField: "_id",
            as: "client"
          }
        },
        {
          $project: {
            id: "$_id",
            client_id: 1,
            client_name: { $arrayElemAt: ["$client.name", 0] },
            start_date: 1,
            end_date: 1,
            notes: 1
          }
        },
        { $sort: { start_date: -1 } }
      ])
      .toArray();
    res.json(rows);
  });

  app.post("/contracts", requireRole(...ADMIN_ROLES), async (req, res) => {
    const { client_id, start_date, end_date, notes } = req.body;
    if (!client_id || !start_date || !end_date) {
      return res.status(400).json({ message: "client_id, start_date and end_date are required." });
    }

    const contractsCollection = db.collection("contracts");
    const result = await contractsCollection.insertOne({
      client_id: new ObjectId(client_id),
      start_date,
      end_date,
      notes: notes || null
    });

    const row = await contractsCollection.findOne({ _id: result.insertedId });
    res.status(201).json(row);
  });

  app.listen(PORT, () => {
    console.log(`ICC backend running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});
