import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import * as bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { username, email, password, full_name, role, is_active } = body;

        // Validation
        if (!username || !email || !password) {
            return NextResponse.json(
                { message: "Username, email, and password are required" },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { message: "Password must be at least 8 characters" },
                { status: 400 }
            );
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const [newUser] = await db
            .insert(users)
            .values({
                username,
                email,
                password_hash: passwordHash,
                full_name: full_name || null,
                role: role || "user",
                is_active: is_active !== undefined ? is_active : true,
            })
            .returning();

        return NextResponse.json({
            message: "User created successfully",
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
            },
        });
    } catch (e: any) {
        console.error("User creation error:", e);

        // Handle unique constraint violations
        if (e.code === '23505') {
            return NextResponse.json(
                { message: "Username or email already exists" },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { message: "Failed to create user" },
            { status: 500 }
        );
    }
}
