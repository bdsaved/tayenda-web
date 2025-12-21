"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Settings</h2>
                <p className="text-neutral-500">
                    Manage your account preferences and application settings.
                </p>
            </div>

            <div className="grid gap-6">
                {/* Organization Settings */}
                <Card className="border-neutral-200 shadow-sm">
                    <CardHeader>
                        <CardTitle>Organization Profile</CardTitle>
                        <CardDescription>
                            Update your organization details visible on reports.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="org-name">Organization Name</Label>
                            <Input id="org-name" defaultValue="Rflmwcom Renai Labs" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="contact-email">Contact Email</Label>
                            <Input id="contact-email" defaultValue="admin@tayenda.com" />
                        </div>
                        <div className="flex justify-end">
                            <Button>Save Changes</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* API Settings */}
                <Card className="border-neutral-200 shadow-sm">
                    <CardHeader>
                        <CardTitle>API Configuration</CardTitle>
                        <CardDescription>
                            Manage API keys and access tokens for your devices.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Public Registration</Label>
                                <p className="text-sm text-neutral-500">Allow new devices to self-register via the API.</p>
                            </div>
                            <Switch defaultChecked />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <Label>Master API Key</Label>
                            <div className="flex gap-2">
                                <Input readOnly value="sk_live_51Mz...Xy9z" className="font-mono bg-neutral-50" />
                                <Button variant="outline">Copy</Button>
                            </div>
                            <p className="text-xs text-neutral-500">Keep this key secret. It allows full access to the API.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Notification Settings */}
                <Card className="border-neutral-200 shadow-sm">
                    <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                        <CardDescription>Configure how you receive alerts.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="email-alerts" className="flex flex-col space-y-1">
                                <span>Email Alerts</span>
                                <span className="font-normal text-xs text-neutral-500">Receive emails for critical system issues.</span>
                            </Label>
                            <Switch id="email-alerts" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="trip-complete" className="flex flex-col space-y-1">
                                <span>Trip Completion</span>
                                <span className="font-normal text-xs text-neutral-500">Get notified when a trip upload completes.</span>
                            </Label>
                            <Switch id="trip-complete" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
