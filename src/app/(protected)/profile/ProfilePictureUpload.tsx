"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ProfilePictureUploadProps {
    currentUrl: string | null;
}

export function ProfilePictureUpload({ currentUrl }: ProfilePictureUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const router = useRouter();

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            setUploading(true);
            setUploadError(null);
            const res = await fetch("/api/user/profile-picture", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setUploadError(data?.message ?? "Failed to upload photo.");
                return;
            }

            setUploadError(null);
            router.refresh();
        } catch {
            setUploadError("An error occurred while uploading your photo.");
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
            {uploadError ? (
                <div
                    role="alert"
                    className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700"
                >
                    {uploadError}
                </div>
            ) : null}
        </div>
    );
}
