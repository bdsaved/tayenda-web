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
import { Search, Smartphone, MoreHorizontal } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data
const mockDevices = [
    {
        hashed_device_id: "7f83b165...a1b2",
        model: "Google Pixel 7",
        os_version: "Android 14",
        app_version: "1.0.2",
        last_seen: 1716234000000,
        status: "active",
    },
    {
        hashed_device_id: "3c91a422...c3d4",
        model: "Samsung Galaxy S23",
        os_version: "Android 13",
        app_version: "1.0.1",
        last_seen: 1715900000000,
        status: "inactive",
    },
    {
        hashed_device_id: "9e28f511...e5f6",
        model: "Google Pixel 6a",
        os_version: "Android 14",
        app_version: "1.0.2",
        last_seen: 1716244000000,
        status: "active",
    },
];

export default function DevicesPage() {
    const [searchTerm, setSearchTerm] = useState("");

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Devices</h2>
                    <p className="text-neutral-500">
                        Manage registered collection devices.
                    </p>
                </div>
                <Button className="bg-primary hover:bg-primary/90">
                    <Smartphone className="w-4 h-4 mr-2" />
                    Register New Device
                </Button>
            </div>

            <Card className="border-neutral-200 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle>Registered Devices</CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                            <Input
                                placeholder="Search devices..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-neutral-200">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-neutral-50">
                                    <TableHead>Model</TableHead>
                                    <TableHead>OS Version</TableHead>
                                    <TableHead>App Version</TableHead>
                                    <TableHead>Last Seen</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mockDevices.map((device) => (
                                    <TableRow key={device.hashed_device_id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Smartphone className="w-4 h-4 text-neutral-400" />
                                                {device.model}
                                            </div>
                                        </TableCell>
                                        <TableCell>{device.os_version}</TableCell>
                                        <TableCell>v{device.app_version}</TableCell>
                                        <TableCell className="text-neutral-600">
                                            {format(new Date(device.last_seen), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={device.status === "active" ? "default" : "secondary"}
                                                className={device.status === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-gray-100 text-gray-800"}>
                                                {device.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem>View Details</DropdownMenuItem>
                                                    <DropdownMenuItem>View Trips</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-red-600">Revoke Access</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
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
