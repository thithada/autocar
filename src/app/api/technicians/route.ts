// src/app/api/technicians/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const query = `
            SELECT 
                CAST(t.id AS CHAR) as id,
                t.name,
                t.position,
                t.status,
                u.email,
                u.phone,
                u.first_name,
                u.last_name
            FROM technicians t
            JOIN users u ON t.user_id = u.id
            WHERE t.status = 'active'
            ORDER BY t.name ASC
        `;

        const [rows] = await pool.execute(query);
        console.log('Fetched technicians:', rows);
        
        return NextResponse.json(rows);
    } catch (error) {
        console.error('Error fetching technicians:', error);
        return NextResponse.json(
            { error: 'Failed to fetch technicians' },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    let connection;
    try {
        const body = await req.json();
        const { userId, name, position } = body;

        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        // Convert userId to SERIAL type
        const userIdBigInt = BigInt(userId);

        // Check if user exists and is not already a technician
        const [existingTech] = await connection.execute(
            'SELECT id FROM technicians WHERE user_id = ?',
            [userIdBigInt]
        );

        if ((existingTech as any[]).length > 0) {
            return NextResponse.json(
                { error: 'User is already a technician' },
                { status: 400 }
            );
        }

        // Create technician
        const [result] = await connection.execute(
            `INSERT INTO technicians (user_id, name, position, status)
             VALUES (?, ?, ?, 'active')`,
            [userIdBigInt, name, position]
        );

        await connection.execute(
            'UPDATE users SET role = ? WHERE id = ?',
            ['technician', userIdBigInt]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            id: (result as any).insertId
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error creating technician:', error);
        return NextResponse.json(
            { error: 'Failed to create technician' },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}