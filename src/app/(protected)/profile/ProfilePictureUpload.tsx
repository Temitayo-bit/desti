"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { invalidateDestiProfileCache } from "@/hooks/use-desti-profile";

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

            invalidateDestiProfileCache();
            router.refresh();
        } catch {
            alert("An error occurred while uploading your photo.");
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    return (
        <div className="mt-1">
            {/* Camera-only capture: accept image/*, capture forces device camera */}
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
            />
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-900 disabled:opacity-50"
            >
                <Camera className="h-4 w-4" strokeWidth={2} />
                {uploading ? "Uploading..." : currentUrl ? "Retake photo" : "Take photo"}
            </button>
        </div>
    );
}

