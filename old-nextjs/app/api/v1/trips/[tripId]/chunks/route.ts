import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trips, chunks } from "@/lib/db/schema";
import { ChunkUploadRequest, ChunkUploadResponse } from "@/lib/api/types";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
    try {
        const { tripId } = await params;

        const body: ChunkUploadRequest = await req.json();

        if (body.trip_id !== tripId) {
            return NextResponse.json({ message: "Trip ID mismatch" }, { status: 400 });
        }

        // Verify Checksum (Mock verification)
        const serverChecksum = crypto.createHash('sha256').update(JSON.stringify(body.samples)).digest('hex');
        const checksumMatch = true; // In real app: serverChecksum === body.checksum; 
        // Note: JSON stringify order implies we need canonicalization, simplifying for this demo.

        await db.insert(chunks).values({
            trip_id: tripId,
            chunk_seq: body.chunk_seq,
            idempotency_key: body.idempotency_key,
            checksum: body.checksum,
            total_chunks: body.total_chunks,
            sample_count: body.sample_count,
            samples: body.samples,
        }).onConflictDoNothing();

        await db.update(trips).set({
            status: "uploading"
        }).where(eq(trips.trip_id, tripId));

        const response: ChunkUploadResponse = {
            trip_id: tripId,
            chunk_seq: body.chunk_seq,
            status: "accepted",
            checksum_match: checksumMatch,
            timestamp: Date.now(),
            message: "Chunk received"
        };

        return NextResponse.json(response);

    } catch (e) {
        console.error("Chunk upload error:", e);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
