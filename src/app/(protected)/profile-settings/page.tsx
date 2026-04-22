"use client";

import { useState, useCallback } from "react";
import { TopNav } from "../track/_components/TopNav";
import { ProfileHeader } from "./_components/ProfileHeader";
import { PersonalInfoCard } from "./_components/PersonalInfoCard";
import { AvatarCard } from "./_components/AvatarCard";
import { RidesharePreferencesCard } from "./_components/RidesharePreferencesCard";
import { AccountSecurityCard } from "./_components/AccountSecurityCard";
import { MOCK_PROFILE, type NotificationSettings } from "./mockData";

export default function ProfileSettingsPage() {
    // ── Editable state seeded from mock data ──
    const [name, setName] = useState(MOCK_PROFILE.name);
    const [phone, setPhone] = useState(MOCK_PROFILE.phone);
    const [bio, setBio] = useState(MOCK_PROFILE.bio);
    const [pickupPoints, setPickupPoints] = useState(MOCK_PROFILE.favoritePickupPoints);
    const [vehicles] = useState(MOCK_PROFILE.vehicles);
    const [notifications, setNotifications] = useState(MOCK_PROFILE.notifications);

    // ── Dirty tracking ──
    const isDirty =
        name !== MOCK_PROFILE.name ||
        phone !== MOCK_PROFILE.phone ||
        bio !== MOCK_PROFILE.bio ||
        pickupPoints.length !== MOCK_PROFILE.favoritePickupPoints.length ||
        notifications.rideRequests !== MOCK_PROFILE.notifications.rideRequests ||
        notifications.chatMessages !== MOCK_PROFILE.notifications.chatMessages ||
        notifications.promotions !== MOCK_PROFILE.notifications.promotions;

    // ── Handlers ──
    const handleSave = useCallback(() => {
        // Placeholder — will wire to API later
        alert("Changes saved! (mock)");
    }, []);

    const handleRemovePickup = useCallback((point: string) => {
        setPickupPoints((prev) => prev.filter((p) => p !== point));
    }, []);

    const handleAddPickup = useCallback(() => {
        const point = prompt("Enter pickup point name:");
        if (point?.trim()) {
            setPickupPoints((prev) => [...prev, point.trim()]);
        }
    }, []);

    const handleAddVehicle = useCallback(() => {
        alert("Add vehicle flow — coming soon!");
    }, []);

    const handleToggleNotification = useCallback((key: keyof NotificationSettings) => {
        setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F5F3EF] font-sans">
            <TopNav />

            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8 md:py-12">
                {/* Profile Header */}
                <ProfileHeader
                    name={name}
                    email={MOCK_PROFILE.email}
                    verifiedStudent={MOCK_PROFILE.verifiedStudent}
                    isDirty={isDirty}
                    onSave={handleSave}
                />

                {/* Top Row: Personal Info + Avatar */}
                <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                    <PersonalInfoCard
                        name={name}
                        phone={phone}
                        bio={bio}
                        onNameChange={setName}
                        onPhoneChange={setPhone}
                        onBioChange={setBio}
                    />
                    <AvatarCard
                        avatarUrl={MOCK_PROFILE.avatarUrl}
                        name={name}
                    />
                </div>

                {/* Bottom Row: Rideshare Preferences + Account Security */}
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                    <RidesharePreferencesCard
                        pickupPoints={pickupPoints}
                        vehicles={vehicles}
                        onRemovePickup={handleRemovePickup}
                        onAddPickup={handleAddPickup}
                        onAddVehicle={handleAddVehicle}
                    />
                    <AccountSecurityCard
                        notifications={notifications}
                        onToggleNotification={handleToggleNotification}
                    />
                </div>
            </main>
        </div>
    );
}
