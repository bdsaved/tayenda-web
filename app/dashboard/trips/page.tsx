"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Download } from "lucide-react";

// Mock data for initial view (will be replaced by DB fetch in real implementation)
const mockTrips = [
    {
        trip_id: "t_123456789",
        device_id: "d_pixel7_01",
        start_time: 1716234000000,
        vehicle_type: "CAR",
        total_distance: 12.5,
        status: "completed",
        chunks_received: 10,
        total_chunks: 10,
    },
    {
        trip_id: "t_987654321",
        device_id: "d_s23_02",
        start_time: 1716240000000,
        vehicle_type: "BUS",
        total_distance: 4.2,
        status: "uploading",
        chunks_received: 3,
        total_chunks: 15,
    },
    {
        trip_id: "t_567890123",
        device_id: "d_pixel6_03",
        start_time: 1716243600000,
        vehicle_type: "CAR",
        total_distance: 0,
        status: "started",
        chunks_received: 0,
        total_chunks: 0,
    },
];

export default function TripsPage() {
    const [searchTerm, setSearchTerm] = useState("");

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed":
                return "bg-green-100 text-green-800 hover:bg-green-100";
            case "uploading":
                return "bg-blue-100 text-blue-800 hover:bg-blue-100";
            case "started":
                return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
            default:
                return "bg-gray-100 text-gray-800 hover:bg-gray-100";
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Trips</h2>
                    <p className="text-neutral-500">
                        Monitor and manage vehicle trip uploads.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2">
                        <Download className="w-4 h-4" />
                        Export
                    </Button>
                </div>
            </div>

            <Card className="border-neutral-200 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle>All Trips</CardTitle>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                                <Input
                                    placeholder="Search trip or device..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="icon">
                                <Filter className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-neutral-200">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-neutral-50">
                                    <TableHead>Trip ID</TableHead>
                                    <TableHead>Device</TableHead>
                                    <TableHead>Start Time</TableHead>
                                    <TableHead>Vehicle</TableHead>
                                    <TableHead>Progress</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mockTrips.map((trip) => (
                                    <TableRow key={trip.trip_id}>
                                        <TableCell className="font-mono text-xs">{trip.trip_id}</TableCell>
                                        <TableCell className="text-sm">{trip.device_id}</TableCell>
                                        <TableCell className="text-sm text-neutral-600">
                                            {format(new Date(trip.start_time), "MMM d, yyyy HH:mm")}
                                        </TableCell>
                                        <TableCell className="text-sm">{trip.vehicle_type}</TableCell>
                                        <TableCell className="text-sm">
                                            {trip.status === "completed" ? (
                                                <span className="text-green-600 font-medium">100%</span>
                                            ) : (
                                                <span className="text-neutral-500">
                                                    {trip.chunks_received} / {trip.total_chunks > 0 ? trip.total_chunks : "?"} chunks
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`border-0 ${getStatusColor(trip.status)}`}>
                                                {trip.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
