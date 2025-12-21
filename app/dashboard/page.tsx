"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Activity, Map, Smartphone, AlertTriangle } from "lucide-react";

const stats = [
    {
        title: "Total Trips",
        value: "1,284",
        change: "+12% from last month",
        icon: Map,
        color: "text-blue-500",
    },
    {
        title: "Active Devices",
        value: "42",
        change: "+3 new devices",
        icon: Smartphone,
        color: "text-green-500",
    },
    {
        title: "Distance Covered",
        value: "12,450 km",
        change: "+8.5% this week",
        icon: Activity,
        color: "text-purple-500",
    },
    {
        title: "Issues Detected",
        value: "7",
        change: "-2 from yesterday",
        icon: AlertTriangle,
        color: "text-yellow-500",
    },
];

export default function DashboardPage() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Overview</h2>
                <p className="text-neutral-500">
                    Real-time insights from SurfaceDoctor fleet.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title} className="border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-neutral-600">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className={`h-4 w-4 ${stat.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
                            <p className="text-xs text-neutral-500 mt-1">{stat.change}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 border-neutral-200 shadow-sm">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] flex items-center justify-center bg-neutral-50 rounded-md border border-dashed border-neutral-200">
                            <p className="text-neutral-400">Activity Chart Placeholder</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3 border-neutral-200 shadow-sm">
                    <CardHeader>
                        <CardTitle>Fleet Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((_, i) => (
                                <div key={i} className="flex items-center">
                                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium leading-none">Vehicle #{100 + i}</p>
                                        <p className="text-xs text-muted-foreground">Uploading chunk {i + 1}/10</p>
                                    </div>
                                    <div className="text-xs text-neutral-500 font-medium">Just now</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
