import Image from "next/image";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface UserAvatarProps {
    src?: string | null;
    name?: string | null;
    size?: AvatarSize;
    className?: string;
}

const sizeMap: Record<AvatarSize, { container: string; text: string; px: number }> = {
    sm: { container: "h-8 w-8", text: "text-xs", px: 32 },
    md: { container: "h-10 w-10", text: "text-sm", px: 40 },
    lg: { container: "h-16 w-16", text: "text-xl", px: 64 },
    xl: { container: "h-24 w-24", text: "text-3xl", px: 96 },
};

function getInitial(name: string | null | undefined): string {
    const source = name?.trim();
    if (source && source.length > 0) {
        return source.charAt(0).toUpperCase();
    }
    return "D";
}

export function UserAvatar({ src, name, size = "md", className = "" }: UserAvatarProps) {
    const { container, text, px } = sizeMap[size];
    const normalizedSrc = src?.trim() || null;

    if (normalizedSrc) {
        return (
            <Image
                src={normalizedSrc}
                alt={name?.trim() || "User avatar"}
                width={px}
                height={px}
                className={`${container} rounded-full object-cover ${className}`}
            />
        );
    }

    return (
        <div
            className={`${container} flex shrink-0 items-center justify-center rounded-full bg-emerald-800 font-bold text-white ${text} ${className}`}
        >
            {getInitial(name)}
        </div>
    );
}
