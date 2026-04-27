"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";

interface AvatarCardProps {
    avatarUrl: string | null;
    name: string;
}

export function AvatarCard({ avatarUrl, name }: AvatarCardProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(avatarUrl);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setPreview(url);
    }

    const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
        <article className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-zinc-100/50 p-8 shadow-sm">
            {/* Avatar */}
            <div className="relative">
                <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-emerald-100 shadow-lg">
                    {preview ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={preview}
                            alt={name}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <span className="text-3xl font-bold text-emerald-700">
                            {initials}
                        </span>
                    )}
                </div>

                {/* Camera overlay */}
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-md transition hover:bg-emerald-700 active:scale-95"
                    aria-label="Upload avatar photo"
                >
                    <Camera size={16} />
                </button>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            <h3 className="mt-5 text-lg font-bold text-zinc-900">Avatar Photo</h3>
            <p className="mt-1 text-center text-sm leading-relaxed text-zinc-500">
                Upload a clear photo so your drivers and passengers can identify you.
            </p>
        </article>
    );
}
