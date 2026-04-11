import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";
import { DeviceRegistrationRequest, DeviceRegistrationResponse } from "@/lib/api/types";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
    try {
        const body: DeviceRegistrationRequest = await req.json();

        // Basic validation
        if (!body.hashed_device_id || !body.model) {
            return NextResponse.json({ message: "Invalid request" }, { status: 400 });
        }

        // Check if device exists
        const existingDevice = await db.select().from(devices).where(eq(devices.hashed_device_id, body.hashed_device_id)).limit(1);

        let userUuid: string;
        let apiKey = uuidv4(); // Generate a new API key

        if (existingDevice.length > 0) {
            userUuid = existingDevice[0].user_uuid;
            // Optionally update last seen or app version here
            // Update the API key for the existing device
            await db.update(devices).set({
                app_version: body.app_version,
                os_version: body.os_version,
                api_key: apiKey
            }).where(eq(devices.hashed_device_id, body.hashed_device_id));

        } else {
            userUuid = uuidv4();
            await db.insert(devices).values({
                hashed_device_id: body.hashed_device_id,
                model: body.model,
                os_version: body.os_version,
                app_version: body.app_version,
                user_uuid: userUuid,
                api_key: apiKey
            });
        }

        const response: DeviceRegistrationResponse = {
            user_uuid: userUuid,
            api_key: apiKey,
            status: "registered",
        };

        return NextResponse.json(response);
    } catch (e) {
        console.error("Registration error:", e);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
