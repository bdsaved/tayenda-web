"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UsersPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        full_name: "",
        role: "user",
        is_active: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch("/api/admin/users/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: "error", text: data.message || "Failed to create user" });
                setLoading(false);
                return;
            }

            setMessage({ type: "success", text: "User created successfully!" });
            setFormData({
                username: "",
                email: "",
                password: "",
                full_name: "",
                role: "user",
                is_active: true,
            });
            setLoading(false);
        } catch (error) {
            setMessage({ type: "error", text: "An error occurred. Please try again." });
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Users</h2>
                <p className="text-neutral-500">Manage dashboard users and access.</p>
            </div>

            <Card className="border-neutral-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5" />
                        Create New User
                    </CardTitle>
                    <CardDescription>
                        Add a new user to access the dashboard. Users can view data, admins can manage users.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="username">Username *</Label>
                                <Input
                                    id="username"
                                    required
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="johndoe"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="john@example.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="full_name">Full Name</Label>
                            <Input
                                id="full_name"
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password *</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                minLength={8}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="Minimum 8 characters"
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="role">Role *</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                                >
                                    <SelectTrigger id="role">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="is_active">Account Status</Label>
                                <div className="flex items-center space-x-2 pt-2">
                                    <Switch
                                        id="is_active"
                                        checked={formData.is_active}
                                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                    />
                                    <Label htmlFor="is_active" className="font-normal">
                                        {formData.is_active ? "Active" : "Inactive"}
                                    </Label>
                                </div>
                            </div>
                        </div>

                        {message && (
                            <div
                                className={`p-3 rounded-md text-sm ${message.type === "success"
                                        ? "bg-green-50 text-green-800 border border-green-200"
                                        : "bg-red-50 text-red-800 border border-red-200"
                                    }`}
                            >
                                {message.text}
                            </div>
                        )}

                        <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating User...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Create User
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-neutral-200 shadow-sm">
                <CardHeader>
                    <CardTitle>Setup Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-sm mb-2">First Time Setup</h4>
                        <p className="text-sm text-neutral-600">
                            Before creating users, make sure you've initialized the database:
                        </p>
                        <div className="bg-neutral-50 rounded-md p-3 mt-2 font-mono text-sm">
                            <div>pnpm db:push &nbsp;&nbsp;# Create tables</div>
                            <div>pnpm db:seed &nbsp;&nbsp;# Seed admin user</div>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm mb-2">Default Admin Credentials</h4>
                        <div className="text-sm text-neutral-600 space-y-1">
                            <div>Username: <span className="font-mono bg-neutral-100 px-1">rflmwcom</span></div>
                            <div>Password: <span className="font-mono bg-neutral-100 px-1">8-18Zfyd9;YYAe</span></div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
