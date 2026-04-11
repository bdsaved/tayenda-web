import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trips, chunks } from "@/lib/db/schema";
import { FinalizeTripRequest, FinalizeTripResponse } from "@/lib/api/types";
import { eq, sql } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
    try {
        const { tripId } = await params;
        const body: FinalizeTripRequest = await req.json();

        if (body.trip_id !== tripId) {
            return NextResponse.json({ message: "Trip ID mismatch" }, { status: 400 });
        }

        // Count received chunks
        const result = await db.select({ count: sql<number>`count(*)` })
            .from(chunks)
            .where(eq(chunks.trip_id, tripId));

        const chunksReceived = Number(result[0].count);

        let status: "completed" | "failed" = "completed";
        let message = "Trip finalized successfully";

        if (chunksReceived !== body.total_chunks) {
            status = "failed";
            message = `Missing chunks. Expected ${body.total_chunks}, got ${chunksReceived}`;
        } else {
            await db.update(trips).set({ status: "completed" }).where(eq(trips.trip_id, tripId));
        }

        const response: FinalizeTripResponse = {
            trip_id: tripId,
            status: status,
            chunks_received: chunksReceived,
            chunks_expected: body.total_chunks,
            samples_received: body.total_samples, // Simplified
            message: message
        };

        return NextResponse.json(response);

    } catch (e) {
        console.error("Finalize error:", e);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
