export interface ProfileData {
    name: string;
    email: string;
    verifiedStudent: boolean;
    phone: string;
    bio: string;
    avatarUrl: string | null;
    favoritePickupPoints: string[];
    vehicles: VehicleData[];
    notifications: NotificationSettings;
}

export interface VehicleData {
    id: string;
    makeModel: string;
    color: string;
    plate: string;
}

export interface NotificationSettings {
    rideRequests: boolean;
    chatMessages: boolean;
    promotions: boolean;
}

export const MOCK_PROFILE: ProfileData = {
    name: "Alex Johnson",
    email: "alex.johnson@university.edu",
    verifiedStudent: true,
    phone: "+1 (555) 000-1234",
    bio: "Senior Architecture student looking for shared rides to South Campus on Tuesdays and Thursdays. Always have coffee!",
    avatarUrl: null,
    favoritePickupPoints: ["Student Union", "Science Hall North"],
    vehicles: [
        {
            id: "veh_1",
            makeModel: "Tesla Model 3",
            color: "Midnight Silver",
            plate: "XYZ-1234",
        },
    ],
    notifications: {
        rideRequests: true,
        chatMessages: true,
        promotions: false,
    },
};
