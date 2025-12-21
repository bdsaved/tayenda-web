export interface TripManifestDTO {
    trip_id: string; // UUID
    version: string; // App Version
    device_id: string; // Hashed Device ID
    mount_type?: string; // e.g., DASHBOARD
    vehicle_type?: string; // e.g., CAR
    road_surface?: string;
    sampling_profile?: string;
    start_time: number; // Unix timestamp (ms)
    end_time?: number; // Unix timestamp (ms)
    total_samples?: number;
    total_distance?: number;
    avg_speed?: number;
    mount_quality?: number;
    quality_flags?: {
        paused?: number;
        low_gps?: number;
        low_speed?: number;
        stationary?: number;
        [key: string]: number | undefined;
    };
}

export interface ManifestUploadResponse {
    trip_id: string;
    server_trip_id: string;
    timestamp: number;
    status: "accepted" | "rejected";
}

export interface ChunkUploadRequest {
    trip_id: string;
    chunk_seq: number;
    idempotency_key: string; // UUID
    checksum: string; // SHA-256 of samples
    total_chunks: number;
    sample_count: number;
    samples: Array<{
        ts: number;
        acc_device?: [number, number, number];
        gyro_device?: [number, number, number];
        acc_vehicle?: [number, number, number];
        gyro_vehicle?: [number, number, number];
        lat?: number;
        lon?: number;
        speed_mps?: number;
        gps_accuracy?: number;
        bearing?: number;
        flags?: number;
        [key: string]: any;
    }>;
}

export interface ChunkUploadResponse {
    trip_id: string;
    chunk_seq: number;
    status: "accepted" | "rejected";
    checksum_match: boolean;
    timestamp: number;
    message: string;
}

export interface FinalizeTripRequest {
    trip_id: string;
    total_chunks: number;
    total_samples: number;
}

export interface FinalizeTripResponse {
    trip_id: string;
    status: "completed" | "failed";
    chunks_received: number;
    chunks_expected: number;
    samples_received: number;
    message: string;
}

export interface DeviceRegistrationRequest {
    hashed_device_id: string;
    model: string;
    os_version: string;
    app_version: string;
}

export interface DeviceRegistrationResponse {
    user_uuid: string; // UUID
    api_key: string; // Dynamic API Key
    status: "registered";
}
