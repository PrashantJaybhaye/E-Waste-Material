'use server'

import { db } from "./dbConfig";
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    orderBy,
    limit,
    updateDoc,
    Timestamp,
    setDoc,
    increment,
    runTransaction,
    writeBatch
} from "firebase/firestore";

// Helper to serialize Firestore data to plain objects
const serializeDoc = (doc: any) => {
    if (!doc.exists()) return null;
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
        date: data.date instanceof Timestamp ? data.date.toDate() : data.date,
        collectionDate: data.collectionDate instanceof Timestamp ? data.collectionDate.toDate() : data.collectionDate,
    };
};

export async function createUser(email: string, name: string) {
    try {
        // Use a deterministic ID based on email to prevent duplicates
        // Note: encoding email to be safe as a doc ID
        const docId = email.replace(/[^a-zA-Z0-9]/g, '_');
        const userRef = doc(db, "users", docId);

        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
            return serializeDoc(userSnapshot);
        }

        const newUser = {
            email,
            name,
            createdAt: new Date(),
        };

        await setDoc(userRef, newUser);
        return { id: docId, ...newUser };
    } catch (error) {
        console.error('Error creating user', error);
        return null;
    }
}

export async function getUserByEmail(email: string) {
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            return serializeDoc(querySnapshot.docs[0]);
        }
        return null;
    } catch (error) {
        console.error('Error fetching user by email', error);
        return null;
    }
}

