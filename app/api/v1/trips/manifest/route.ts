import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trips } from "@/lib/db/schema";
import { TripManifestDTO, ManifestUploadResponse } from "@/lib/api/types";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
    try {
        const body: TripManifestDTO = await req.json();

        // Validation
        if (!body.trip_id || !body.device_id) {
            return NextResponse.json({ message: "Invalid manifest" }, { status: 400 });
        }

        // Check for existing trip (idempotency)
        // For simplicity, we assume if ID exists, we just update or ignore.
        const tripId = body.trip_id; // Client's UUID

        await db.insert(trips).values({
            trip_id: tripId,
            version: body.version,
            device_id: body.device_id,
            mount_type: body.mount_type,
            vehicle_type: body.vehicle_type,
            road_surface: body.road_surface,
            sampling_profile: body.sampling_profile,
            start_time: new Date(body.start_time),
            end_time: body.end_time ? new Date(body.end_time) : null,
            total_samples: body.total_samples,
            total_distance: body.total_distance,
            avg_speed: body.avg_speed,
            mount_quality: body.mount_quality,
            quality_flags: body.quality_flags,
            status: "started"
        }).onConflictDoNothing(); // If trip exists, do nothing

        const response: ManifestUploadResponse = {
            trip_id: tripId,
            server_trip_id: tripId,
            timestamp: Date.now(),
            status: "accepted"
        };

        return NextResponse.json(response);
    } catch (e) {
        console.error("Manifest error:", e);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
