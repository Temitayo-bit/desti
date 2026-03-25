"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ProfilePictureUploadProps {
    currentUrl: string | null;
}

export function ProfilePictureUpload({ currentUrl }: ProfilePictureUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const router = useRouter();

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            setUploading(true);
            const res = await fetch("/api/user/profile-picture", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                alert(data?.message ?? "Failed to upload photo.");
                return;
            }

            router.refresh();
        } catch {
            alert("An error occurred while uploading your photo.");
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    return (
        <div className="mt-4">
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
            />
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="text-sm font-medium text-emerald-700 hover:text-emerald-900 transition-colors disabled:opacity-50"
            >
                {uploading
                    ? "Uploading..."
                    : currentUrl
                      ? "Change photo"
                      : "Upload photo"}
            </button>
        </div>
    );
}