export async function getUnreadNotifications(userId: string) {
    try {
        const notificationsRef = collection(db, "notifications");
        const q = query(
            notificationsRef,
            where("userId", "==", userId),
            where("isRead", "==", false)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(serializeDoc);
    } catch (error) {
        console.error('Error fetching unread notifications', error);
        return null;
    }
}

export async function getUserBalance(userId: string): Promise<number> {
    try {
        const transactionsRef = collection(db, "transactions");
        const q = query(transactionsRef, where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        const balance = querySnapshot.docs.reduce((acc, doc) => {
            const data = doc.data();
            return data.type.startsWith('earned') ? acc + data.amount : acc - data.amount;
        }, 0);
        return Math.max(balance, 0);
    } catch (error) {
        console.error("Error getting user balance:", error, userId);
        return 0;
    }
}

export async function getRewardTransactions(userId: string) {
    try {
        const transactionsRef = collection(db, "transactions");
        const q = query(
            transactionsRef,
            where("userId", "==", userId),
            orderBy("date", "desc"),
            limit(10)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(serializeDoc).map((t: any) => {
            const date = t.date;
            let formattedDate = new Date().toISOString().split('T')[0]; // Default
            if (date instanceof Date && !isNaN(date.getTime())) {
                formattedDate = date.toISOString().split('T')[0];
            } else if (typeof date === 'string') {
                const parsed = new Date(date);
                if (!isNaN(parsed.getTime())) {
                    formattedDate = parsed.toISOString().split('T')[0];
                }
            }
            return {
                ...t,
                date: formattedDate
            };
        });
    } catch (error) {
        console.error('Error fetching reward transactions', error);
        return [];
    }
}

export async function markNotificationAsRead(notificationId: string) {
    try {
        const notificationRef = doc(db, "notifications", notificationId);
        await updateDoc(notificationRef, { isRead: true });
    } catch (error) {
        console.error('Error marking notification as read', error);
    }
}

export async function createReport(
    userId: string,
    location: string,
    wasteType: string,
    amount: string,
    imageUrl?: string,
    verificationResult?: any
) {
    try {
        const reportData = {
            userId,
            location,
            wasteType,
            amount,
            imageUrl: imageUrl || null,
            verificationResult: verificationResult || null,
            status: "pending",
            createdAt: new Date(),
        };

        const batch = writeBatch(db);

        // 1. Create Report
        const reportRef = doc(collection(db, "reports"));
        batch.set(reportRef, reportData);

        // 2. Update Reward Points (find existing or create new)
        const pointsEarned = 10;
        const rewardsRef = collection(db, "rewards");
        const q = query(rewardsRef, where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const rewardDoc = querySnapshot.docs[0];
            batch.update(rewardDoc.ref, {
                points: increment(pointsEarned),
                updatedAt: new Date()
            });
        } else {
            const newRewardRef = doc(collection(db, "rewards"));
            batch.set(newRewardRef, {
                userId,
                points: pointsEarned,
                updatedAt: new Date(),
                createdAt: new Date(),
                isAvailable: true,
                name: 'Waste Collection Reward',
                collectionInfo: 'Points earned from waste collection'
            });
        }

        // 3. Create Transaction
        const transactionRef = doc(collection(db, "transactions"));
        batch.set(transactionRef, {
            userId,
            type: 'earned_report',
            amount: pointsEarned,
            description: 'Points earned for reporting waste',
            date: new Date(),
        });

        // 4. Create Notification
        const notificationRef = doc(collection(db, "notifications"));
        batch.set(notificationRef, {
            userId,
            message: `You've earned ${pointsEarned} points for reporting waste!`,
            title: 'reward',
            isRead: false,
            createdAt: new Date(),
        });

        await batch.commit();

        return { id: reportRef.id, ...reportData };
    } catch (error) {
        console.error("Error creating report:", error);
        return null;
    }
}

export async function updateRewardPoints(userId: string, pointsToAdd: number) {
    try {
        const rewardsRef = collection(db, "rewards");
        const q = query(rewardsRef, where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const rewardDoc = querySnapshot.docs[0];
            await updateDoc(rewardDoc.ref, {
                points: increment(pointsToAdd),
                updatedAt: new Date()
            });
            // Fetch fresh data to ensure correct points return
            const updatedDoc = await getDoc(rewardDoc.ref);
            return serializeDoc(updatedDoc);
        } else {
            // Create new reward entry if not exists
            const newReward = {
                userId,
                points: pointsToAdd,
                updatedAt: new Date(),
                createdAt: new Date(),
                isAvailable: true,
                name: 'Waste Collection Reward', // accurate defaults?
                collectionInfo: 'Points earned from waste collection'
            };
            const newDocRef = await addDoc(rewardsRef, newReward);
            return { id: newDocRef.id, ...newReward };
        }
    } catch (error) {
        console.error("Error updating reward points:", error);
        return null;
    }
}

export async function createTransaction(userId: string, type: 'earned_report' | 'earned_collect' | 'redeemed', amount: number, description: string) {
    try {
        const transactionsRef = collection(db, "transactions");
        const transactionData = {
            userId,
            type,
            amount,
            description,
            date: new Date(),
        };
        const docRef = await addDoc(transactionsRef, transactionData);
        return { id: docRef.id, ...transactionData };
    } catch (error) {
        console.error("Error creating transaction:", error);
        throw error;
    }
}

export async function createNotification(userId: string, message: string, type: string) {
    try {
        const notificationsRef = collection(db, "notifications");
        const notificationData = {
            userId,
            message,
            title: type,
            isRead: false,
            createdAt: new Date(),
        };
        const docRef = await addDoc(notificationsRef, notificationData);
        return { id: docRef.id, ...notificationData };
    } catch (error) {
        console.error("Error creating notification:", error);
        return null;
    }
}

export async function getRecentReports(limitCount: number = 10) {
    try {
        const reportsRef = collection(db, "reports");
        const q = query(reportsRef, orderBy("createdAt", "desc"), limit(limitCount));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(serializeDoc);
    } catch (error) {
        console.error("Error fetching recent reports:", error);
        return [];
    }
}

export async function getAvailableRewards(userId: string) {
    try {
        // Get user's total points
        const transactionsRef = collection(db, "transactions");
        const qTransactions = query(transactionsRef, where("userId", "==", userId));
        const transactionSnapshot = await getDocs(qTransactions);

        const userPoints = transactionSnapshot.docs.reduce((total, doc) => {
            const t = doc.data();
            return t.type.startsWith('earned') ? total + t.amount : total - t.amount;
        }, 0);

        // Get available rewards
        // Note: Logic logic implies fetching "REDEEMABLE" items. 
        // Original code queried 'Rewards' table with isAvailable=true.
        const rewardsRef = collection(db, "rewards");
        const qRewards = query(rewardsRef, where("isAvailable", "==", true));
        const rewardSnapshot = await getDocs(qRewards);
        const dbRewards = rewardSnapshot.docs.map(serializeDoc) as any[];

        // Filter out the user's own reward balance entry usually?
        // But original code didn't filter.
        // We act as if 'rewards' collection contains items to redeem.

        const allRewards = [
            {
                id: "0", // Use a special ID for user's points display which we can keep as number 0 or string '0'
                name: "Your Points",
                cost: userPoints,
                description: "Redeem your earned points",
                collectionInfo: "Points earned from reporting and collecting waste"
            },
            ...dbRewards
        ];

        return allRewards;
    } catch (error) {
        console.error("Error fetching available rewards:", error);
        return [];
    }
}

export async function getWasteCollectionTasks(limitCount: number = 20) {
    try {
        // Original code:
        // .limit(limit)
        const reportsRef = collection(db, "reports");
        const q = query(reportsRef, orderBy("createdAt", "desc"), limit(limitCount));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(serializeDoc).map((task: any) => {
            const date = task.createdAt;
            let formattedDate = '';
            if (date instanceof Date && !isNaN(date.getTime())) {
                formattedDate = date.toISOString().split('T')[0];
            } else if (typeof date === 'string') {
                const parsed = new Date(date);
                if (!isNaN(parsed.getTime())) {
                    formattedDate = parsed.toISOString().split('T')[0];
                }
            }
            return {
                ...task,
                date: formattedDate
            };
        });
    } catch (error) {
        console.error("Error fetching waste collection tasks:", error);
        return [];
    }
}

export async function updateTaskStatus(reportId: string, newStatus: string, collectorId?: string) {
    try {
        const reportRef = doc(db, "reports", reportId);
        const updateData: any = { status: newStatus };
        if (collectorId !== undefined) {
            updateData.collectorId = collectorId;
        }
        await updateDoc(reportRef, updateData);
        const updatedReport = await getDoc(reportRef);
        return serializeDoc(updatedReport);
    } catch (error) {
        console.error("Error updating task status:", error);
        throw error;
    }
}

export async function saveReward(userId: string, amount: number) {
    try {
        const updatedReward = await updateRewardPoints(userId, amount);

        await createTransaction(userId, 'earned_collect', amount, 'Points earned for collecting waste');

        return updatedReward;
    } catch (error) {
        console.error("Error saving reward:", error);
        throw error;
    }
}

export async function saveCollectedWaste(reportId: string, collectorId: string, verificationResult: any) {
    try {
        const collectedWasteRef = collection(db, "collected_waste");
        const data = {
            reportId,
            collectorId,
            collectionDate: new Date(),
            status: 'verified',
            verificationResult,
        };
        const docRef = await addDoc(collectedWasteRef, data);
        return { id: docRef.id, ...data };
    } catch (error) {
        console.error("Error saving collected waste:", error);
        throw error;
    }
}

export async function redeemReward(userId: string, rewardId: string) {
    try {
        const userReward = await getOrCreateReward(userId) as any;

        if (rewardId === '0' || rewardId === 0 as any) {
            // Redeem all points
            const rewardRef = doc(db, "rewards", userReward.id);
            await updateDoc(rewardRef, {
                points: 0,
                updatedAt: new Date(),
            });

            await createTransaction(userId, 'redeemed', userReward.points, `Redeemed all points: ${userReward.points}`);

            return { ...userReward, points: 0 };
        } else {
            const rewardDoc = await getDoc(doc(db, "rewards", rewardId));
            const availableReward = serializeDoc(rewardDoc);

            if (!availableReward) throw new Error("Reward not found");

            // Use 'cost' if available, otherwise fallback to points (safeguard)
            // ensuring we process cost correctly
            const cost = availableReward.cost || availableReward.points || 0;

            if (!userReward || userReward.points < cost) {
                throw new Error("Insufficient points");
            }

            const rewardRef = doc(db, "rewards", userReward.id);
            await updateDoc(rewardRef, {
                points: increment(-cost),
                updatedAt: new Date(),
            });

            await createTransaction(userId, 'redeemed', cost, `Redeemed: ${availableReward.name}`);

            // Fresh read to return accurate state
            const updatedUserReward = await getDoc(rewardRef);
            return serializeDoc(updatedUserReward);
        }
    } catch (error) {
        console.error("Error redeeming reward:", error);
        throw error;
    }
}

export async function getOrCreateReward(userId: string) {
    try {
        const rewardsRef = collection(db, "rewards");
        const q = query(rewardsRef, where("userId", "==", userId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            return serializeDoc(querySnapshot.docs[0]);
        }

        const newReward = {
            userId,
            name: 'Default Reward',
            collectionInfo: 'Default Collection Info',
            points: 0,
            isAvailable: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const docRef = await addDoc(rewardsRef, newReward);
        return { id: docRef.id, ...newReward };
    } catch (error) {
        console.error("Error getting or creating reward:", error);
        return null;
    }
}

export async function getAllRewards() {
    try {
        const rewardsRef = collection(db, "rewards");
        const q = query(rewardsRef, orderBy("points", "desc"));
        const querySnapshot = await getDocs(q);

        const rewards = querySnapshot.docs.map(serializeDoc) as any[];

        // Filter for unique userIds from rewards
        const userIds = Array.from(new Set(rewards.map(r => r.userId))).filter(Boolean);

        const usersMap = new Map();

        // Fetch users in chunks (limit is usually 10 or 30 for 'in' queries)
        // Firestore limit for 'in' is 10.
        // Or 30? Docs says: "in" query supports up to 10 comparison values.

        if (userIds.length > 0) {
            const chunkSize = 10;
            for (let i = 0; i < userIds.length; i += chunkSize) {
                const chunk = userIds.slice(i, i + chunkSize);
                const usersRef = collection(db, "users");
                const qUsers = query(usersRef, where("__name__", "in", chunk)); // __name__ checks document ID.
                // Wait, are userIds the Document IDs?
                // In createUser, we now use custom ID = email (sanitized).
                // Or existing IDs?
                // If existing users have random IDs, and userId matches that ID, then `documentId()` or `__name__` is correct.
                // If userId is NOT the key, but a field, we should use where("id", "in", chunk) ?
                // Firestore document IDs ARE the keys. `serializeDoc` maps doc.id to `id`.
                // Assuming `reward.userId` points to `user.id` (document ID), then `where(documentId(), "in", chunk)` is correct.

                // Note: documentId() in modular SDK is `documentId()`. I didn't import `documentId`.
                // But `where(documentId(), ...)` needs `documentId` imported.
                // Alternatively, `where("__name__", ...)` works directly as string.

                try {
                    const usersSnapshot = await getDocs(qUsers);
                    usersSnapshot.docs.forEach(doc => {
                        usersMap.set(doc.id, doc.data().name);
                    });
                } catch (err) {
                    console.error("Error fetching users chunk", err);
                }
            }
        }

        return rewards.map(reward => {
            const userName = usersMap.get(reward.userId) || 'Unknown User';
            const level = Math.floor(reward.points / 20) + 1;
            return {
                ...reward,
                userName,
                level
            };
        });
    } catch (error) {
        console.error("Error fetching all rewards:", error);
        return [];
    }
}