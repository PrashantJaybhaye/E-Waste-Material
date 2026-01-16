import { db } from "./dbConfig";
import { Notification, Reports, Rewards, Transaction, Users } from "./schema";
import { eq, sql, and, desc } from "drizzle-orm";

export async function createUser(email: string, name: string) {
    try {
        const [existingUser] = await db.select().from(Users).where(eq(Users.email, email)).execute();
        if (existingUser) {
            return existingUser;
        }
        const [user] = await db.insert(Users).values({
            email,
            name,
        }).returning().execute();
        return user;
    } catch (error) {
        console.error('Error creating user', error)
        return null;
    }
}

export async function getUserByEmail(email: string) {
    try {
        const [user] = await db.select().from(Users).where(eq(Users.email, email)).execute();
        return user;
    } catch (error) {
        console.error('Error fetching user by email', error)
        return null;
    }
}

export async function getUnreadNotifications(userId: number) {
    try {
        const notifications = await db.select().from(Notification).where(and(eq(Notification.userId, userId), eq(Notification.isRead, false))).execute();
        return notifications;
    } catch (error) {
        console.error('Error fetching unread notifications', error)
        return null;
    }
}

export async function getUserBalance(userId: number): Promise<number> {
    const transactions = await getRewardTransactions(userId) || [];

    if (!transactions) return 0;
    const balance = transactions.reduce((acc: number, transaction: any) => {
        return transaction.type.startsWith('earned') ? acc + transaction.amount : acc - transaction.amount;
    }, 0)
    return Math.max(balance, 0);
}

export async function getRewardTransactions(userId: number) {
    try {
        const transactions = await db.select({
            id: Transaction.id,
            type: Transaction.type,
            amount: Transaction.amount,
            description: Transaction.description,
            date: Transaction.date,
        }).from(Transaction).where(eq(Transaction.userId, userId)).orderBy(desc(Transaction.date)).limit(10).execute();

        const formattedTransactions = transactions.map(t => ({
            ...t,
            date: t.date.toISOString().split('T')[0], // YYYY-MM-DD
        }))

        return formattedTransactions;
    } catch (error) {
        console.error('Error fetching reward transactions', error)
        return null;
    }
}

export async function markNotificationAsRead(notificationId: number) {
    try {
        await db.update(Notification).set({ isRead: true }).where(eq(Notification.id, notificationId)).execute();
    } catch (error) {
        console.error('Error marking notification as read', error)
    }
}

export async function createReport(
    userId: number,
    location: string,
    wasteType: string,
    amount: string,
    imageUrl?: string,
    verificationResult?: any
) {
    try {
        const [report] = await db
            .insert(Reports)
            .values({
                userId,
                location,
                wasteType,
                amount,
                imageUrl,
                verificationResult,
                status: "pending",
            })
            .returning()
            .execute();

        // Award 10 points for reporting waste
        const pointsEarned = 10;
        await updateRewardPoints(userId, pointsEarned);

        // // Create a transaction for the earned points
        await createTransaction(userId, 'earned_report', pointsEarned, 'Points earned for reporting waste');

        // // Create a notification for the user
        await createNotification(
            userId,
            `You've earned ${pointsEarned} points for reporting waste!`,
            'reward'
        );

        return report;
    } catch (error) {
        console.error("Error creating report:", error);
        return null;
    }
}

export async function updateRewardPoints(userId: number, pointsToAdd: number) {
    try {
        const [updatedReward] = await db
            .update(Rewards)
            .set({
                points: sql`${Rewards.points} + ${pointsToAdd}`,
                updatedAt: new Date()
            })
            .where(eq(Rewards.userId, userId))
            .returning()
            .execute();
        return updatedReward;
    } catch (error) {
        console.error("Error updating reward points:", error);
        return null;
    }
}

export async function createTransaction(userId: number, type: 'earned_report' | 'earned_collect' | 'redeemed', amount: number, description: string) {
    try {
        const [transaction] = await db
            .insert(Transaction)
            .values({ userId, type, amount, description })
            .returning()
            .execute();
        return transaction;
    } catch (error) {
        console.error("Error creating transaction:", error);
        throw error;
    }
}

export async function createNotification(userId: number, message: string, type: string) {
    try {
        const [notification] = await db
            .insert(Notification)
            .values({ userId, message, title: type })
            .returning()
            .execute();
        return notification;
    } catch (error) {
        console.error("Error creating notification:", error);
        return null;
    }
}

export async function getRecentReports(limit: number = 10) {
    try {
        const reports = await db
            .select()
            .from(Reports)
            .orderBy(desc(Reports.createdAt))
            .limit(limit)
            .execute();
        return reports;
    } catch (error) {
        console.error("Error fetching recent reports:", error);
        return [];
    }
}

export async function getAvailableRewards(userId: number) {
    try {
        console.log('Fetching available rewards for user:', userId);

        // Get user's total points
        const userTransactions = (await getRewardTransactions(userId)) || [];
        const userPoints = userTransactions.reduce((total, transaction) => {
            return transaction.type.startsWith('earned') ? total + transaction.amount : total - transaction.amount;
        }, 0);

        console.log('User total points:', userPoints);

        // Get available rewards from the database
        const dbRewards = await db
            .select({
                id: Rewards.id,
                name: Rewards.name,
                cost: Rewards.points,
                description: Rewards.description,
                collectionInfo: Rewards.collectioninfo,
            })
            .from(Rewards)
            .where(eq(Rewards.isAvailable, true))
            .execute();

        console.log('Rewards from database:', dbRewards);

        // Combine user points and database rewards
        const allRewards = [
            {
                id: 0, // Use a special ID for user's points
                name: "Your Points",
                cost: userPoints,
                description: "Redeem your earned points",
                collectionInfo: "Points earned from reporting and collecting waste"
            },
            ...dbRewards
        ];

        console.log('All available rewards:', allRewards);
        return allRewards;
    } catch (error) {
        console.error("Error fetching available rewards:", error);
        return [];
    }
}