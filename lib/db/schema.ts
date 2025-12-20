import { pgTable, text, timestamp, doublePrecision, integer, jsonb, uuid, boolean } from "drizzle-orm/pg-core";

export const devices = pgTable("devices", {
  hashed_device_id: text("hashed_device_id").primaryKey(),
  model: text("model").notNull(),
  os_version: text("os_version").notNull(),
  app_version: text("app_version").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  user_uuid: uuid("user_uuid").defaultRandom().notNull(), // Generated UUID for the user associated with this device
});

export const trips = pgTable("trips", {
  trip_id: uuid("trip_id").primaryKey(),
  version: text("version").notNull(),
  device_id: text("device_id").references(() => devices.hashed_device_id).notNull(),
  mount_type: text("mount_type"),
  vehicle_type: text("vehicle_type"),
  road_surface: text("road_surface"),
  sampling_profile: text("sampling_profile"),
  start_time: timestamp("start_time").notNull(),
  end_time: timestamp("end_time"),
  total_samples: integer("total_samples"),
  total_distance: doublePrecision("total_distance"),
  avg_speed: doublePrecision("avg_speed"),
  mount_quality: doublePrecision("mount_quality"),
  quality_flags: jsonb("quality_flags"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  status: text("status").default("started").notNull(), // started, finalization_requested, completed
});

export const chunks = pgTable("chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  trip_id: uuid("trip_id").references(() => trips.trip_id).notNull(),
  chunk_seq: integer("chunk_seq").notNull(),
  idempotency_key: text("idempotency_key").notNull(),
  checksum: text("checksum").notNull(),
  total_chunks: integer("total_chunks").notNull(),
  sample_count: integer("sample_count").notNull(),
  samples: jsonb("samples").notNull(), // Storing samples as JSONB for now
  created_at: timestamp("created_at").defaultNow().notNull(),
});
